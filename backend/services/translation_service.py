"""translation_service.py - translation helpers.
TODO: translate prompts between English, Hindi, Bengali, Tamil and Telugu (via a provider),
and optionally back-translate to check meaning is preserved."""

"""
services/translation_service.py - translate a prompt from one language to another.

THIS MODULE KNOWS NOTHING ABOUT AI MODELS. It only turns text A (language X)
into text B (language Y) and reports how long it took, which engine did it and
what it cost. benchmark_service.py is the file that calls it.

THE ADAPTER IDEA
    Every translation engine is a class with the same three methods
    (available / supports_pair / translate). translate_text() picks one by name.
    To plug in another open-source translator, write a new BaseTranslator
    subclass and call register_engine(MyTranslator()). Nothing else changes.

ENGINES IN THIS FILE
    indictrans2     AI4Bharat IndicTrans2 distilled 200M models (MIT license).
                    22 scheduled Indian languages <-> English. Runs LOCALLY.
                    Needs torch + transformers + IndicTransToolkit and a free
                    Hugging Face login (the model repo asks you to accept terms).
                    Roughly 1.1 GB per direction in float32. CPU works but is slow;
                    a GPU helps. IndicTransToolkit is documented as "not meant/built/
                    tested for Windows" -> use WSL2 or Linux/macOS for this engine
                    (see README). Indic<->Indic goes through English (pivot).
    libretranslate  Self-hosted LibreTranslate server (open source), used over
                    HTTP. Language coverage is discovered from the server.
    dataset         NOT a translator: looks up the pre-written prompt of the
                    same test-case group in the benchmark dataset.
    demo            SYNTHETIC placeholder text for demo mode. Not a translation.

HONESTY RULES
    * `quality_verified` is ALWAYS False. We never claim an engine's output is
      equivalent in meaning to the source; use the translation sanity check in
      quality_service.py and manual review for safety prompts.
    * Local engines have no API fee, so cost_usd = 0.0 with a note that LOCAL
      COMPUTE still costs time/electricity. The measured duration is reported.
    * Translation time/cost are separate fields - never merged into model cost.

INPUT/OUTPUT of translate_text(text, source, target, engine, demo_mode)
    -> TranslationResult (see dataclass). It never raises; on failure
       success=False and error_code / error_message are filled.
"""
import importlib.util
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional, Tuple

import requests

from config import Config
from services import language_service


@dataclass
class TranslationResult:
    success: bool
    translated_text: str = ""
    source_language: str = ""
    target_language: str = ""
    engine: str = ""
    method_note: str = ""
    duration_seconds: float = 0.0
    cost_usd: Optional[float] = None       # 0.0 = no API fee (local); None = unknown / not applicable
    cost_note: str = ""
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    synthetic: bool = False
    quality_verified: bool = False         # always False - see module docstring

    def to_dict(self) -> dict:
        return asdict(self)


class BaseTranslator(ABC):
    """Interface of a translation engine."""

    name = "base"
    label = "Base translator"
    is_local = True
    description = ""

    @abstractmethod
    def available(self) -> Tuple[bool, str]:
        """(True, '') if ready to use, else (False, human-readable reason + how to fix)."""

    @abstractmethod
    def supports_pair(self, source: str, target: str) -> bool:
        """Can this engine translate source -> target?"""

    @abstractmethod
    def translate(self, text: str, source: str, target: str) -> TranslationResult:
        """Translate. Inputs are already validated (non-empty, different languages)."""


