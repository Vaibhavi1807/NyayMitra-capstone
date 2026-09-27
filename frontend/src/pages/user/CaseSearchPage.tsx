import CaseSearch from "../../components/CaseSearch";

type CaseSearchPageProps = {
  onBack?: () => void;
};

export default function CaseSearchPage({
  onBack,
}: CaseSearchPageProps) {
  return (
    <main className="nyaymitra-page">
      {/* Back to Dashboard */}
      {onBack && (
        <div className="page-back-wrapper">
          <button className="page-back-button" onClick={onBack}>
            ← Back to Dashboard
          </button>
        </div>
      )}

      <section className="hero-section">
        <div className="hero-glow" />

        <div className="hero-content">
          <div className="eyebrow">
            <span>⚖</span>
            NYAYMITRA CASE SERVICES
          </div>

          <h1>
            Find and understand
            <br />
            <span>your case</span>
          </h1>

          <p>
            Search your case using the CNR number, petitioner name,
            or case type. Keep track of your case stage and upcoming
            hearings in one place.
          </p>
        </div>
      </section>

      <CaseSearch />
    </main>
  );
}