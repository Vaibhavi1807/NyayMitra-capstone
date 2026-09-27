import { useEffect, useState } from "react";

import {
  getLawyers,
  getLawyerById,
  getPracticeAreas,
} from "../../api/lawyerApi";

import type {
  Lawyer,
  PracticeArea,
} from "../../api/lawyerApi";

import type { ChatTarget } from "../../api/chatApi";

/* =========================================================
   PROPS
   ========================================================= */

type LawyerPageProps = {
  onBack: () => void;

  /**
   * Opens the full profile of a lawyer.
   * Wired up by App.tsx to the shared profile page.
   */
  onViewProfile?: (lawyerId: string) => void;

  /**
   * Starts a conversation with the lawyer on the card.
   * Wired up by App.tsx to the shared inbox, which enforces
   * that a citizen may only message lawyers and staff.
   */
  onChat?: (target: ChatTarget) => void;
};

/* =========================================================
   CONSTANTS

   The list endpoint caps `limit` at 100, and a single page
   of 100 records already contains all 36 distinct cities,
   so one request is enough to build the city filter.
   ========================================================= */

const PAGE_SIZE = 12;
const CITY_INDEX_LIMIT = 100;

const ALL_PRACTICE_AREAS = "All practice areas";
const ALL_CITIES = "All cities";

const SENIOR_YEARS = 15;

/* =========================================================
   HELPERS
   ========================================================= */

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "—";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

function practiceAreasOf(lawyer: Lawyer): string[] {
  return (lawyer.practice_areas ?? []).filter(Boolean);
}

function languagesOf(lawyer: Lawyer): string[] {
  return (lawyer.languages_known ?? []).filter(Boolean);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to reach the NyayMitra lawyer service.";
}

/* =========================================================
   RESULT SNAPSHOT

   The results are stored together with the exact filter
   combination that produced them. `loading` is then
   DERIVED by comparing that snapshot key with the current
   filters, instead of being toggled inside an effect.
   ========================================================= */

type ResultSnapshot = {
  key: string;
  lawyers: Lawyer[];
  totalCount: number;
  totalPages: number;
  error: string;
};

function snapshotKey(
  query: string,
  practiceArea: string,
  city: string,
  page: number,
  retryToken: number,
): string {
  return [
    query,
    practiceArea,
    city,
    page,
    retryToken,
  ].join("|");
}

/* =========================================================
   LAWYER PAGE

   Every lawyer shown here comes from the FastAPI +
   PostgreSQL lawyer service:

     GET /api/practice-areas   → practice area filter
     GET /api/lawyers          → search, filters, paging
     GET /api/lawyers/{id}     → full profile per card
   ========================================================= */

