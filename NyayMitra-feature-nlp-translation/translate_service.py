import re
import uuid
from datetime import datetime, timezone

import torch
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from IndicTransToolkit.processor import IndicProcessor
from test_asr import transcribe_and_discard
from upload_validation import validate_audio_upload, UploadValidationError
from glossary_matcher import find_glossary_matches
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


def load_model():
    global tokenizer, model, indic_indic_tokenizer, indic_indic_model

    tokenizer = AutoTokenizer.from_pretrained(
        EN_INDIC_MODEL, trust_remote_code=True
    )
    model = _use_legacy_cache(
        AutoModelForSeq2SeqLM.from_pretrained(
            EN_INDIC_MODEL, trust_remote_code=True
        ).to(DEVICE)
    )
    model.eval()

    indic_indic_tokenizer = AutoTokenizer.from_pretrained(
        INDIC_INDIC_MODEL, trust_remote_code=True
    )
    indic_indic_model = _use_legacy_cache(
        AutoModelForSeq2SeqLM.from_pretrained(
            INDIC_INDIC_MODEL, trust_remote_code=True
        ).to(DEVICE)
    )
    indic_indic_model.eval()

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
    print("Loading IndicTrans2 model...")
    load_model()
    print("IndicTrans2 model loaded successfully.")

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
            translated_text = translate(
                req.source_text,
                internal_target_lang,
            )
        else:
            if req.source_lang == req.target_lang:
                translated_text = req.source_text
            else:
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


@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": model is not None}
