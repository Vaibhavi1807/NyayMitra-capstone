import { useState } from "react";

type CaseTimelinePageProps = {
  onBack: () => void;
};

type TimelineEvent = {
  date: string;
  title: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  icon: string;
};

const sampleTimeline: TimelineEvent[] = [
  {
    date: "12 January 2025",
    title: "Case Filed",
    description:
      "The case was registered and filed before the concerned court.",
    status: "completed",
    icon: "📄",
  },
  {
    date: "28 February 2025",
    title: "Notice Issued",
    description:
      "Notice was issued to the concerned party for further proceedings.",
    status: "completed",
    icon: "✉",
  },
  {
    date: "18 April 2025",
    title: "First Hearing",
    description:
      "The matter was listed before the court for the first hearing.",
    status: "completed",
    icon: "⚖",
  },
  {
    date: "22 August 2026",
    title: "Arguments",
    description:
      "Arguments from the concerned parties were heard by the court.",
    status: "current",
    icon: "🗣",
  },
  {
    date: "15 October 2026",
    title: "Next Hearing",
    description:
      "The case is scheduled for the next hearing on this date.",
    status: "upcoming",
    icon: "📅",
  },
  {
    date: "To be decided",
    title: "Final Decision",
    description:
      "The final decision will be recorded after the remaining proceedings.",
    status: "upcoming",
    icon: "⚖",
  },
];

export default function CaseTimelinePage({
  onBack,
}: CaseTimelinePageProps) {
  const [caseNumber, setCaseNumber] = useState("");
  const [searchedCase, setSearchedCase] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);

  const handleSearch = () => {
    const value = caseNumber.trim();

    if (!value) return;

    setSearchedCase(value);
    setShowTimeline(true);
  };

  const handleClear = () => {
    setCaseNumber("");
    setSearchedCase("");
    setShowTimeline(false);
  };

  return (
    <main className="case-timeline-page">

      {/* =====================================================
          BACK
          ===================================================== */}

      <button
        type="button"
        className="case-timeline-back"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="case-timeline-hero">

        <div className="case-timeline-hero-glow" />

        <div className="case-timeline-hero-content">

          <div className="case-timeline-eyebrow">
            <span>◷</span>
            NYAYMITRA CASE TIMELINE
          </div>

          <h1>
            Track your case
            <br />
            <span>journey clearly</span>
          </h1>

          <p>
            Enter your case number to understand the important
            events, hearings, and stages in your case history.
          </p>

        </div>

      </section>

      {/* =====================================================
          SEARCH
          ===================================================== */}

      <section className="case-timeline-main">

        <div className="case-timeline-search-card">

          <div className="case-timeline-search-heading">

            <span className="section-label">
              SEARCH CASE
            </span>

            <h2>
              Enter your case number
            </h2>

            <p>
              You can use your CNR number or case reference number.
            </p>

          </div>

          <div className="case-timeline-search-row">

            <div className="case-timeline-input">

              <span>⌕</span>

              <input
                type="text"
                value={caseNumber}
                onChange={(event) =>
                  setCaseNumber(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
                placeholder="Enter CNR or case number..."
              />

              {caseNumber && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear"
                >
                  ×
                </button>
              )}

            </div>

            <button
              type="button"
              className="case-timeline-search-button"
              disabled={!caseNumber.trim()}
              onClick={handleSearch}
            >
              Search Case
              <span>→</span>
            </button>

          </div>

          <div className="case-timeline-search-note">
            <span>ⓘ</span>
            Enter the case number exactly as shown in your
            court documents.
          </div>

        </div>

        {/* =================================================
            RESULT
            ================================================= */}

        {showTimeline && (

          <section className="case-timeline-result">

            {/* CASE SUMMARY */}

            <div className="case-timeline-summary">

              <div>

                <span className="section-label">
                  CASE FOUND
                </span>

                <h2>
                  Case Timeline
                </h2>

                <p>
                  Case Number:
                  <strong> {searchedCase}</strong>
                </p>

              </div>

              <div className="case-status-badge">
                <span />
                Pending
              </div>

            </div>

            {/* QUICK STATS */}

            <div className="case-timeline-stats">

              <div>
                <span>CASE STAGE</span>
                <strong>Arguments</strong>
              </div>

              <div>
                <span>EVENTS</span>
                <strong>6</strong>
              </div>

              <div>
                <span>NEXT HEARING</span>
                <strong>15 Oct 2026</strong>
              </div>

            </div>

            {/* TIMELINE */}

            <div className="case-timeline-card">

              <div className="case-timeline-heading">

                <div>
                  <span className="section-label">
                    CASE HISTORY
                  </span>

                  <h2>
                    Your case journey
                  </h2>
                </div>

                <span className="timeline-count">
                  6 Events
                </span>

              </div>

              <div className="case-timeline-list">

                {sampleTimeline.map((event, index) => (

                  <div
                    className={`timeline-item ${event.status}`}
                    key={`${event.title}-${index}`}
                  >

                    {/* LINE */}

                    {index < sampleTimeline.length - 1 && (
                      <div className="timeline-line" />
                    )}

                    {/* ICON */}

                    <div className="timeline-icon">
                      {event.icon}
                    </div>

                    {/* CONTENT */}

                    <div className="timeline-event-content">

                      <div className="timeline-event-top">

                        <span className="timeline-date">
                          {event.date}
                        </span>

                        {event.status === "current" && (
                          <span className="timeline-current">
                            Current Stage
                          </span>
                        )}

                      </div>

                      <h3>
                        {event.title}
                      </h3>

                      <p>
                        {event.description}
                      </p>

                    </div>

                  </div>

                ))}

              </div>

            </div>

            {/* INFORMATION */}

            <div className="case-timeline-info">

              <span>✦</span>

              <div>
                <strong>
                  What does this mean?
                </strong>

                <p>
                  The timeline shows important stages and
                  events recorded for your case. Dates and
                  case stages should always be verified against
                  official court records.
                </p>
              </div>

            </div>

          </section>
        )}

        {/* EMPTY STATE */}

        {!showTimeline && (

          <div className="case-timeline-empty">

            <div className="case-timeline-empty-icon">
              ◷
            </div>

            <h3>
              Your case journey will appear here
            </h3>

            <p>
              Enter a case number above to view the timeline
              and important case events.
            </p>

          </div>

        )}

        {/* DISCLAIMER */}

        <div className="case-timeline-disclaimer">

          <span>ⓘ</span>

          <p>
            <strong>Important:</strong> Case information shown
            by NyayMitra is intended to help you understand
            your case history. Always verify important dates
            and proceedings with official court records.
          </p>

        </div>

      </section>
    </main>
  );
}