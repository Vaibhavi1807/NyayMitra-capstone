import { useState } from "react";

import { translateText } from "../../api/translationApi";

type TranslationPageProps = {
  onBack: () => void;
};

type Language = {
  code: "en" | "hi" | "mr";
  name: string;
  apiCode: "eng_Latn" | "hin_Deva" | "mar_Deva";
};

const languages: Language[] = [
  {
    code: "en",
    name: "English",
    apiCode: "eng_Latn",
  },
  {
    code: "hi",
    name: "Hindi",
    apiCode: "hin_Deva",
  },
  {
    code: "mr",
    name: "Marathi",
    apiCode: "mar_Deva",
  },
];

export default function TranslationPage({
  onBack,
}: TranslationPageProps) {
  const [sourceLanguage, setSourceLanguage] =
    useState<"en" | "hi" | "mr">("en");

  const [targetLanguage, setTargetLanguage] =
    useState<"hi" | "mr">("mr");

  const [text, setText] = useState("");

  const [translatedText, setTranslatedText] =
    useState("");

  const [copied, setCopied] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleTranslate = async () => {
    if (!text.trim()) return;

    setLoading(true);
    setError("");
    setTranslatedText("");
    setCopied(false);

    if (sourceLanguage === targetLanguage) {
      setTranslatedText(text);
      setLoading(false);
      return;
    }

    const source = languages.find(
      (language) => language.code === sourceLanguage
    );

    const target = languages.find(
      (language) => language.code === targetLanguage
    );

    if (!source || !target) {
      setError("Unsupported language selected.");
      setLoading(false);
      return;
    }

    try {
      const data = await translateText({
        case_id: "demo-001",
        source_text: text,
        source_lang: sourceLanguage,
        target_lang: targetLanguage,
      });

      setTranslatedText(
        data.translated_text || ""
      );
    } catch (error) {
      console.error(
        "Translation error:",
        error
      );

      setError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to translate. Please make sure the NyayMitra translation service is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    const newSource = targetLanguage;
    const newTarget =
      sourceLanguage === "en"
        ? "hi"
        : sourceLanguage === "hi"
        ? "mr"
        : "hi";

    setSourceLanguage(newSource);
    setTargetLanguage(newTarget);

    if (translatedText) {
      setText(translatedText);
      setTranslatedText("");
    }
  };

  const handleClear = () => {
    setText("");
    setTranslatedText("");
    setCopied(false);
    setError("");
  };

  const handleCopy = async () => {
    if (!translatedText) return;

    try {
      await navigator.clipboard.writeText(
        translatedText
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  };

  const sourceName =
    languages.find(
      (language) =>
        language.code === sourceLanguage
    )?.name || "English";

  const targetName =
    languages.find(
      (language) =>
        language.code === targetLanguage
    )?.name || "Marathi";

  return (
    <main className="translation-page">

      {/* BACK TO DASHBOARD */}
      <div className="page-back-wrapper">
        <button
          type="button"
          className="page-back-button"
          onClick={onBack}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* HERO */}
      <section className="translation-hero">

        <div className="translation-hero-glow" />

        <div className="translation-hero-content">

          <div className="translation-eyebrow">
            <span>文</span>
            NYAYMITRA LANGUAGE ASSISTANCE
          </div>

          <h1>
            Understand the law
            <br />
            <span>in your language</span>
          </h1>

          <p>
            Translate difficult legal language into
            Hindi or Marathi for clearer understanding.
          </p>

          <div className="translation-hero-pills">
            <span>Hindi</span>
            <span>Marathi</span>
            <span>Legal Text</span>
          </div>

        </div>

      </section>

      {/* MAIN */}
      <section className="translation-main">

        {/* LANGUAGE SELECTOR */}
        <div className="translation-language-card">

          <div className="translation-language-side">

            <span className="translation-small-label">
              SOURCE LANGUAGE
            </span>

            <select
              value={sourceLanguage}
              onChange={(event) => {
                const value =
                  event.target.value as
                    | "en"
                    | "hi"
                    | "mr";

                setSourceLanguage(value);

                if (value === "hi") {
                  setTargetLanguage("mr");
                } else if (value === "mr") {
                  setTargetLanguage("hi");
                } else {
                  setTargetLanguage("mr");
                }

                setTranslatedText("");
                setError("");
              }}
            >
              {languages.map((language) => (
                <option
                  key={language.code}
                  value={language.code}
                >
                  {language.name}
                </option>
              ))}
            </select>

          </div>

          <button
            type="button"
            className="translation-swap-button"
            onClick={handleSwap}
            aria-label="Swap languages"
          >
            ⇄
          </button>

          <div className="translation-language-side">

            <span className="translation-small-label">
              TRANSLATE TO
            </span>

            <select
              value={targetLanguage}
              onChange={(event) =>
                setTargetLanguage(
                  event.target.value as
                    | "hi"
                    | "mr"
                )
              }
            >
              {languages
                .filter(
                  (language) =>
                    language.code !==
                    sourceLanguage
                )
                .filter(
                  (language) =>
                    language.code !== "en"
                )
                .map((language) => (
                  <option
                    key={language.code}
                    value={language.code}
                  >
                    {language.name}
                  </option>
                ))}
            </select>

          </div>

        </div>

        {/* WORKSPACE */}
        <div className="translation-workspace">

          {/* SOURCE */}
          <div className="translation-editor">

            <div className="translation-editor-header">

              <div>
                <span className="translation-editor-label">
                  YOUR LEGAL TEXT
                </span>

                <strong>
                  {sourceName}
                </strong>
              </div>

              {text && (
                <button
                  type="button"
                  className="translation-text-action"
                  onClick={() =>
                    setText("")
                  }
                >
                  Clear
                </button>
              )}

            </div>

            <textarea
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
              placeholder="Paste your court order, notice, judgment or legal text here..."
            />

            <div className="translation-editor-footer">

              <span>
                {text.length} characters
              </span>

              <span>
                Legal document translation
              </span>

            </div>

          </div>

          {/* RESULT */}
          <div className="translation-editor translation-output">

            <div className="translation-editor-header">

              <div>
                <span className="translation-editor-label">
                  TRANSLATED TEXT
                </span>

                <strong>
                  {targetName}
                </strong>
              </div>

              {translatedText && (
                <button
                  type="button"
                  className="translation-text-action"
                  onClick={handleCopy}
                >
                  {copied
                    ? "Copied ✓"
                    : "Copy"}
                </button>
              )}

            </div>

            <div
              className={
                translatedText
                  ? "translation-output-text"
                  : "translation-output-text empty"
              }
            >

              {loading ? (
                <>
                  <span className="translation-output-icon">
                    ⟳
                  </span>

                  <span>
                    Translating...
                  </span>

                  <small>
                    Please wait while NyayMitra
                    processes the legal text.
                  </small>
                </>
              ) : translatedText ? (
                translatedText
              ) : (
                <>
                  <span className="translation-output-icon">
                    文
                  </span>

                  <span>
                    Your translation will appear here
                  </span>

                  <small>
                    Enter legal text on the left
                    and click “Translate Text”.
                  </small>
                </>
              )}

            </div>

            <div className="translation-editor-footer">

              <span>
                {translatedText.length} characters
              </span>

              <span>
                NyayMitra language assistance
              </span>

            </div>

          </div>

        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#fff1f1",
              color: "#b42318",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {/* ACTIONS */}
        <div className="translation-action-row">

          <button
            type="button"
            className="translation-primary-button"
            onClick={handleTranslate}
            disabled={
              !text.trim() || loading
            }
          >
            <span>文</span>

            {loading
              ? "Translating..."
              : "Translate Text"}

            <strong>→</strong>
          </button>

          <button
            type="button"
            className="translation-secondary-button"
            onClick={handleClear}
          >
            Start Again
          </button>

        </div>

        {/* QUICK EXAMPLES */}
        <div className="translation-example-section">

          <div className="translation-section-heading">

            <div>
              <span className="section-label">
                QUICK START
              </span>

              <h2>
                What can you translate?
              </h2>
            </div>

          </div>

          <div className="translation-example-grid">

            <button
              type="button"
              onClick={() =>
                setText(
                  "The court has directed both parties to appear before the court on the next scheduled hearing date."
                )
              }
            >
              <span>⚖</span>

              <div>
                <strong>
                  Court Orders
                </strong>

                <small>
                  Understand directions issued by
                  the court
                </small>
              </div>

              <b>→</b>
            </button>

            <button
              type="button"
              onClick={() =>
                setText(
                  "The petitioner is directed to submit the required documents within the prescribed period."
                )
              }
            >
              <span>▤</span>

              <div>
                <strong>
                  Legal Notices
                </strong>

                <small>
                  Translate formal legal
                  communication
                </small>
              </div>

              <b>→</b>
            </button>

            <button
              type="button"
              onClick={() =>
                setText(
                  "The matter is listed for hearing on the next available date."
                )
              }
            >
              <span>◷</span>

              <div>
                <strong>
                  Case Updates
                </strong>

                <small>
                  Understand important case
                  information
                </small>
              </div>

              <b>→</b>
            </button>

          </div>

        </div>

        {/* NOTE */}
        <div className="translation-note">

          <span>ⓘ</span>

          <p>
            <strong>Important:</strong>{" "}
            Translation is intended to improve
            understanding of legal information.
            The translated text should not be treated
            as a replacement for the original legal
            document.
          </p>

        </div>

      </section>

    </main>
  );
}
