import {
  TRANSLATION_API_BASE_URL,
  TRANSLATION_API_KEY,
  apiRequest,
} from "./config";

/* =========================================================
   NYAYMITRA — NLP / TRANSLATION API CLIENT

   Wraps the FastAPI service in
   NyayMitra-feature-nlp-translation/translate_service.py

   ENDPOINTS
   --------
   POST /api/translate                  EN ↔ HI / MR
   POST /api/translate/indic-to-indic   HI ↔ MR
   POST /api/voice                      voice → transcript
   GET  /health                         service health

   Auth: every endpoint requires the header
         Authorization: Bearer <API_KEY>
   ========================================================= */

/* =========================================================
   TYPES (mirror the Pydantic models in translate_service.py)
   ========================================================= */

export type LanguageCode = "en" | "hi" | "mr";

export interface TranslateRequest {
  case_id: string;
  source_text: string;
  source_lang: LanguageCode;
  target_lang: LanguageCode;
}

export interface GlossaryMatch {
  term?: string;
  matched?: string;
  [key: string]: unknown;
}

export interface TranslateResponse {
  translation_id: string;
  case_id: string;
  source_text: string;
  translated_text: string;
  language: LanguageCode;
  translated_at: string;
  glossary_matches: GlossaryMatch[];
}

export interface IndicToIndicResponse {
  case_id?: string;
  source_text?: string;
  translated_text: string;
  source_lang?: LanguageCode;
  target_lang?: LanguageCode;
  note?: string;
}

export interface VoiceResponse {
  transcribed_text: string;
  language: LanguageCode;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
}

/* =========================================================
   AUTH HEADER
   ========================================================= */

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${TRANSLATION_API_KEY}`,
  };
}

/* =========================================================
   TRANSLATE  (EN ↔ HI / MR, and HI ↔ MR)
   ========================================================= */

export async function translateText(
  request: TranslateRequest,
): Promise<TranslateResponse> {
  return apiRequest<TranslateResponse>(
    TRANSLATION_API_BASE_URL,
    "/api/translate",
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(request),
    },
  );
}

/* =========================================================
   INDIC → INDIC  (HI ↔ MR)
   ========================================================= */

export async function translateIndicToIndic(
  request: TranslateRequest,
): Promise<IndicToIndicResponse> {
  return apiRequest<IndicToIndicResponse>(
    TRANSLATION_API_BASE_URL,
    "/api/translate/indic-to-indic",
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(request),
    },
  );
}

/* =========================================================
   VOICE  (audio → transcript)

   NOTE: in FastAPI, `target_lang: str = "mr"` is a QUERY
   parameter, and `audio: UploadFile` is the only form
   field. The transcript therefore goes on the URL, not in
   the FormData body.
   ========================================================= */

export async function transcribeVoice(
  audio: Blob,
  targetLang: LanguageCode,
  filename = "voice-recording.wav",
): Promise<VoiceResponse> {
  const formData = new FormData();

  formData.append("audio", audio, filename);

  const response = await fetch(
    `${TRANSLATION_API_BASE_URL}/api/voice` +
      `?target_lang=${encodeURIComponent(targetLang)}`,
    {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    },
  );

  if (!response.ok) {
    let message =
      `Voice request failed with status ${response.status}.`;

    try {
      const errorData: unknown = await response.json();

      if (
        errorData &&
        typeof errorData === "object" &&
        "detail" in errorData &&
        typeof errorData.detail === "string"
      ) {
        message = errorData.detail;
      }
    } catch {
      /* Keep default HTTP error message. */
    }

    throw new Error(message);
  }

  return response.json() as Promise<VoiceResponse>;
}

/* =========================================================
   HEALTH

   Used by pages to warn up-front when the NLP service is
   not running, instead of failing after the user submits.
   ========================================================= */

export async function getTranslationHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>(
    TRANSLATION_API_BASE_URL,
    "/health",
  );
}
