import { useMemo, useState } from "react";

import type { Case } from "../types/case";
import type { ChatTarget } from "../api/chatApi";
import {
  DOCUMENT_CATEGORIES,
  addDocument,
  listDocuments,
  readFileAsDataUrl,
  removeDocument,
  type CaseDocument,
  type DocumentCategory,
} from "../api/documentApi";

import "./CaseDetail.css";

/* =========================================================
   MY CASES — ONE MATTER, IN FULL

   The screen behind a case card. It answers the four
   questions a filer actually has about their own case: who
   is on either side, where and when it is next heard, what
   they have already filed, and how to reach the advocate
   handling it.

   The last one matters most. The assigned lawyer is not a
   name in a footer — it is a button, and it opens the thread
   already scoped to this CNR, so the conversation about the
   matter lives with the matter.
   ========================================================= */

type CaseDetailProps = {
  caseData: Case;

  /* Account viewing the file. Documents uploaded here are
     stamped with it, which is what keeps the citizen's copy
     and the lawyer's view distinguishable later. */
  userId: string;

  onBack: () => void;

  /* Opens a chat thread. Omitted where the screen has no
     chat — the component then simply does not offer one
     rather than showing a button that goes nowhere. */
  onChat?: (target: ChatTarget) => void;
};

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

function documentIcon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼";
  if (mime === "application/pdf") return "📄";
  return "📎";
}

/* =========================================================
   DOCUMENT ROW
   ========================================================= */

