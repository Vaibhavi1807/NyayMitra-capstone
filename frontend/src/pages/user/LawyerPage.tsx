import { useMemo, useState } from "react";

type LawyerPageProps = {
  onBack: () => void;
};

type Lawyer = {
  id: number;
  name: string;
  initials: string;
  specialization: string;
  experience: string;
  city: string;
  cases: number;
  rating: number;
  languages: string[];
  suggested: boolean;
};

const lawyers: Lawyer[] = [
  {
    id: 1,
    name: "Vijay Kumar",
    initials: "VK",
    specialization: "Civil Litigation",
    experience: "12 years",
    city: "Amritsar",
    cases: 186,
    rating: 4.9,
    languages: ["English", "Hindi", "Punjabi"],
    suggested: true,
  },
  {
    id: 2,
    name: "Rishi Arora",
    initials: "RA",
    specialization: "Property & Civil Law",
    experience: "9 years",
    city: "Amritsar",
    cases: 124,
    rating: 4.8,
    languages: ["English", "Hindi", "Punjabi"],
    suggested: true,
  },
  {
    id: 3,
    name: "Ajay Sharma",
    initials: "AS",
    specialization: "Criminal Law",
    experience: "15 years",
    city: "Amritsar",
    cases: 231,
    rating: 4.9,
    languages: ["English", "Hindi"],
    suggested: false,
  },
  {
    id: 4,
    name: "K.S. Baath",
    initials: "KB",
    specialization: "Rent & Property Law",
    experience: "11 years",
    city: "Baba Bakala",
    cases: 142,
    rating: 4.7,
    languages: ["English", "Hindi", "Punjabi"],
    suggested: false,
  },
  {
    id: 5,
    name: "Dalbir Singh Baath",
    initials: "DB",
    specialization: "Civil & Execution",
    experience: "14 years",
    city: "Baba Bakala",
    cases: 197,
    rating: 4.8,
    languages: ["Punjabi", "Hindi"],
    suggested: true,
  },
  {
    id: 6,
    name: "Harpreet Kaur",
    initials: "HK",
    specialization: "Family & Civil Law",
    experience: "8 years",
    city: "Amritsar",
    cases: 109,
    rating: 4.8,
    languages: ["English", "Hindi", "Punjabi"],
    suggested: false,
  },
];

const specializations = [
  "All practice areas",
  "Civil Litigation",
  "Property & Civil Law",
  "Criminal Law",
  "Rent & Property Law",
  "Civil & Execution",
  "Family & Civil Law",
];

const cities = ["All cities", "Amritsar", "Baba Bakala"];

