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
  extractOrderText,
  type ExplainResult,
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

   "Explain this order" reads the file and returns the points
   in plain English. The service cannot read a photograph on a
   host without OCR, and when that happens the card says so
   and offers a text box instead of pretending it understood.
   ========================================================= */

type CourtOrdersPageProps = {
  userId: string;
  onBack: () => void;
};

type Explained = ExplainResult & { docId: string };

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

  const [workingDoc, setWorkingDoc] = useState<string | null>(null);
  const [explained, setExplained] = useState<Explained | null>(null);
  const [needsTextDoc, setNeedsTextDoc] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* ---- reading an order ---- */

  const runExplanation = async (
    document: CaseDocument,
    file: File | null,
  ) => {
    setWorkingDoc(document.id);
    setError(null);
    setExplained(null);
    setNeedsTextDoc(null);

    try {
      if (file) {
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
      setError(
        err instanceof Error
          ? err.message
          : "The order could not be explained.",
      );
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

    try {
      const result = await explainOrderText(paste, document.name);

      setExplained({ ...result, docId: document.id });
      setNeedsTextDoc(null);
      setPaste("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The order could not be explained.",
      );
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
              Choose the case this order belongs to, then the file — an image
              or a PDF. It is saved to that case and explained straight away.
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
                                  needsTextDoc === document.id
                                ) {
                                  setExplained(null);
                                  setNeedsTextDoc(null);
                                }
                              }}
                            >
                              Remove from this case
                            </button>

                            {/* ---- paste fallback ---- */}

                            {openPaste && !busy && (
                              <div className="explain-panel">
                                <div className="explain-note">
                                  This file could not be read on this
                                  device, so there is nothing to summarise
                                  from it yet. Paste the text of the order
                                  below and it will be explained in plain
                                  language.
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