# ======================================================================
# Engine 1: IndicTrans2 (local neural model)
# ======================================================================
class IndicTrans2Translator(BaseTranslator):
    name = "indictrans2"
    label = "IndicTrans2 distilled 200M (local, AI4Bharat)"
    is_local = True
    description = ("Open-source (MIT) neural machine translation for 22 scheduled Indian languages and English. "
                   "Runs on your computer; first use downloads ~1 GB per direction.")

    MODEL_EN_INDIC = "ai4bharat/indictrans2-en-indic-dist-200M"
    MODEL_INDIC_EN = "ai4bharat/indictrans2-indic-en-dist-200M"
    NUM_BEAMS = 4          # beam search width: higher = better but slower
    MAX_LENGTH = 256       # max generated tokens per translation

    def __init__(self):
        self._loaded: Dict[str, tuple] = {}   # direction -> (tokenizer, model, processor, device)
        self._lock = threading.Lock()          # models are loaded once, even with parallel requests

    def available(self) -> Tuple[bool, str]:
        missing = [m for m in ("torch", "transformers", "IndicTransToolkit", "sentencepiece")
                   if importlib.util.find_spec(m) is None]
        if missing:
            return False, ("Missing Python packages: " + ", ".join(missing) +
                           ". Install them with: pip install -r requirements-translation.txt "
                           "(Linux, macOS or Windows WSL2 recommended - see README). "
                           "Then run: huggingface-cli login")
        return True, ""

    def supports_pair(self, source: str, target: str) -> bool:
        src, tgt = language_service.get_language(source), language_service.get_language(target)
        # Any pair works: one side English = direct, otherwise we pivot through English.
        return bool(src and tgt and src.get("indictrans2_code") and tgt.get("indictrans2_code"))

    def _load(self, direction: str):
        """Load (once) the tokenizer + model for 'en_indic' or 'indic_en'."""
        with self._lock:
            if direction in self._loaded:
                return self._loaded[direction]
            import torch  # imported here: heavy, and optional for demo mode
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
            try:
                from IndicTransToolkit.processor import IndicProcessor
            except ImportError:                      # older toolkit versions
                from IndicTransToolkit import IndicProcessor
            name = self.MODEL_EN_INDIC if direction == "en_indic" else self.MODEL_INDIC_EN
            device = Config.INDICTRANS2_DEVICE or ("cuda" if torch.cuda.is_available() else "cpu")
            tokenizer = AutoTokenizer.from_pretrained(name, trust_remote_code=True)
            model = AutoModelForSeq2SeqLM.from_pretrained(name, trust_remote_code=True).to(device)
            model.eval()
            self._loaded[direction] = (tokenizer, model, IndicProcessor(inference=True), device)
            return self._loaded[direction]

    def _translate_step(self, text: str, source: str, target: str) -> str:
        """One direct translation where source == 'en' OR target == 'en'."""
        import torch
        direction = "en_indic" if source == "en" else "indic_en"
        tokenizer, model, processor, device = self._load(direction)
        src_tag = language_service.get_language(source)["indictrans2_code"]
        tgt_tag = language_service.get_language(target)["indictrans2_code"]
        batch = processor.preprocess_batch([text], src_lang=src_tag, tgt_lang=tgt_tag)  # normalise + add tags
        inputs = tokenizer(batch, truncation=True, padding="longest", return_tensors="pt",
                           return_attention_mask=True).to(device)
        with torch.no_grad():
            generated = model.generate(**inputs, use_cache=True, min_length=0, max_length=self.MAX_LENGTH,
                                       num_beams=self.NUM_BEAMS, num_return_sequences=1)
        decoded = tokenizer.batch_decode(generated, skip_special_tokens=True, clean_up_tokenization_spaces=True)
        return processor.postprocess_batch(decoded, lang=tgt_tag)[0]

    def translate(self, text, source, target) -> TranslationResult:
        started = time.perf_counter()
        if source == "en" or target == "en":
            out = self._translate_step(text, source, target)
            note = f"IndicTrans2 distilled 200M, direct {source}->{target}"
        else:  # Indic -> Indic: pivot through English (two steps, quality may drop)
            middle = self._translate_step(text, source, "en")
            out = self._translate_step(middle, "en", target)
            note = f"IndicTrans2 pivot {source}->en->{target} (2 steps; quality may be lower)"
        return TranslationResult(
            success=True, translated_text=out, source_language=source, target_language=target,
            engine=self.name, method_note=note, duration_seconds=time.perf_counter() - started,
            cost_usd=0.0, cost_note="Local model: no API fee, but local compute time/energy is used")


