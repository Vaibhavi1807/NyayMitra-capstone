import type { Page } from "../../App";

type DashboardPageProps = {
  onNavigate: (page: Page) => void;
};

function DashboardPage({ onNavigate }: DashboardPageProps) {
  return (
    <div className="dashboard-page">

      {/* =====================================================
          DASHBOARD HERO
          ===================================================== */}

      <section className="dashboard-hero">

        <div className="dashboard-hero-glow" />

        <div className="dashboard-hero-content">

          <div className="dashboard-eyebrow">
            <span>⚖</span>
            NYAYMITRA LEGAL ASSISTANCE
          </div>

          <h1>
            Your legal journey,
            <br />
            <span>simplified.</span>
          </h1>

          <p>
            Understand your cases, find legal professionals,
            translate legal documents and get useful insights
            — all in one place.
          </p>

          <div className="dashboard-scroll-hint">
            <span>↓</span>
            Explore services
          </div>

        </div>

      </section>


      {/* =====================================================
          MAIN DASHBOARD
          ===================================================== */}

      <main className="dashboard-main">

        {/* =================================================
            WELCOME
            ================================================= */}

        <section className="dashboard-welcome">

          <div>

            <span className="dashboard-section-label">
              YOUR LEGAL ASSISTANT
            </span>

            <h2>
              Welcome to NyayMitra
            </h2>

            <p>
              What would you like to do today?
            </p>

          </div>

          <div className="dashboard-welcome-icon">
            ⚖
          </div>

        </section>


        {/* =================================================
            ACTION CARDS
            ================================================= */}

        <section className="dashboard-actions-section">

          <div className="dashboard-heading">

            <div>

              <span className="dashboard-section-label">
                LEGAL SERVICES
              </span>

              <h2>
                What can we help you with?
              </h2>

            </div>

            <p>
              Choose a service below
            </p>

          </div>


          <div className="dashboard-action-grid">

            {/* =================================================
                1. MY CASES
                ================================================= */}

            <button
              type="button"
              className="dashboard-action-card"
              onClick={() => onNavigate("cases")}
            >

              <div className="dashboard-action-icon purple">
                ⚖
              </div>

              <div className="dashboard-action-content">

                <span>CASE SERVICES</span>

                <h3>
                  My Cases
                </h3>

                <p>
                  Search and track your cases,
                  hearings and case status.
                </p>

              </div>

              <div className="dashboard-action-arrow">
                →
              </div>

            </button>


            {/* =================================================
                2. FIND LAWYER
                ================================================= */}

            <button
              type="button"
              className="dashboard-action-card"
              onClick={() => onNavigate("lawyer")}
            >

              <div className="dashboard-action-icon blue">
                ⚖
              </div>

              <div className="dashboard-action-content">

                <span>LEGAL PROFESSIONALS</span>

                <h3>
                  Find a Lawyer
                </h3>

                <p>
                  Find lawyers based on practice
                  area, experience and location.
                </p>

              </div>

              <div className="dashboard-action-arrow">
                →
              </div>

            </button>


            {/* =================================================
                2B. CHAT WITH YOUR LAWYER / STAFF

                Opens the shared inbox. Which conversations you
                can actually start is decided in chatApi — for a
                citizen that is lawyers and account staff only.
                ================================================= */}

            <button
              type="button"
              className="dashboard-action-card"
              onClick={() => onNavigate("chat")}
            >

              <div className="dashboard-action-icon indigo">
                ✉
              </div>

              <div className="dashboard-action-content">

                <span>MESSAGES</span>

                <h3>
                  Chat
                </h3>

                <p>
                  Continue a conversation with a lawyer you
                  contacted, or with the staff handling your
                  account.
                </p>

              </div>

              <div className="dashboard-action-arrow">
                →
              </div>

            </button>


            {/* =================================================
                3. COURT ORDERS
                ================================================= */}

            <button
              type="button"
              className="dashboard-action-card"
              onClick={() => onNavigate("orders")}
            >

              <div className="dashboard-action-icon orange">
                📄
              </div>

              <div className="dashboard-action-content">

                <span>COURT DOCUMENTS</span>

                <h3>
                  Court Orders
                </h3>

                <p>
                  Access court orders and understand
                  important legal documents.
                </p>

              </div>

              <div className="dashboard-action-arrow">
                →
              </div>

            </button>


            {/* =================================================
                4. TRANSLATION
                ================================================= */}

            <button
              type="button"
              className="dashboard-action-card"
              onClick={() => onNavigate("translation")}
            >

              <div className="dashboard-action-icon green">
                文
              </div>

              <div className="dashboard-action-content">

                <span>LANGUAGE ASSISTANCE</span>

                <h3>
                  Translation
                </h3>

                <p>
                  Translate legal content into
                  simpler and familiar languages.
                </p>

              </div>

              <div className="dashboard-action-arrow">
                →
              </div>

            </button>


            {/* =================================================
                5. DELAY ANALYSIS
                ================================================= */}

            <button
              type="button"
              className="dashboard-action-card"
              onClick={() => onNavigate("delay")}
            >

              <div className="dashboard-action-icon indigo">
                ⏱
              </div>

              <div className="dashboard-action-content">

                <span>CASE INSIGHTS</span>

                <h3>
                  Delay Analysis
                </h3>

                <p>
                  Understand possible reasons for
                  case delays and get useful insights.
                </p>

              </div>

              <div className="dashboard-action-arrow">
                →
              </div>

            </button>


            {/* =================================================
                6. VOICE NYAYMITRA
                ================================================= */}

            <button
              type="button"
              className="dashboard-action-card"
              onClick={() => onNavigate("voice")}
            >

              <div className="dashboard-action-icon blue">
                🎙
              </div>

              <div className="dashboard-action-content">

                <span>SPEAK ABOUT YOUR SITUATION</span>

                <h3>
                  Voice NyayMitra
                </h3>

                <p>
                  Say what happened in your own words and
                  get what to do next and how urgent it is.
                </p>

              </div>

              <div className="dashboard-action-arrow">
                →
              </div>

            </button>


            {/* =================================================
                7. CASE TIMELINE
                ================================================= */}

            <button
              type="button"
              className="dashboard-action-card"
              onClick={() => onNavigate("timeline")}
            >

              <div className="dashboard-action-icon orange">
                ◷
              </div>

              <div className="dashboard-action-content">

                <span>CASE HISTORY</span>

                <h3>
                  Case Timeline
                </h3>

                <p>
                  Track important hearings, events
                  and stages in your case journey.
                </p>

              </div>

              <div className="dashboard-action-arrow">
                →
              </div>

            </button>

          </div>

        </section>


        {/* =====================================================
            HOW NYAYMITRA HELPS
            ===================================================== */}

        <section className="dashboard-info-section">

          <div className="dashboard-heading">

            <div>

              <span className="dashboard-section-label">
                YOUR LEGAL COMPANION
              </span>

              <h2>
                How NyayMitra helps
              </h2>

            </div>

          </div>


          <div className="dashboard-info-grid">

            <div className="dashboard-info-card">

              <div className="dashboard-info-number">
                01
              </div>

              <h3>
                Understand
              </h3>

              <p>
                Make complex legal information
                easier to understand.
              </p>

            </div>


            <div className="dashboard-info-card">

              <div className="dashboard-info-number">
                02
              </div>

              <h3>
                Track
              </h3>

              <p>
                Keep important case information
                and upcoming hearings organized.
              </p>

            </div>


            <div className="dashboard-info-card">

              <div className="dashboard-info-number">
                03
              </div>

              <h3>
                Take the Next Step
              </h3>

              <p>
                Get guidance about useful next
                steps for your legal situation.
              </p>

            </div>

          </div>

        </section>


        {/* =====================================================
            BOTTOM CTA
            ===================================================== */}

        <section className="dashboard-cta">

          <div>

            <span>
              NEED LEGAL ASSISTANCE?
            </span>

            <h2>
              Start with your case.
            </h2>

            <p>
              Search your case information and
              explore the available NyayMitra services.
            </p>

          </div>

          <button
            type="button"
            onClick={() => onNavigate("cases")}
          >
            Explore My Cases
            <span>→</span>
          </button>

        </section>

      </main>

    </div>
  );
}

export default DashboardPage;