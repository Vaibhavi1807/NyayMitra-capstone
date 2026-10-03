import gc
import os
import re
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

import torch
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from IndicTransToolkit.processor import IndicProcessor
from test_asr import transcribe_and_discard, release_idle_model
from upload_validation import validate_audio_upload, UploadValidationError
from glossary_matcher import find_glossary_matches
from next_steps_guidance_lookup import (
    find_related_glossary_terms,
    load_guidance_data,
)
import logging
from datetime import datetime as dt

logging.basicConfig(
    filename="access_audit.log",
    level=logging.INFO,
    format="%(asctime)s | %(message)s",
)

def log_access(endpoint: str, detail: str = ""):
    logging.info(f"ACCESS endpoint={endpoint} {detail}")
import logging
from datetime import datetime as dt

logging.basicConfig(
    filename="access_audit.log",
    level=logging.INFO,
    format="%(asctime)s | %(message)s",
)

def log_access(endpoint: str, detail: str = ""):
    logging.info(f"ACCESS endpoint={endpoint} {detail}")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
EN_INDIC_MODEL = "ai4bharat/indictrans2-en-indic-dist-200M"
INDIC_INDIC_MODEL = "ai4bharat/indictrans2-indic-indic-dist-320M"

LANG_CODE_MAP = {
    "hi": "hin_Deva",
    "mr": "mar_Deva",
}
SOURCE_LANG = "eng_Latn"

API_KEY = "nyaymitra-local-test-2026"  # TODO: move to an environment variable before final submission

ip = IndicProcessor(inference=True)
tokenizer = None
model = None
indic_indic_tokenizer = None
indic_indic_model = None

# --- lazy model cache -------------------------------------------------------
# The three checkpoints total ~4.7 GB. They used to be built at startup (and the
# ASR one at import), so the service held all of it for its whole life and left
# the machine ~3.5 GB short. Each model now loads on first use and is released
# again after MODEL_IDLE_SECONDS without a request, so an idle service costs only
# the interpreter. Load, inference and unload all run under that model's lock, so
# the reaper can never unload a checkpoint a request is still using.
MODEL_IDLE_SECONDS = float(os.environ.get("MODEL_IDLE_SECONDS", "600"))

_model_locks = {
    "en_indic": threading.Lock(),
    "indic_indic": threading.Lock(),
}
_last_used: dict[str, float] = {}


def verify_api_key(authorization: str = Header(None)):
    if authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _use_legacy_cache(model):
    """Keep IndicTrans2 on its own tuple cache instead of transformers' Cache.

    transformers >= 4.36 pre-creates an *empty* EncoderDecoderCache before the
    first decode step. IndicTrans2's remote modelling code predates that and does
    `past_key_values[0][0].shape[2]`, which raises AttributeError while the cache
    layers are still None. Reporting that the model does not support the default
    dynamic cache makes transformers leave `past_key_values=None` on the first
    step, so the model manages the legacy tuple cache itself -- the format its own
    `_reorder_cache` expects. Without this every generate() call returns 500.
    """
    model.__class__._supports_default_dynamic_cache = classmethod(lambda cls: False)
    return model


def _ensure_model(name: str):
    """Build one checkpoint on first use. Caller must hold `_model_locks[name]`.

    `_use_legacy_cache` is applied here rather than at import so a model that has
    been released and reloaded gets the same transformers shim as a first load.
    """
    global tokenizer, model, indic_indic_tokenizer, indic_indic_model

    if name == "en_indic":
        if model is None:
            print("Loading en-indic model...", flush=True)
            tokenizer = AutoTokenizer.from_pretrained(
                EN_INDIC_MODEL, trust_remote_code=True
            )
            model = _use_legacy_cache(
                AutoModelForSeq2SeqLM.from_pretrained(
                    EN_INDIC_MODEL, trust_remote_code=True
                ).to(DEVICE)
            )
            model.eval()
            print("en-indic model ready.", flush=True)
        return

    if name == "indic_indic":
        if indic_indic_model is None:
            print("Loading indic-indic model...", flush=True)
            indic_indic_tokenizer = AutoTokenizer.from_pretrained(
                INDIC_INDIC_MODEL, trust_remote_code=True
            )
            indic_indic_model = _use_legacy_cache(
                AutoModelForSeq2SeqLM.from_pretrained(
                    INDIC_INDIC_MODEL, trust_remote_code=True
                ).to(DEVICE)
            )
            indic_indic_model.eval()
            print("indic-indic model ready.", flush=True)
        return

    raise KeyError(f"unknown model {name!r}")


