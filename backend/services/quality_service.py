"""
services/quality_service.py - answer-quality checks (kept SEPARATE from safety).

QUALITY MEANS HERE (MVP, all rule-based and measurable)
    keyword_coverage        Did the answer contain the expected facts? Each
                            keyword spec is "a|b" = a OR b (so Latin and native
                            digits / spellings are both accepted).
    reference_f1            Word-overlap F1 between the answer and a reference
                            answer written in the SAME language as the prompt.
    language_appropriateness Is the answer written (mostly) in the prompt's
                            script? Penalises answering Hindi questions in English.
    completeness            Non-empty and not cut off (finish_reason MAX_TOKENS/length).
    overall = simple average of the components that are available.

WHAT THIS CANNOT DO (be honest with judges)
    * Word overlap cannot understand meaning; a correct answer phrased
      differently can score low, a wrong answer sharing words can score high.
    * With no reference/keywords (open-ended prompts) only the weak checks
      run, so the result is marked review_status = "human_review_recommended".
    * No AI judge is used in this MVP (listed in DEVELOPMENT_ROADMAP.md). If you
      add one, label it "automated, imperfect" and keep it separate.

ALSO HERE: translation_sanity() - a WEAK heuristic that checks whether a
translation kept numbers, is in the right script, is not identical to the source
and has a plausible length. It cannot detect changed meaning - review translated
safety prompts by hand.

HOW TO ADD A SCRIPT: add its Unicode range to SCRIPT_RANGES.
"""
import re
import unicodedata
from collections import Counter
from typing import Any, Dict, List, Optional

from services import language_service

METHOD = "rule_based_quality_v1"
TRUNCATION_REASONS = {"MAX_TOKENS", "length", "max_tokens"}

# Unicode code-point ranges per writing system (letters AND vowel signs).
SCRIPT_RANGES = {
    "Latin": [(0x41, 0x5A), (0x61, 0x7A), (0xC0, 0x24F)],
    "Devanagari": [(0x900, 0x97F)], "Bengali": [(0x980, 0x9FF)], "Gurmukhi": [(0xA00, 0xA7F)],
    "Gujarati": [(0xA80, 0xAFF)], "Odia": [(0xB00, 0xB7F)], "Tamil": [(0xB80, 0xBFF)],
    "Telugu": [(0xC00, 0xC7F)], "Kannada": [(0xC80, 0xCFF)], "Malayalam": [(0xD00, 0xD7F)],
    "Arabic": [(0x600, 0x6FF), (0x750, 0x77F)],
}


def _script_of(ch: str) -> Optional[str]:
    code = ord(ch)
    for script, ranges in SCRIPT_RANGES.items():
        if any(lo <= code <= hi for lo, hi in ranges):
            return script
    return None


def script_share(text: str, script: str) -> Optional[float]:
    """Fraction of script-recognised letters that belong to `script` (None if no letters)."""
    total = target = 0
    for ch in text or "":
        found = _script_of(ch)
        if found:
            total += 1
            target += found == script
    return None if total == 0 else target / total


_SPLIT = re.compile(r"[\s.,;:!?\"'()\[\]{}\u0964\u0965|/\\\-\u2013\u2014]+")


def _words(text: str) -> List[str]:
    """Split on spaces/punctuation (incl. the Hindi danda). `\\w` is avoided because it
    breaks Indic words at vowel signs."""
    text = unicodedata.normalize("NFC", text or "").lower()
    return [w for w in _SPLIT.split(text) if w]


def f1_overlap(answer: str, reference: str) -> float:
    """Word-overlap F1 between two texts (0..1)."""
    a, r = Counter(_words(answer)), Counter(_words(reference))
    if not a or not r:
        return 0.0
    common = sum((a & r).values())
    if common == 0:
        return 0.0
    precision, recall = common / sum(a.values()), common / sum(r.values())
    return 2 * precision * recall / (precision + recall)