# ======================================================================
# Engine 2: LibreTranslate (self-hosted HTTP server)
# ======================================================================
class LibreTranslateTranslator(BaseTranslator):
    name = "libretranslate"
    label = "LibreTranslate (self-hosted server)"
    is_local = True
    description = ("Open-source translation server you run yourself (set LIBRETRANSLATE_URL). "
                   "Supported languages are discovered from your server.")

    def __init__(self):
        self._lang_cache: Optional[Tuple[float, set]] = None

    def available(self) -> Tuple[bool, str]:
        if not Config.LIBRETRANSLATE_URL:
            return False, "LIBRETRANSLATE_URL is not set in backend/.env (point it to your LibreTranslate server)."
        return True, ""

    def _languages(self) -> set:
        """Language codes the server supports (cached for 5 minutes)."""
        now = time.time()
        if self._lang_cache and now - self._lang_cache[0] < 300:
            return self._lang_cache[1]
        try:
            resp = requests.get(Config.LIBRETRANSLATE_URL.rstrip("/") + "/languages", timeout=5)
            codes = {item["code"] for item in resp.json()}
        except (requests.RequestException, ValueError, KeyError, TypeError):
            codes = set()
        self._lang_cache = (now, codes)
        return codes

    def supports_pair(self, source, target) -> bool:
        codes = self._languages()
        return source in codes and target in codes

    def translate(self, text, source, target) -> TranslationResult:
        started = time.perf_counter()
        payload = {"q": text, "source": source, "target": target, "format": "text"}
        if Config.LIBRETRANSLATE_API_KEY:
            payload["api_key"] = Config.LIBRETRANSLATE_API_KEY
        base = Config.LIBRETRANSLATE_URL.rstrip("/")
        try:
            resp = requests.post(base + "/translate", json=payload, timeout=30)
            if resp.status_code != 200:
                return _failure(self.name, source, target, "engine_error", f"Server answered HTTP {resp.status_code}")
            translated = resp.json().get("translatedText", "")
        except (requests.RequestException, ValueError) as exc:
            return _failure(self.name, source, target, "engine_error", type(exc).__name__)
        local_host = any(h in base for h in ("localhost", "127.0.0.1"))
        return TranslationResult(
            success=bool(translated), translated_text=translated, source_language=source, target_language=target,
            engine=self.name, method_note="LibreTranslate server", duration_seconds=time.perf_counter() - started,
            cost_usd=0.0 if local_host else None,
            cost_note="Self-hosted: no API fee (local compute)" if local_host else "Remote server: pricing unknown",
            error_code=None if translated else "empty_translation")


# ======================================================================
# Engine 3: dataset lookup (pre-written prompts, no translation happens)
# ======================================================================
class DatasetTranslator(BaseTranslator):
    name = "dataset"
    label = "Pre-written dataset prompts (no machine translation)"
    is_local = True
    description = ("Looks up the same question in the benchmark dataset in the target language. "
                   "Only works for prompts that exist in the dataset.")

    def available(self) -> Tuple[bool, str]:
        from database import repository
        if repository.count_test_cases() == 0:
            return False, "The dataset is empty."
        return True, ""

    def supports_pair(self, source, target) -> bool:
        return language_service.is_supported(source) and language_service.is_supported(target)

    def translate(self, text, source, target) -> TranslationResult:
        from database import repository
        started = time.perf_counter()
        for case in repository.list_test_cases(language=source):
            if case["prompt"].strip() == text.strip():
                for sibling in repository.list_test_cases(language=target, group_id=case["group_id"]):
                    reviewed = "human-reviewed" if sibling["human_reviewed"] else "NOT reviewed by a native speaker"
                    return TranslationResult(
                        success=True, translated_text=sibling["prompt"], source_language=source,
                        target_language=target, engine=self.name,
                        method_note=f"Pre-written dataset prompt ({reviewed})",
                        duration_seconds=time.perf_counter() - started, cost_usd=0.0,
                        cost_note="No translation performed")
        return _failure(self.name, source, target, "not_in_dataset",
                        "This prompt is not in the dataset for that language")


# ======================================================================
# Engine 4: demo (synthetic)
# ======================================================================
class DemoTranslator(BaseTranslator):
    name = "demo"
    label = "Demo translator (SYNTHETIC placeholder, not a real translation)"
    is_local = True
    description = "Adds a [DEMO-xx] tag in front of the text. Used only in demo mode."

    def available(self) -> Tuple[bool, str]:
        return True, ""

    def supports_pair(self, source, target) -> bool:
        return language_service.is_supported(source) and language_service.is_supported(target)

    def translate(self, text, source, target) -> TranslationResult:
        fake_seconds = round(0.05 + 0.0004 * len(text), 3)   # synthetic duration, deterministic
        return TranslationResult(
            success=True, translated_text=f"[DEMO-{target}] {text}", source_language=source, target_language=target,
            engine=self.name, method_note="SYNTHETIC placeholder - not a real translation",
            duration_seconds=fake_seconds, cost_usd=0.0, cost_note="Synthetic demo value", synthetic=True)


