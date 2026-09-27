import { useEffect, useState } from "react";
import {
  getLawyerById,
  type Lawyer,
} from "../../api/lawyerApi";
import "./LawyerProfilePage.css";

interface LawyerProfilePageProps {
  lawyerId: string;
  onBack: () => void;
}

function LawyerProfilePage({
  lawyerId,
  onBack,
}: LawyerProfilePageProps) {
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLawyer() {
      try {
        setLoading(true);
        setError("");

        const data = await getLawyerById(lawyerId);

        if (!cancelled) {
          setLawyer(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load lawyer profile."
          );
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
  }, [lawyerId]);

  if (loading) {
    return (
      <div className="lawyer-profile-page">
        <div className="lawyer-profile-loading">
          <div className="lawyer-profile-spinner" />
          <h2>Loading lawyer profile...</h2>
          <p>
            Fetching professional information from NyayMitra.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lawyer-profile-page">
        <div className="lawyer-profile-error">
          <div className="lawyer-profile-error-icon">
            !
          </div>

          <h2>Unable to load profile</h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={onBack}
            className="lawyer-profile-back-button"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!lawyer) {
    return (
      <div className="lawyer-profile-page">
        <div className="lawyer-profile-error">
          <h2>Lawyer profile not found</h2>

          <p>
            No lawyer information was returned by the API.
          </p>

          <button
            type="button"
            onClick={onBack}
            className="lawyer-profile-back-button"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lawyer-profile-page">

      {/* =====================================================
          HERO
         ===================================================== */}

      <section className="lawyer-profile-hero">
        <div className="lawyer-profile-hero-glow" />

        <div className="lawyer-profile-hero-content">

          <button
            type="button"
            onClick={onBack}
            className="lawyer-profile-back"
          >
            ← Dashboard
          </button>

          <div className="lawyer-profile-eyebrow">
            <span>⚖</span>
            NYAYMITRA LAWYER PROFILE
          </div>

          <div className="lawyer-profile-identity">

            <div className="lawyer-profile-avatar">
              {lawyer.profile_image ? (
                <img
                  src={lawyer.profile_image}
                  alt={lawyer.full_name}
                />
              ) : (
                <span>
                  {getInitials(lawyer.full_name)}
                </span>
              )}
            </div>

            <div className="lawyer-profile-title">
              <h1>{lawyer.full_name}</h1>

              <p>
                {lawyer.practice_areas?.length
                  ? lawyer.practice_areas.join(" • ")
                  : "Legal Professional"}
              </p>

              <div className="lawyer-profile-location">
                📍{" "}
                {[
                  lawyer.city,
                  lawyer.district,
                  lawyer.state,
                ]
                  .filter(Boolean)
                  .join(", ") || "Location not available"}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================
          MAIN
         ===================================================== */}

      <main className="lawyer-profile-main">

        {/* Professional summary */}

        <section className="lawyer-profile-summary">

          <div className="lawyer-summary-item">
            <span>EXPERIENCE</span>
            <strong>
              {lawyer.years_of_experience ?? "—"}
            </strong>
            <small>years</small>
          </div>

          <div className="lawyer-summary-item">
            <span>ENROLLMENT YEAR</span>
            <strong>
              {lawyer.year_of_enrollment ?? "—"}
            </strong>
            <small>bar enrollment</small>
          </div>

          <div className="lawyer-summary-item">
            <span>BAR COUNCIL</span>
            <strong>
              {lawyer.bar_council || "—"}
            </strong>
            <small>registration authority</small>
          </div>

          <div className="lawyer-summary-item">
            <span>PROFILE STATUS</span>
            <strong>
              {lawyer.profile_status || "—"}
            </strong>
            <small>current status</small>
          </div>

        </section>

        {/* =====================================================
            BASIC INFORMATION
           ===================================================== */}

        <section className="lawyer-profile-section">

          <div className="lawyer-section-heading">
            <span className="lawyer-section-label">
              BASIC INFORMATION
            </span>

            <h2>Personal Details</h2>
          </div>

          <div className="lawyer-info-grid">

            <InfoItem
              label="Lawyer ID"
              value={lawyer.lawyer_id}
            />

            <InfoItem
              label="Full Name"
              value={lawyer.full_name}
            />

            <InfoItem
              label="Gender"
              value={lawyer.gender}
            />

            <InfoItem
              label="Date of Birth"
              value={formatDate(lawyer.date_of_birth)}
            />

          </div>
        </section>

        {/* =====================================================
            PROFESSIONAL INFORMATION
           ===================================================== */}

        <section className="lawyer-profile-section">

          <div className="lawyer-section-heading">
            <span className="lawyer-section-label">
              PROFESSIONAL INFORMATION
            </span>

            <h2>Legal Practice</h2>
          </div>

          <div className="lawyer-info-grid">

            <InfoItem
              label="Enrollment Number"
              value={lawyer.enrollment_number}
            />

            <InfoItem
              label="Registration Number"
              value={lawyer.registration_number}
            />

            <InfoItem
              label="Bar ID / Bar Code"
              value={lawyer.bar_id_or_bar_code}
            />

            <InfoItem
              label="Bar Council"
              value={lawyer.bar_council}
            />

            <InfoItem
              label="Year of Enrollment"
              value={
                lawyer.year_of_enrollment?.toString()
              }
            />

            <InfoItem
              label="Years of Experience"
              value={
                lawyer.years_of_experience !== null &&
                lawyer.years_of_experience !== undefined
                  ? `${lawyer.years_of_experience} years`
                  : null
              }
            />

          </div>

          <div className="lawyer-list-block">

            <span>Practice Areas</span>

            <div className="lawyer-tags">
              {lawyer.practice_areas?.length ? (
                lawyer.practice_areas.map((area) => (
                  <span key={area}>{area}</span>
                ))
              ) : (
                <em>Not available</em>
              )}
            </div>

          </div>

          <div className="lawyer-list-block">

            <span>Courts of Practice</span>

            <div className="lawyer-tags blue-tags">
              {lawyer.courts_of_practice?.length ? (
                lawyer.courts_of_practice.map((court) => (
                  <span key={court}>{court}</span>
                ))
              ) : (
                <em>Not available</em>
              )}
            </div>

          </div>

        </section>

        {/* =====================================================
            LOCATION
           ===================================================== */}

        <section className="lawyer-profile-section">

          <div className="lawyer-section-heading">
            <span className="lawyer-section-label">
              OFFICE & LOCATION
            </span>

            <h2>Professional Location</h2>
          </div>

          <div className="lawyer-info-grid">

            <InfoItem
              label="State"
              value={lawyer.state}
            />

            <InfoItem
              label="District"
              value={lawyer.district}
            />

            <InfoItem
              label="City"
              value={lawyer.city}
            />

            <InfoItem
              label="Pincode"
              value={lawyer.pincode}
            />

          </div>

          <div className="lawyer-address-card">

            <span>OFFICE ADDRESS</span>

            <p>
              {lawyer.office_address ||
                "Office address not available"}
            </p>

          </div>

        </section>

        {/* =====================================================
            CONTACT
           ===================================================== */}

        <section className="lawyer-profile-section">

          <div className="lawyer-section-heading">
            <span className="lawyer-section-label">
              CONTACT
            </span>

            <h2>Professional Contact</h2>
          </div>

          <div className="lawyer-info-grid">

            <InfoItem
              label="Professional Phone"
              value={lawyer.professional_phone_number}
            />

            <InfoItem
              label="Professional Email"
              value={lawyer.professional_email}
            />

            <InfoItem
              label="Office Phone"
              value={lawyer.office_phone}
            />

            <InfoItem
              label="Preferred Contact"
              value={lawyer.preferred_contact_method}
            />

          </div>

          {lawyer.website && (
            <div className="lawyer-website">
              <span>Website</span>

              <a
                href={lawyer.website}
                target="_blank"
                rel="noreferrer"
              >
                {lawyer.website}
              </a>
            </div>
          )}

        </section>

        {/* =====================================================
            EDUCATION & LANGUAGES
           ===================================================== */}

        <section className="lawyer-profile-section">

          <div className="lawyer-section-heading">
            <span className="lawyer-section-label">
              EDUCATION & LANGUAGES
            </span>

            <h2>Qualifications</h2>
          </div>

          <div className="lawyer-two-column">

            <div className="lawyer-list-block">
              <span>Education Qualifications</span>

              <div className="lawyer-tags">
                {lawyer.education_qualifications?.length ? (
                  lawyer.education_qualifications.map(
                    (education) => (
                      <span key={education}>
                        {education}
                      </span>
                    )
                  )
                ) : (
                  <em>Not available</em>
                )}
              </div>
            </div>

            <div className="lawyer-list-block">
              <span>Languages Known</span>

              <div className="lawyer-tags green-tags">
                {lawyer.languages_known?.length ? (
                  lawyer.languages_known.map(
                    (language) => (
                      <span key={language}>
                        {language}
                      </span>
                    )
                  )
                ) : (
                  <em>Not available</em>
                )}
              </div>
            </div>

          </div>

        </section>

        {/* =====================================================
            BIO & OFFICE HOURS
           ===================================================== */}

        <section className="lawyer-profile-section">

          <div className="lawyer-section-heading">
            <span className="lawyer-section-label">
              ADDITIONAL INFORMATION
            </span>

            <h2>Professional Overview</h2>
          </div>

          <div className="lawyer-bio-card">

            <h3>Professional Bio</h3>

            <p>
              {lawyer.professional_bio ||
                "Professional biography not available."}
            </p>

          </div>

          <div className="lawyer-hours-card">

            <span>WORKING OFFICE HOURS</span>

            <strong>
              {lawyer.working_office_hours ||
                "Office hours not available"}
            </strong>

          </div>

        </section>

        <div className="lawyer-profile-footer">
          NyayMitra lawyer information is provided through
          the connected backend API.
        </div>

      </main>
    </div>
  );
}

/* =========================================================
   SMALL HELPERS
   ========================================================= */

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatDate(
  date?: string | null
): string | null {
  if (!date) return null;

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="lawyer-info-item">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </div>
  );
}

export default LawyerProfilePage;