export default function LawyerPage({
  onBack,
  onViewProfile,
  onChat,
}: LawyerPageProps) {
  /* ---------- FILTER STATE ---------- */

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [practiceArea, setPracticeArea] = useState(
    ALL_PRACTICE_AREAS,
  );
  const [city, setCity] = useState(ALL_CITIES);
  const [page, setPage] = useState(1);

  /* ---------- FILTER OPTIONS ---------- */

  const [practiceAreaOptions, setPracticeAreaOptions] =
    useState<PracticeArea[]>([]);

  const [cityOptions, setCityOptions] = useState<
    string[]
  >([]);

  /* ---------- RESULTS ---------- */

  const [snapshot, setSnapshot] =
    useState<ResultSnapshot | null>(null);

  /* Bumped by the Retry button to re-run the load effect. */
  const [retryToken, setRetryToken] = useState(0);

  /* =======================================================
     DEBOUNCE THE SEARCH BOX

     The search runs server-side, so it must not fire on
     every keystroke.
     ======================================================= */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  /* =======================================================
     FILTER OPTIONS  (loaded once)
     ======================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      try {
        const response = await getPracticeAreas();

        if (!cancelled) {
          setPracticeAreaOptions(
            response.practice_areas,
          );
        }
      } catch {
        /* Filter falls back to "All practice areas". */
      }

      try {
        const response = await getLawyers({
          page: 1,
          limit: CITY_INDEX_LIMIT,
        });

        if (cancelled) return;

        const distinct = Array.from(
          new Set(
            response.lawyers
              .map((lawyer) =>
                (lawyer.city || "").trim(),
              )
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));

        setCityOptions(distinct);
      } catch {
        /* Filter falls back to "All cities". */
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     LOAD RESULTS

     1. getLawyers  — server-side search, filters, paging
     2. getLawyerById for each visible row so the card can
        show practice areas, languages and enrollment year.
        Each detail call fails soft: the card then falls
        back to whatever the list returned.
     ======================================================= */

  useEffect(() => {
    let cancelled = false;

    const key = snapshotKey(
      query,
      practiceArea,
      city,
      page,
      retryToken,
    );

    const load = async () => {
      try {
        const response = await getLawyers({
          name: query || undefined,
          practice_area:
            practiceArea === ALL_PRACTICE_AREAS
              ? undefined
              : practiceArea,
          city:
            city === ALL_CITIES ? undefined : city,
          page,
          limit: PAGE_SIZE,
        });

        const detailed = await Promise.all(
          response.lawyers.map(async (row) => {
            try {
              return await getLawyerById(
                row.lawyer_id,
              );
            } catch {
              return row;
            }
          }),
        );

        if (cancelled) return;

        setSnapshot({
          key,
          lawyers: detailed,
          totalCount: response.total_count,
          totalPages: Math.max(
            1,
            response.total_pages,
          ),
          error: "",
        });
      } catch (loadError) {
        if (cancelled) return;

        setSnapshot({
          key,
          lawyers: [],
          totalCount: 0,
          totalPages: 1,
          error: errorMessage(loadError),
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [query, practiceArea, city, page, retryToken]);

  /* =======================================================
     DERIVED VIEW STATE

     A snapshot matching the current filters means the
     results are settled; otherwise we are loading.
     ======================================================= */

  const currentKey = snapshotKey(
    query,
    practiceArea,
    city,
    page,
    retryToken,
  );

  const current =
    snapshot !== null && snapshot.key === currentKey
      ? snapshot
      : null;

  const loading = current === null;
  const error = current?.error ?? "";
  const lawyers = current?.lawyers ?? [];

  const totalCount = snapshot?.totalCount ?? 0;
  const totalPages = snapshot?.totalPages ?? 1;

  /* =======================================================
     HANDLERS
     ======================================================= */

  const changePracticeArea = (value: string) => {
    setPracticeArea(value);
    setPage(1);
  };

  const changeCity = (value: string) => {
    setCity(value);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setQuery("");
    setPracticeArea(ALL_PRACTICE_AREAS);
    setCity(ALL_CITIES);
    setPage(1);
  };

  const changePage = (nextPage: number) => {
    const clamped = Math.min(
      Math.max(1, nextPage),
      totalPages,
    );

    if (clamped === page) return;

    setPage(clamped);

    document
      .querySelector(".lawyer-results")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  const filtersActive =
    Boolean(query) ||
    practiceArea !== ALL_PRACTICE_AREAS ||
    city !== ALL_CITIES;

  const firstIndex =
    totalCount === 0
      ? 0
      : (page - 1) * PAGE_SIZE + 1;

  const lastIndex =
    totalCount === 0
      ? 0
      : firstIndex + lawyers.length - 1;

  /* =======================================================
     RENDER
     ======================================================= */

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
            Search verified lawyers by name, practice
            area and location — live from the NyayMitra
            advocate registry.
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
                value={searchInput}
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
                placeholder="Search lawyer by name..."
              />

              {searchInput && (
                <button
                  type="button"
                  className="lawyer-clear"
                  onClick={() => setSearchInput("")}
                >
                  ×
                </button>
              )}
            </div>

            <select
              value={practiceArea}
              onChange={(event) =>
                changePracticeArea(event.target.value)
              }
              className="lawyer-filter"
            >
              <option value={ALL_PRACTICE_AREAS}>
                {ALL_PRACTICE_AREAS}
              </option>

              {practiceAreaOptions.map((area) => (
                <option
                  key={area.practice_area_id}
                  value={area.practice_area_name}
                >
                  {area.practice_area_name}
                </option>
              ))}
            </select>

            <select
              value={city}
              onChange={(event) =>
                changeCity(event.target.value)
              }
              className="lawyer-filter"
            >
              <option value={ALL_CITIES}>
                {ALL_CITIES}
              </option>

              {cityOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

          </div>

          <div className="lawyer-filter-summary">
            <div>
              <strong>{totalCount}</strong>{" "}
              lawyers found
              {lawyers.length > 0 && (
                <>
                  {" "}
                  · showing {firstIndex}–{lastIndex}
                </>
              )}
            </div>

            {filtersActive && (
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
                VERIFIED ADVOCATES
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

          {/* -------- LOADING -------- */}

          {loading && (
            <div className="lawyer-grid">
              {Array.from({ length: 6 }).map(
                (_, index) => (
                  <div
                    className="lawyer-card lawyer-skeleton"
                    key={`skeleton-${index}`}
                  >
                    <div className="lawyer-skeleton-line w40" />
                    <div className="lawyer-skeleton-line w70" />
                    <div className="lawyer-skeleton-line w55" />
                    <div className="lawyer-skeleton-line w85" />
                  </div>
                ),
              )}
            </div>
          )}

          {/* -------- ERROR -------- */}

          {!loading && error && (
            <div className="lawyer-error">
              <div className="lawyer-error-icon">
                ⚠
              </div>

              <h3>
                Lawyer service unavailable
              </h3>

              <p>{error}</p>

              <p className="lawyer-error-hint">
                Start the FastAPI service on port 8000,
                then try again.
              </p>

              <button
                type="button"
                onClick={() =>
                  setRetryToken((token) => token + 1)
                }
              >
                Retry
              </button>
            </div>
          )}

          {/* -------- EMPTY -------- */}

          {!loading && !error && lawyers.length === 0 && (
            <div className="lawyer-empty">
              <div>⚖</div>

              <h3>No lawyers found</h3>

              <p>
                Try changing your search or selecting
                another practice area or city.
              </p>

              <button
                type="button"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            </div>
          )}

          {/* -------- RESULTS -------- */}

          {!loading && !error && lawyers.length > 0 && (
            <>
              <div className="lawyer-grid">

                {lawyers.map((lawyer) => {
                  const areas =
                    practiceAreasOf(lawyer);

                  const languages =
                    languagesOf(lawyer);

                  const years =
                    lawyer.years_of_experience;

                  const isSenior =
                    (years ?? 0) >= SENIOR_YEARS;

                  return (
                    <article
                      className="lawyer-card"
                      key={lawyer.lawyer_id}
                    >

                      {isSenior && (
                        <div className="suggested-badge">
                          ✦ Senior counsel
                        </div>
                      )}

                      <div className="lawyer-card-top">

                        <div className="lawyer-avatar">
                          {initialsOf(lawyer.full_name)}
                        </div>

                        <div className="lawyer-rating">
                          <span>✓</span>
                          {lawyer.profile_status ||
                            "Verified"}
                        </div>

                      </div>

                      <h3>
                        {lawyer.full_name}
                      </h3>

                      <p className="lawyer-specialization">
                        {areas[0] || "General Practice"}
                      </p>

                      <div className="lawyer-meta">

                        <div>
                          <span>◷</span>
                          <strong>
                            {years != null
                              ? `${years} yrs`
                              : "—"}
                          </strong>
                          <small>experience</small>
                        </div>

                        <div>
                          <span>⌖</span>
                          <strong>
                            {lawyer.city ||
                              lawyer.district ||
                              "—"}
                          </strong>
                          <small>location</small>
                        </div>

                        <div>
                          <span>§</span>
                          <strong>
                            {lawyer.year_of_enrollment ||
                              "—"}
                          </strong>
                          <small>enrolled</small>
                        </div>

                      </div>

                      <div className="lawyer-divider" />

                      <div className="lawyer-languages">

                        <span>Languages</span>

                        <div>
                          {languages.length > 0 ? (
                            languages
                              .slice(0, 4)
                              .map((language) => (
                                <span
                                  key={language}
                                >
                                  {language}
                                </span>
                              ))
                          ) : (
                            <span className="lawyer-language-muted">
                              Not listed
                            </span>
                          )}
                        </div>

                      </div>

                      <div className="lawyer-card-actions">

                        {onChat && (
                          <button
                            type="button"
                            className="lawyer-chat-btn"
                            onClick={() =>
                              onChat({
                                id: lawyer.lawyer_id,
                                name: lawyer.full_name,
                                role: "LAWYER",
                              })
                            }
                          >
                            💬 Chat
                          </button>
                        )}

                        <button
                          type="button"
                          className="lawyer-profile-btn"
                          onClick={() =>
                            onViewProfile?.(
                              lawyer.lawyer_id,
                            )
                          }
                        >
                          View Profile
                          <span>→</span>
                        </button>

                      </div>

                    </article>
                  );
                })}

              </div>

              {/* -------- PAGINATION -------- */}

              {totalPages > 1 && (
                <nav className="lawyer-pagination">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() =>
                      changePage(page - 1)
                    }
                  >
                    ← Previous
                  </button>

                  <span>
                    Page {page} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() =>
                      changePage(page + 1)
                    }
                  >
                    Next →
                  </button>
                </nav>
              )}

            </>
          )}

        </section>

      </main>

    </main>
  );
}
