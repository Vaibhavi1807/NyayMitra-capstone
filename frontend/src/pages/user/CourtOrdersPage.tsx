import { useState } from "react";

import { getOngoingCasesForUser } from "../../api/caseApi";
import {
  addDocument,
  listDocuments,
  readFileAsDataUrl,
  removeDocument,
  type CaseDocument,
} from "../../api/documentApi";
import {
  explainOrderText,
  explainOrderUpload,
  extractOrderText,
  type CourtOrderLayers,
  type ExplainResult,
  type UploadExplainResult,
} from "../../api/courtOrderApi";
import {
  simplifyAndTranslate,
  type LegalSimplifyResponse,
  type SimplifyTargetLang,
} from "../../api/translationApi";
import LegalOrderExplainer from "../../components/LegalOrderExplainer";

/* =========================================================
   COURT ORDERS

   Three things changed here, and the old screen needed all
   three:

   The upload actually files something. It used to hold a
   File object and do nothing with it; now it writes to the
   case's document store under the case you picked.

   The orders are grouped by case, which is how a person
   thinks about them — not one flat list of unrelated files.

   "Explain this order" now sends the file itself to the
   service, which validates it, reads it (OCR where the page
   is a scan), splits it into the five sections a court order
   is written in and explains each — in English, Hindi or
   Marathi, whichever is selected. Every answer is offered in
   three steps: the order as written, the same words in simple
   English, and that simple English translated, with an arrow
   from one to the next so the reader can see exactly what
   changed at each step. An image still goes through the
   older read-then-explain path, and anything the service
   refuses opens a text box rather than a dead
   end: the text of the order explains itself just as well.
   ========================================================= */

type CourtOrdersPageProps = {
  userId: string;
  onBack: () => void;
};

type Explained = ExplainResult & { docId: string };

/* An uploaded PDF's answer: the same plain-language fields as
   above, plus the document's five sections and how it was read. */
type Uploaded = UploadExplainResult & { docId: string };

/* The languages the service will explain an order in — an uploaded
   PDF and a pasted text alike. English keeps two layers; the other
   two add the third. */
const EXPLAIN_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
];

/* Step three of the explainer is asked for separately from the
   explanation: Marathi, Hindi, or plain English — which stops the
   pipeline at layer two and only takes the wording apart. The `api`
   values are IndicTrans2's own language codes. */
const SIMPLIFY_LANGUAGES: {
  code: string;
  label: string;
  api: SimplifyTargetLang;
}[] = [
  { code: "mr", label: "मराठी (Marathi)", api: "mar_Deva" },
  { code: "hi", label: "हिंदी (Hindi)", api: "hin_Deva" },
  { code: "en", label: "English", api: "eng_Latn" },
];

/* The three steps, labelled for whatever language is in play. Step
   three exists only when a language other than English was picked,
   and it is always the *simple* layer that was translated. */
function layerLabels(language: string) {
  const target =
    EXPLAIN_LANGUAGES.find((item) => item.code === language)?.label ??
    language;

  return {
    legal: "1 · Original legal text",
    simple: "2 · Simple English",
    translated: `3 · ${target}, from the simple English`,
  };
}

/* One piece of text, shown as the three steps it arrives in. The
   arrows are the whole point: each panel is the one above it, made
   readable. Nothing here is composed — layer one is the document's
   own wording, taken straight from the answer. */
