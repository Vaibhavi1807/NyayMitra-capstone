/* =========================================================
   NYAYMITRA — CENTRAL API CONFIG

   Every service URL and credential in the frontend is
   read from here. No page should hardcode a URL or an
   API key again.

   Values come from frontend/.env (Vite inlines them at
   build time). See .env.example for documentation.
   ========================================================= */

/* =========================================================
   LAWYER SERVICE  (NyayMitra-feature-lawyer-api)
   FastAPI + PostgreSQL, port 8000
   ========================================================= */

export const LAWYER_API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/* =========================================================
   NLP / TRANSLATION SERVICE  (NyayMitra-feature-nlp-translation)
   FastAPI + IndicTrans2, port 8001
   ========================================================= */

export const TRANSLATION_API_BASE_URL: string =
  import.meta.env.VITE_TRANSLATION_API_URL ||
  "http://127.0.0.1:8001";

export const TRANSLATION_API_KEY: string =
  import.meta.env.VITE_TRANSLATION_API_KEY ||
  "nyaymitra-local-test-2026";

/* =========================================================
   GENERIC JSON REQUEST

   Shared by every API module so error handling (FastAPI's
   `detail` field) stays consistent across the app.
   ========================================================= */

export async function apiRequest<T>(
  baseUrl: string,
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${baseUrl}${endpoint}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    },
  );

  if (!response.ok) {
    let message =
      `Request failed with status ${response.status}.`;

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

  return response.json() as Promise<T>;
}