export default function LawyerPage({ onBack }: LawyerPageProps) {
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] =
    useState("All practice areas");
  const [city, setCity] = useState("All cities");

  const filteredLawyers = useMemo(() => {
    const query = search.toLowerCase().trim();

    return lawyers.filter((lawyer) => {
      const matchesSearch =
        !query ||
        lawyer.name.toLowerCase().includes(query) ||
        lawyer.specialization.toLowerCase().includes(query);

      const matchesSpecialization =
        specialization === "All practice areas" ||
        lawyer.specialization === specialization;

      const matchesCity =
        city === "All cities" || lawyer.city === city;

      return (
        matchesSearch &&
        matchesSpecialization &&
        matchesCity
      );
    });
  }, [search, specialization, city]);

  const resetFilters = () => {
    setSearch("");
    setSpecialization("All practice areas");
    setCity("All cities");
  };

  return (
    <main className="lawyer-page">

      {/* BACK TO DASHBOARD */}
      <div className="page-back-wrapper">
        <button
          type="button"
          className="page-back-button"
          onClick={onBack}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* HERO */}
      <section className="lawyer-hero">
        <div className="lawyer-hero-glow" />

        <div className="lawyer-hero-content">
          <div className="lawyer-eyebrow">
            <span>✦</span>
            LEGAL PROFESSIONAL NETWORK
          </div>

          <h1>
            Find the right
            <span> legal expert.</span>
          </h1>

          <p>
            Connect with verified lawyers based on their practice
            area, experience, location, and your legal needs.
          </p>
        </div>
      </section>

      {/* MAIN */}
      <main className="lawyer-main">

        {/* SEARCH */}
        <section className="lawyer-search-panel">

          <div className="lawyer-search-row">

            <div className="lawyer-search-box">
              <span className="lawyer-search-icon">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search lawyers or practice areas..."
              />

              {search && (
                <button
                  type="button"
                  className="lawyer-clear"
                  onClick={() => setSearch("")}
                >
                  ×
                </button>
              )}
            </div>

            <select
              value={specialization}
              onChange={(event) =>
                setSpecialization(event.target.value)
              }
              className="lawyer-filter"
            >
              {specializations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={city}
              onChange={(event) =>
                setCity(event.target.value)
              }
              className="lawyer-filter"
            >
              {cities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

          </div>

          <div className="lawyer-filter-summary">
            <div>
              <strong>{filteredLawyers.length}</strong>{" "}
              lawyers found
            </div>

            {(search ||
              specialization !== "All practice areas" ||
              city !== "All cities") && (
              <button
                type="button"
                onClick={resetFilters}
              >
                Reset filters
              </button>
            )}
          </div>

        </section>

        {/* RESULTS */}
        <section className="lawyer-results">

          <div className="lawyer-results-heading">

            <div>
              <p className="lawyer-section-label">
                RECOMMENDED PROFESSIONALS
              </p>

              <h2>
                Lawyers for your legal needs
              </h2>
            </div>

            <div className="verified-note">
              <span>✓</span>
              Verified profiles
            </div>

          </div>

          {filteredLawyers.length > 0 ? (

            <div className="lawyer-grid">

              {filteredLawyers.map((lawyer) => (

                <article
                  className="lawyer-card"
                  key={lawyer.id}
                >

                  {lawyer.suggested && (
                    <div className="suggested-badge">
                      ✦ Suggested for your case
                    </div>
                  )}

                  <div className="lawyer-card-top">

                    <div className="lawyer-avatar">
                      {lawyer.initials}
                    </div>

                    <div className="lawyer-rating">
                      <span>★</span>
                      {lawyer.rating}
                    </div>

                  </div>

                  <h3>{lawyer.name}</h3>

                  <p className="lawyer-specialization">
                    {lawyer.specialization}
                  </p>

                  <div className="lawyer-meta">

                    <div>
                      <span>◷</span>
                      <strong>{lawyer.experience}</strong>
                      <small>experience</small>
                    </div>

                    <div>
                      <span>⌖</span>
                      <strong>{lawyer.city}</strong>
                      <small>location</small>
                    </div>

                    <div>
                      <span>✓</span>
                      <strong>{lawyer.cases}</strong>
                      <small>cases handled</small>
                    </div>

                  </div>

                  <div className="lawyer-divider" />

                  <div className="lawyer-languages">

                    <span>Languages</span>

                    <div>
                      {lawyer.languages.map((language) => (
                        <span key={language}>
                          {language}
                        </span>
                      ))}
                    </div>

                  </div>

                  <button
                    type="button"
                    className="lawyer-profile-btn"
                    onClick={() =>
                      alert(
                        `${lawyer.name}'s profile will be available here.`
                      )
                    }
                  >
                    View Profile
                    <span>→</span>
                  </button>

                </article>

              ))}

            </div>

          ) : (

            <div className="lawyer-empty">

              <div>⚖</div>

              <h3>
                No lawyers found
              </h3>

              <p>
                Try changing your search or selecting another
                practice area or city.
              </p>

              <button
                type="button"
                onClick={resetFilters}
              >
                Clear filters
              </button>

            </div>

          )}

        </section>

      </main>

    </main>
  );
}