function DocumentRow({
  document,
  expanded,
  onToggle,
  onRemove,
}: {
  document: CaseDocument;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const previewable = document.dataUrl !== null;

  return (
    <li className="matter-doc">
      <div className="matter-doc-line">
        <span className="matter-doc-icon" aria-hidden="true">
          {documentIcon(document.mime)}
        </span>

        <div className="matter-doc-meta">
          <strong title={document.name}>{document.name}</strong>

          <span>
            {document.category} · {formatBytes(document.size)} ·{" "}
            {formatDate(document.uploadedAt.slice(0, 10))}
          </span>
        </div>

        <div className="matter-doc-actions">
          {previewable ? (
            <button type="button" className="doc-ghost" onClick={onToggle}>
              {expanded ? "Hide" : "Preview"}
            </button>
          ) : (
            <span className="doc-muted">Record only</span>
          )}

          <button
            type="button"
            className="doc-ghost doc-ghost-danger"
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>

      {expanded && previewable && (
        <div className="matter-doc-preview">
          {document.mime.startsWith("image/") ? (
            <img src={document.dataUrl ?? ""} alt={document.name} />
          ) : (
            <object
              data={document.dataUrl ?? ""}
              type={document.mime}
              aria-label={document.name}
            >
              <a href={document.dataUrl ?? ""} download={document.name}>
                Open {document.name}
              </a>
            </object>
          )}
        </div>
      )}

      {!previewable && document.note && (
        <p className="matter-doc-note">{document.note}</p>
      )}
    </li>
  );
}

/* =========================================================
   MAIN
   ========================================================= */

export default function CaseDetail({
  caseData,
  userId,
  onBack,
  onChat,
}: CaseDetailProps) {
  const cnr = caseData.cnr_number;

  const [documents, setDocuments] = useState<CaseDocument[]>(() =>
    listDocuments(cnr),
  );
  const [category, setCategory] = useState<DocumentCategory>("Evidence");
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = () => {
    setDocuments(listDocuments(cnr));
    setExpanded(null);
  };

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.target;
    const files = Array.from(input.files ?? []);

    if (files.length === 0) return;

    setUploading(true);

    try {
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);

        addDocument({
          cnr,
          owner_user_id: userId,
          category,
          file,
          dataUrl,
        });
      }

      refresh();
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  const lawyerName =
    caseData.petitioner_advocate ||
    (caseData.handling_lawyer_id ? "Assigned advocate" : "");

  /* The chat door. Present only when the matter actually has an
     advocate on it — a case the citizen filed unrepresented has
     nobody to message, and pretending otherwise would produce a
     thread with an unknown party on the other end. */
  const canChat =
    Boolean(onChat) && Boolean(caseData.handling_lawyer_id);

  const openLawyerChat = () => {
    if (!canChat || !onChat) return;

    onChat({
      id: caseData.handling_lawyer_id,
      name: lawyerName,
      role: "LAWYER",
      caseCnr: cnr,
    });
  };

  const metrics = caseData.calculated_metrics;

  const groupedHistory = useMemo(
    () => caseData.case_history_timeline ?? [],
    [caseData.case_history_timeline],
  );

  return (
    <section className="matter-detail">
      {/* -------------------------------------------------
          HEADER
          ------------------------------------------------- */}
      <div className="matter-head">
        <button type="button" className="matter-back" onClick={onBack}>
          ← All cases
        </button>

        <div className="matter-head-main">
          <div>
            <span className="matter-eyebrow">CNR NUMBER</span>
            <h2>{cnr}</h2>
            <p className="matter-type">
              {caseData.case_type} · filed {formatDate(caseData.filing_date)}
            </p>
          </div>

          <div className="matter-head-side">
            <span className="matter-stage">{caseData.current_case_stage}</span>

            {canChat && (
              <button
                type="button"
                className="matter-chat-btn"
                onClick={openLawyerChat}
              >
                💬 Chat with assigned lawyer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------
          PARTIES · COURT · SCHEDULE
          ------------------------------------------------- */}
      <div className="matter-grid">
        <article className="matter-card">
          <h3>Parties</h3>

          <div className="matter-parties">
            <div className="matter-party">
              <span className="detail-label">PETITIONER</span>
              <strong>{caseData.petitioner_name}</strong>
            </div>

            <div className="matter-party-arrow" aria-hidden="true">
              →
            </div>

            <div className="matter-party">
              <span className="detail-label">RESPONDENTS</span>
              <strong>{caseData.respondents_list.join(", ")}</strong>
            </div>
          </div>

          <dl className="matter-fields">
            <div>
              <dt>Petitioner's advocate</dt>
              <dd>{caseData.petitioner_advocate || "—"}</dd>
            </div>

            <div>
              <dt>Act applied</dt>
              <dd>
                {caseData.applied_act}
                {caseData.applied_section
                  ? `, Section ${caseData.applied_section}`
                  : ""}
              </dd>
            </div>
          </dl>
        </article>

        <article className="matter-card">
          <h3>Court</h3>

          <dl className="matter-fields">
            <div>
              <dt>Court</dt>
              <dd>{caseData.court_name}</dd>
            </div>

            <div>
              <dt>District</dt>
              <dd>
                {caseData.court_district}, {caseData.court_state}
              </dd>
            </div>

            <div>
              <dt>Presiding judge</dt>
              <dd>{caseData.presiding_judge || "Not yet listed"}</dd>
            </div>

            <div>
              <dt>Filing number</dt>
              <dd>{caseData.filing_number || "—"}</dd>
            </div>
          </dl>
        </article>

        <article className="matter-card">
          <h3>Schedule</h3>

          <div className="matter-hearing">
            <span className="detail-label">NEXT HEARING</span>
            <strong>{formatDate(caseData.next_hearing_date)}</strong>
          </div>

          <dl className="matter-fields">
            <div>
              <dt>First hearing</dt>
              <dd>{formatDate(caseData.first_hearing_date)}</dd>
            </div>

            <div>
              <dt>Registration date</dt>
              <dd>{formatDate(caseData.registration_date)}</dd>
            </div>
          </dl>

          {metrics && (
            <div className="matter-stats">
              <div>
                <strong>{metrics.total_case_age_days}</strong>
                <span>days on file</span>
              </div>

              <div>
                <strong>{metrics.respondent_count}</strong>
                <span>
                  {metrics.respondent_count === 1
                    ? "respondent"
                    : "respondents"}
                </span>
              </div>

              <div>
                <strong>{metrics.current_stage_duration_days}</strong>
                <span>days at this stage</span>
              </div>
            </div>
          )}
        </article>
      </div>

      {/* -------------------------------------------------
          DOCUMENTS
          ------------------------------------------------- */}
      <article className="matter-card matter-documents">
        <div className="matter-card-head">
          <div>
            <h3>Case documents</h3>
            <p>
              Everything you have filed in this matter. The assigned lawyer
              sees the same list.
            </p>
          </div>
        </div>

        <div className="matter-upload">
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as DocumentCategory)
            }
            aria-label="Document category"
          >
            {DOCUMENT_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label className="matter-upload-btn">
            {uploading ? "Uploading…" : "＋ Add documents"}

            <input
              type="file"
              multiple
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {documents.length > 0 ? (
          <ul className="matter-doc-list">
            {documents.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                expanded={expanded === document.id}
                onToggle={() =>
                  setExpanded((current) =>
                    current === document.id ? null : document.id,
                  )
                }
                onRemove={() => {
                  removeDocument(document.id);
                  refresh();
                }}
              />
            ))}
          </ul>
        ) : (
          <div className="matter-empty">
            <span aria-hidden="true">📎</span>
            <p>No documents filed in this matter yet.</p>
          </div>
        )}
      </article>

      {/* -------------------------------------------------
          HISTORY
          ------------------------------------------------- */}
      <article className="matter-card">
        <h3>Hearing history</h3>

        {groupedHistory.length > 0 ? (
          <ol className="matter-timeline">
            {groupedHistory.map((entry, index) => (
              <li key={`${entry.hearing_date}_${index}`}>
                <span className="matter-timeline-date">
                  {formatDate(entry.hearing_date)}
                </span>

                <div>
                  <strong>{entry.purpose_of_hearing}</strong>
                  <span>{entry.judge_title}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="matter-empty">
            <span aria-hidden="true">🗓</span>
            <p>No hearings recorded yet.</p>
          </div>
        )}
      </article>
    </section>
  );
}
