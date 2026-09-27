import { useState } from "react";

import OngoingCases from "../../components/OngoingCases";
import { getOngoingCasesForUser } from "../../api/caseApi";
import type { Case } from "../../types/case";

/* =========================================================
   DELAY ANALYSIS

   The screen no longer asks for a CNR. It lists the account's
   live matters and puts one action on each, because nobody
   should have to look up a number that the app already holds
   in order to ask a question about their own case.

   What the analysis shows is split honestly in two. The
   figures and the reasons below are derived from the record
   itself — age, stage duration, listed dates, hearing count —
   and are true today. The delay model that would rank them
   against every other matter on the platform is not
   connected yet, and the panel says so rather than
   presenting a guess as a prediction.
   ========================================================= */

type DelayAnalysisPageProps = {
  userId: string;
  onBack: () => void;
};

type Reason = {
  title: string;
  body: string;
};

function formatDate(iso: string): string {
  if (!iso) return "not set";

  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Reasons read off the record itself.
 *
 * Each one names a field a reader can go and check, so the
 * screen can justify itself before the model exists instead
 * of asserting an outcome it has no basis for.
 */
function deriveReasons(caseData: Case): Reason[] {
  const reasons: Reason[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next = new Date(`${caseData.next_hearing_date}T00:00:00`);
  const hasValidDate = !Number.isNaN(next.getTime());

  const age = caseData.calculated_metrics?.total_case_age_days ?? 0;
  const stageDays =
    caseData.calculated_metrics?.current_stage_duration_days ?? 0;
  const hearings = caseData.case_history_timeline?.length ?? 0;

  if (!caseData.next_hearing_date || !hasValidDate) {
    reasons.push({
      title: "No hearing is listed",
      body: "The record carries no next hearing date. Matters usually sit idle while awaiting a fresh listing.",
    });
  } else if (next < today) {
    reasons.push({
      title: "The last listed date has passed",
      body: `The date on file was ${formatDate(caseData.next_hearing_date)}. Until a new date is entered, nothing can move.`,
    });
  }

  if (stageDays >= 180) {
    reasons.push({
      title: "A long time at the current stage",
      body: `The matter has been at "${caseData.current_case_stage}" for ${stageDays} days.`,
    });
  }

  if (hearings <= 1) {
    reasons.push({
      title: "Few proceedings on record",
      body: "The hearing history holds little more than the filing itself, so there is little to move the matter forward.",
    });
  } else if (stageDays >= 90) {
    reasons.push({
      title: "Hearings spaced widely apart",
      body: `${hearings} proceedings are on record, with the current stage alone having run ${stageDays} days.`,
    });
  }

  if (age >= 365) {
    reasons.push({
      title: "Running past a year",
      body: `The case has been on file for ${age} days, which is longer than most matters of its kind take.`,
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      title: "Nothing in the record points to a hold",
      body: "The listed dates and the current stage are both within a normal range for a matter of this age.",
    });
  }

  return reasons.slice(0, 3);
}

/* A coarse read from the same signals — labelled preliminary on
   screen, because it is a count of warning signs rather than a
   model's output. */
function delayLevel(reasons: Reason[]): {
  label: string;
  tone: string;
} {
  const strong = reasons.filter((reason) =>
    /passed|no hearing|few proceedings|past a year|180/i.test(
      `${reason.title} ${reason.body}`,
    ),
  ).length;

  if (strong >= 3) return { label: "High", tone: "is-high" };
  if (strong >= 2) return { label: "Moderate", tone: "is-mid" };

  return { label: "Low", tone: "is-low" };
}

export default function DelayAnalysisPage({
  userId,
  onBack,
}: DelayAnalysisPageProps) {
  const cases = getOngoingCasesForUser(userId);

  const [selected, setSelected] = useState<Case | null>(null);
  const [busyCnr, setBusyCnr] = useState<string | null>(null);

  const run = (caseData: Case) => {
    if (busyCnr) return;

    setBusyCnr(caseData.cnr_number);

    /* A stand-in for the round trip the model will make. The
       screen already needs the pending state, so the switch
       costs nothing now and does not have to be added later. */
    window.setTimeout(() => {
      setSelected(caseData);
      setBusyCnr(null);
    }, 450);
  };

  const reasons = selected ? deriveReasons(selected) : [];
  const level = selected ? delayLevel(reasons) : null;

  return (
    <main className="delay-analysis-page">
      {/* BACK TO DASHBOARD */}
      <button
        type="button"
        className="delay-back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      {/* HERO */}
      <section className="delay-analysis-hero">
        <div className="delay-analysis-hero-glow" />

        <div className="delay-analysis-hero-content">
          <div className="delay-analysis-eyebrow">
            <span>◷</span>
            NYAYMITRA CASE ANALYSIS
          </div>

          <h1>
            Understand your
            <br />
            <span>case delay</span>
          </h1>

          <p>
            Pick one of your ongoing cases to see what the record says about
            how far it has moved, and where it appears to be held up.
          </p>
        </div>
      </section>

      {/* MAIN */}
      <section className="delay-analysis-main">
        {!selected ? (
          /* =========================
             PICK A CASE
             ========================= */
          <>
            <div className="delay-case-picker-head">
              <span className="delay-section-label">
                CASE DELAY ANALYSIS
              </span>

              <h2>Choose a case to predict delay for</h2>

              <p>
                Each prediction is run against that case's own hearing history
                and stage dates.
              </p>
            </div>

            <OngoingCases
              cases={cases}
              actionLabel="Predict Delay"
              onAction={run}
              busyCnr={busyCnr}
              emptyTitle="No ongoing cases on this account"
              emptyBody="Delay can only be predicted for a case that is still running. File a case from My Cases and it will appear here."
            />
          </>
        ) : (
          /* =========================
             ANALYSIS RESULT
             ========================= */
          <div className="delay-analysis-result">
            {/* RESULT HEADER */}
            <div className="delay-result-header">
              <div>
                <span className="delay-section-label">DELAY ANALYSIS</span>

                <h2>{selected.case_type}</h2>

                <p>
                  Case Number:
                  <strong> {selected.cnr_number}</strong>
                </p>
              </div>

              <div className="delay-status-badge">Analysis Ready</div>
            </div>

            {/* SUMMARY */}
            <div className="delay-summary-card">
              <div className="delay-summary-icon">◷</div>

              <div>
                <span>CASE DELAY STATUS</span>

                <h3>
                  Preliminary read — {level?.label.toLowerCase()} delay signal
                </h3>

                <p>
                  Read from this case's own dates: filed{" "}
                  {formatDate(selected.filing_date)}, currently at{" "}
                  {selected.current_case_stage}, next listed{" "}
                  {formatDate(selected.next_hearing_date)}.
                </p>
              </div>
            </div>

            {/* STATS */}
            <div className="delay-stat-grid">
              <div className="delay-stat-card">
                <span>CASE STATUS</span>
                <strong>{selected.current_case_stage}</strong>
                <small>Current case stage</small>
              </div>

              <div className="delay-stat-card">
                <span>AGE ON FILE</span>
                <strong>
                  {selected.calculated_metrics?.total_case_age_days ?? 0} days
                </strong>
                <small>Since filing</small>
              </div>

              <div className="delay-stat-card">
                <span>DELAY LEVEL</span>
                <strong className={level?.tone}>{level?.label}</strong>
                <small>Preliminary assessment</small>
              </div>
            </div>

            {/* POSSIBLE REASONS */}
            <div className="delay-reasons">
              <div className="delay-result-section-heading">
                <span className="delay-section-label">ANALYSIS</span>

                <h3>Why this case may be held up</h3>
              </div>

              <div className="delay-reason-list">
                {reasons.map((reason, index) => (
                  <div className="delay-reason-item" key={reason.title}>
                    <div className="delay-reason-number">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div>
                      <h4>{reason.title}</h4>
                      <p>{reason.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MODEL STATUS */}
            <div className="delay-model-note">
              <span aria-hidden="true">⚙</span>

              <div>
                <strong>The delay model is not connected yet</strong>

                <p>
                  Ranking this matter against others of its kind — and a
                  confidence score for the prediction — will come from the
                  delay-analysis API when it is available. Until then the
                  reasons above are read only from this case's own record.
                </p>
              </div>
            </div>

            {/* NEXT STEP */}
            <div className="delay-next-step-card">
              <div className="delay-next-step-icon">→</div>

              <div>
                <span className="delay-section-label">SUGGESTED NEXT STEP</span>

                <h3>Review the latest case activity</h3>

                <p>
                  Check the latest hearing date, case stage, orders and pending
                  actions before taking further steps.
                </p>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="delay-result-actions">
              <button
                type="button"
                className="delay-new-analysis-button"
                onClick={() => setSelected(null)}
              >
                Predict delay for another case
              </button>
            </div>

            {/* DISCLAIMER */}
            <div className="delay-disclaimer">
              <span>ⓘ</span>

              <p>
                <strong>Note:</strong> This is a preliminary analysis intended
                to help users understand possible case delays. It should not be
                treated as legal advice or a final determination of the reason
                for delay.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
