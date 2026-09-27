import { useEffect, useState } from "react";
import type { Page } from "../../App";
import {
  getLawyerById,
  type Lawyer,
} from "../../api/lawyerApi";
import "./LawyerDashboardPage.css";

const DEFAULT_LAWYER_ID =
  import.meta.env.VITE_LAWYER_ID || "LAWYER_0003";

type LawyerDashboardPageProps = {
  onNavigate: (page: Page) => void;
  lawyerId?: string;
};

function LawyerDashboardPage({
  onNavigate,
  lawyerId,
}: LawyerDashboardPageProps) {
  const effectiveLawyerId =
    lawyerId?.trim() || DEFAULT_LAWYER_ID;

  const [lawyer, setLawyer] =
    useState<Lawyer | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * LOAD LAWYER
   *
   * The function is intentionally inside useEffect.
   * This avoids the loadLawyer/exhaustive-deps warning.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadLawyer() {
      try {
        setLoading(true);
        setError("");

        const data =
          await getLawyerById(effectiveLawyerId);

        if (!cancelled) {
          setLawyer(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load lawyer information."
          );

          setLawyer(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLawyer();

    return () => {
      cancelled = true;
    };
  }, [effectiveLawyerId]);

  /*
   * LOADING
   */
  if (loading) {
    return (
      <div className="lawyer-dashboard-loading">
        <div className="lawyer-dashboard-spinner" />

        <p>
          Loading lawyer dashboard...
        </p>

        <span>
          Fetching professional information
          from NyayMitra.
        </span>
      </div>
    );
  }

  /*
   * ERROR
   */
  if (error || !lawyer) {
    return (
      <div className="lawyer-dashboard-page">

        <div className="lawyer-dashboard-error">

          <div className="lawyer-dashboard-error-icon">
            !
          </div>

          <span className="lawyer-dashboard-section-label">
            LAWYER BACKEND
          </span>

          <h1>
            Unable to load your dashboard
          </h1>

          <p>
            {error ||
              "No lawyer information was returned by the API."}
          </p>

          <div className="lawyer-dashboard-error-meta">
            <span>Lawyer ID:</span>

            <strong>
              {effectiveLawyerId}
            </strong>
          </div>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
          >
            Retry
          </button>

        </div>

      </div>
    );
  }

  /*
   * REAL API DATA
   */

  const practiceAreas =
    lawyer.practice_areas ?? [];

  const courts =
    lawyer.courts_of_practice ?? [];

  const languages =
    lawyer.languages_known ?? [];

  const education =
    lawyer.education_qualifications ?? [];

  /*
   * PROFILE COMPLETENESS
   */

  const profileFields = [
    lawyer.full_name,
    lawyer.gender,
    lawyer.date_of_birth,
    lawyer.enrollment_number,
    lawyer.registration_number,
    lawyer.bar_council,
    lawyer.years_of_experience,
    practiceAreas.length > 0,
    courts.length > 0,
    lawyer.city,
    lawyer.state,
    lawyer.office_address,
    lawyer.professional_email,
    languages.length > 0,
    lawyer.professional_bio,
    lawyer.working_office_hours,
  ];

  const completedFields =
    profileFields.filter(Boolean).length;

  const profileCompleteness =
    Math.round(
      (completedFields /
        profileFields.length) *
        100
    );

  return (
    <div className="lawyer-dashboard-page">

      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="lawyer-dashboard-hero">

        <div className="lawyer-dashboard-hero-glow" />

        <div className="lawyer-dashboard-hero-content">

          <div className="lawyer-dashboard-eyebrow">
            <span>⚖</span>
            NYAYMITRA LAWYER PORTAL
          </div>

          <h1>
            Your legal practice,
            <br />
            <span>simplified.</span>
          </h1>

          <p>
            Manage your professional information
            and access your NyayMitra lawyer
            workspace from one place.
          </p>

          <div className="lawyer-dashboard-hero-meta">

            <span>
              ⚖ {lawyer.lawyer_id}
            </span>

            {lawyer.city && (
              <span>
                ⌖ {lawyer.city}
              </span>
            )}

            {lawyer.years_of_experience !== null &&
              lawyer.years_of_experience !== undefined && (
                <span>
                  ◷ {lawyer.years_of_experience} years
                  experience
                </span>
              )}

          </div>

        </div>

      </section>


      {/* =====================================================
          MAIN
          ===================================================== */}

      <main className="lawyer-dashboard-main">

        {/* =================================================
            PROFILE WELCOME
            ================================================= */}

        <section className="lawyer-dashboard-welcome">

          <div className="lawyer-dashboard-profile">

            <div className="lawyer-dashboard-avatar">
              {getInitials(
                lawyer.full_name
              )}
            </div>

            <div>

              <span className="lawyer-dashboard-section-label">
                LAWYER WORKSPACE
              </span>

              <h2>
                {lawyer.full_name}
              </h2>

              <p>
                {practiceAreas.length > 0
                  ? practiceAreas.join(" • ")
                  : "Legal Professional"}
              </p>

            </div>

          </div>

          <div className="lawyer-dashboard-profile-status">

            <span>
              Profile Status
            </span>

            <strong>
              {lawyer.profile_status ||
                "Not available"}
            </strong>

          </div>

        </section>


        {/* =================================================
            OVERVIEW
            ================================================= */}

        <section className="lawyer-dashboard-overview">

          <div className="lawyer-dashboard-heading">

            <div>

              <span className="lawyer-dashboard-section-label">
                WORKSPACE OVERVIEW
              </span>

              <h2>
                Your professional snapshot
              </h2>

            </div>

            <p>
              Live information from the
              NyayMitra lawyer API
            </p>

          </div>


          <div className="lawyer-dashboard-stat-grid">

            <StatCard
              icon="⚖"
              tone="purple"
              label="EXPERIENCE"
              value={
                lawyer.years_of_experience !==
                  null &&
                lawyer.years_of_experience !==
                  undefined
                  ? `${lawyer.years_of_experience} yrs`
                  : "—"
              }
              detail="Professional experience"
            />

            <StatCard
              icon="§"
              tone="blue"
              label="PRACTICE AREAS"
              value={String(
                practiceAreas.length
              )}
              detail="Areas listed in profile"
            />

            <StatCard
              icon="⌖"
              tone="orange"
              label="COURTS"
              value={String(
                courts.length
              )}
              detail="Courts listed in profile"
            />

            <StatCard
              icon="✓"
              tone="green"
              label="PROFILE STATUS"
              value={
                lawyer.profile_status ||
                "—"
              }
              detail="Backend profile status"
              status
            />

          </div>

        </section>


        {/* =================================================
            INFORMATION
            ================================================= */}

        <section className="lawyer-dashboard-info-section">

          <div className="lawyer-dashboard-info-grid">

            <InfoCard
              title="Location"
              icon="⌖"
              tone="blue"
              items={[
                ["City", lawyer.city],
                ["District", lawyer.district],
                ["State", lawyer.state],
                ["Pincode", lawyer.pincode],
              ]}
            />

            <InfoCard
              title="Professional Contact"
              icon="✉"
              tone="green"
              items={[
                [
                  "Email",
                  lawyer.professional_email,
                ],
                [
                  "Phone",
                  lawyer.professional_phone_number,
                ],
                [
                  "Office",
                  lawyer.office_phone,
                ],
                [
                  "Preferred",
                  lawyer.preferred_contact_method,
                ],
              ]}
            />

            <InfoCard
              title="Registration"
              icon="⚖"
              tone="purple"
              items={[
                [
                  "Enrollment",
                  lawyer.enrollment_number,
                ],
                [
                  "Registration",
                  lawyer.registration_number,
                ],
                [
                  "Bar Council",
                  lawyer.bar_council,
                ],
                [
                  "Year",
                  lawyer.year_of_enrollment?.toString(),
                ],
              ]}
            />

          </div>

        </section>


        {/* =================================================
            PRACTICE + COURTS
            ================================================= */}

        <section className="lawyer-dashboard-specialization-grid">

          <div className="lawyer-dashboard-wide-card">

            <div className="lawyer-dashboard-card-heading">

              <div className="lawyer-dashboard-stat-icon purple">
                §
              </div>

              <h3>
                Practice Areas
              </h3>

            </div>

            {practiceAreas.length > 0 ? (

              <div className="lawyer-dashboard-chip-list">

                {practiceAreas.map(
                  (area) => (
                    <span key={area}>
                      {area}
                    </span>
                  )
                )}

              </div>

            ) : (

              <p className="lawyer-dashboard-muted">
                No practice areas are available
                in the API response.
              </p>

            )}

          </div>


          <div className="lawyer-dashboard-wide-card">

            <div className="lawyer-dashboard-card-heading">

              <div className="lawyer-dashboard-stat-icon orange">
                ⌖
              </div>

              <h3>
                Courts of Practice
              </h3>

            </div>

            {courts.length > 0 ? (

              <ul className="lawyer-dashboard-list">

                {courts.map(
                  (court) => (
                    <li key={court}>
                      <span>✓</span>
                      {court}
                    </li>
                  )
                )}

              </ul>

            ) : (

              <p className="lawyer-dashboard-muted">
                No courts are available
                in the API response.
              </p>

            )}

          </div>

        </section>


        {/* =================================================
            EDUCATION + LANGUAGES
            ================================================= */}

        <section className="lawyer-dashboard-info-grid-bottom">

          <div className="lawyer-dashboard-small-card">

            <div className="lawyer-dashboard-small-icon">
              🎓
            </div>

            <span>
              EDUCATION
            </span>

            <h3>
              {education.length > 0
                ? education.join(" • ")
                : "Not available"}
            </h3>

          </div>


          <div className="lawyer-dashboard-small-card">

            <div className="lawyer-dashboard-small-icon">
              文
            </div>

            <span>
              LANGUAGES
            </span>

            <h3>
              {languages.length > 0
                ? languages.join(" • ")
                : "Not available"}
            </h3>

          </div>


          <div className="lawyer-dashboard-small-card">

            <div className="lawyer-dashboard-small-icon">
              ◷
            </div>

            <span>
              OFFICE HOURS
            </span>

            <h3>
              {lawyer.working_office_hours ||
                "Not available"}
            </h3>

          </div>

        </section>


        {/* =================================================
            PROFILE COMPLETENESS
            ================================================= */}

        <section className="lawyer-dashboard-profile-progress">

          <div>

            <span className="lawyer-dashboard-section-label">
              PROFILE COMPLETENESS
            </span>

            <h2>
              Keep your professional
              profile complete
            </h2>

            <p>
              More complete information makes
              the lawyer profile more useful
              across NyayMitra.
            </p>

          </div>

          <div className="lawyer-dashboard-progress">

            <div className="lawyer-dashboard-progress-number">
              {profileCompleteness}%
            </div>

            <div className="lawyer-dashboard-progress-track">
              <div
                style={{
                  width: `${profileCompleteness}%`,
                }}
              />
            </div>

          </div>

        </section>


        {/* =================================================
            CTA
            ================================================= */}

        <section className="lawyer-dashboard-cta">

          <div>

            <span>
              PROFESSIONAL PROFILE
            </span>

            <h2>
              Review your lawyer profile
            </h2>

            <p>
              Open the complete profile page
              to review your professional,
              contact, education and practice
              information.
            </p>

          </div>


          <div className="lawyer-dashboard-cta-actions">

            <button
              type="button"
              onClick={() =>
                onNavigate("lawyerProfile")
              }
            >
              View My Profile →
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                })
              }
            >
              Back to top ↑
            </button>

          </div>

        </section>

      </main>

    </div>
  );
}


