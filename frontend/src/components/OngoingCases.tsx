import type { Case } from "../types/case";

import "./OngoingCases.css";

/* =========================================================
   SHARED — "PICK ONE OF YOUR CASES"

   Three screens stopped asking for a CNR: delay prediction,
   the timeline and (in its own grouping) court orders. Two of
   them need the same thing — the citizen's live matters, each
   with one action on it — so the list lives here once instead
   of being written three times and drifting.

   Deliberately not a picker: the row carries the stage, the
   court and the next hearing, because the reason to choose one
   case over another is what is happening in it.
   ========================================================= */

function formatHearing(iso: string): string {
  if (!iso) return "Date not set";

  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const label = parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (parsed.getTime() === today.getTime()) return `Today, ${label}`;
  if (parsed < today) return `Held ${label}`;

  return label;
}

type OngoingCasesProps = {
  cases: Case[];

  /* What the button on each row does. One label per screen —
     every row on a given page offers the same action. */
  actionLabel: string;
  onAction: (caseData: Case) => void;

  /* The case whose action is currently running, so only that
     row reads as busy rather than the whole list. */
  busyCnr?: string | null;

  emptyTitle: string;
  emptyBody: string;
};

export default function OngoingCases({
  cases,
  actionLabel,
  onAction,
  busyCnr,
  emptyTitle,
  emptyBody,
}: OngoingCasesProps) {
  if (cases.length === 0) {
    return (
      <div className="ongoing-empty">
        <span aria-hidden="true">⚖</span>
        <h3>{emptyTitle}</h3>
        <p>{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="ongoing-list">
      {cases.map((caseData) => {
        const busy = busyCnr === caseData.cnr_number;

        return (
          <article
            className={`ongoing-row${busy ? " is-busy" : ""}`}
            key={caseData.cnr_number}
          >
            <div className="ongoing-main">
              <span className="ongoing-cnr">{caseData.cnr_number}</span>

              <h3>{caseData.case_type}</h3>

              <p className="ongoing-parties">
                {caseData.petitioner_name} v.{" "}
                {caseData.respondents_list.join(", ")}
              </p>

              <div className="ongoing-chips">
                <span className="ongoing-chip ongoing-chip-stage">
                  {caseData.current_case_stage}
                </span>

                <span className="ongoing-chip">
                  ⚖ {caseData.court_name}
                </span>

                <span className="ongoing-chip">
                  ◷ Next hearing {formatHearing(caseData.next_hearing_date)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="ongoing-action"
              disabled={busy}
              onClick={() => onAction(caseData)}
            >
              {busy ? "Working…" : actionLabel}
            </button>
          </article>
        );
      })}
    </div>
  );
}
