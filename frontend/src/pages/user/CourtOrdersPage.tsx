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
  type ExplainResult,
  type UploadExplainResult,
} from "../../api/courtOrderApi";

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
   Marathi, whichever is selected. An image still goes
   through the older read-then-explain path, and anything
   the service refuses opens a text box rather than a dead
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

/* The languages the service will explain an uploaded order in.
   The pasted-text path below is English-only, so the selector
   labels itself as applying to the uploaded document. */
const EXPLAIN_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
];

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

    try {
      const result = await explainOrderText(paste, document.name);

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
              straight away, in the language picked below.
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
                                  it will be explained in plain language.
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
                                <p className="explain-summary">
                                  {uploaded.summary}
                                </p>

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
                                <p className="explain-summary">
                                  {explained.summary}
                                </p>

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