def _release_model(name: str) -> bool:
    """Drop one translation checkpoint. Caller must hold `_model_locks[name]`."""
    global tokenizer, model, indic_indic_tokenizer, indic_indic_model

    if name == "en_indic":
        if model is None:
            return False
        model = None
        tokenizer = None
    elif name == "indic_indic":
        if indic_indic_model is None:
            return False
        indic_indic_model = None
        indic_indic_tokenizer = None
    else:
        raise KeyError(f"unknown model {name!r}")

    gc.collect()
    print(f"Released idle model {name} (~1.2 GB freed).", flush=True)
    return True


@contextmanager
def _loaded(name: str):
    """Lock a model, load it if needed, run the body, then stamp it as used."""
    with _model_locks[name]:
        _ensure_model(name)
        try:
            yield
        finally:
            _last_used[name] = time.time()


def _reaper():
    """Release checkpoints that have gone idle so their memory returns to the OS."""
    while True:
        time.sleep(30)

        for name, lock in _model_locks.items():
            if time.time() - _last_used.get(name, 0.0) < MODEL_IDLE_SECONDS:
                continue
            if not lock.acquire(blocking=False):
                continue  # a request is loading or running with it
            try:
                _release_model(name)
            finally:
                lock.release()

        # The ASR model keeps its own lock inside test_asr, so it self-guards.
        try:
            release_idle_model(MODEL_IDLE_SECONDS)
        except Exception as exc:  # noqa: BLE001 - the reaper must never die
            print(f"reaper: ASR release skipped ({exc!r})", flush=True)

app = FastAPI(title="NyayMitra Translation Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    print(
        f"Models load on first use and are released after "
        f"{MODEL_IDLE_SECONDS:.0f}s idle; nothing is held at startup.",
        flush=True,
    )
    threading.Thread(target=_reaper, name="model-reaper", daemon=True).start()

class TranslateRequest(BaseModel):
    case_id: str
    source_text: str
    source_lang: str
    target_lang: str


class TranslateResponse(BaseModel):
    translation_id: str
    case_id: str
    source_text: str
    translated_text: str
    language: str
    translated_at: datetime
    glossary_matches: list


@app.post("/api/translate", response_model=TranslateResponse)
def translate_endpoint(req: TranslateRequest, auth=Depends(verify_api_key)):
    if req.source_lang not in {"en", "hi", "mr"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported source_lang. Supported: en, hi, mr."
        )

    if req.target_lang not in LANG_CODE_MAP:
        raise HTTPException(
            status_code=400,
            detail="Unsupported target_lang. Supported: hi, mr."
        )

    glossary_matches = find_glossary_matches(req.source_text)

    try:
        if req.source_lang == "en":
            internal_target_lang = LANG_CODE_MAP[req.target_lang]
            with _loaded("en_indic"):
                translated_text = translate(
                    req.source_text,
                    internal_target_lang,
                )
        else:
            if req.source_lang == req.target_lang:
                translated_text = req.source_text
            else:
                with _loaded("indic_indic"):
                    translated_text = translate_indic_to_indic(
                        req.source_text,
                        LANG_CODE_MAP[req.source_lang],
                        LANG_CODE_MAP[req.target_lang],
                    )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Translation failed. Please try again."
        )

    return TranslateResponse(
        translation_id=f"t_{uuid.uuid4().hex[:8]}",
        case_id=req.case_id,
        source_text=req.source_text,
        translated_text=translated_text,
        language=req.target_lang,
        translated_at=datetime.now(timezone.utc),
        glossary_matches=glossary_matches,
    )

def translate(text: str, target_lang_code: str) -> str:
    # Translate long legal text in small word-boundary chunks.
    # This avoids truncation while preserving legal abbreviations,
    # case numbers, party names, and dates.
    words = text.strip().split()
    chunks = []
    current = ""
    max_chars = 450

    for word in words:
        if current and len(current) + 1 + len(word) > max_chars:
            chunks.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()

    if current:
        chunks.append(current)

    translated_chunks = []

    for chunk in chunks:
        batch = ip.preprocess_batch(
            [chunk],
            src_lang=SOURCE_LANG,
            tgt_lang=target_lang_code,
        )

        inputs = tokenizer(
            batch,
            padding=True,
            truncation=True,
            return_tensors="pt",
        ).to(DEVICE)

        with torch.no_grad():
            generated = model.generate(
                **inputs,
                max_length=256,
                num_beams=5,
            )

        decoded = tokenizer.batch_decode(
            generated,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=True,
        )

        result = ip.postprocess_batch(
            decoded,
            lang=target_lang_code,
        )

        translated_chunks.append(result[0])

    translated_text = " ".join(translated_chunks)

    return translated_text
