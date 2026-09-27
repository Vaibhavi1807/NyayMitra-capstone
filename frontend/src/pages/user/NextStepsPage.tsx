import { useState } from "react";

type NextStepsPageProps = {
  onBack: () => void;
};

export default function NextStepsPage({
  onBack,
}: NextStepsPageProps) {
  const [caseNumber, setCaseNumber] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleAnalyze = () => {
    if (!caseNumber.trim()) return;

    setShowAnalysis(true);
  };

  return (
    <main className="next-steps-page">

      {/* HERO */}

      <section className="next-steps-hero">

        <button
          type="button"
          className="page-back-button"
          onClick={onBack}
        >
          ← Back to Dashboard
        </button>

        <div className="next-steps-hero-content">

          <div className="next-steps-eyebrow">
            <span>→</span>
            NYAYMITRA CASE GUIDANCE
          </div>

          <h1>
            Know your
            <br />
            <span>next legal step.</span>
          </h1>

          <p>
            Enter your case number to understand the
            possible next steps in your case.
          </p>

        </div>

      </section>


      {/* MAIN */}

      <section className="next-steps-main">

        <div className="next-steps-search-card">

          <span className="next-steps-label">
            CASE NUMBER
          </span>

          <div className="next-steps-input-row">

            <input
              type="text"
              value={caseNumber}
              onChange={(event) =>
                setCaseNumber(event.target.value)
              }
              placeholder="Enter your CNR or case number"
            />

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!caseNumber.trim()}
            >
              Analyze
              <span>→</span>
            </button>

          </div>

          <p>
            Example: CNR/MH/2026/001245
          </p>

        </div>


        {/* ANALYSIS */}

        {showAnalysis && (

          <section className="next-steps-analysis">

            <div className="next-steps-analysis-header">

              <div>
                <span className="next-steps-label">
                  CASE GUIDANCE
                </span>

                <h2>
                  Possible next steps
                </h2>
              </div>

              <div className="next-steps-case-number">
                {caseNumber}
              </div>

            </div>


            <div className="next-steps-list">

              <article className="next-step-card">

                <div className="next-step-number">
                  01
                </div>

                <div>
                  <h3>
                    Check the next hearing date
                  </h3>

                  <p>
                    Review your latest case information
                    and confirm the upcoming hearing date
                    with the court record.
                  </p>
                </div>

              </article>


              <article className="next-step-card">

                <div className="next-step-number">
                  02
                </div>

                <div>
                  <h3>
                    Review required documents
                  </h3>

                  <p>
                    Check whether any documents,
                    applications or evidence need to
                    be submitted before the next hearing.
                  </p>
                </div>

              </article>


              <article className="next-step-card">

                <div className="next-step-number">
                  03
                </div>

                <div>
                  <h3>
                    Consult your lawyer
                  </h3>

                  <p>
                    Discuss the latest case development
                    with your lawyer before taking an
                    important legal action.
                  </p>
                </div>

              </article>


              <article className="next-step-card">

                <div className="next-step-number">
                  04
                </div>

                <div>
                  <h3>
                    Keep your case information updated
                  </h3>

                  <p>
                    Continue monitoring your case status
                    and upcoming hearings through NyayMitra.
                  </p>
                </div>

              </article>

            </div>


            <div className="next-steps-note">

              <span>ⓘ</span>

              <p>
                <strong>Important:</strong> These are general
                informational suggestions and should not be
                considered legal advice. Consult a qualified
                legal professional for advice about your case.
              </p>

            </div>

          </section>

        )}

      </section>

    </main>
  );
}
