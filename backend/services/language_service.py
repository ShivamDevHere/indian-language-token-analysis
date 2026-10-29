"""
services/language_service.py - the list of supported languages.

Reads backend/data/languages.json once. Language codes are ISO 639-1 (en, hi,
bn, ta ...). The `indictrans2_code` field is the FLORES-style tag that the
IndicTrans2 translator needs (hin_Deva, tam_Taml ...).

TO ADD A LANGUAGE: add an entry to data/languages.json (see its _comment).
"""
import json
from functools import lru_cache
from typing import Dict, List, Optional

from config import Config


@lru_cache(maxsize=1)
def _load() -> List[dict]:
    with open(Config.DATA_DIR / "languages.json", encoding="utf-8") as handle:
        return json.load(handle)["languages"]


def list_languages() -> List[dict]:
    return list(_load())


def get_language(code: str) -> Optional[dict]:
    for lang in _load():
        if lang["code"] == code:
            return lang
    return None


def is_supported(code: str) -> bool:
    return get_language(code) is not None


def language_map() -> Dict[str, dict]:
    return {lang["code"]: lang for lang in _load()}