def translate_indic_to_indic(text: str, src_lang_code: str, tgt_lang_code: str) -> str:
    batch = ip.preprocess_batch([text], src_lang=src_lang_code, tgt_lang=tgt_lang_code)
    inputs = indic_indic_tokenizer(batch, truncation=True, padding="longest", return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        generated = indic_indic_model.generate(**inputs, max_length=256, num_beams=5)
    decoded = indic_indic_tokenizer.batch_decode(generated, skip_special_tokens=True, clean_up_tokenization_spaces=True)
    result = ip.postprocess_batch(decoded, lang=tgt_lang_code)
    return result[0]


class IndicToIndicRequest(BaseModel):
    case_id: str
    source_text: str
    source_lang: str  # 'hi' or 'mr'
    target_lang: str  # 'hi' or 'mr'


@app.post("/api/translate/indic-to-indic")
def translate_indic_to_indic_endpoint(req: IndicToIndicRequest, auth=Depends(verify_api_key)):
    if req.source_lang not in LANG_CODE_MAP or req.target_lang not in LANG_CODE_MAP:
        raise HTTPException(status_code=400, detail="source_lang and target_lang must be 'hi' or 'mr'.")

    if req.source_lang == req.target_lang:
        return {"translated_text": req.source_text, "note": "source and target language are the same"}

    with _loaded("indic_indic"):
        translated_text = translate_indic_to_indic(
            req.source_text, LANG_CODE_MAP[req.source_lang], LANG_CODE_MAP[req.target_lang]
        )

    return {
        "case_id": req.case_id,
        "source_text": req.source_text,
        "translated_text": translated_text,
        "source_lang": req.source_lang,
        "target_lang": req.target_lang,
    }


@app.post("/api/voice")
async def voice_endpoint(
    target_lang: str = "mr",
    audio: UploadFile = File(...),
    auth=Depends(verify_api_key),
):
    if target_lang not in {"hi", "mr"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported target_lang. Supported: hi, mr."
        )

    try:
        audio_bytes = await audio.read()
        validate_audio_upload(audio_bytes)

        transcribed_text = transcribe_and_discard(
            audio_bytes,
            target_lang,
        )

        log_access(
            "/api/voice",
            f"target_lang={target_lang} filename={audio.filename}"
        )

        return {
            "transcribed_text": transcribed_text,
            "language": target_lang,
        }

    except UploadValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    except HTTPException:
        raise

    except Exception as exc:
        # Never swallow the reason: a bare 500 with no log line makes this
        # service undebuggable (it hid the transformers cache bug above).
        logging.getLogger("nyaymitra.voice").exception(
            "voice transcription failed: %r", exc
        )
        raise HTTPException(
            status_code=500,
            detail="Voice transcription failed. Please try again."
        )


# ---------------------------------------------------------------------------
# COURT ORDERS — read the file, then explain it in plain language.
#
# Neither of these loads a model. Explaining an order should not cost
# 370 MB and ten seconds of model load, and it does not need one: an
# order is written in standing language, and restating that language
# plainly is fast, deterministic, and honest about what it actually saw.
#
# Extraction is best effort. A PDF with a text layer is easy; a
# photograph of a paper order needs OCR this host does not have. When
# extraction fails the caller is told exactly why, so the UI can ask
# for the text rather than inventing an explanation of a file it
# never read.
# ---------------------------------------------------------------------------


def _extract_pdf_text(data: bytes):
    """Return (text, reason). `reason` is set only when text is empty."""
    try:
        import io

        import pdfplumber
    except ImportError:
        return "", (
            "Reading PDFs needs pdfplumber, which is not installed "
            "on this host."
        )

    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = [(page.extract_text() or "") for page in pdf.pages]
    except Exception as exc:
        logging.getLogger("nyaymitra.court_order").exception(
            "pdf text extraction failed: %r", exc
        )
        return "", "This PDF could not be read. It may be a scan of an image."

    text = "\n".join(page for page in pages if page.strip()).strip()

    if not text:
        return "", (
            "No text layer found in this PDF. It looks like a scan, which "
            "this host cannot read without OCR."
        )

    return text, ""


@app.post("/api/court-order/extract")
async def court_order_extract(
    file: UploadFile = File(...),
    auth=Depends(verify_api_key),
):
    """Best-effort text out of an uploaded court order."""
    name = (file.filename or "").lower()
    data = await file.read()

    looks_like_pdf = name.endswith(".pdf") or (
        file.content_type or ""
    ) == "application/pdf"

    if looks_like_pdf:
        text, reason = _extract_pdf_text(data)
    else:
        text = ""
        reason = (
            "Images need OCR, which is not installed on this host. "
            "Paste the text of the order and it will be explained."
        )

    log_access(
        "/api/court-order/extract",
        f"filename={file.filename} read_chars={len(text)}",
    )

    if not text:
        return {"ok": False, "text": "", "needs_text": True, "reason": reason}

    return {"ok": True, "text": text, "needs_text": False, "reason": ""}


# The standing wording of an order, and what it means to the person
# reading it. Ordered so the first point is usually the headline.
_ORDER_RULES = [
    (
        r"\b(adjourn\w*|postpon\w*|defer\w*)\b",
        "The hearing has been postponed",
        "The court has put this hearing off. A postponement decides "
        "nothing — the case simply returns on the next date.",
    ),
    (
        r"\b(reserved|reserved for judgment)\b",
        "Judgment is reserved",
        "Both sides have finished arguing. The judge will pass orders "
        "later, so the decision is not out yet.",
    ),
    (
        r"\b(granted|allowed|admitted|accepted)\b",
        "An application was allowed",
        "What one side asked for has been accepted, subject to whatever "
        "conditions the order sets out.",
    ),
    (
        r"\b(rejected|refused|dismissed|denied)\b",
        "An application was refused",
        "What one side asked for has been turned down. The order will "
        "say whether it can be challenged, and by when.",
    ),
    (
        r"\b(notice|summons)\b",
        "Notice goes to the other side",
        "The other party has been asked to respond. They must file "
        "their reply before the matter can be heard.",
    ),
    (
        r"\b(stay(ed|ing|s)?)\b",
        "The proceedings are stayed",
        "The case is on hold for now. No further step is taken until "
        "the stay is lifted.",
    ),
    (
        r"\b(bail)\b",
        "The order deals with bail",
        "It sets whether someone may be released, and on what "
        "conditions.",
    ),
    (
        r"\b(costs?)\b",
        "Costs are mentioned",
        "The order says who pays the expenses of this application, or "
        "of the case so far.",
    ),
    (
        r"\b(directed to\b|\bshall\s+(?:file|appear|produce|submit))\b",
        "The court gave a direction",
        "A party has been told to do something — file paper, appear, "
        "or produce a document — by a date.",
    ),
    (
        r"\b(interim|temporary)\b",
        "This looks like an interim order",
        "It is a direction given while the case is still running, not "
        "the final outcome.",
    ),
    (
        r"\b(final (?:order|judgment|decision)|judgment is pronounced"
        r"|decree)\b",
        "This looks like the final order",
        "The court has recorded its decision on the matter.",
    ),
]

_DATE_PATTERNS = [
    r"\b\d{1,2}(?:st|nd|rd|th)?\s+"
    r"(?:January|February|March|April|May|June|July|August|September"
    r"|October|November|December)\s+\d{4}\b",
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
]


def _order_dates(text: str):
    """Every date the order mentions, in first-seen order, capped."""
    found = []

    for pattern in _DATE_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            value = match.group(0)
            if value not in found:
                found.append(value)

    return found[:6]


def _first_sentence(text: str, limit: int = 340) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return ""

    boundary = re.search(r"(?<=[.!?])\s", compact)
    head = compact[: boundary.start()] if boundary else compact

    if len(head) > limit:
        head = head[: limit - 1].rstrip() + "…"

    return head


class CourtOrderExplainRequest(BaseModel):
    text: str = Field(..., min_length=1)
    filename: str = ""


@app.post("/api/court-order/explain")
def court_order_explain(
    req: CourtOrderExplainRequest,
    auth=Depends(verify_api_key),
):
    """Explain a court order in plain English.

    Built by recognising the standing language orders use and restating
    it, plus the glossary's own plain reading of any legal term that
    appears. Nothing is asserted that was not in the text: if the order
    does not use recognisable wording, the response says so instead of
    summarising a file it did not understand.
    """
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text to explain.")

    lowered = text.lower()

    points = [
        {"heading": heading, "plain": plain}
        for pattern, heading, plain in _ORDER_RULES
        if re.search(pattern, lowered)
    ]

    if not points:
        points = [
            {
                "heading": "No standard order wording was recognised",
                "plain": (
                    "This order does not use the usual phrasing, so "
                    "nothing has been summarised for you. Read it with "
                    "your advocate before acting on it."
                ),
            }
        ]

    terms = [
        {"term": item["formal_term"], "plain": item["plain_explanation_en"]}
        for item in find_glossary_matches(text)
    ]

    log_access(
        "/api/court-order/explain",
        f"filename={req.filename or '-'} chars={len(text)} "
        f"points={len(points)} terms={len(terms)}",
    )

    return {
        "filename": req.filename,
        "summary": _first_sentence(text) or "Court order",
        "points": points,
        "key_dates": _order_dates(text),
        "terms": terms,
        "disclaimer": (
            "This is a plain-language reading of the words in the file. "
            "It is not legal advice, and the original order is what "
            "governs the case."
        ),
    }


# ---------------------------------------------------------------------------
# NEXT STEPS — "what should I do now", from whatever the person said.
#
# The guidance set is keyed by the fifty case-stage phrases the court
# system uses. Somebody describing their situation in their own words
# will not type those phrases, so the rule is matched by scoring the
# words they did use against each rule's own vocabulary — the stage
# phrases carry the weight, description wording only breaks ties.
#
# `urgency` comes back too, and it is a lookup against that same set,
# not a model's opinion about a particular incident. The screen says
# so; the incident-urgency model replaces it later without this
# endpoint changing shape.
# ---------------------------------------------------------------------------

# Carried no signal when scoring. The generic nouns are in nearly every
# stage, so a match on them would rate every rule equally. The last line
# is different: these are the ordinary English words the stage phrases
# happen to be built out of — "for want of time" shares "want" with a
# sentence about wanting to open a shop, and "next date for compliance"
# shares "date" with almost any account of a court hearing. They are
# dropped on both sides, so a stage is scored on what makes it that
# stage and nothing else.
_GUIDANCE_STOPWORDS = frozenset(
    """
    the a an to of for in on at by with and or not is be are was were it its
    this that from as within till under before after up no any shall will
    due when if then so such other another each every both few more most
    case matter
    want time next date part
    """.split()
)

# The words that decide what a stage *means*. They are weighted above the
# nouns around them for two reasons: a person's account usually contains
# the outcome and little else, and a rule carrying one of these that the
# account does not contain is being contradicted — which is exactly how
# "bail application was rejected" stays on a rejected rule instead of
# landing on the identical-looking "bail application allowed".
_GUIDANCE_OUTCOMES = frozenset(
    """
    allowed granted rejected refused dismissed declined admitted withdrawn
    reserved disposed quashed restored remanded transferred extended
    released unserved filed pending cancelled
    """.split()
)

# The subject the stage is about. Weighed between the outcomes and the
# connective tissue: someone saying "bail" is talking about a bail rule,
# and a rule that is about bail outranks one that merely mentions an
# application.
_GUIDANCE_SUBJECTS = frozenset(
    """
    bail appeal notice custody summons statement vakalatnama rejoinder
    review revision execution anticipatory accused interim stay
    condonation counter affidavit remand jurisdiction registrar
    """.split()
)


def _guidance_terms(text: str):
    return {
        token
        for token in re.findall(r"[a-z]+", text.lower())
        if len(token) > 1 and token not in _GUIDANCE_STOPWORDS
    }


def _guidance_weight(term: str) -> int:
    if term in _GUIDANCE_OUTCOMES:
        return 3
    if term in _GUIDANCE_SUBJECTS:
        return 2
    return 1


# A third of the stage's weighted vocabulary is a knife-edge: a
# single shared word in a three-word stage lands exactly there,
# so one word in three stops counting and one word in two still
# does.
_GUIDANCE_MATCH_COVERAGE = 0.35

# Worth mentioning as "closest stages" when nothing cleared the
# bar, but never close enough to act on — and only if the shared
# words include one that carries weight. "Want" from "for want of
# time" is a connective in somebody's sentence about opening a
# shop, not a sign they are describing an adjournment.
_GUIDANCE_NEAR_COVERAGE = 0.15
_GUIDANCE_NEAR_MIN_WEIGHT = 2


def _score_guidance_rule(tokens, rule):
    """(score, coverage, shared_weight) for one rule.

    All three are always computed — the endpoint needs to tell
    the difference between "nothing here at all" and "some of
    this is here, just not enough to act on", and between
    sharing a word that means something and sharing a
    connective, because only the first of those is worth
    offering back as a near miss.
    """
    stage_terms = _guidance_terms(rule["case_stage"])

    if not stage_terms:
        return 0.0, 0.0, 0

    total = sum(_guidance_weight(term) for term in stage_terms)
    shared = sum(
        _guidance_weight(term) for term in stage_terms if term in tokens
    )
    coverage = shared / total

    # Description wording adds a little, but only for words long enough
    # to be specific — "court" and "date" appear in half the set.
    other_terms = (
        _guidance_terms(rule["description"])
        | _guidance_terms(rule["suggested_action"])
    ) - stage_terms

    secondary = sum(
        0.35
        for term in other_terms
        if len(term) >= 6 and term in tokens
    )

    return shared + secondary + coverage * 1.5, coverage, shared


class GuidanceRequest(BaseModel):
    text: str = Field(..., min_length=1)


@app.post("/api/guidance")
def guidance_endpoint(
    req: GuidanceRequest,
    auth=Depends(verify_api_key),
):
    """Match what someone described to the closest case stage, and say
    what that stage calls for."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Nothing to read.")

    data = load_guidance_data()
    tokens = _guidance_terms(text)

    rows = [
        (*_score_guidance_rule(tokens, rule), rule)
        for rule in data["guidance_v2"]
    ]

    # Matching is decided on coverage, never on score. Score
    # mixes in shared and secondary words, so a rule sharing two
    # weight-1 words can out-score one that clears the bar on a
    # single subject — and taking the top of that list would let
    # a near miss occupy the answer.
    eligible = [row for row in rows if row[1] >= _GUIDANCE_MATCH_COVERAGE]
    eligible.sort(key=lambda row: (row[0], row[1]), reverse=True)

    rows.sort(key=lambda row: (row[0], row[1]), reverse=True)

    if not eligible:
        log_access(
            "/api/guidance",
            f"chars={len(text)} matched=no "
            f"best={rows[0][1]:.2f}",
        )
        return {
            "matched": False,
            "stage": None,
            "urgency": None,
            "why": "",
            "what_to_do_next": (
                "Nothing you described matches a stage this service "
                "covers, so nothing specific has been guessed. Say a "
                "little more — a notice, a hearing date, an order, a "
                "bail or custody situation — and it will match one of "
                "the fifty stages in the guidance set. Meanwhile, treat "
                "any deadline printed on your papers as real and speak "
                "to a qualified advocate."
            ),
            "related_terms": [],
            # Rules that shared a word of real weight but not enough
            # to act on. A rule sharing only connectives — or nothing
            # — drops out rather than being offered as "closest".
            "candidates": [
                {"stage": rule["case_stage"], "urgency": rule["urgency"]}
                for _score, coverage, shared, rule in rows[:6]
                if coverage >= _GUIDANCE_NEAR_COVERAGE
                and shared >= _GUIDANCE_NEAR_MIN_WEIGHT
            ][:3],
            "disclaimer": data["disclaimer"],
        }

    best_score, best_coverage, _shared, best_rule = eligible[0]

    log_access(
        "/api/guidance",
        f"chars={len(text)} matched={best_rule['guidance_id']} "
        f"score={best_score:.2f} coverage={best_coverage:.2f}",
    )

    return {
        "matched": True,
        "stage": best_rule["case_stage"],
        "urgency": best_rule["urgency"],
        "why": best_rule["description"],
        "what_to_do_next": best_rule["suggested_action"],
        "related_terms": [
            {"term": term["formal_term"], "plain": term["plain_explanation_en"]}
            for term in find_related_glossary_terms(
                f"{best_rule['case_stage']} {best_rule['description']}"
            )
        ],
        "candidates": [],
        "disclaimer": data["disclaimer"],
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": model is not None}
