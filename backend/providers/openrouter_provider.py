"""openrouter_provider.py - OpenRouter API client wrapper.
TODO: send a prompt using the key from config.py and return text, token usage and latency.
Check the provider docs for current model names, availability and pricing."""

"""
providers/openrouter_provider.py - adapter for OpenRouter (OpenAI-style chat API).

VERIFIED AGAINST (2026-10-29)
    * Endpoint : POST https://openrouter.ai/api/v1/chat/completions
    * Auth     : header "Authorization: Bearer <key>"
    * Usage    : response["usage"] = prompt_tokens, completion_tokens, total_tokens,
                 and "cost" (credits charged, 1 credit = 1 USD). Token counts use
                 the model's native tokenizer.
    * Free models: model ids ending in ":free". Limits (docs, checked 2026-10-29):
                 20 requests/minute, and 50 requests/DAY until you have bought
                 10 USD of credits (then 1000/day). Limits are per ACCOUNT, not per
                 model. Availability of free models changes - verify the model id
                 on openrouter.ai/models before a demo.

HOW TO MODIFY
    * Add provider routing options -> add keys to `body`.
    * Read another usage field     -> edit _parse_success().
"""
import time
from typing import Optional

import requests

from .base import BaseProvider, ProviderResult, estimate_tokens, safe_error_text

API_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterProvider(BaseProvider):
    name = "openrouter"

    def generate(self, prompt, model_id, timeout_seconds=60, max_output_tokens=1024,
                 temperature: Optional[float] = None, context=None) -> ProviderResult:
        result = ProviderResult(provider=self.name, model=model_id)
        if not self._api_key:
            result.error_code = "missing_api_key"
            result.error_message = "OPENROUTER_API_KEY is not set in backend/.env"
            return result

        body = {
            "model": model_id,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": int(max_output_tokens),
            "usage": {"include": True},     # ask for token + cost accounting
        }
        if temperature is not None:
            body["temperature"] = float(temperature)
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "X-Title": "Bhasha Kar benchmark",   # optional app name shown in OpenRouter dashboards
        }

        started = time.perf_counter()
        try:
            response = requests.post(API_URL, json=body, headers=headers, timeout=(5, timeout_seconds))
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
        status = response.status_code
        message = ""
        try:
            err = response.json().get("error", {})
            message = err.get("message", "") if isinstance(err, dict) else str(err)
        except ValueError:
            message = response.text
        result.error_message = safe_error_text(message) or f"HTTP {status}"
        if status == 429:
            result.error_code, result.retryable = "rate_limited", True
            try:
                result.retry_after = float(response.headers.get("Retry-After", ""))
            except (ValueError, TypeError):
                result.retry_after = None
        elif status == 402:
            result.error_code = "insufficient_credits"   # also happens for free models if balance is negative
        elif status in (401, 403):
            result.error_code = "auth_error"
        elif status == 404:
            result.error_code = "model_not_found"
        elif status in (408, 502, 503, 504) or status >= 500:
            result.error_code, result.retryable = "server_error", True
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

        # OpenRouter can return HTTP 200 with an "error" object (upstream provider failed).
        if data.get("error") and not data.get("choices"):
            err = data["error"]
            result.error_code = "upstream_error"
            result.error_message = safe_error_text(err.get("message", "") if isinstance(err, dict) else str(err))
            result.retryable = True
            return result

        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        text = message.get("content") or ""   # content can be null for reasoning-only replies
        finish = choice.get("finish_reason")
        if finish == "content_filter":
            result.blocked = True

        usage = data.get("usage") or {}
        if "prompt_tokens" in usage and "completion_tokens" in usage:
            result.input_tokens = int(usage["prompt_tokens"])
            result.output_tokens = int(usage["completion_tokens"])
            result.total_tokens = int(usage.get("total_tokens") or (result.input_tokens + result.output_tokens))
            result.token_source = "provider_reported"
        else:
            result.input_tokens = estimate_tokens(prompt)
            result.output_tokens = estimate_tokens(text)
            result.total_tokens = result.input_tokens + result.output_tokens
            result.token_source = "estimated_chars_div_4"

        cost = usage.get("cost")
        if isinstance(cost, (int, float)):
            result.actual_charge_usd = float(cost)     # real charge reported by OpenRouter
        details = usage.get("completion_tokens_details") or {}
        result.provider_usage_metadata = {
            k: v for k, v in {
                "prompt_tokens": usage.get("prompt_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "reasoning_tokens": details.get("reasoning_tokens"),
                "cost": cost,
                "upstream_model": data.get("model"),
            }.items() if v is not None}

        result.response_text = text
        result.finish_reason = finish
        result.success = True
        return result