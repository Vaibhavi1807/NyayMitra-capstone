import { useState } from "react";
import "./App.css";

// ================= AUTH =================

import LoginPage from "./pages/auth/LoginPage";
import type { Session } from "./auth/session";
import {
  loadSession,
  saveSession,
  clearSession,
} from "./auth/session";

// ================= USER PAGES =================

import DashboardPage from "./pages/user/DashboardPage";
import CaseSearchPage from "./pages/user/CaseSearchPage";
import LawyerPage from "./pages/user/LawyerPage";
import CourtOrdersPage from "./pages/user/CourtOrdersPage";
import TranslationPage from "./pages/user/TranslationPage";
import DelayAnalysisPage from "./pages/user/DelayAnalysisPage";
import TellUsPage from "./pages/user/TellUsPage";
import VoiceNyayMitraPage from "./pages/user/VoiceNyayMitraPage";
import CaseTimelinePage from "./pages/user/CaseTimelinePage";
import NextStepsPage from "./pages/user/NextStepsPage";

// ================= LAWYER PAGES =================

import LawyerDashboardPage from "./pages/lawyer/LawyerDashboardPage";
import LawyerProfilePage from "./pages/lawyer/LawyerProfilePage";

// ================= ADMIN PAGES =================

import AdminDashboardPage from "./pages/admin/AdminDashboardPage";

// ================= STAFF PAGES =================

import StaffDashboardPage from "./pages/staff/StaffDashboardPage";

/* =========================================================
   PAGE TYPES
   ========================================================= */

export type Page =
  // USER
  | "dashboard"
  | "cases"
  | "lawyer"
  | "orders"
  | "translation"
  | "delay"
  | "tellUs"
  | "voice"
  | "timeline"
  | "nextSteps"

  // LAWYER
  | "lawyerDashboard"
  | "lawyerProfile"

  // ADMIN
  | "adminDashboard"

  // STAFF
  | "staffDashboard";

/* =========================================================
   DEVELOPMENT LAWYER ID

   Fallback used only when the signed-in session does not
   carry a lawyer ID (for example, an older saved session).
   After login, the LAWYER session's own lawyerId wins.
   ========================================================= */

const FALLBACK_LAWYER_ID =
  import.meta.env.VITE_LAWYER_ID?.trim() || "LAWYER_0003";

/* =========================================================
   HOME PAGE FOR EACH ROLE

   Login → role detection → respective dashboard.
   ========================================================= */

function homePageForRole(
  role: Session["role"],
): Page {
  switch (role) {
    case "USER":
      return "dashboard";

    case "LAWYER":
      return "lawyerDashboard";

    case "ADMIN":
      return "adminDashboard";

    case "STAFF":
      return "staffDashboard";

    default:
      return "dashboard";
  }
}

/* =========================================================
   WHICH PAGES BELONG TO WHICH ROLE

   Used as a guard so a role can never render another
   role's dashboard (defence in depth on top of the
   conditional rendering below).
   ========================================================= */

const PAGES_BY_ROLE: Record<
  Session["role"],
  Page[]
> = {
  USER: [
    "dashboard",
    "cases",
    "lawyer",
    "orders",
    "translation",
    "delay",
    "tellUs",
    "voice",
    "timeline",
    "nextSteps",
  ],

  LAWYER: ["lawyerDashboard", "lawyerProfile"],

  ADMIN: ["adminDashboard"],

  STAFF: ["staffDashboard"],
};

function pageOwnedByRole(
  role: Session["role"],
  page: Page,
): boolean {
  return PAGES_BY_ROLE[role].includes(page);
}

/* =========================================================
   APP
   ========================================================= */

