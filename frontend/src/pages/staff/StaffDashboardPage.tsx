import type { Session } from "../../auth/session";
import type { Page } from "../../App";
import {
  AUTHORITY_CATALOG,
  getAuthoritiesFor,
} from "../../api/authorityApi";
import RoleDashboardShell, {
  type DashboardSection,
  type DashboardStat,
} from "../../components/RoleDashboardShell";
import "../../components/RoleDashboardShell.css";
import "./StaffDashboardPage.css";

/* =========================================================
   STAFF DASHBOARD

   Authorized operational / case-management work carried
   out under the admin role.

   Staff accounts are issued by the admin, and staff sign
   in through the admin login door (see LoginPage).

   Every section below is a planned screen; the shell
   itself is ready and identical in structure to the other
   three dashboards.

   What this account may actually do is whatever the
   administrator delegated on the Access & Roles screen.
   The communication section only opens if that authority
   was granted, so a revoked grant shows up here instead of
   merely going unenforced. See chatApi for who staff may
   talk to once the inbox is open.
   ========================================================= */

type StaffDashboardPageProps = {
  session: Session;
  onSignOut: () => void;
  onNavigate: (page: Page) => void;
};

function StaffDashboardPage({
  session,
  onSignOut,
  onNavigate,
}: StaffDashboardPageProps) {
  /* =====================================================
     CONFIG
     ===================================================== */

  const granted = getAuthoritiesFor(session.userId);

  const has = (authorityId: string) =>
    granted.includes(authorityId);

  const stats: DashboardStat[] = [
    {
      icon: "📋",
      tone: "purple",
      label: "ASSIGNED CASES",
      value: "—",
      detail: "Assigned by admin",
    },
    {
      icon: "📅",
      tone: "blue",
      label: "HEARINGS TODAY",
      value: "—",
      detail: "Court activities",
    },
    {
      icon: "📝",
      tone: "orange",
      label: "PENDING UPDATES",
      value: "—",
      detail: "Case records to file",
    },
    {
      icon: "✅",
      tone: "green",
      label: "STATUS",
      value: "Active",
      detail: "Authorized by admin",
    },
  ];

  const sections: DashboardSection[] = [
    {
      id: "caseFiles",
      icon: "📋",
      title: "Case Files",
      description:
        "Operational case management: update case records, " +
        "attach documents and track filing status.",
      status: "planned",
    },
    {
      id: "hearings",
      icon: "📅",
      title: "Hearings & Court Activities",
      description:
        "View upcoming hearings, cause lists and court " +
        "activities for assigned cases.",
      status: "planned",
    },
    {
      id: "documents",
      icon: "📄",
      title: "Document Processing",
      description:
        "Upload and process court orders and case " +
        "documents through OCR and PDF pipelines.",
      status: "planned",
    },
    {
      id: "communication",
      icon: "💬",
      title: "Client Communication",
      description: has("messages.send")
        ? "Handle authorized communication with users and " +
          "lawyers on assigned matters, and with the admin."
        : "Messaging authority has not been granted to this " +
          "account. The administrator can restore it under " +
          "Access & Roles.",
      status: has("messages.send") ? "ready" : "planned",
      badge: has("messages.send") ? "Open" : "Not granted",
      cta: "Ask the administrator for access",
      onOpen: () => onNavigate("chat"),
    },
    {
      id: "tasks",
      icon: "📝",
      title: "Task Queue",
      description:
        "Work through tasks assigned by the administrator, " +
        "with priority and due-date tracking.",
      status: "planned",
    },
    {
      id: "reports",
      icon: "📊",
      title: "Operational Reports",
      description:
        "Daily activity summaries submitted to the " +
        "administrator for review.",
      status: "planned",
    },
  ];

  /* =====================================================
     RENDER
     ===================================================== */

  return (
    <div className="staff-dashboard">

      <RoleDashboardShell
        session={session}

        eyebrow="NYAYMITRA STAFF PORTAL"

        heroTitle="Operations"
        heroTitleAccent="under admin."

        heroDescription={
          "Authorized operational and case-management work " +
          "carried out under the administrator — everything " +
          "you do is accountable to the admin role."
        }

        workspaceLabel="STAFF WORKSPACE"
        workspaceTitle={`Welcome, ${session.fullName}`}
        workspaceSubtitle={
          "You are signed in with staff access, issued and " +
          "authorized by the administrator."
        }

        stats={stats}
        statsLabel="WORKLOAD OVERVIEW"
        statsHeading="Your operations snapshot"
        statsNote="Populates once staff APIs connect"

        sectionsLabel="OPERATIONS"
        sectionsHeading="Your assigned work"
        sections={sections}

        onSignOut={onSignOut}
      />

      {/* =================================================
          ADMIN-ACCOUNTABLE NOTE
          ================================================= */}

      <div className="staff-dashboard-note">

        <span>🛡️</span>

        <div>

          <strong>Staff works under Admin authority</strong>

          <p>
            Staff accounts are issued by the administrator
            and every operation performed here is visible to
            and accountable to the admin role.
          </p>

        </div>

      </div>

      {/* =================================================
          AUTHORITIES THIS ACCOUNT HOLDS

          Mirrors the Access & Roles screen, so the person
          on the receiving end can see the decision rather
          than only discovering it when a button is missing.
          ================================================= */}

      <div className="staff-dashboard-authorities">

        <div className="staff-dashboard-authorities-head">

          <span>🔐</span>

          <div>

            <strong>Your authorities</strong>

            <p>
              Delegated by the administrator. Ask the admin
              under Access & Roles to change what you can do.
            </p>

          </div>

          <em>
            {granted.length} of {AUTHORITY_CATALOG.length} granted
          </em>

        </div>

        <ul>

          {AUTHORITY_CATALOG.map((authority) => {

            const on = granted.includes(authority.id);

            return (
              <li
                key={authority.id}
                className={on ? "is-on" : "is-off"}
              >

                <span
                  className="staff-dashboard-authority-dot"
                  aria-hidden="true"
                />

                <div>
                  <strong>{authority.label}</strong>
                  <small>{authority.description}</small>
                </div>

                <em>{on ? "Granted" : "Not granted"}</em>

              </li>
            );
          })}

        </ul>

      </div>

    </div>
  );
}

export default StaffDashboardPage;