# ======================================================================
# Registry + public entry point
# ======================================================================
_ENGINES: Dict[str, BaseTranslator] = {}
AUTO_ORDER = ["indictrans2", "libretranslate", "dataset"]   # tried in this order when engine == "auto"


def _ensure_registry() -> None:
    if not _ENGINES:
        for engine in (IndicTrans2Translator(), LibreTranslateTranslator(), DatasetTranslator(), DemoTranslator()):
            _ENGINES[engine.name] = engine


def register_engine(engine: BaseTranslator) -> None:
    """Plug in a new (or replacement) translation engine."""
    _ensure_registry()
    _ENGINES[engine.name] = engine


def list_engines() -> List[dict]:
    """Information for the UI: which engines exist and whether they can run."""
    _ensure_registry()
    items = []
    for engine in _ENGINES.values():
        ok, reason = engine.available()
        items.append({"name": engine.name, "label": engine.label, "is_local": engine.is_local,
                      "description": engine.description, "available": ok, "unavailable_reason": reason})
    return items


def resolve_engine(engine: str, demo_mode: bool = False) -> Tuple[Optional[str], str]:
    """Turn 'auto' into a concrete engine name. Returns (name or None, explanation)."""
    _ensure_registry()
    if engine and engine != "auto":
        return engine, ""
    if demo_mode:
        return "demo", ""
    reasons = []
    for name in AUTO_ORDER:
        ok, reason = _ENGINES[name].available()
        if ok:
            return name, ""
        reasons.append(f"{name}: {reason}")
    return None, "No translation engine is available. " + " | ".join(reasons)


def _failure(engine, source, target, code, message) -> TranslationResult:
    return TranslationResult(success=False, source_language=source, target_language=target, engine=engine,
                             error_code=code, error_message=message)


def translate_text(text: str, source: str, target: str, engine: str = "auto",
                   demo_mode: bool = False) -> TranslationResult:
    """Validate the request, choose an engine, translate, and measure the time.

    Never raises. Check `.success`.
    """
    _ensure_registry()
    # --- input validation ------------------------------------------------
    if not isinstance(text, str) or not text.strip():
        return _failure(engine, source, target, "empty_text", "Text to translate is empty")
    if len(text) > Config.MAX_PROMPT_CHARS:
        return _failure(engine, source, target, "text_too_long",
                        f"Text is longer than {Config.MAX_PROMPT_CHARS} characters")
    for code in (source, target):
        if not language_service.is_supported(code):
            return _failure(engine, source, target, "unsupported_language", f"Language '{code}' is not supported")

    # --- same language: do not translate ----------------------------------
    if source == target:
        return TranslationResult(success=True, translated_text=text, source_language=source, target_language=target,
                                 engine="none", method_note="Source and target are the same - not translated",
                                 duration_seconds=0.0, cost_usd=0.0, cost_note="No translation needed")

    # --- choose engine -----------------------------------------------------
    name, explanation = resolve_engine(engine, demo_mode)
    if name is None:
        return _failure("auto", source, target, "no_engine_available", explanation)
    translator = _ENGINES.get(name)
    if translator is None:
        return _failure(name, source, target, "unknown_engine", f"Unknown translation engine '{name}'")
    ok, reason = translator.available()
    if not ok:
        return _failure(name, source, target, "engine_unavailable", reason)
    if not translator.supports_pair(source, target):
        return _failure(name, source, target, "unsupported_pair",
                        f"Engine '{name}' does not support {source} -> {target}")

    # --- translate (never let an engine crash the benchmark) ---------------
    started = time.perf_counter()
    try:
        result = translator.translate(text, source, target)
    except Exception as exc:  # noqa: BLE001 - engines are third-party code
        return _failure(name, source, target, "translation_error", f"{type(exc).__name__}: {str(exc)[:200]}")
    if not result.duration_seconds:
        result.duration_seconds = time.perf_counter() - started
    result.quality_verified = False
    return result