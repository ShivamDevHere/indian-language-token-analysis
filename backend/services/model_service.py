"""model_service.py - picks a provider and calls a model.
TODO: map a model id from the UI to gemini_provider or openrouter_provider,
and return a normalized {text, input_tokens, output_tokens, latency_ms} dict."""

"""
services/model_service.py - the ONE place that calls an AI model.

WHAT IT ADDS ON TOP OF THE PROVIDER ADAPTERS
    1. Rate limiting : a minimum gap between calls to the same provider, so a
       benchmark does not burn through free-tier requests-per-minute limits.
    2. Controlled retries : temporary errors (HTTP 429, 5xx, timeout, network)
       are retried a LIMITED number of times (settings.max_retries) with a wait
       between attempts. Permanent errors (bad key, unknown model) are never
       retried. We never retry forever.
    3. A single, provider-independent function: call_model().

INPUT  : a model row (dict from repository.list_models), the prompt, settings.
OUTPUT : ProviderResult (never raises for normal API problems).

PRIVACY : prompts and API keys are never logged here.

HOW TO MODIFY
    * Wait longer between retries -> edit _backoff_seconds().
    * Add a provider-specific rule -> add it in the provider adapter, not here.
"""
import threading
import time
from typing import Callable, Dict, Optional, Tuple

from providers import ProviderResult, get_provider

MAX_WAIT_SECONDS = 30   # never sleep longer than this between retries


class RateLimiter:
    """Allow at most `requests_per_minute` call STARTS (thread-safe)."""

    def __init__(self, requests_per_minute: float):
        self.min_interval = 60.0 / max(requests_per_minute, 0.1)
        self._next_slot = 0.0
        self._lock = threading.Lock()

    def wait(self, sleep_fn: Callable[[float], None] = time.sleep) -> None:
        with self._lock:                       # reserve the next time slot...
            now = time.monotonic()
            slot = max(now, self._next_slot)
            self._next_slot = slot + self.min_interval
        if slot > now:                         # ...and sleep outside the lock
            sleep_fn(slot - now)


_limiters: Dict[str, Tuple[float, RateLimiter]] = {}
_limiters_lock = threading.Lock()


def _get_limiter(provider: str, rpm: float) -> RateLimiter:
    """One limiter per provider; rebuilt when the user changes the rpm setting."""
    with _limiters_lock:
        current = _limiters.get(provider)
        if current is None or current[0] != rpm:
            current = (rpm, RateLimiter(rpm))
            _limiters[provider] = current
        return current[1]


def _backoff_seconds(attempt: int, retry_after: Optional[float]) -> float:
    """Seconds to wait before retry number `attempt` (0-based)."""
    if retry_after is not None:
        return min(max(retry_after, 0.0) + 0.5, MAX_WAIT_SECONDS)
    return min(2.0 ** attempt, MAX_WAIT_SECONDS)   # 1s, 2s, 4s ...


def call_model(model_row: dict, prompt: str, settings: dict, context: Optional[dict] = None,
               sleep_fn: Callable[[float], None] = time.sleep) -> ProviderResult:
    """Send `prompt` to one model with rate limiting and limited retries.

    model_row : dict with at least 'provider' and 'model_id'
    settings  : output of settings_service.get_settings()
    context   : extra info only the demo provider uses
    sleep_fn  : replaceable in tests so they do not really wait
    """
    provider_name = model_row["provider"]
    try:
        provider = get_provider(provider_name)
    except ValueError as exc:
        return ProviderResult(provider=provider_name, model=model_row["model_id"],
                              error_code="unknown_provider", error_message=str(exc))

    max_retries = int(settings.get("max_retries", 2))
    limiter = None
    if provider_name != "demo":   # no waiting for synthetic calls
        rpm = settings.get("requests_per_minute", {}).get(provider_name, 10)
        limiter = _get_limiter(provider_name, rpm)

    attempt = 0
    while True:
        if limiter:
            limiter.wait(sleep_fn)
        result = provider.generate(
            prompt, model_row["model_id"],
            timeout_seconds=settings.get("timeout_seconds", 60),
            max_output_tokens=settings.get("max_output_tokens", 1024),
            temperature=settings.get("temperature"),
            context=context)
        result.attempts = attempt + 1
        if result.success or not result.retryable or attempt >= max_retries:
            return result
        sleep_fn(_backoff_seconds(attempt, result.retry_after))
        attempt += 1