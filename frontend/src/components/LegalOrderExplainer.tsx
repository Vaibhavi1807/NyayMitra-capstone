import { useState } from "react";

import { getGuidance, type GuidanceResult } from "../api/guidanceApi";
import type { LegalSimplifyResponse } from "../api/translationApi";

import "./LegalOrderExplainer.css";

/* =========================================================
   LEGAL ORDER EXPLAINER — the three layers, in one place

   Original legal text  →  Simple English  →  मराठी / हिंदी

   Layer one is quoted, never rewritten: it is what the court
   wrote, and it stays on the page so every claim made by the
   two layers below it can be checked against it. Layer two is
   the service's rule-based rewrite — same facts, everyday
   words. Layer three is that plain English translated.

   The three actions are the ones a person actually needs:

     Copy              take the answer somewhere else
     Listen            hear it read aloud, in the target
     Explain Next Step the guidance set's reading of where
                       this leaves the case

   Nothing here invents content: warnings, glossary terms and
   the guidance answer are all reported by the service.
   ========================================================= */

const TARGET_LABELS: Record<string, string> = {
  mar_Deva: "मराठी (Marathi)",
  hin_Deva: "हिंदी (Hindi)",
  eng_Latn: "English",
};

const SPEECH_LOCALES: Record<string, string> = {
  mar_Deva: "mr-IN",
  hin_Deva: "hi-IN",
  eng_Latn: "en-IN",
};

export default function LegalOrderExplainer({
  result,
}: {
  result: LegalSimplifyResponse;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [guidance, setGuidance] = useState<GuidanceResult | null>(null);
  const [guidanceBusy, setGuidanceBusy] = useState(false);
  const [guidanceError, setGuidanceError] = useState("");

  const targetLabel =
    TARGET_LABELS[result.target_lang] ?? result.target_lang;

  const isEnglish = result.target_lang === "eng_Latn";

  /* Copy and Listen both act on the layer the reader asked for:
     the translation, or the plain English when English *was* the
     answer. */
  const spokenText = isEnglish
    ? result.simple_english
    : result.translated_text;

  const handleCopy = async () => {
    if (!spokenText) return;

    try {
      await navigator.clipboard.writeText(spokenText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleListen = () => {
    if (!("speechSynthesis" in window) || !spokenText) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(spokenText);
    speech.lang = SPEECH_LOCALES[result.target_lang] ?? "en-IN";

    speech.onstart = () => setSpeaking(true);
    speech.onend = () => setSpeaking(false);
    speech.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(speech);
  };

  const handleNextStep = async () => {
    if (guidance || guidanceBusy) return;

    setGuidanceBusy(true);
    setGuidanceError("");

    try {
      setGuidance(await getGuidance(result.simple_english));
    } catch (error) {
      setGuidanceError(
        error instanceof Error && error.message
          ? error.message
          : "The next step could not be worked out just now.",
      );
    } finally {
      setGuidanceBusy(false);
    }
  };

  return (
    <div className="legal-explainer">
      <header className="legal-explainer-head">
        <span className="legal-explainer-title">
          ⚖ Legal Order Explainer
        </span>

        <span className="legal-explainer-target">
          Step 3 in {targetLabel}
        </span>
      </header>

      {/* ---- the three layers ---- */}
      <div className="order-layers">
        <div className="order-layer order-layer-legal">
          <span className="order-layer-tag">
            1 · Original legal text
          </span>
          <p>{result.original_text}</p>
        </div>

        <span className="order-layer-down" aria-hidden="true">
          ↓
        </span>

        <div className="order-layer order-layer-simple">
          <span className="order-layer-tag">2 · Simple English</span>
          <p>{result.simple_english}</p>

          {result.simple_english === result.original_text && (
            <em className="order-layer-note">
              No plainer wording was found for this passage, so it is
              shown exactly as written.
            </em>
          )}
        </div>

        {!isEnglish && (
          <>
            <span className="order-layer-down" aria-hidden="true">
              ↓
            </span>

            <div className="order-layer order-layer-translated">
              <span className="order-layer-tag">
                3 · {targetLabel}, from the simple English
              </span>
              <p>{result.translated_text}</p>
            </div>
          </>
        )}

        {isEnglish && (
          <em className="order-layer-note">
            English was asked for, so step two is the finished answer.
          </em>
        )}
      </div>

      {/* ---- what the service could not promise ---- */}
      {result.warnings.length > 0 && (
        <ul className="legal-explainer-warnings" role="note">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {/* ---- glossary terms the text matched ---- */}
      {result.glossary_terms_used.length > 0 && (
        <div className="legal-explainer-terms">
          <span>Words from the legal glossary in this text</span>
          <ul>
            {result.glossary_terms_used.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- actions ---- */}
      <div className="legal-explainer-actions">
        <button type="button" onClick={handleCopy} disabled={!spokenText}>
          {copied ? "Copied ✓" : "Copy"}
        </button>

        <button type="button" onClick={handleListen} disabled={!spokenText}>
          {speaking ? "Stop ▪" : "Listen"}
        </button>

        <button
          type="button"
          className="legal-explainer-primary"
          onClick={handleNextStep}
          disabled={guidanceBusy}
        >
          {guidanceBusy
            ? "Working it out…"
            : guidance
              ? "Next step shown ✓"
              : "Explain Next Step"}
        </button>
      </div>

      {guidanceError && (
        <p className="legal-explainer-error" role="alert">
          {guidanceError}
        </p>
      )}

      {guidance && (
        <div className="legal-explainer-next">
          <strong>
            {guidance.stage ? `Where your case stands: ${guidance.stage}` : "What to do next"}
          </strong>

          <p>{guidance.what_to_do_next}</p>

          {guidance.urgency && (
            <em>Urgency for this stage: {guidance.urgency}</em>
          )}

          <small>{guidance.disclaimer}</small>
        </div>
      )}
    </div>
  );
}
