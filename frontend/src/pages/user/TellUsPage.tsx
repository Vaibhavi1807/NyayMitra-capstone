import { useState } from "react";

type TellUsPageProps = {
  onBack: () => void;
};

const categories = [
  "Property Dispute",
  "Family Matter",
  "Criminal Matter",
  "Consumer Complaint",
  "Cyber Crime",
  "Employment / Salary",
  "Tenant / Landlord",
  "Legal Notice",
  "Other",
];

const urgencyOptions = [
  "Not urgent",
  "Important",
  "Urgent",
];

export default function TellUsPage({
  onBack,
}: TellUsPageProps) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("Not urgent");
  const [submitted, setSubmitted] = useState(false);

  const handleAnalyze = () => {
    if (!category || !description.trim()) return;

    setSubmitted(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleReset = () => {
    setCategory("");
    setDescription("");
    setUrgency("Not urgent");
    setSubmitted(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <main className="tell-us-page">

      {/* =====================================================
          BACK
      ===================================================== */}

      <button
        type="button"
        className="tell-us-back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="tell-us-hero">

        <div className="tell-us-hero-glow" />

        <div className="tell-us-hero-content">

          <div className="tell-us-eyebrow">
            <span>💬</span>
            NYAYMITRA LEGAL ASSISTANCE
          </div>

          <h1>
            Tell us what
            <br />
            <span>happened</span>
          </h1>

          <p>
            Describe your legal problem in your own words.
            NyayMitra will help organize the situation and
            identify possible next steps.
          </p>

          <div className="tell-us-hero-pills">
            <span>Simple Language</span>
            <span>AI Assisted</span>
            <span>Step-by-Step Guidance</span>
          </div>

        </div>
      </section>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <section className="tell-us-main">

        {!submitted ? (

          <div className="tell-us-form-card">

            {/* FORM HEADER */}

            <div className="tell-us-form-header">

              <div className="tell-us-form-icon">
                💬
              </div>

              <div>
                <span className="tell-us-section-label">
                  START HERE
                </span>

                <h2>
                  Describe your situation
                </h2>

                <p>
                  You don't need to know the legal terminology.
                  Just explain what happened in simple words.
                </p>
              </div>

            </div>

            {/* CATEGORY */}

            <div className="tell-us-field">

              <label>
                What is your problem about?
              </label>

              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
              >
                <option value="">
                  Select a category
                </option>

                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

            </div>

            {/* DESCRIPTION */}

            <div className="tell-us-field">

              <div className="tell-us-label-row">

                <label htmlFor="problem-description">
                  What happened?
                </label>

                <span>
                  {description.length} characters
                </span>

              </div>

              <textarea
                id="problem-description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="For example: My landlord has not returned my security deposit even though I moved out two months ago..."
                rows={8}
              />

            </div>

            {/* URGENCY */}

            <div className="tell-us-field">

              <label>
                How urgent is this?
              </label>

              <div className="tell-us-urgency-options">

                {urgencyOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      urgency === option
                        ? "tell-us-urgency active"
                        : "tell-us-urgency"
                    }
                    onClick={() =>
                      setUrgency(option)
                    }
                  >
                    {option}
                  </button>
                ))}

              </div>

            </div>

            {/* ACTION */}

            <button
              type="button"
              className="tell-us-analyze-button"
              disabled={
                !category || !description.trim()
              }
              onClick={handleAnalyze}
            >
              <span>✦</span>
              Understand My Situation
              <strong>→</strong>
            </button>

            {/* PRIVACY NOTE */}

            <div className="tell-us-note">

              <span>ⓘ</span>

              <p>
                Share only the information needed to explain
                your situation. Avoid entering passwords,
                OTPs, bank details or other sensitive
                credentials.
              </p>

            </div>

          </div>

        ) : (

          /* =================================================
             RESULT
             ================================================= */

          <div className="tell-us-result-card">

            <div className="tell-us-result-header">

              <div>

                <span className="tell-us-section-label">
                  INITIAL ASSESSMENT
                </span>

                <h2>
                  We understood your situation
                </h2>

                <p>
                  Your information has been organized into
                  a simple case summary.
                </p>

              </div>

              <div className="tell-us-result-badge">
                Analysis Ready
              </div>

            </div>

            {/* SUMMARY */}

            <div className="tell-us-summary">

              <div className="tell-us-summary-icon">
                ✓
              </div>

              <div>

                <span>
                  ISSUE CATEGORY
                </span>

                <h3>
                  {category}
                </h3>

                <p>
                  You marked this situation as{" "}
                  <strong>{urgency.toLowerCase()}</strong>.
                </p>

              </div>

            </div>

            {/* USER STORY */}

            <div className="tell-us-story">

              <span className="tell-us-section-label">
                YOUR DESCRIPTION
              </span>

              <div className="tell-us-story-box">
                {description}
              </div>

            </div>

            {/* POSSIBLE NEXT STEPS */}

            <div className="tell-us-guidance">

              <span className="tell-us-section-label">
                INITIAL GUIDANCE
              </span>

              <h3>
                What you may want to do next
              </h3>

              <div className="tell-us-guidance-grid">

                <div className="tell-us-guidance-item">
                  <span>01</span>

                  <div>
                    <strong>
                      Collect relevant documents
                    </strong>

                    <p>
                      Keep notices, agreements, receipts,
                      messages or other documents related
                      to the issue.
                    </p>
                  </div>
                </div>

                <div className="tell-us-guidance-item">
                  <span>02</span>

                  <div>
                    <strong>
                      Record important dates
                    </strong>

                    <p>
                      Note when the issue started and any
                      deadlines or communications involved.
                    </p>
                  </div>
                </div>

                <div className="tell-us-guidance-item">
                  <span>03</span>

                  <div>
                    <strong>
                      Review your legal options
                    </strong>

                    <p>
                      Use NyayMitra's case tools or consult
                      a qualified lawyer for situation-specific
                      advice.
                    </p>
                  </div>
                </div>

              </div>

            </div>

            {/* ACTIONS */}

            <div className="tell-us-result-actions">

              <button
                type="button"
                className="tell-us-secondary-button"
                onClick={handleReset}
              >
                Start Again
              </button>

              <button
                type="button"
                className="tell-us-primary-button"
                onClick={onBack}
              >
                Back to Dashboard
                <span>→</span>
              </button>

            </div>

            {/* DISCLAIMER */}

            <div className="tell-us-disclaimer">

              <span>ⓘ</span>

              <p>
                <strong>Important:</strong> This is an
                initial AI-assisted understanding of the
                information provided. It is not legal advice
                and does not replace consultation with a
                qualified legal professional.
              </p>

            </div>

          </div>

        )}

      </section>
    </main>
  );
}