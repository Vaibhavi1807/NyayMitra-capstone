import { useState } from "react";
import type { Session } from "../../auth/session";
import RoleDashboardShell, {
  type DashboardSection,
  type DashboardStat,
} from "../../components/RoleDashboardShell";
import { issueStaffAccount, DEMO_ACCOUNTS } from "../../api/authApi";
import "../../components/RoleDashboardShell.css";
import "./AdminDashboardPage.css";

/* =========================================================
   ADMIN DASHBOARD

   Platform-level administration:
   - managing users / lawyers / staff
   - lawyer records
   - platform data and access

   STAFF MANAGEMENT is implemented (staff accounts are
   issued by the admin — staff login goes through the
   admin login). The remaining sections are planned
   screens and are marked as such.
   ========================================================= */

type AdminDashboardPageProps = {
  session: Session;
  onSignOut: () => void;
};

/* =========================================================
   STAFF RECORD (read-only list built from mock data)
   ========================================================= */

interface StaffRecord {
  userId: string;
  fullName: string;
  email: string;
}

function AdminDashboardPage({
  session,
  onSignOut,
}: AdminDashboardPageProps) {
  /* =====================================================
     SECTION NAVIGATION
     ===================================================== */

  const [activeSection, setActiveSection] =
    useState<string | null>(null);

  /* =====================================================
     STAFF MANAGEMENT STATE
     ===================================================== */

  const initialStaff: StaffRecord[] = DEMO_ACCOUNTS
    .filter((account) => account.role === "STAFF")
    .map((account, index) => ({
      userId: `STAFF_${String(index + 1).padStart(4, "0")}`,
      fullName: account.fullName,
      email: account.email,
    }));

  const [staffList, setStaffList] =
    useState<StaffRecord[]>(initialStaff);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");

  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  /* =====================================================
     ISSUE STAFF ACCOUNT

     Staff login goes through the admin login: the admin
     issues the credentials, then the staff member signs
     in through the admin door on the login page.
     ===================================================== */

  const handleIssueStaff = (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    setInviteError("");
    setInviteSuccess("");

    if (!inviteName.trim()) {
      setInviteError("Enter the staff member's name.");
      return;
    }

    if (!inviteEmail.trim()) {
      setInviteError("Enter the staff member's email.");
      return;
    }

    if (invitePassword.trim().length < 4) {
      setInviteError(
        "Password must be at least 4 characters.",
      );
      return;
    }

    try {
      const account = issueStaffAccount(
        {
          fullName: inviteName,
          email: inviteEmail,
          password: invitePassword,
        },
        session,
      );

      setStaffList((current) => [
        ...current,
        {
          userId: account.userId,
          fullName: account.fullName,
          email: account.email,
        },
      ]);

      setInviteName("");
      setInviteEmail("");
      setInvitePassword("");

      setInviteSuccess(
        `Staff account issued for ${account.fullName}. ` +
          "They can now sign in through the Admin door.",
      );
    } catch (err) {
      setInviteError(
        err instanceof Error
          ? err.message
          : "Unable to issue staff account.",
      );
    }
  };

  /* =====================================================
     CONFIG
     ===================================================== */

  const stats: DashboardStat[] = [
    {
      icon: "🧑‍💼",
      tone: "purple",
      label: "USERS",
      value: "—",
      detail: "Citizen accounts",
    },
    {
      icon: "⚖️",
      tone: "blue",
      label: "LAWYERS",
      value: "—",
      detail: "Verified professionals",
    },
    {
      icon: "🗂️",
      tone: "orange",
      label: "STAFF",
      value: String(staffList.length),
      detail: "Issued by admin",
    },
    {
      icon: "🛡️",
      tone: "green",
      label: "ACCESS",
      value: "Active",
      detail: "Platform access control",
    },
  ];

  const sections: DashboardSection[] = [
    {
      id: "staff",
      icon: "🗂️",
      title: "Staff Management",
      description:
        "Issue and revoke staff credentials. Staff members " +
        "sign in through this admin login.",
      status: "ready",
      badge: "Open",
      onOpen: () => setActiveSection("staff"),
    },
    {
      id: "users",
      icon: "🧑‍💼",
      title: "Manage Users",
      description:
        "View, verify and deactivate citizen accounts, and " +
        "review each user's case activity.",
      status: "planned",
    },
    {
      id: "lawyers",
      icon: "⚖️",
      title: "Manage Lawyers",
      description:
        "Review lawyer registrations, verification status " +
        "and profile records from the lawyer database.",
      status: "planned",
    },
    {
      id: "records",
      icon: "📄",
      title: "Lawyer Records",
      description:
        "Full lawyer records: enrollment details, practice " +
        "areas, courts, location and contact information.",
      status: "planned",
    },
    {
      id: "data",
      icon: "🗄️",
      title: "Platform Data",
      description:
        "Platform-level data: cases, court orders, " +
        "translations and usage statistics.",
      status: "planned",
    },
    {
      id: "access",
      icon: "🔐",
      title: "Access & Roles",
      description:
        "Role assignments and permissions across USER, " +
        "LAWYER, ADMIN and STAFF.",
      status: "planned",
    },
  ];

  /* =====================================================
     STAFF MANAGEMENT SCREEN
     ===================================================== */

  if (activeSection === "staff") {
    return (
      <div className="role-dashboard-page">

        <section className="role-dashboard-hero">

          <div className="role-dashboard-hero-glow" />

          <div className="role-dashboard-hero-content">

            <div className="role-dashboard-eyebrow">
              <span>⚖</span>
              NYAYMITRA ADMIN PORTAL
            </div>

            <h1>
              Staff
              <br />
              <span>management.</span>
            </h1>

            <p>
              Staff accounts are issued by the administrator.
              A staff member signs in through the Admin door
              on the login page using these credentials.
            </p>

          </div>

        </section>

        <main className="role-dashboard-main">

          <section className="role-dashboard-welcome">

            <div className="role-dashboard-profile">

              <div className="role-dashboard-avatar">
                {session.fullName
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() || "")
                  .join("")}
              </div>

              <div>

                <span className="role-dashboard-section-label">
                  ADMIN WORKSPACE
                </span>

                <h2>Issue staff credentials</h2>

                <p>
                  Signed in as {session.fullName} (
                  {session.userId})
                </p>

              </div>

            </div>

            <button
              type="button"
              className="role-dashboard-signout"
              onClick={() => setActiveSection(null)}
            >
              ← Back to dashboard
            </button>

          </section>

          <div className="admin-staff-grid">

            {/* =========================================
                ISSUE FORM
                ========================================= */}

            <form
              className="admin-staff-card"
              onSubmit={handleIssueStaff}
            >

              <span className="role-dashboard-section-label">
                NEW STAFF ACCOUNT
              </span>

              <h3>Issue credentials</h3>

              <label className="admin-staff-field">

                <span>Full name</span>

                <input
                  type="text"
                  placeholder="Staff member name"
                  value={inviteName}
                  onChange={(event) =>
                    setInviteName(event.target.value)
                  }
                />

              </label>

              <label className="admin-staff-field">

                <span>Email</span>

                <input
                  type="email"
                  placeholder="staff@nyaymitra.in"
                  value={inviteEmail}
                  onChange={(event) =>
                    setInviteEmail(event.target.value)
                  }
                />

              </label>

              <label className="admin-staff-field">

                <span>Temporary password</span>

                <input
                  type="text"
                  placeholder="At least 4 characters"
                  value={invitePassword}
                  onChange={(event) =>
                    setInvitePassword(event.target.value)
                  }
                />

              </label>

              {inviteError && (
                <div className="admin-staff-alert error">
                  {inviteError}
                </div>
              )}

              {inviteSuccess && (
                <div className="admin-staff-alert success">
                  {inviteSuccess}
                </div>
              )}

              <button
                type="submit"
                className="admin-staff-submit"
              >
                Issue staff account
              </button>

            </form>

            {/* =========================================
                STAFF LIST
                ========================================= */}

            <div className="admin-staff-card">

              <span className="role-dashboard-section-label">
                ACTIVE STAFF
              </span>

              <h3>Staff accounts</h3>

              <div className="admin-staff-list">

                {staffList.map((staff) => (
                  <div
                    key={staff.email}
                    className="admin-staff-row"
                  >

                    <div className="admin-staff-row-icon">
                      {staff.fullName
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map(
                          (part) =>
                            part[0]?.toUpperCase() || "",
                        )
                        .join("")}
                    </div>

                    <div>

                      <strong>{staff.fullName}</strong>

                      <span>{staff.email}</span>

                    </div>

                    <em>STAFF</em>

                  </div>
                ))}

              </div>

            </div>

          </div>

        </main>

      </div>
    );
  }

  /* =====================================================
     DEFAULT — ADMIN DASHBOARD
     ===================================================== */

  return (
    <RoleDashboardShell
      session={session}

      eyebrow="NYAYMITRA ADMIN PORTAL"

      heroTitle="Platform"
      heroTitleAccent="administration."

      heroDescription={
        "Manage users, lawyers and staff records, control " +
        "platform data and access — all from one console."
      }

      workspaceLabel="ADMIN WORKSPACE"
      workspaceTitle={`Welcome, ${session.fullName}`}
      workspaceSubtitle={
        "You are signed in with full platform " +
        "administrative access."
      }

      stats={stats}
      statsLabel="PLATFORM SNAPSHOT"
      statsHeading="Everything at a glance"
      statsNote="Counts update as backend APIs connect"

      sectionsLabel="ADMINISTRATION"
      sectionsHeading="Manage the platform"
      sections={sections}

      onSignOut={onSignOut}
    />
  );
}

export default AdminDashboardPage;
