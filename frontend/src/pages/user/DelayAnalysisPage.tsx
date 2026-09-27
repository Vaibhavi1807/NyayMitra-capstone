import { useState } from "react";

type DelayAnalysisPageProps = {
  onBack: () => void;
};

export default function DelayAnalysisPage({
  onBack,
}: DelayAnalysisPageProps) {
  const [caseNumber, setCaseNumber] = useState("");
  const [analyzed, setAnalyzed] = useState(false);

  const handleAnalyze = () => {
    if (!caseNumber.trim()) return;
    setAnalyzed(true);
  };

  const handleReset = () => {
    setCaseNumber("");
    setAnalyzed(false);
  };

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
            Enter your case number to understand the current
            status, case progress and possible reasons for delay.
          </p>
        </div>
      </section>

      {/* MAIN */}
      <section className="delay-analysis-main">

        {!analyzed ? (
          /* =========================
             SEARCH / INPUT STATE
             ========================= */
          <div className="delay-search-card">

            <div className="delay-search-icon">
              ◷
            </div>

            <div className="delay-search-content">
              <span className="delay-section-label">
                CASE DELAY ANALYSIS
              </span>

              <h2>
                Enter your case number
              </h2>

              <p>
                Enter the case number associated with your
                legal matter to begin the analysis.
              </p>

              <div className="delay-input-wrapper">
                <label htmlFor="case-number">
                  Case Number
                </label>

                <input
                  id="case-number"
                  type="text"
                  value={caseNumber}
                  onChange={(event) =>
                    setCaseNumber(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleAnalyze();
                    }
                  }}
                  placeholder="Enter your case number"
                />
              </div>

              <button
                type="button"
                className="delay-analyze-button"
                onClick={handleAnalyze}
                disabled={!caseNumber.trim()}
              >
                Analyze Case
                <span>→</span>
              </button>

              <div className="delay-info-note">
                <span>ⓘ</span>

                <p>
                  Your case number will be used to identify
                  the case and prepare its delay analysis.
                </p>
              </div>
            </div>

          </div>
        ) : (
          /* =========================
             ANALYSIS RESULT
             ========================= */
          <div className="delay-analysis-result">

            {/* RESULT HEADER */}
            <div className="delay-result-header">

              <div>
                <span className="delay-section-label">
                  DELAY ANALYSIS
                </span>

                <h2>
                  Case analysis
                </h2>

                <p>
                  Case Number:
                  <strong> {caseNumber}</strong>
                </p>
              </div>

              <div className="delay-status-badge">
                Analysis Ready
              </div>

            </div>

            {/* SUMMARY */}
            <div className="delay-summary-card">

              <div className="delay-summary-icon">
                ◷
              </div>

              <div>
                <span>CASE DELAY STATUS</span>

                <h3>
                  Possible procedural delay
                </h3>

                <p>
                  The case may require further review of its
                  hearing history, pending stages and previous
                  case events to identify the exact reason for
                  delay.
                </p>
              </div>

            </div>

            {/* STATS */}
            <div className="delay-stat-grid">

              <div className="delay-stat-card">
                <span>CASE STATUS</span>
                <strong>Pending</strong>
                <small>Current case stage</small>
              </div>

              <div className="delay-stat-card">
                <span>HEARINGS</span>
                <strong>Multiple</strong>
                <small>Recorded proceedings</small>
              </div>

              <div className="delay-stat-card">
                <span>DELAY LEVEL</span>
                <strong>Moderate</strong>
                <small>Preliminary assessment</small>
              </div>

            </div>

            {/* POSSIBLE REASONS */}
            <div className="delay-reasons">

              <div className="delay-result-section-heading">
                <span className="delay-section-label">
                  ANALYSIS
                </span>

                <h3>
                  Possible reasons for delay
                </h3>
              </div>

              <div className="delay-reason-list">

                <div className="delay-reason-item">
                  <div className="delay-reason-number">
                    01
                  </div>

                  <div>
                    <h4>
                      Pending hearing or proceeding
                    </h4>

                    <p>
                      The case may be waiting for the next
                      scheduled hearing or procedural step.
                    </p>
                  </div>
                </div>

                <div className="delay-reason-item">
                  <div className="delay-reason-number">
                    02
                  </div>

                  <div>
                    <h4>
                      Pending documents or submissions
                    </h4>

                    <p>
                      Required documents, responses or
                      submissions may still be pending.
                    </p>
                  </div>
                </div>

                <div className="delay-reason-item">
                  <div className="delay-reason-number">
                    03
                  </div>

                  <div>
                    <h4>
                      Procedural processing
                    </h4>

                    <p>
                      Administrative or procedural stages can
                      contribute to the overall case timeline.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* NEXT STEPS */}
            <div className="delay-next-step-card">

              <div className="delay-next-step-icon">
                →
              </div>

              <div>
                <span className="delay-section-label">
                  SUGGESTED NEXT STEP
                </span>

                <h3>
                  Review the latest case activity
                </h3>

                <p>
                  Check the latest hearing date, case stage,
                  orders and pending actions before taking
                  further steps.
                </p>
              </div>

            </div>

            {/* ACTIONS */}
            <div className="delay-result-actions">

              <button
                type="button"
                className="delay-new-analysis-button"
                onClick={handleReset}
              >
                Analyze Another Case
              </button>

            </div>

            {/* DISCLAIMER */}
            <div className="delay-disclaimer">
              <span>ⓘ</span>

              <p>
                <strong>Note:</strong> This is a preliminary
                analysis intended to help users understand
                possible case delays. It should not be treated
                as legal advice or a final determination of
                the reason for delay.
              </p>
            </div>

          </div>
        )}

      </section>
    </main>
  );
}