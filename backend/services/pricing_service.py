"""pricing_service.py - cost estimation.
TODO: keep a configurable price table (per 1M input/output tokens) and compute estimated cost.
Prices change, so load them from config and label them as estimates."""

"""
services/pricing_service.py - turns TOKENS into MONEY (honestly).

FORMULA (per request)
    estimated cost = input_tokens  * input_price_per_million  / 1,000,000
                   + output_tokens * output_price_per_million / 1,000,000

THREE DIFFERENT "COSTS" - never mix them up
    1. actual_charge_usd        : what the provider really charged.
                                  - OpenRouter reports it in usage.cost.
                                  - A model marked free_tier is assumed 0.0
                                    ("assumed_free_tier").
                                  - Otherwise it is unknown (None) - we do NOT guess.
    2. estimated_equivalent_usd : tokens x PUBLIC list price. This is what the
                                  request WOULD cost on a paid plan. It lets us
                                  compare models even when you use free tiers.
    3. translation_cost_usd     : cost of the translation step, kept SEPARATE.
                                  Local models (IndicTrans2) have no API fee, so
                                  this is 0.0 with a note about local compute.

    total_pipeline_estimate = estimated_equivalent + translation_cost
    Translation tokens are never added to model tokens, so nothing is counted
    twice: the model's input_tokens already describe only the (translated)
    prompt that was sent to the model.

MISSING PRICES: if a price is unknown (None) we return status "missing" and no
number. If the price was verified long ago we return status "stale" but still
compute the number. We never invent prices.

HOW TO MODIFY
    * Different stale limit  -> Settings page ("pricing_stale_days").
    * New price for a model  -> Settings page (creates a new pricing version).
"""
from datetime import date, datetime
from typing import Any, Dict, Optional


def cost_from_tokens(input_tokens: int, output_tokens: int,
                     input_price_per_million: float, output_price_per_million: float) -> float:
    """Pure formula. Example: 1000 in + 500 out at $0.25 / $1.50 per million -> $0.001."""
    return (input_tokens * input_price_per_million / 1_000_000
            + output_tokens * output_price_per_million / 1_000_000)


def pricing_status(pricing: Dict[str, Any], today: Optional[date] = None, stale_days: int = 90) -> str:
    """Return 'missing', 'stale' or 'ok' for a pricing row.

    pricing keys used: input_price_per_million, output_price_per_million, verified_on (YYYY-MM-DD).
    """
    if not pricing or pricing.get("input_price_per_million") is None or pricing.get("output_price_per_million") is None:
        return "missing"
    verified = pricing.get("verified_on")
    if not verified:
        return "stale"
    try:
        verified_date = datetime.strptime(verified[:10], "%Y-%m-%d").date()
    except ValueError:
        return "stale"
    today = today or date.today()
    return "stale" if (today - verified_date).days > stale_days else "ok"


def estimate_cost(input_tokens: Optional[int], output_tokens: Optional[int], pricing: Dict[str, Any],
                  today: Optional[date] = None, stale_days: int = 90) -> Dict[str, Any]:
    """Estimated equivalent cost + a status explaining how far to trust it."""
    status = pricing_status(pricing, today, stale_days)
    if input_tokens is None or output_tokens is None:
        return {"estimated_usd": None, "status": "no_token_data"}
    if status == "missing":
        return {"estimated_usd": None, "status": "missing"}
    value = cost_from_tokens(input_tokens, output_tokens,
                             pricing["input_price_per_million"], pricing["output_price_per_million"])
    return {"estimated_usd": value, "status": status}


def build_cost_breakdown(provider_result: Dict[str, Any], pricing: Dict[str, Any], free_tier: bool,
                         translation_cost_usd: Optional[float], today: Optional[date] = None,
                         stale_days: int = 90) -> Dict[str, Any]:
    """Combine all cost facts of ONE request into one dict (stored in the results table).

    provider_result : ProviderResult.to_dict()
    pricing         : row from repository.list_models() (price columns)
    free_tier       : models.free_tier flag
    translation_cost_usd : 0.0 for local engines, None if unknown / not applicable
    """
    # 1) actual charge
    if provider_result.get("synthetic"):
        actual, actual_note = None, "synthetic_demo"
    elif provider_result.get("actual_charge_usd") is not None:
        actual, actual_note = float(provider_result["actual_charge_usd"]), "reported_by_provider"
    elif free_tier:
        actual, actual_note = 0.0, "assumed_free_tier"
    else:
        actual, actual_note = None, "not_reported"

    # 2) estimated equivalent commercial cost
    est = estimate_cost(provider_result.get("input_tokens"), provider_result.get("output_tokens"),
                        pricing, today, stale_days)

    # 3) total pipeline = equivalent model cost + translation cost (kept as separate columns too)
    total = None
    if est["estimated_usd"] is not None:
        total = est["estimated_usd"] + (translation_cost_usd or 0.0)

    return {
        "actual_charge_usd": actual,
        "actual_charge_note": actual_note,
        "estimated_cost_usd": est["estimated_usd"],
        "pricing_status": est["status"],
        "pricing_version_id": pricing.get("pricing_version_id"),
        "total_pipeline_cost_usd": total,
    }