import CaseSearch from "../../components/CaseSearch";

type CaseSearchPageProps = {
  /* Signed-in account — the list below is scoped to it, so one user can never
     see another user's cases. */
  userId: string;
  onBack?: () => void;
};

export default function CaseSearchPage({
  userId,
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
            NYAYMITRA MY CASES
          </div>

          <h1>
            Track
            <br />
            <span>your cases</span>
          </h1>

          <p>
            Only cases filed on your account appear on this page — nobody
            else's. Search by CNR number, petitioner name, or case type,
            and keep track of your case stage and upcoming hearings.
          </p>
        </div>
      </section>

      <CaseSearch userId={userId} />
    </main>
  );
}