function App() {

  /*
   * ONE LOGIN SYSTEM
   *
   * No session  → Login page (role selection).
   * Session     → the role on the session decides which
   *               dashboard opens.
   */

  const [session, setSession] =
    useState<Session | null>(() => loadSession());

  /*
   * On a page refresh the session is restored from
   * storage, so the starting page must be derived from
   * the restored role — otherwise a lawyer refreshing
   * the browser would land on a user page and see a
   * blank screen.
   */

  const [activePage, setActivePage] =
    useState<Page>(() => {
      const existing = loadSession();

      return existing
        ? homePageForRole(existing.role)
        : "dashboard";
    });

  /* =======================================================
     LOGIN / LOGOUT
     ======================================================= */

  const handleAuthenticated = (next: Session) => {
    saveSession(next);

    setSession(next);
    setActivePage(homePageForRole(next.role));

    window.scrollTo({ top: 0 });
  };

  const handleSignOut = () => {
    clearSession();

    setSession(null);
    setActivePage("dashboard");

    window.scrollTo({ top: 0 });
  };

  /* =======================================================
     NOT SIGNED IN → LOGIN PAGE
     ======================================================= */

  if (!session) {
    return (
      <div className="app">
        <LoginPage
          onAuthenticated={handleAuthenticated}
        />
      </div>
    );
  }

  /* =======================================================
     SIGNED IN → ROLE ROUTING
     ======================================================= */

  const goToPage = (page: Page) => {
    setActivePage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const goBackToDashboard = () => {
    setActivePage(homePageForRole(session.role));

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const lawyerId =
    session.lawyerId?.trim() || FALLBACK_LAWYER_ID;

  /*
   * GUARD
   *
   * If activePage somehow points at a page that does not
   * belong to the signed-in role (for example a stale
   * stored value), fall back to that role's dashboard
   * instead of rendering a blank screen.
   */

  const page = pageOwnedByRole(session.role, activePage)
    ? activePage
    : homePageForRole(session.role);

  return (
    <div className="app">

      {/* =================================================
          USER DASHBOARD
          ================================================= */}

      {session.role === "USER" &&
        page === "dashboard" && (
          <DashboardPage
            onNavigate={goToPage}
          />
        )}


      {/* =================================================
          USER FEATURE PAGES
          ================================================= */}

      {session.role === "USER" &&
        page === "cases" && (
          <CaseSearchPage
            onBack={goBackToDashboard}
          />
        )}

      {session.role === "USER" &&
        page === "lawyer" && (
          <LawyerPage
            onBack={goBackToDashboard}
          />
        )}

      {session.role === "USER" &&
        page === "orders" && (
          <CourtOrdersPage
            onBack={goBackToDashboard}
          />
        )}

      {session.role === "USER" &&
        page === "translation" && (
          <TranslationPage
            onBack={goBackToDashboard}
          />
        )}

      {session.role === "USER" &&
        page === "delay" && (
          <DelayAnalysisPage
            onBack={goBackToDashboard}
          />
        )}

      {session.role === "USER" &&
        page === "tellUs" && (
          <TellUsPage
            onBack={goBackToDashboard}
          />
        )}

      {session.role === "USER" &&
        page === "voice" && (
          <VoiceNyayMitraPage
            onBack={goBackToDashboard}
          />
        )}

      {session.role === "USER" &&
        page === "timeline" && (
          <CaseTimelinePage
            onBack={goBackToDashboard}
          />
        )}

      {session.role === "USER" &&
        page === "nextSteps" && (
          <NextStepsPage
            onBack={goBackToDashboard}
          />
        )}


      {/* =================================================
          LAWYER DASHBOARD
          ================================================= */}

      {session.role === "LAWYER" &&
        page === "lawyerDashboard" && (
          <LawyerDashboardPage
            onNavigate={goToPage}
            lawyerId={lawyerId}
          />
        )}


      {/* =================================================
          LAWYER PROFILE
          ================================================= */}

      {session.role === "LAWYER" &&
        page === "lawyerProfile" && (
          <LawyerProfilePage
            lawyerId={lawyerId}
            onBack={goBackToDashboard}
          />
        )}


      {/* =================================================
          ADMIN DASHBOARD
          ================================================= */}

      {session.role === "ADMIN" && (
        <AdminDashboardPage
          session={session}
          onSignOut={handleSignOut}
        />
      )}


      {/* =================================================
          STAFF DASHBOARD
          ================================================= */}

      {session.role === "STAFF" && (
        <StaffDashboardPage
          session={session}
          onSignOut={handleSignOut}
        />
      )}


      {/* =================================================
          SIGN OUT (USER + LAWYER)

          The user and lawyer dashboards predate
          authentication, so the session control is
          provided globally here instead of inside each
          page.
          ================================================= */}

      {(session.role === "USER" ||
        session.role === "LAWYER") && (
        <div className="app-session-bar">

          <span className="app-session-role">
            {session.role}
          </span>

          <span className="app-session-name">
            {session.fullName}
          </span>

          <button
            type="button"
            onClick={handleSignOut}
          >
            Sign out
          </button>

        </div>
      )}

    </div>
  );
}

export default App;