function OrderLayers({
  layers,
  language,
}: {
  layers: CourtOrderLayers;
  language: string;
}) {
  const labels = layerLabels(language);

  /* A passage with no plain equivalent — headings, dates, a
     signature — comes back unchanged, and that is worth stating
     rather than repeating the same text twice under a heading
     promising something different. */
  const needsNoRewording =
    Boolean(layers.legal) && layers.legal === layers.simple;

  return (
    <div className="order-layers">
      <div className="order-layer order-layer-legal">
        <span className="order-layer-tag">{labels.legal}</span>
        <p>{layers.legal}</p>
      </div>

      <span className="order-layer-down" aria-hidden="true">
        ↓
      </span>

      <div className="order-layer order-layer-simple">
        <span className="order-layer-tag">{labels.simple}</span>
        <p>{layers.simple}</p>

        {needsNoRewording && (
          <em className="order-layer-note">
            No plainer wording was found for this passage, so it is
            shown exactly as written.
          </em>
        )}
      </div>

      {layers.translated && (
        <>
          <span className="order-layer-down" aria-hidden="true">
            ↓
          </span>

          <div className="order-layer order-layer-translated">
            <span className="order-layer-tag">{labels.translated}</span>
            <p>{layers.translated}</p>
          </div>
        </>
      )}
    </div>
  );
}

/* The language chooser and the run button for the three-layer
   answer. It sits above the document as a whole ("Understand this
   order") and inside a single section ("Simplify & Translate") —
   same control, same behaviour, only the wording differs. */
function SimplifyControls({
  value,
  onChange,
  busy,
  running,
  label,
  onRun,
}: {
  value: string;
  onChange: (next: string) => void;
  busy: boolean;
  running: boolean;
  label: string;
  onRun: () => void;
}) {
  return (
    <div className="order-simplify-controls">
      <label className="order-simplify-lang">
        <span>Step 3 in</span>

        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={busy}
        >
          {SIMPLIFY_LANGUAGES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="order-simplify-run"
        disabled={busy}
        onClick={onRun}
      >
        {running ? "Working out the three layers…" : label}
      </button>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";

  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/* Turn a stored copy back into a File so an order uploaded earlier can
   be re-read without asking for it twice. */
function fileFromStored(document: CaseDocument): File | null {
  if (!document.dataUrl) return null;

  const [head, base64] = document.dataUrl.split(",");
  const mime = /data:(.*?);/.exec(head)?.[1] ?? document.mime;

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], document.name, { type: mime });
  } catch {
    return null;
  }
}

