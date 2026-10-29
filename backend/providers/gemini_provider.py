"""gemini_provider.py - Google Gemini API client wrapper.
TODO: send a prompt using the key from config.py and return text, token usage and latency.
Check the provider docs for current model names, limits and pricing."""

"""
providers/gemini_provider.py - adapter for the Google Gemini API (REST).

VERIFIED AGAINST (2026-10-29)
    * Endpoint : POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
    * Auth     : header "x-goog-api-key: <key>"  (the key is NOT put in the URL)
    * Usage    : response["usageMetadata"] has promptTokenCount, candidatesTokenCount,
                 thoughtsTokenCount (hidden thinking), totalTokenCount.
    * Billing  : thinking tokens are billed at the OUTPUT price, so we add
                 thoughtsTokenCount to output_tokens.
    * Free tier: exists for some Flash models but is rate limited and the limits
                 change - see Google AI Studio for your project's limits.
    We use plain `requests` (not the Google SDK) so you can see exactly what is
    sent and received.

HOW TO MODIFY
    * Different generation settings -> edit `body["generationConfig"]`.
    * New field from the API         -> read it in _parse_success().
"""
import re
import time
from typing import Optional

import requests

from .base import BaseProvider, ProviderResult, estimate_tokens, safe_error_text

API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"

# finishReason values that mean Gemini's own safety system stopped the answer.
BLOCK_FINISH_REASONS = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"}


class GeminiProvider(BaseProvider):
    name = "gemini"

    def generate(self, prompt, model_id, timeout_seconds=60, max_output_tokens=1024,
                 temperature: Optional[float] = None, context=None) -> ProviderResult:
        result = ProviderResult(provider=self.name, model=model_id)
        if not self._api_key:
            result.error_code = "missing_api_key"
            result.error_message = "GEMINI_API_KEY is not set in backend/.env"
            return result

        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": int(max_output_tokens)},
        }
        # Only send temperature if the user chose one. Some newer Gemini models
        # work best with the default, so we do not force a value.
        if temperature is not None:
            body["generationConfig"]["temperature"] = float(temperature)

        headers = {"x-goog-api-key": self._api_key, "Content-Type": "application/json"}
        url = f"{API_ROOT}/{model_id}:generateContent"

        started = time.perf_counter()
        try:
            response = requests.post(url, json=body, headers=headers, timeout=(5, timeout_seconds))
        except requests.exceptions.Timeout:
            result.latency_seconds = time.perf_counter() - started
            result.error_code, result.retryable = "timeout", True
            result.error_message = f"No answer within {timeout_seconds} seconds"
            return result
        except requests.exceptions.RequestException as exc:
            result.latency_seconds = time.perf_counter() - started
            result.error_code, result.retryable = "network_error", True
            result.error_message = safe_error_text(type(exc).__name__)
            return result
        result.latency_seconds = time.perf_counter() - started

        if response.status_code != 200:
            return self._parse_error(response, result)
        return self._parse_success(response, prompt, result)

    # ------------------------------------------------------------------
    @staticmethod
    def _parse_error(response, result: ProviderResult) -> ProviderResult:
        """Turn an HTTP error into a normalised failure."""
        status = response.status_code
        message = ""
        try:
            message = response.json().get("error", {}).get("message", "")
        except ValueError:
            message = response.text
        result.error_message = safe_error_text(message) or f"HTTP {status}"
        if status == 429:
            result.error_code, result.retryable = "rate_limited", True
            result.retry_after = _retry_after_seconds(response, message)
        elif status >= 500:
            result.error_code, result.retryable = "server_error", True
        elif status in (401, 403):
            result.error_code = "auth_error"
        elif status == 404:
            result.error_code = "model_not_found"
        else:
            result.error_code = "bad_request"
        return result

    @staticmethod
    def _parse_success(response, prompt: str, result: ProviderResult) -> ProviderResult:
        try:
            data = response.json()
        except ValueError:
            result.error_code, result.error_message = "invalid_response", "Response was not JSON"
            return result

        # 1) Prompt blocked before any answer was produced.
        block_reason = (data.get("promptFeedback") or {}).get("blockReason")
        candidates = data.get("candidates") or []
        text, finish = "", None
        if candidates:
            cand = candidates[0]
            finish = cand.get("finishReason")
            parts = (cand.get("content") or {}).get("parts") or []
            # Join only visible text parts (thought summaries are flagged with "thought": true).
            text = "".join(p.get("text", "") for p in parts if not p.get("thought"))

        if block_reason:
            result.blocked, finish = True, f"PROMPT_BLOCKED:{block_reason}"
        elif finish in BLOCK_FINISH_REASONS:
            result.blocked = True

        # 2) Token usage - prefer provider numbers.
        usage = data.get("usageMetadata") or {}
        if "promptTokenCount" in usage:
            visible = int(usage.get("candidatesTokenCount") or 0)
            thinking = int(usage.get("thoughtsTokenCount") or 0)
            result.input_tokens = int(usage["promptTokenCount"])
            result.output_tokens = visible + thinking     # thinking is billed as output
            result.total_tokens = int(usage.get("totalTokenCount") or (result.input_tokens + result.output_tokens))
            result.token_source = "provider_reported"
        else:
            result.input_tokens = estimate_tokens(prompt)
            result.output_tokens = estimate_tokens(text)
            result.total_tokens = result.input_tokens + result.output_tokens
            result.token_source = "estimated_chars_div_4"
        result.provider_usage_metadata = {
            k: usage[k] for k in ("promptTokenCount", "candidatesTokenCount", "thoughtsTokenCount",
                                  "cachedContentTokenCount", "totalTokenCount") if k in usage}

        result.response_text = text
        result.finish_reason = finish
        result.success = True
        return result


def _retry_after_seconds(response, message: str) -> Optional[float]:
    """Read the wait time suggested by the API (header or 'retry in 11.8s' text)."""
    header = response.headers.get("Retry-After") if getattr(response, "headers", None) else None
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    match = re.search(r"retry in ([0-9.]+)s", message or "", flags=re.IGNORECASE)
    return float(match.group(1)) if match else None