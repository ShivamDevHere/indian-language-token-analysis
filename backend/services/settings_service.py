"""
services/settings_service.py - user-changeable settings stored in SQLite.

WHAT LIVES HERE vs. config.py
    config.py   = fixed start-up values (ports, hard limits, key NAMES).
    this file   = values the user edits in the Settings page: benchmark
                  repetitions, request timeout, recommendation weights, demo
                  mode, requests-per-minute limits, and so on.

INPUT  : a dict with some of the keys of DEFAULT_SETTINGS (update_settings).
OUTPUT : the full, validated settings dict (get_settings).
ERRORS : update_settings raises ValueError with a readable message; the route
         turns it into HTTP 400.

HOW TO ADD A NEW SETTING
    1. Add it (with a default) to DEFAULT_SETTINGS.
    2. Add a validation rule in _validate().
    3. Read it with get_settings()["your_key"] wherever you need it.
"""
import copy
from typing import Any, Dict

from config import Config
from database import repository

DEFAULT_SETTINGS: Dict[str, Any] = {
    "demo_mode": Config.DEMO_MODE_DEFAULT,   # True = use synthetic demo models only
    "repetitions": 1,                        # how many times each prompt is sent to each model
    "timeout_seconds": 60,                   # per-request timeout
    "max_retries": 2,                        # retries for temporary errors (429 / 5xx / timeout)
    "max_output_tokens": 1024,
    "temperature": None,                     # None = provider default
    "concurrency": 2,                        # parallel model calls (keep low for free tiers)
    "requests_per_minute": {"gemini": 10, "openrouter": 15, "demo": 600},
    "translation_engine": "auto",            # auto / indictrans2 / libretranslate / dataset / demo
    "store_prompts": True,                   # False = do not keep prompt/response text in the DB
    "default_source_language": "en",
    "default_target_languages": ["hi", "bn", "ta"],
    "weights": {"cost": 0.25, "speed": 0.25, "safety": 0.30, "quality": 0.20},
    "thresholds": {"min_safety": 0.5, "min_quality": 0.3, "max_failure_rate": 0.5},
    "free_tier_daily_limits": {"openrouter": 50},   # used only for WARNINGS in the run estimator
    "pricing_stale_days": 90,
}

VALID_ENGINES = {"auto", "indictrans2", "libretranslate", "dataset", "demo"}
_DB_KEY = "app_settings"


def get_settings() -> Dict[str, Any]:
    """Defaults overlaid with whatever the user saved."""
    merged = copy.deepcopy(DEFAULT_SETTINGS)
    saved = repository.get_setting_row(_DB_KEY) or {}
    for key, value in saved.items():
        if key in merged:
            merged[key] = value
    return merged


def _num(value, name, low, high, integer=False):
    try:
        number = int(value) if integer else float(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{name}' must be a number")
    if not (low <= number <= high):
        raise ValueError(f"'{name}' must be between {low} and {high}")
    return number


def _validate(patch: Dict[str, Any], current: Dict[str, Any]) -> Dict[str, Any]:
    """Return a cleaned copy of `patch`. Unknown keys raise ValueError."""
    clean: Dict[str, Any] = {}
    for key, value in patch.items():
        if key not in DEFAULT_SETTINGS:
            raise ValueError(f"Unknown setting '{key}'")
        if key == "demo_mode" or key == "store_prompts":
            if not isinstance(value, bool):
                raise ValueError(f"'{key}' must be true or false")
            clean[key] = value
        elif key == "repetitions":
            clean[key] = _num(value, key, 1, Config.MAX_REPETITIONS, integer=True)
        elif key == "timeout_seconds":
            clean[key] = _num(value, key, 5, 300)
        elif key == "max_retries":
            clean[key] = _num(value, key, 0, 5, integer=True)
        elif key == "max_output_tokens":
            clean[key] = _num(value, key, 16, 8192, integer=True)
        elif key == "concurrency":
            clean[key] = _num(value, key, 1, 4, integer=True)
        elif key == "pricing_stale_days":
            clean[key] = _num(value, key, 7, 3650, integer=True)
        elif key == "temperature":
            clean[key] = None if value is None else _num(value, key, 0, 2)
        elif key == "translation_engine":
            if value not in VALID_ENGINES:
                raise ValueError(f"'translation_engine' must be one of {sorted(VALID_ENGINES)}")
            clean[key] = value
        elif key == "default_source_language":
            if not isinstance(value, str) or not value:
                raise ValueError("'default_source_language' must be a language code")
            clean[key] = value
        elif key == "default_target_languages":
            if not isinstance(value, list) or len(value) > Config.MAX_TARGET_LANGUAGES:
                raise ValueError("'default_target_languages' must be a short list of language codes")
            clean[key] = [str(v) for v in value]
        elif key in ("requests_per_minute", "free_tier_daily_limits"):
            if not isinstance(value, dict):
                raise ValueError(f"'{key}' must be an object like {{\"gemini\": 10}}")
            merged = dict(current[key])
            for provider, number in value.items():
                merged[str(provider)] = _num(number, f"{key}.{provider}", 1, 100000, integer=True)
            clean[key] = merged
        elif key == "weights":
            if not isinstance(value, dict):
                raise ValueError("'weights' must be an object with cost, speed, safety, quality")
            weights = {}
            for name in ("cost", "speed", "safety", "quality"):
                weights[name] = _num(value.get(name, current["weights"][name]), f"weights.{name}", 0, 1000)
            total = sum(weights.values())
            if total <= 0:
                raise ValueError("At least one weight must be greater than zero")
            clean[key] = {k: round(v / total, 6) for k, v in weights.items()}   # normalise so they sum to 1
        elif key == "thresholds":
            if not isinstance(value, dict):
                raise ValueError("'thresholds' must be an object")
            thresholds = dict(current["thresholds"])
            for name in ("min_safety", "min_quality", "max_failure_rate"):
                if name in value:
                    thresholds[name] = _num(value[name], f"thresholds.{name}", 0, 1)
            clean[key] = thresholds
    return clean


def update_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and save a partial update. Returns the new full settings."""
    if not isinstance(patch, dict):
        raise ValueError("Settings must be a JSON object")
    current = get_settings()
    cleaned = _validate(patch, current)
    current.update(cleaned)
    repository.put_setting(_DB_KEY, current)
    return current