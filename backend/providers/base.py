"""
providers/base.py - the COMMON FORMAT every AI provider must return.

THE ADAPTER IDEA (most important design idea in this project)
    Gemini, OpenRouter and any future provider each send and receive different
    JSON. The rest of the application must not care. So every provider is
    wrapped in a small "adapter" class that:
        1. builds the request the provider wants,
        2. sends it,
        3. converts the provider's answer into ONE standard object:
           ProviderResult (defined below).
    To add a new provider you write one new adapter file and register it in
    providers/__init__.py. Nothing else changes.

TOKEN HONESTY RULES
    * If the provider reports token usage, we store it and set
      token_source = "provider_reported".
    * If it does not, we use estimate_tokens() and set token_source =
      "estimated_chars_div_4". An estimate is NEVER presented as billed usage.
    * Different providers use different tokenizers, so token counts are only
      comparable within the same model, not across providers.
"""
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Optional


@dataclass
class ProviderResult:
    """Normalised answer of one model call (success OR failure)."""

    provider: str
    model: str
    success: bool = False
    response_text: str = ""

    # Token usage. `output_tokens` means BILLABLE output tokens: visible answer
    # plus hidden "thinking/reasoning" tokens when the provider reports them.
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    token_source: str = "provider_reported"   # provider_reported | estimated_chars_div_4 | synthetic

    latency_seconds: float = 0.0              # wall-clock time of the HTTP call
    time_to_first_token: Optional[float] = None  # None: we use non-streaming calls (see roadmap)
    finish_reason: Optional[str] = None
    blocked: bool = False                     # True when the provider's own filter blocked the prompt/answer
    provider_usage_metadata: Dict[str, Any] = field(default_factory=dict)  # small, secret-free subset
    actual_charge_usd: Optional[float] = None  # only when the provider reports a real charge

    error_code: Optional[str] = None          # e.g. "rate_limited", "timeout", "missing_api_key"
    error_message: Optional[str] = None
    retryable: bool = False                   # used by model_service to decide about retries
    retry_after: Optional[float] = None       # seconds suggested by the provider (Retry-After)
    attempts: int = 1
    synthetic: bool = False                   # True only for the demo provider

    def to_dict(self) -> dict:
        return asdict(self)


def estimate_tokens(text: str) -> int:
    """Very rough token estimate: about 4 characters per token for English.

    This is a FALLBACK only. For Indic scripts real tokenizers usually produce
    MORE tokens per character, so this underestimates them. Callers must label
    the result as an estimate (token_source = "estimated_chars_div_4").
    """
    return max(1, round(len(text or "") / 4))


class BaseProvider(ABC):
    """Interface every provider adapter implements."""

    name: str = "base"

    def __init__(self, api_key: str = ""):
        # The key stays inside this object. Never log it, never return it.
        self._api_key = api_key

    @abstractmethod
    def generate(self, prompt: str, model_id: str, timeout_seconds: float = 60,
                 max_output_tokens: int = 1024, temperature: Optional[float] = None,
                 context: Optional[dict] = None) -> ProviderResult:
        """Send `prompt` to `model_id` and return a ProviderResult.

        Must NEVER raise for normal failures (timeouts, HTTP errors, bad JSON);
        return ProviderResult(success=False, error_code=..., error_message=...)
        instead. `context` is extra information used only by the demo provider.
        """
        raise NotImplementedError


def safe_error_text(text: str, limit: int = 300) -> str:
    """Shorten provider error text for storage (and avoid giant HTML pages)."""
    text = (text or "").strip().replace("\n", " ")
    return text[:limit]