export default function CourtOrdersPage({
  userId,
  onBack,
}: CourtOrdersPageProps) {
  const cases = getOngoingCasesForUser(userId);

  /* Bumped after every write so the grouped lists below re-read the
     store. Nothing here is derived once and cached — a document added
     a moment ago has to appear without a reload. The value itself is
     never read; incrementing it is what forces the render. */
  const [, setVersion] = useState(0);

  const [targetCnr, setTargetCnr] = useState(
    () => cases[0]?.cnr_number ?? "",
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  /* Language for the next explanation of an uploaded PDF. */
  const [language, setLanguage] = useState("en");

  /* ---- "Simplify & Translate": one call, three layers ----
     `simplifyLanguage` is the language chooser for step three, and
     the answers are kept per section so opening one section's
     explanation never overwrites another's. `simplifyBusy` names
     whichever run is in flight ("document" or a section id). */
  const [simplifyLanguage, setSimplifyLanguage] = useState("mr");
  const [docSimplify, setDocSimplify] =
    useState<LegalSimplifyResponse | null>(null);
  const [sectionSimplify, setSectionSimplify] = useState<
    Record<string, LegalSimplifyResponse | null>
  >({});
  const [simplifyBusy, setSimplifyBusy] = useState<string | null>(null);
  const [simplifyError, setSimplifyError] = useState<string | null>(null);

  const [workingDoc, setWorkingDoc] = useState<string | null>(null);
  const [explained, setExplained] = useState<Explained | null>(null);
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [needsTextDoc, setNeedsTextDoc] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* A failure while reading one card belongs on that card. The
     upload form's own error stays where it is — filing a document
     and reading one are different mistakes. */
  const [cardError, setCardError] = useState<{
    docId: string;
    message: string;
  } | null>(null);

  /* ---- reading an order ---- */

  const runExplanation = async (
    document: CaseDocument,
    file: File | null,
  ) => {
    setWorkingDoc(document.id);
    setError(null);
    setExplained(null);
    setUploaded(null);
    setNeedsTextDoc(null);
    setCardError(null);
    setDocSimplify(null);
    setSectionSimplify({});
    setSimplifyError(null);

    try {
      if (file) {
        const isPdf =
          file.type === "application/pdf" || /\.pdf$/i.test(file.name);

        if (isPdf) {
          /* One request: validated, security scanned, read (OCR for a
             page that is only a scan), split into the five sections
             and explained — in the selected language. */
          const result = await explainOrderUpload(file, language);

          setUploaded({ ...result, docId: document.id });
          return;
        }

        /* An image takes the older two-step path: read the text,
           then explain it. */
        const extracted = await extractOrderText(file);

        if (extracted.ok && extracted.text.trim()) {
          const result = await explainOrderText(
            extracted.text,
            document.name,
            language,
          );

          setExplained({ ...result, docId: document.id });
          return;
        }

        /* A normal answer, not a failure: this host could not read the
           file, and the card now needs the text from the reader. */
        setNeedsTextDoc(document.id);
        return;
      }

      setNeedsTextDoc(document.id);
    } catch (err) {
      /* The service refuses in its own words — not a PDF, too large,
         not acceptable on security grounds — and those are shown as
         they arrive. The paste box opens beside them, because the
         text of the same order can still be explained without the
         file ever being accepted. */
      setCardError({
        docId: document.id,
        message:
          err instanceof Error
            ? err.message
            : "The order could not be explained.",
      });
      setNeedsTextDoc(document.id);
    } finally {
      setWorkingDoc(null);
    }
  };

  const explainExisting = (document: CaseDocument) =>
    void runExplanation(document, fileFromStored(document));

  const submitPastedText = async (document: CaseDocument) => {
    if (!paste.trim()) return;

    setWorkingDoc(document.id);
    setError(null);
    setCardError(null);
    setDocSimplify(null);
    setSectionSimplify({});
    setSimplifyError(null);

    try {
      const result = await explainOrderText(paste, document.name, language);

      setExplained({ ...result, docId: document.id });
      setUploaded(null);
      setNeedsTextDoc(null);
      setPaste("");
    } catch (err) {
      setCardError({
        docId: document.id,
        message:
          err instanceof Error
            ? err.message
            : "The order could not be explained.",
      });
    } finally {
      setWorkingDoc(null);
    }
  };

  /* ---- one request, three layers ----

     Used twice: for the document as a whole ("Understand this
     order") and for a single section ("Simplify & Translate").
     `key` is "document" or the section id — the spinner and the
     answer both hang off it, so starting one never clears another. */
  async function runSimplify(key: string, text: string | null) {
    const body = (text || "").trim();

    if (!body || simplifyBusy) return;

    const target = SIMPLIFY_LANGUAGES.find(
      (item) => item.code === simplifyLanguage,
    );

    if (!target) {
      setSimplifyError("Unsupported language selected.");
      return;
    }

    setSimplifyBusy(key);
    setSimplifyError(null);

    if (key === "document") {
      setDocSimplify(null);
    } else {
      setSectionSimplify((previous) => ({ ...previous, [key]: null }));
    }

    try {
      const answer = await simplifyAndTranslate({
        text: body,
        target_lang: target.api,
      });

      if (key === "document") {
        setDocSimplify(answer);
      } else {
        setSectionSimplify((previous) => ({ ...previous, [key]: answer }));
      }
    } catch (err) {
      setSimplifyError(
        err instanceof Error && err.message
          ? err.message
          : "The text could not be simplified and translated.",
      );
    } finally {
      setSimplifyBusy(null);
    }
  }

  /* ---- filing an order ---- */

  async function handleUpload(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!pendingFile || !targetCnr || uploading) return;

    setUploading(true);
    setError(null);

    try {
      const dataUrl = await readFileAsDataUrl(pendingFile);

      const document = addDocument({
        cnr: targetCnr,
        owner_user_id: userId,
        category: "Court order",
        file: pendingFile,
        dataUrl,
      });

      const file = pendingFile;
      setPendingFile(null);
      setVersion((value) => value + 1);

      /* Straight into the explanation: the upload and the question the
         reader came to ask are one action, not two. */
      await runExplanation(document, file);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The order was not filed.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="court-orders-page">
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
      <section className="court-orders-hero">
        <div className="hero-badge">⚖ NYAYMITRA COURT SERVICES</div>

        <h1>
          Find and understand
          <br />
          <span>your court orders</span>
        </h1>

        <p>
          Upload an order against the case it belongs to, and NyayMitra will
          read it back to you in plain language — grouped by the matter, the
          way your advocate would file them.
        </p>
      </section>

      {/* MAIN CONTENT */}
      <section className="order-content">
        {/* UPLOAD */}
        <form className="upload-card" onSubmit={handleUpload}>
          <div className="upload-icon">📄</div>

          <div className="upload-text">
            <h2>Explain a Court Order</h2>

            <p>
              Choose the case this order belongs to, then the file — a
              PDF or an image. It is saved to that case and explained
              in three steps: the order exactly as written, the same
              words in simple English, and that plain English in
              Hindi or Marathi — whichever language is picked below.
            </p>

            <div className="upload-fields">
              <select
                value={targetCnr}
                onChange={(event) => setTargetCnr(event.target.value)}
                aria-label="Case this order belongs to"
              >
                {cases.length === 0 && (
                  <option value="">No ongoing cases</option>
                )}

                {cases.map((caseData) => (
                  <option
                    key={caseData.cnr_number}
                    value={caseData.cnr_number}
                  >
                    {caseData.cnr_number} — {caseData.case_type}
                  </option>
                ))}
              </select>

              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                aria-label="Language for the explanation"
                className="explain-language"
              >
                {EXPLAIN_LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>

              <label className="upload-button">
                {pendingFile ? pendingFile.name : "Choose file"}

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(event) =>
                    setPendingFile(event.target.files?.[0] ?? null)
                  }
                  hidden
                />
              </label>

              <button
                type="submit"
                className="upload-submit"
                disabled={!pendingFile || !targetCnr || uploading}
              >
                {uploading ? "Reading…" : "Upload and explain"}
              </button>
            </div>

            {error && (
              <p className="upload-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </form>

        {/* HEADING */}
        <div className="orders-heading">
          <div>
            <span className="section-label">YOUR DOCUMENTS</span>

            <h2>Court orders by case</h2>
          </div>

          <div className="order-count">
            {
              cases.reduce(
                (total, caseData) =>
                  total +
                  listDocuments(caseData.cnr_number).filter(
                    (document) => document.category === "Court order",
                  ).length,
                0,
              )
            }{" "}
            Orders
          </div>
        </div>

        {/* GROUPED BY CASE */}
        {cases.length === 0 ? (
          <div className="empty-orders">
            <div>⚖</div>

            <h3>No ongoing cases on this account</h3>

            <p>
              Court orders are filed against a case. File a case from My
              Cases and its orders will be listed here.
            </p>
          </div>
        ) : (
          <div className="orders-by-case">
            {cases.map((caseData) => {
              const orders = listDocuments(caseData.cnr_number).filter(
                (document) => document.category === "Court order",
              );

              return (
                <section
                  className="orders-case"
                  key={caseData.cnr_number}
                >
                  <header className="orders-case-head">
                    <div>
                      <span className="orders-case-cnr">
                        {caseData.cnr_number}
                      </span>

                      <h3>{caseData.case_type}</h3>

                      <p>
                        {caseData.court_name} · Next hearing{" "}
                        {formatDate(caseData.next_hearing_date)}
                      </p>
                    </div>

                    <span className="orders-case-count">
                      {orders.length}{" "}
                      {orders.length === 1 ? "order" : "orders"}
                    </span>
                  </header>

                  {orders.length === 0 ? (
                    <div className="orders-empty-row">
                      No court orders uploaded for this case yet.
                    </div>
                  ) : (
                    <div className="orders-grid">
                      {orders.map((document) => {
                        const busy = workingDoc === document.id;
                        const openExplanation =
                          explained?.docId === document.id;
                        const openUpload = uploaded?.docId === document.id;
                        const openPaste =
                          needsTextDoc === document.id;

                        return (
                          <article
                            className="order-card"
                            key={document.id}
                          >
                            <div className="order-card-top">
                              <div className="document-icon">📄</div>

                              <div className="available-badge">
                                {document.dataUrl
                                  ? "Available"
                                  : "Record only"}
                              </div>
                            </div>

                            <div className="order-type">
                              {document.category}
                            </div>

                            <h3 title={document.name}>
                              {document.name}
                            </h3>

                            <div className="order-details">
                              <div>
                                <span>Size</span>
                                <strong>
                                  {formatBytes(document.size)}
                                </strong>
                              </div>

                              <div>
                                <span>Uploaded</span>
                                <strong>
                                  {formatDate(
                                    document.uploadedAt.slice(0, 10),
                                  )}
                                </strong>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="explain-button"
                              disabled={busy}
                              onClick={() => explainExisting(document)}
                            >
                              <span>
                                {busy
                                  ? "Reading the order…"
                                  : "Explain this order"}
                              </span>

                              <span>→</span>
                            </button>

                            <button
                              type="button"
                              className="order-remove"
                              onClick={() => {
                                removeDocument(document.id);
                                setVersion((value) => value + 1);

                                if (
                                  explained?.docId === document.id ||
                                  uploaded?.docId === document.id ||
                                  needsTextDoc === document.id
                                ) {
                                  setExplained(null);
                                  setUploaded(null);
                                  setNeedsTextDoc(null);
                                }

                                if (cardError?.docId === document.id) {
                                  setCardError(null);
                                }
                              }}
                            >
                              Remove from this case
                            </button>

                            {/* ---- refusal, on this card ---- */}

                            {cardError?.docId === document.id && !busy && (
                              <p className="order-card-error" role="alert">
                                {cardError.message}
                              </p>
                            )}

                            {/* ---- paste fallback ---- */}

                            {openPaste && !busy && (
                              <div className="explain-panel">
                                <div className="explain-note">
                                  The file was not read, so there is
                                  nothing to summarise from it yet.
                                  Paste the text of the order below and
                                  it will be shown in three steps: as
                                  written, in simple English, and in the
                                  language picked above.
                                </div>

                                <textarea
                                  rows={6}
                                  value={paste}
                                  onChange={(event) =>
                                    setPaste(event.target.value)
                                  }
                                  placeholder="Paste the text of the court order…"
                                />

                                <button
                                  type="button"
                                  className="explain-submit"
                                  disabled={!paste.trim()}
                                  onClick={() =>
                                    void submitPastedText(document)
                                  }
                                >
                                  Explain in simple words
                                </button>
                              </div>
                            )}

                            {/* ---- explanation of an uploaded PDF ----
                                 Every section the document contains is
                                 shown, and every one it does not is said
                                 out loud — a missing Proceedings block is
                                 a fact about the file, never a gap to
                                 fill in. */}

                            {openUpload && uploaded && !busy && (
                              <div className="explain-panel">
                                {uploaded.layers?.legal ? (
                                  <OrderLayers
                                    layers={uploaded.layers}
                                    language={uploaded.language}
                                  />
                                ) : (
                                  <p className="explain-summary">
                                    {uploaded.summary}
                                  </p>
                                )}

                                <div className="order-badges">
                                  <span className="order-badge">
                                    📄 {uploaded.filename}
                                  </span>

                                  <span className="order-badge">
                                    {uploaded.metadata.page_count}{" "}
                                    {uploaded.metadata.page_count === 1
                                      ? "page"
                                      : "pages"}
                                  </span>

                                  {uploaded.metadata.ocr_used && (
                                    <span className="order-badge order-badge-accent">
                                      Text read by OCR
                                    </span>
                                  )}

                                  <span className="order-badge">
                                    Security scan:{" "}
                                    {uploaded.metadata.security_scan.status}
                                  </span>

                                  {uploaded.translation?.applied && (
                                    <span className="order-badge order-badge-accent">
                                      Explained in{" "}
                                      {EXPLAIN_LANGUAGES.find(
                                        (item) =>
                                          item.code ===
                                          uploaded.language,
                                      )?.label ?? uploaded.language}
                                    </span>
                                  )}
                                </div>

                                <div className="order-simplify-bar">
                                  <div className="order-simplify-intro">
                                    <strong>Understand this order</strong>
                                    <span>
                                      Original wording → simple English →
                                      that plain English in the language
                                      picked below.
                                    </span>
                                  </div>

                                  <SimplifyControls
                                    value={simplifyLanguage}
                                    onChange={setSimplifyLanguage}
                                    busy={Boolean(simplifyBusy)}
                                    running={simplifyBusy === "document"}
                                    label={
                                      simplifyBusy === "document"
                                        ? "Working…"
                                        : docSimplify
                                          ? "Run again"
                                          : "Understand this order"
                                    }
                                    onRun={() =>
                                      void runSimplify(
                                        "document",
                                        uploaded.layers?.legal ??
                                          uploaded.summary,
                                      )
                                    }
                                  />
                                </div>

                                {simplifyError && (
                                  <p
                                    className="order-simplify-error"
                                    role="alert"
                                  >
                                    {simplifyError}
                                  </p>
                                )}

                                {docSimplify && (
                                  <LegalOrderExplainer
                                    result={docSimplify}
                                  />
                                )}

                                <div className="order-sections">
                                  {uploaded.sections.map((section) => (
                                    <section
                                      className="order-section"
                                      key={section.section_id}
                                    >
                                      <header>
                                        <h4>{section.title}</h4>

                                        {!section.available && (
                                          <span className="order-section-missing">
                                            Not in this document
                                          </span>
                                        )}
                                      </header>

                                      {!section.available ? (
                                        <p className="order-section-absent">
                                          Not available in the document.
                                        </p>
                                      ) : section.layers?.legal ? (
                                        <OrderLayers
                                          layers={section.layers}
                                          language={uploaded.language}
                                        />
                                      ) : section.translated_text ? (
                                        <p className="order-section-text">
                                          {section.translated_text}
                                        </p>
                                      ) : section.paragraphs.length > 0 ? (
                                        section.paragraphs.map(
                                          (paragraph, index) => (
                                            <p
                                              className="order-section-text"
                                              key={`${section.section_id}_${
                                                paragraph.number ?? index
                                              }`}
                                            >
                                              {paragraph.text}
                                            </p>
                                          ),
                                        )
                                      ) : (
                                        <p className="order-section-text">
                                          {section.text}
                                        </p>
                                      )}

                                      {section.available &&
                                        section.explanation.length > 0 && (
                                          <ul className="order-section-points">
                                            {section.explanation.map(
                                              (point) => (
                                                <li key={point.heading}>
                                                  <strong>
                                                    {point.heading}
                                                  </strong>
                                                  <span>{point.plain}</span>
                                                </li>
                                              ),
                                            )}
                                          </ul>
                                        )}

                                      {section.available &&
                                        section.key_dates.length > 0 && (
                                          <div className="order-section-dates">
                                            {section.key_dates.map(
                                              (date) => (
                                                <em key={date}>{date}</em>
                                              ),
                                            )}
                                          </div>
                                        )}

                                      {/* ---- this section, in three
                                           layers ---- */}

                                      {section.available && (
                                        <div className="order-section-simplify">
                                          <SimplifyControls
                                            value={simplifyLanguage}
                                            onChange={setSimplifyLanguage}
                                            busy={Boolean(simplifyBusy)}
                                            running={
                                              simplifyBusy ===
                                              section.section_id
                                            }
                                            label={
                                              simplifyBusy ===
                                              section.section_id
                                                ? "Working…"
                                                : sectionSimplify[
                                                      section.section_id
                                                    ]
                                                  ? "Run again"
                                                  : "Simplify & Translate"
                                            }
                                            onRun={() =>
                                              void runSimplify(
                                                section.section_id,
                                                section.layers?.legal ??
                                                  section.text,
                                              )
                                            }
                                          />

                                          {sectionSimplify[
                                            section.section_id
                                          ] && (
                                            <LegalOrderExplainer
                                              result={
                                                sectionSimplify[
                                                  section.section_id
                                                ] as LegalSimplifyResponse
                                              }
                                            />
                                          )}
                                        </div>
                                      )}
                                    </section>
                                  ))}
                                </div>

                                {uploaded.terms.length > 0 && (
                                  <div className="explain-terms">
                                    <span>Words used, in plain terms</span>

                                    <dl>
                                      {uploaded.terms.map((term) => (
                                        <div key={term.term}>
                                          <dt>{term.term}</dt>
                                          <dd>{term.plain}</dd>
                                        </div>
                                      ))}
                                    </dl>
                                  </div>
                                )}

                                <p className="explain-disclaimer">
                                  {uploaded.disclaimer}
                                </p>

                                <button
                                  type="button"
                                  className="explain-clear"
                                  onClick={() => setUploaded(null)}
                                >
                                  Close explanation
                                </button>
                              </div>
                            )}

                            {/* ---- explanation ---- */}

                            {openExplanation && explained && (
                              <div className="explain-panel">
                                {explained.layers?.legal ? (
                                  <OrderLayers
                                    layers={explained.layers}
                                    language={explained.language ?? "en"}
                                  />
                                ) : (
                                  <p className="explain-summary">
                                    {explained.summary}
                                  </p>
                                )}

                                <div className="order-simplify-bar">
                                  <div className="order-simplify-intro">
                                    <strong>Understand this order</strong>
                                    <span>
                                      Original wording → simple English →
                                      that plain English in the language
                                      picked below.
                                    </span>
                                  </div>

                                  <SimplifyControls
                                    value={simplifyLanguage}
                                    onChange={setSimplifyLanguage}
                                    busy={Boolean(simplifyBusy)}
                                    running={simplifyBusy === "document"}
                                    label={
                                      simplifyBusy === "document"
                                        ? "Working…"
                                        : docSimplify
                                          ? "Run again"
                                          : "Understand this order"
                                    }
                                    onRun={() =>
                                      void runSimplify(
                                        "document",
                                        explained.layers?.legal ??
                                          explained.summary,
                                      )
                                    }
                                  />
                                </div>

                                {simplifyError && (
                                  <p
                                    className="order-simplify-error"
                                    role="alert"
                                  >
                                    {simplifyError}
                                  </p>
                                )}

                                {docSimplify && (
                                  <LegalOrderExplainer
                                    result={docSimplify}
                                  />
                                )}

                                <ol className="explain-points">
                                  {explained.points.map((point) => (
                                    <li key={point.heading}>
                                      <strong>{point.heading}</strong>
                                      <span>{point.plain}</span>
                                    </li>
                                  ))}
                                </ol>

                                {explained.key_dates.length > 0 && (
                                  <div className="explain-dates">
                                    <span>Dates in this order</span>

                                    <div>
                                      {explained.key_dates.map((date) => (
                                        <em key={date}>{date}</em>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {explained.terms.length > 0 && (
                                  <div className="explain-terms">
                                    <span>Words used, in plain terms</span>

                                    <dl>
                                      {explained.terms.map((term) => (
                                        <div key={term.term}>
                                          <dt>{term.term}</dt>
                                          <dd>{term.plain}</dd>
                                        </div>
                                      ))}
                                    </dl>
                                  </div>
                                )}

                                <p className="explain-disclaimer">
                                  {explained.disclaimer}
                                </p>

                                <button
                                  type="button"
                                  className="explain-clear"
                                  onClick={() => setExplained(null)}
                                >
                                  Close explanation
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