def keyword_coverage(answer: str, keywords: List[str]) -> float:
    """Fraction of keyword specs found. A spec 'a|b' counts if ANY alternative appears."""
    if not keywords:
        return 0.0
    text = unicodedata.normalize("NFC", answer or "").casefold()
    found = 0
    for spec in keywords:
        alternatives = [unicodedata.normalize("NFC", alt).casefold() for alt in spec.split("|") if alt]
        found += any(alt in text for alt in alternatives)
    return found / len(keywords)


def evaluate_quality(response_text: str, finish_reason: Optional[str], language: str,
                     expected_behavior: Optional[str], reference_answer: Optional[str] = None,
                     expected_keywords: Optional[List[str]] = None, api_success: bool = True,
                     blocked: bool = False) -> Dict[str, Any]:
    """Score one answer. Returns a dict for an `evaluations` row (kind='quality')."""
    def na(reason):
        return {"kind": "quality", "label": "not_applicable", "score": None, "method": METHOD,
                "confidence": None, "review_status": "auto_checked", "details": {"reason": reason}}

    if not api_success:
        return na("api_call_failed")
    if blocked:
        return na("blocked_by_provider")
    if expected_behavior == "refuse":
        return na("quality_is_not_scored_for_prompts_that_should_be_refused")

    components: Dict[str, float] = {}
    text = (response_text or "").strip()
    if expected_keywords:
        components["keyword_coverage"] = keyword_coverage(text, expected_keywords)
    if reference_answer:
        components["reference_f1"] = f1_overlap(text, reference_answer)

    lang = language_service.get_language(language)
    if lang and text:
        share = script_share(text, lang["script"])
        if share is not None:
            components["language_appropriateness"] = min(1.0, share / 0.6)  # >=60% in-script counts as fully OK
    if not text:
        components["completeness"] = 0.0
    elif finish_reason in TRUNCATION_REASONS:
        components["completeness"] = 0.5
    else:
        components["completeness"] = 1.0

    overall = sum(components.values()) / len(components)
    strong_evidence = bool(expected_keywords or reference_answer)
    return {"kind": "quality", "label": None, "score": round(overall, 4), "method": METHOD,
            "confidence": "medium" if strong_evidence else "low",
            "review_status": "auto_checked" if strong_evidence else "human_review_recommended",
            "details": {"components": {k: round(v, 4) for k, v in components.items()},
                        "note": "Equal-weight average of available components." if strong_evidence else
                                "No reference/keywords: only weak checks ran. Please review by hand."}}


# ----------------------------------------------------------------------
# Translation sanity check (weak heuristic)
# ----------------------------------------------------------------------
def _numbers(text: str) -> set:
    """Extract numbers, converting native digits (১২) to ASCII (12) first."""
    ascii_text = "".join(str(unicodedata.digit(c)) if c.isdigit() else c for c in text or "")
    return set(re.findall(r"\d+", ascii_text))


def translation_sanity(original: str, translated: str, source: str, target: str) -> Dict[str, Any]:
    """Cheap checks that a translation is plausible. NOT a meaning check."""
    checks: Dict[str, bool] = {}
    nums = _numbers(original)
    if nums:
        checks["numbers_preserved"] = nums.issubset(_numbers(translated))
    checks["not_identical_to_source"] = (translated or "").strip() != (original or "").strip()
    target_lang = language_service.get_language(target)
    if target_lang:
        share = script_share(translated, target_lang["script"])
        checks["target_script_used"] = share is not None and share >= (0.8 if target == "en" else 0.5)
    ratio = len(translated or "") / max(len(original or ""), 1)
    checks["length_ratio_plausible"] = 0.3 <= ratio <= 3.5

    score = sum(checks.values()) / len(checks)
    return {"kind": "translation_check", "label": "passed" if all(checks.values()) else "failed_some_checks",
            "score": round(score, 4), "method": "heuristic_sanity_v1", "confidence": "low",
            "review_status": "auto_checked" if all(checks.values()) else "human_review_recommended",
            "details": {"checks": checks,
                        "note": "Weak heuristic. It cannot detect changed meaning or intent; "
                                "review translated safety prompts manually."}}