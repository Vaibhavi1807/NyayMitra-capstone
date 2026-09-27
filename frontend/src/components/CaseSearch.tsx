import { useMemo, useState } from "react";
import { mockCases } from "../mocks/cases";
import CaseCard from "./CaseCard";

type CaseSearchProps = {
  /* Signed-in account. Everything below is scoped to it: the results, the type
     filter and the search box only ever see this user's own cases. */
  userId: string;
};

export default function CaseSearch({ userId }: CaseSearchProps) {
  const [search, setSearch] = useState("");
  const [caseType, setCaseType] = useState("All");

  const myCases = useMemo(
    () => mockCases.filter((item) => item.owner_user_id === userId),
    [userId],
  );

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
                    myCases.length === 1 ? "case" : "cases"
                  } on your account`
                : `${filteredCases.length} of ${myCases.length} cases`}
            </h2>

            <p>
              {search
                ? `Showing your cases matching "${search}"`
                : "Only cases filed on your account are shown"}
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
        ) : myCases.length === 0 ? (
          /* No ownership at all — filtering isn't the problem. */
          <div className="empty-state">
            <div className="empty-icon">⚖</div>
            <h3>No cases on your account</h3>
            <p>
              This account does not have any court cases linked to it yet.
              Once a case is filed and linked to you, it will appear here.
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