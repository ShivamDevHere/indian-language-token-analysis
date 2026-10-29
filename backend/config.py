"""config.py - central configuration.
TODO: load values from .env (GEMINI_API_KEY, OPENROUTER_API_KEY, DATABASE_URL, model names, price table).
API keys must only ever live on the backend."""

"""
config.py - central place for ALL static configuration of the backend.

WHY THIS FILE EXISTS
    Ports, limits, file paths and API-key names are read here once, so the rest
    of the code never calls os.getenv() directly. If you want to change a limit,
    this is the first file to look at.

IMPORTANT SECURITY RULE
    API keys are read from environment variables (the .env file) at the moment
    they are needed (see get_api_key). They are never stored in the database,
    never written to logs, and never returned by any API endpoint.

HOW TO MODIFY
    * Change a default limit        -> edit the Config class below.
    * Add a new provider's key name -> add it to PROVIDER_ENV_KEYS.
    * Things the user changes from the UI (repetitions, timeout, weights)
      live in services/settings_service.py instead (stored in SQLite).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Read backend/.env (if it exists) into the process environment.
# Real environment variables always win over the .env file.
load_dotenv(BASE_DIR / ".env")


def _env_bool(name: str, default: bool) -> bool:
    """Read a true/false environment variable. 'true', '1', 'yes', 'on' mean True."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    """Read an integer environment variable; fall back to default if invalid."""
    try:
        return int(os.getenv(name, "") or default)
    except ValueError:
        return default


# Which environment variable holds the key for which provider.
# To add a provider: add one line here, then create providers/<name>_provider.py.
PROVIDER_ENV_KEYS = {
    "gemini": "GEMINI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}


def get_api_key(provider: str) -> str:
    """Return the API key for a provider, or '' if it is not configured.

    The key is read from the environment each time (not cached) so tests can
    change it. NEVER log this value or send it to the browser.
    """
    env_name = PROVIDER_ENV_KEYS.get(provider)
    return os.getenv(env_name, "").strip() if env_name else ""


def is_provider_configured(provider: str) -> bool:
    """True when a key exists for the provider. The demo provider needs no key."""
    if provider == "demo":
        return True
    return bool(get_api_key(provider))


class Config:
    """Static application settings. Read once at start-up."""

    APP_VERSION = "1.0.0"

    # ---- Storage ---------------------------------------------------------
    DATABASE_PATH = os.getenv("DATABASE_PATH") or str(BASE_DIR / "database" / "bhasha_kar.sqlite3")
    DATA_DIR = BASE_DIR / "data"          # models.json, languages.json
    DATASET_DIR = BASE_DIR / "dataset"    # test_cases.json (seed dataset)

    # ---- Web server ------------------------------------------------------
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = _env_int("PORT", 5001)
    # CORS: only these browser origins may call the API (development defaults).
    ALLOWED_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]
    # Reject request bodies larger than this (bytes). Protects the server.
    MAX_CONTENT_LENGTH = _env_int("MAX_CONTENT_LENGTH", 1_000_000)

    # ---- Limits that prevent accidental heavy API usage ------------------
    MAX_PROMPT_CHARS = _env_int("MAX_PROMPT_CHARS", 2000)
    MAX_CALLS_PER_RUN = _env_int("MAX_CALLS_PER_RUN", 150)   # hard cap on model calls in one run
    MAX_REPETITIONS = 10
    MAX_TARGET_LANGUAGES = 12
    # Simple per-IP limiter for endpoints that start work: (max requests, per N seconds)
    RUN_ENDPOINT_LIMIT = (10, 60)

    # ---- Demo mode default (can be toggled in the Settings page) ---------
    DEMO_MODE_DEFAULT = _env_bool("DEMO_MODE", True)

    # ---- Optional translation back-ends ----------------------------------
    LIBRETRANSLATE_URL = os.getenv("LIBRETRANSLATE_URL", "").strip()
    LIBRETRANSLATE_API_KEY = os.getenv("LIBRETRANSLATE_API_KEY", "").strip()
    INDICTRANS2_DEVICE = os.getenv("INDICTRANS2_DEVICE", "").strip()  # "", "cpu" or "cuda"
