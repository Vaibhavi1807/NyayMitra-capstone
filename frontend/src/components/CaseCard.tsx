import type { Case } from "../types/case";

interface CaseCardProps {
  caseData: Case;
}

function getStatusClass(stage: string) {
  const value = stage.toLowerCase();

  if (value.includes("argument")) return "status-purple";
  if (value.includes("evidence")) return "status-blue";
  if (value.includes("appearance")) return "status-orange";
  if (value.includes("rent")) return "status-green";

  return "status-gray";
}

export default function CaseCard({ caseData }: CaseCardProps) {
  return (
    <article className="case-card">
      <div className="case-card-top">
        <div>
          <span className="case-label">CNR NUMBER</span>
          <h3>{caseData.cnr_number}</h3>
        </div>

        <span className={`status-badge ${getStatusClass(caseData.current_case_stage)}`}>
          <span className="status-dot" />
          {caseData.current_case_stage}
        </span>
      </div>

      <div className="case-type">
        {caseData.case_type}
      </div>

      <div className="case-parties">
        <div className="party-block">
          <span className="detail-label">PETITIONER</span>
          <strong>{caseData.petitioner_name}</strong>
        </div>

        <div className="party-arrow">→</div>

        <div className="party-block">
          <span className="detail-label">RESPONDENTS</span>
          <strong>
            {caseData.respondents_list.length === 1
              ? caseData.respondents_list[0]
              : `${caseData.respondents_list[0]} + ${caseData.respondents_list.length - 1}`}
          </strong>
        </div>
      </div>

      <div className="case-divider" />

      <div className="case-info-grid">
        <div className="case-info">
          <span className="info-icon">⚖</span>
          <div>
            <span className="detail-label">COURT</span>
            <p>{caseData.court_name}</p>
          </div>
        </div>

        <div className="case-info">
          <span className="info-icon">📅</span>
          <div>
            <span className="detail-label">NEXT HEARING</span>
            <p className="hearing-date">
              {new Date(caseData.next_hearing_date).toLocaleDateString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="case-card-footer">
        <span>
          Advocate: <strong>{caseData.petitioner_advocate}</strong>
        </span>

        <button className="view-case-btn">
          View case
          <span>→</span>
        </button>
      </div>
    </article>
  );
}