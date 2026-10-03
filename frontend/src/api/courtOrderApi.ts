/* =========================================================
   NYAYMITRA — COURT ORDER EXPLANATION

   Two calls to the NLP service, and no model behind either:
   the service recognises the standing language an order is
   written in and restates it plainly.

   Extraction is allowed to fail — a scanned image on a host
   without OCR simply cannot be read — and that failure comes
   back as a normal answer with a reason attached, so the
   screen can ask the person for the text instead of showing
   an error for something that was never wrong.
   ========================================================= */

import {
  TRANSLATION_API_BASE_URL,
  TRANSLATION_API_KEY,
} from "./config";

export interface ExtractResult {
  ok: boolean;
  text: string;
  needs_text: boolean;
  reason: string;
}

export interface ExplainPoint {
  heading: string;
  plain: string;
}

export interface ExplainTerm {
  term: string;
  plain: string;
}

export interface ExplainResult {
  filename: string;
  summary: string;
  points: ExplainPoint[];
  key_dates: string[];
  terms: ExplainTerm[];
  disclaimer: string;
}

async function readDetail(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (
      payload &&
      typeof payload === "object" &&
      "detail" in payload &&
      typeof payload.detail === "string"
    ) {
      return payload.detail;
    }
  } catch {
    /* Not JSON — keep the fallback. */
  }

  return `${fallback} (status ${response.status})`;
}

/** Best-effort text out of an uploaded order. */
export async function extractOrderText(
  file: File,
): Promise<ExtractResult> {
  const body = new FormData();
  body.append("file", file, file.name);

  const response = await fetch(
    `${TRANSLATION_API_BASE_URL}/api/court-order/extract`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TRANSLATION_API_KEY}` },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(
      await readDetail(response, "The file could not be read."),
    );
  }

  return (await response.json()) as ExtractResult;
}

/** Plain-language reading of an order's text. */
export async function explainOrderText(
  text: string,
  filename: string,
): Promise<ExplainResult> {
  const response = await fetch(
    `${TRANSLATION_API_BASE_URL}/api/court-order/explain`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TRANSLATION_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, filename }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readDetail(response, "The order could not be explained."),
    );
  }

  return (await response.json()) as ExplainResult;
}
