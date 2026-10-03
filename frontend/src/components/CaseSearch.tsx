import { useMemo, useState } from "react";
import { getCasesForUser } from "../api/caseApi";
import CaseCard from "./CaseCard";

type CaseSearchProps = {
  /* Signed-in account. Everything below is scoped to it: the results, the type
     filter and the search box only ever see this user's own saved cases. */
  userId: string;

  /* Opens one matter's detail screen. */
  onOpen?: (cnr: string) => void;
};

export default function CaseSearch({
  userId,
  onOpen,
}: CaseSearchProps) {
  const [search, setSearch] = useState("");
  const [caseType, setCaseType] = useState("All");

  /* Read on every render, not memoised: saving a case and
     returning to this list must show it without waiting for a
     reload, and the list only rebuilds when something above
     re-renders anyway. */
  const myCases = getCasesForUser(userId);

  const caseTypes = useMemo(() => {
    const types = myCases.map((item) => item.case_type);
    return ["All", ...Array.from(new Set(types))];
  }, [myCases]);

  const filteredCases = useMemo(() => {
    const query = search.toLowerCase().trim();

    return myCases.filter((item) => {
      const matchesSearch =
        !query ||
        item.cnr_number.toLowerCase().includes(query) ||
        item.petitioner_name.toLowerCase().includes(query) ||
        item.case_type.toLowerCase().includes(query) ||
        item.court_name.toLowerCase().includes(query);

      const matchesType =
        caseType === "All" || item.case_type === caseType;

      return matchesSearch && matchesType;
    });
  }, [myCases, search, caseType]);

  return (
    <section className="case-search-section">
      <div className="search-container">

        <div className="search-toolbar">
          <div className="search-box">
            <span className="search-icon">⌕</span>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by CNR, petitioner, case type..."
            />

            {search && (
              <button
                className="clear-search"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <select
            value={caseType}
            onChange={(event) => setCaseType(event.target.value)}
            className="case-filter"
          >
            {caseTypes.map((type) => (
              <option key={type} value={type}>
                {type === "All" ? "All Case Types" : type}
              </option>
            ))}
          </select>
        </div>

        <div className="results-header">
          <div>
            <h2>
              {myCases.length === filteredCases.length
                ? `${myCases.length} ${
                    myCases.length === 1
                      ? "saved case"
                      : "saved cases"
                  }`
                : `${filteredCases.length} of ${myCases.length} saved cases`}
            </h2>

            <p>
              {search
                ? `Showing your saved cases matching "${search}"`
                : "Only cases you saved to track are shown"}
            </p>
          </div>
        </div>

        {filteredCases.length > 0 ? (
          <div className="case-grid">
            {filteredCases.map((caseData) => (
              <CaseCard
                key={caseData.cnr_number}
                caseData={caseData}
                onOpen={onOpen ? () => onOpen(caseData.cnr_number) : undefined}
              />
            ))}
          </div>
        ) : myCases.length === 0 ? (
          /* Nothing saved yet — filtering isn't the problem. */
          <div className="empty-state">
            <div className="empty-icon">⚖</div>
            <h3>No saved cases yet</h3>
            <p>
              Search for an existing case by its CNR number in the box
              above, then choose "Save to My Cases" to track it here —
              documents, hearings and orders follow the case.
            </p>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">⌕</div>
            <h3>No cases found</h3>
            <p>
              We couldn't find any of your cases matching that search.
              Try a different CNR number, petitioner name, or case type.
            </p>

            <button
              className="reset-search-btn"
              onClick={() => {
                setSearch("");
                setCaseType("All");
              }}
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </section>
  );
}