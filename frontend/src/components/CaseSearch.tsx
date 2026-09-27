import { useMemo, useState } from "react";
import { mockCases } from "../mocks/cases";
import CaseCard from "./CaseCard";

export default function CaseSearch() {
  const [search, setSearch] = useState("");
  const [caseType, setCaseType] = useState("All");

  const caseTypes = useMemo(() => {
    const types = mockCases.map((item) => item.case_type);
    return ["All", ...Array.from(new Set(types))];
  }, []);

  const filteredCases = useMemo(() => {
    const query = search.toLowerCase().trim();

    return mockCases.filter((item) => {
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
  }, [search, caseType]);

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
              {filteredCases.length}{" "}
              {filteredCases.length === 1 ? "case" : "cases"} found
            </h2>

            <p>
              {search
                ? `Showing results matching "${search}"`
                : "Showing your available case records"}
            </p>
          </div>
        </div>

        {filteredCases.length > 0 ? (
          <div className="case-grid">
            {filteredCases.map((caseData) => (
              <CaseCard
                key={caseData.cnr_number}
                caseData={caseData}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">⌕</div>
            <h3>No cases found</h3>
            <p>
              We couldn't find any cases matching your search.
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