/* =========================================================
   HELPERS
   ========================================================= */

function getInitials(
  name: string
): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase() || ""
    )
    .join("");
}


function StatCard({
  icon,
  tone,
  label,
  value,
  detail,
  status = false,
}: {
  icon: string;
  tone:
    | "purple"
    | "blue"
    | "orange"
    | "green";
  label: string;
  value: string;
  detail: string;
  status?: boolean;
}) {
  return (
    <div className="lawyer-dashboard-stat-card">

      <div
        className={`lawyer-dashboard-stat-icon ${tone}`}
      >
        {icon}
      </div>

      <div>

        <span>
          {label}
        </span>

        <strong
          className={
            status
              ? "status-value"
              : undefined
          }
        >
          {value}
        </strong>

        <small>
          {detail}
        </small>

      </div>

    </div>
  );
}


function InfoCard({
  title,
  icon,
  tone,
  items,
}: {
  title: string;
  icon: string;
  tone:
    | "purple"
    | "blue"
    | "orange"
    | "green";
  items: Array<
    [
      string,
      string | number | null | undefined
    ]
  >;
}) {
  return (
    <div className="lawyer-dashboard-info-card">

      <div
        className={`lawyer-dashboard-info-icon ${tone}`}
      >
        {icon}
      </div>

      <div>

        <div className="lawyer-dashboard-info-title">
          <h3>
            {title}
          </h3>
        </div>

        <div className="lawyer-dashboard-detail-list">

          {items.map(
            ([label, value]) => (
              <div key={label}>

                <span>
                  {label}
                </span>

                <strong>
                  {value ||
                    "Not available"}
                </strong>

              </div>
            )
          )}

        </div>

      </div>

    </div>
  );
}


export default LawyerDashboardPage;