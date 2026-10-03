import { useState } from "react";

import CaseSearch from "../../components/CaseSearch";
import AddCaseForm from "../../components/AddCaseForm";
import CaseDetail from "../../components/CaseDetail";
import type { ChatTarget } from "../../api/chatApi";
import { getCase } from "../../api/caseApi";

/* =========================================================
   MY CASES

   Three screens behind one door: the list, the form that
   adds to it, and the matter itself. Keeping them here
   rather than in the router means the hero and the dashboard
   back button belong to the list only — a detail view has
   its own "All cases" link, and two competing back buttons
   in the same corner would be worse than one clear one.

   Each is mounted only while it is on screen, so returning
   to the list re-reads the store and shows whatever was
   filed in the meantime.
   ========================================================= */

type View =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "detail"; cnr: string };

type CaseSearchPageProps = {
  /* Signed-in account — the list below is scoped to it, so one user can never
     see another user's cases. */
  userId: string;

  /* Prefills the petitioner field when filing. */
  userName?: string;

  onBack?: () => void;

  /* Opens a chat thread with the advocate on the matter. */
  onChat?: (target: ChatTarget) => void;
};

export default function CaseSearchPage({
  userId,
  userName = "",
  onBack,
  onChat,
}: CaseSearchPageProps) {
  const [view, setView] = useState<View>({ kind: "list" });

  /* Re-read on every render: the detail view must reflect a
     matter that was re-opened, not the last one it rendered. */
  const opened =
    view.kind === "detail" ? getCase(view.cnr) : null;

  return (
    <main className="nyaymitra-page">
      {/* The dashboard back button belongs to the list. On the
          form and the matter it would sit directly under the
          component's own link and cover it. */}
      {view.kind === "list" && onBack && (
        <div className="page-back-wrapper">
          <button className="page-back-button" onClick={onBack}>
            ← Back to Dashboard
          </button>
        </div>
      )}

      {view.kind === "list" && (
        <>
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
                else's. Open a case to read it in full, add documents, and
                speak to the advocate handling it.
              </p>
            </div>
          </section>

          <CaseSearch
            userId={userId}
            onAdd={() => setView({ kind: "add" })}
            onOpen={(cnr) => setView({ kind: "detail", cnr })}
          />
        </>
      )}

      {view.kind === "add" && (
        <AddCaseForm
          userId={userId}
          defaultPetitioner={userName}
          onCancel={() => setView({ kind: "list" })}
          onCreated={(cnr) => setView({ kind: "detail", cnr })}
        />
      )}

      {view.kind === "detail" && opened && (
        <CaseDetail
          key={opened.cnr_number}
          caseData={opened}
          userId={userId}
          onBack={() => setView({ kind: "list" })}
          onChat={onChat}
        />
      )}

      {/* A CNR that no longer resolves — the case was removed
          between renders. Drop back to the list rather than
          leaving an empty page. */}
      {view.kind === "detail" && !opened && (
        <section className="matter-detail">
          <button
            type="button"
            className="matter-back"
            onClick={() => setView({ kind: "list" })}
          >
            ← All cases
          </button>

          <div className="matter-empty">
            <span aria-hidden="true">⚖</span>
            <p>This case is no longer on your account.</p>
          </div>
        </section>
      )}
    </main>
  );
}
