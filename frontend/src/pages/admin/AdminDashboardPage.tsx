import { useEffect, useRef, useState } from "react";
import type { Session } from "../../auth/session";
import type { Page } from "../../App";
import RoleDashboardShell, {
  type DashboardSection,
  type DashboardStat,
} from "../../components/RoleDashboardShell";
import RoleSectionView from "../../components/RoleSectionView";
import { initialsOf } from "../../lib/initials";
import { issueStaffAccount, DEMO_ACCOUNTS } from "../../api/authApi";
import {
  AUTHORITY_CATALOG,
  ADMIN_AUTHORITIES,
  getAuthoritiesFor,
  setAuthorityFor,
  setAuthoritiesFor,
} from "../../api/authorityApi";
import { getLawyers, getLawyerById } from "../../api/lawyerApi";
import type { Lawyer } from "../../api/lawyerApi";
import { getCases } from "../../api/caseApi";
import "../../components/RoleDashboardShell.css";
import "../../components/RoleSectionView.css";
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
  onNavigate: (page: Page) => void;
};

/* =========================================================
   PAGE SIZE

   Small on purpose: the summary endpoint's records are
   sparse, and Lawyer Records resolves each one through a
   second call, so this number is what the detail screen
   costs as well as what the list shows.
   ========================================================= */

const RECORD_PAGE_SIZE = 12;

const SENIOR_YEARS = 15;

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
  onNavigate,
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
     DELEGATED AUTHORITIES

     What the admin has granted each staff member. Loaded
     from authorityApi once, then kept in step locally so a
     toggle repaints immediately instead of refetching.
     ===================================================== */

  const [grants, setGrants] = useState<Record<string, string[]>>(
    () =>
      Object.fromEntries(
        initialStaff.map((member) => [
          member.userId,
          getAuthoritiesFor(member.userId),
        ]),
      ),
  );

  const toggleAuthority = (
    staffUserId: string,
    authorityId: string,
    on: boolean,
  ) => {
    const next = setAuthorityFor(staffUserId, authorityId, on);

    setGrants((previous) => ({
      ...previous,
      [staffUserId]: next,
    }));
  };

  const bulkAuthorities = (
    staffUserId: string,
    authorityIds: string[],
  ) => {
    const next = setAuthoritiesFor(staffUserId, authorityIds);

    setGrants((previous) => ({
      ...previous,
      [staffUserId]: next,
    }));
  };

  /* =====================================================
     LAWYER DIRECTORY (real service, fetched on demand)

     Three screens read this — Manage Lawyers, Lawyer
     Records and the lawyer count on Platform Data — but
     opening the dashboard should not cost a request. The
     fetch runs the first time one of those sections is
     opened and then stays warm.

     The ref guard exists because StrictMode invokes the
     effect twice in development; without it each visit to
     these screens would issue two identical requests. On
     failure the guard is released so the retry button can
     ask again rather than leaving a permanent error.
     ===================================================== */

  const lawyersRequested = useRef(false);

  const [lawyerList, setLawyerList] = useState<Lawyer[]>([]);
  const [lawyerTotal, setLawyerTotal] = useState(0);

  /* "pending" covers both not-yet-started and in flight, so the effect
     never has to set state to say it has begun — only to report the
     outcome, which it does from the async callback. */
  const [lawyerStatus, setLawyerStatus] = useState<
    "pending" | "ready" | "error"
  >("pending");

  const lawyerSectionOpen =
    activeSection === "lawyers" ||
    activeSection === "records" ||
    activeSection === "data";

  useEffect(() => {
    if (!lawyerSectionOpen || lawyerStatus !== "pending") return;
    if (lawyersRequested.current) return;

    lawyersRequested.current = true;

    void (async () => {
      try {
        const response = await getLawyers({
          page: 1,
          limit: RECORD_PAGE_SIZE,
        });

        setLawyerList(response.lawyers);
        setLawyerTotal(response.total_count);
        setLawyerStatus("ready");
      } catch {
        lawyersRequested.current = false;
        setLawyerStatus("error");
      }
    })();
  }, [lawyerSectionOpen, lawyerStatus]);

  const retryLawyers = () => setLawyerStatus("pending");

  /* =====================================================
     FULL RECORDS

     GET /api/lawyers returns a summary only — enrollment
     number, bar council, practice areas and status are all
     blank in the list response. They exist on
     GET /api/lawyers/{id}, so the Records screen resolves
     each row itself once the summary has arrived, in
     parallel, and falls back to the summary for any lawyer
     whose detail call fails rather than dropping the card.
     ===================================================== */

  const recordsRequested = useRef(false);

  const [recordDetails, setRecordDetails] = useState<Lawyer[]>([]);
  const [recordStatus, setRecordStatus] = useState<
    "pending" | "ready" | "error"
  >("pending");

  useEffect(() => {
    if (activeSection !== "records") return;
    if (recordStatus !== "pending" || recordsRequested.current) return;

    /* Needs the summary first — otherwise there is no ID list to resolve. */
    if (lawyerStatus !== "ready" || lawyerList.length === 0) return;

    recordsRequested.current = true;

    void (async () => {
      try {
        const resolved = await Promise.all(
          lawyerList.map((lawyer) =>
            getLawyerById(lawyer.lawyer_id).catch(() => lawyer),
          ),
        );

        setRecordDetails(resolved);
        setRecordStatus("ready");
      } catch {
        recordsRequested.current = false;
        setRecordStatus("error");
      }
    })();
  }, [activeSection, recordStatus, lawyerStatus, lawyerList]);

  const retryRecords = () => setRecordStatus("pending");

  /* One shared notice so Manage Lawyers, Lawyer Records and Platform Data
     cannot disagree about what "the directory is unavailable" looks like. */
  const lawyerNotice =
    lawyerStatus === "pending" ? (
      <div className="section-empty">
        <span aria-hidden="true">⏳</span>
        <p>Loading the lawyer directory…</p>
      </div>
    ) : lawyerStatus === "error" ? (
      <div className="section-empty">
        <span aria-hidden="true">⚠</span>
        <p>
          Could not reach the lawyer service. Start it on port 8000 and try
          again.
        </p>
        <button
          type="button"
          className="section-retry"
          onClick={retryLawyers}
        >
          Try again
        </button>
      </div>
    ) : lawyerList.length === 0 ? (
      <div className="section-empty">
        <span aria-hidden="true">⚖</span>
        <p>The directory has no lawyer records yet.</p>
      </div>
    ) : null;

  /* Records resolves a second endpoint on top of the summary, so it
     defers to lawyerNotice whenever the summary itself is the thing
     that has not arrived yet — otherwise both would describe the same
     wait differently. */
  const recordNotice =
    lawyerStatus !== "ready" ? (
      lawyerNotice
    ) : recordStatus === "error" ? (
      <div className="section-empty">
        <span aria-hidden="true">⚠</span>
        <p>The detail endpoint did not answer. Try again.</p>
        <button
          type="button"
          className="section-retry"
          onClick={retryRecords}
        >
          Try again
        </button>
      </div>
    ) : recordStatus === "pending" ? (
      <div className="section-empty">
        <span aria-hidden="true">⏳</span>
        <p>Resolving full records from the detail endpoint…</p>
      </div>
    ) : null;

  /* Every matter on the platform, seeded and newly filed.
     Read once per render rather than at each use site: the
     store touches localStorage, and the stats below are all
     derived from the same snapshot. */
  const allCases = getCases();

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
      id: "messages",
      icon: "💬",
      title: "Messages",
      description:
        "Reach the lawyers and staff directly. The admin " +
        "holds authority across every dashboard.",
      status: "ready",
      badge: "Open",
      onOpen: () => onNavigate("chat"),
    },
    {
      id: "users",
      icon: "🧑‍💼",
      title: "Manage Users",
      description:
        "View, verify and deactivate citizen accounts, and " +
        "review each user's case activity.",
      status: "ready",
      badge: "Open",
      onOpen: () => setActiveSection("users"),
    },
    {
      id: "lawyers",
      icon: "⚖️",
      title: "Manage Lawyers",
      description:
        "Review lawyer registrations, verification status " +
        "and profile records from the lawyer database.",
      status: "ready",
      badge: "Open",
      onOpen: () => setActiveSection("lawyers"),
    },
    {
      id: "records",
      icon: "📄",
      title: "Lawyer Records",
      description:
        "Full lawyer records: enrollment details, practice " +
        "areas, courts, location and contact information.",
      status: "ready",
      badge: "Open",
      onOpen: () => setActiveSection("records"),
    },
    {
      id: "data",
      icon: "🗄️",
      title: "Platform Data",
      description:
        "Platform-level data: cases, court orders, " +
        "translations and usage statistics.",
      status: "ready",
      badge: "Open",
      onOpen: () => setActiveSection("data"),
    },
    {
      id: "access",
      icon: "🔐",
      title: "Access & Roles",
      description:
        "Grant or revoke the authorities staff hold across " +
        "users, lawyers, cases, documents and messages.",
      status: "ready",
      badge: "Open",
      onOpen: () => setActiveSection("access"),
    },
  ];

  /* =====================================================
     STAFF MANAGEMENT SCREEN
     ===================================================== */

  /* =====================================================
     MANAGE USERS
     ===================================================== */

  if (activeSection === "users") {
    /*
     * Accounts first, then any case owner the database knows
     * about that has no login issued. The admin needs both in
     * one list: only one of them can actually sign in, and
     * that difference is the whole point of this screen.
     */
    const rows = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        issued: boolean;
        cases: number;
      }
    >();

    for (const account of DEMO_ACCOUNTS) {
      if (account.role !== "USER") continue;

      rows.set(account.userId, {
        id: account.userId,
        name: account.fullName,
        email: account.email,
        issued: true,
        cases: 0,
      });
    }

    for (const item of allCases) {
      const existing = rows.get(item.owner_user_id);

      if (existing) {
        existing.cases += 1;
        continue;
      }

      rows.set(item.owner_user_id, {
        id: item.owner_user_id,
        name: item.petitioner_name,
        email: "No login issued",
        issued: false,
        cases: 1,
      });
    }

    const citizens = [...rows.values()];

    return (
      <RoleSectionView
        session={session}
        portal="NYAYMITRA ADMIN PORTAL"
        title="Manage"
        titleAccent="users."
        heroDescription="Citizen accounts, their sign-in state and the case activity attached to each one."
        workspaceTitle="Review citizen accounts"
        workspaceSubtitle="Verify or deactivate from here"
        onBack={() => setActiveSection(null)}
      >
        <div className="section-stats">

          <div className="section-stat">
            <span>CITIZEN RECORDS</span>
            <strong>{citizens.length}</strong>
            <small>Known to the platform</small>
          </div>

          <div className="section-stat">
            <span>LOGIN ACCOUNTS</span>
            <strong>{citizens.filter((row) => row.issued).length}</strong>
            <small>Can sign in</small>
          </div>

          <div className="section-stat">
            <span>CASES ON FILE</span>
            <strong>{allCases.length}</strong>
            <small>Linked to citizens</small>
          </div>

        </div>

        <div className="section-card">

          <span className="role-dashboard-section-label">
            CITIZEN DIRECTORY
          </span>

          <h3>Accounts and case activity</h3>

          <p>
            A record can exist without a login — that happens when a case
            is filed on someone's behalf before their account is set up.
            Those are flagged so nothing gets worked on under the wrong
            name.
          </p>

          <ul className="section-rows">
            {citizens.map((row) => (
              <li key={row.id} className="section-row">

                <span className="section-row-avatar">
                  {initialsOf(row.name)}
                </span>

                <div className="section-row-body">
                  <strong>{row.name}</strong>
                  <span>
                    {row.id} · {row.email}
                  </span>
                </div>

                <div className="section-row-meta">
                  <time>
                    {row.cases} case{row.cases === 1 ? "" : "s"}
                  </time>
                  <span
                    className={`section-pill ${row.issued ? "good" : "warn"}`}
                  >
                    {row.issued ? "Account active" : "No login issued"}
                  </span>
                </div>

              </li>
            ))}
          </ul>

        </div>
      </RoleSectionView>
    );
  }

  /* =====================================================
     MANAGE LAWYERS
     ===================================================== */

  if (activeSection === "lawyers") {
    return (
      <RoleSectionView
        session={session}
        portal="NYAYMITRA ADMIN PORTAL"
        title="Manage"
        titleAccent="lawyers."
        heroDescription="The first page of the advocate directory, read live from the lawyer service — experience and location for every registered practitioner."
        workspaceTitle="Review lawyer registrations"
        workspaceSubtitle="Directory read straight from the API"
        onBack={() => setActiveSection(null)}
      >
        <div className="section-stats">

          <div className="section-stat">
            <span>IN DIRECTORY</span>
            <strong>
              {lawyerStatus === "ready" ? lawyerTotal : "—"}
            </strong>
            <small>Records on the service</small>
          </div>

          <div className="section-stat">
            <span>LOADED HERE</span>
            <strong>
              {lawyerStatus === "ready" ? lawyerList.length : "—"}
            </strong>
            <small>First page of {lawyerTotal}</small>
          </div>

          <div className="section-stat">
            <span>SENIOR COUNSEL</span>
            <strong>
              {lawyerStatus === "ready"
                ? lawyerList.filter(
                    (l) => (l.years_of_experience ?? 0) >= SENIOR_YEARS,
                  ).length
                : "—"}
            </strong>
            <small>{SENIOR_YEARS}+ years on this page</small>
          </div>

        </div>

        <div className="section-card">

          <span className="role-dashboard-section-label">
            REGISTRATIONS
          </span>

          <h3>Lawyer registrations</h3>

          <p>
            Served by GET /api/lawyers. The summary response carries
            identity, experience and location only — bar details and
            verification status live on Lawyer Records, which resolves
            each profile through the detail endpoint.
          </p>

          {lawyerNotice ?? (
            <ul className="section-rows">
              {lawyerList.map((lawyer) => {
                const senior =
                  (lawyer.years_of_experience ?? 0) >= SENIOR_YEARS;

                return (
                  <li key={lawyer.lawyer_id} className="section-row">

                    <span className="section-row-avatar">
                      {initialsOf(lawyer.full_name)}
                    </span>

                    <div className="section-row-body">
                      <strong>{lawyer.full_name}</strong>
                      <span>
                        {lawyer.lawyer_id}
                        {lawyer.city ? ` · ${lawyer.city}` : ""}
                        {lawyer.state ? `, ${lawyer.state}` : ""}
                        {lawyer.professional_email
                          ? ` · ${lawyer.professional_email}`
                          : ""}
                      </span>
                    </div>

                    <div className="section-row-meta">
                      <time>
                        {lawyer.years_of_experience ?? 0} yrs
                      </time>
                      <span
                        className={`section-pill ${senior ? "info" : ""}`}
                      >
                        {senior ? "Senior" : "Practising"}
                      </span>
                    </div>

                  </li>
                );
              })}
            </ul>
          )}

        </div>
      </RoleSectionView>
    );
  }

  /* =====================================================
     LAWYER RECORDS — the full file, not the summary
     ===================================================== */

  if (activeSection === "records") {
    return (
      <RoleSectionView
        session={session}
        portal="NYAYMITRA ADMIN PORTAL"
        title="Lawyer"
        titleAccent="records."
        heroDescription="Enrollment details, practice areas, courts, location and contact information — the full profile behind each summary row."
        workspaceTitle="Read the complete records"
        workspaceSubtitle="Resolved through the detail endpoint"
        onBack={() => setActiveSection(null)}
      >
        <div className="section-card">

          <span className="role-dashboard-section-label">
            FULL RECORDS
          </span>

          <h3>Enrollment and practice</h3>

          <p>
            The same first page as Manage Lawyers, but resolved through
            the lawyer detail endpoint — that is the only way to see bar
            details, practice areas and verification status, because the
            list response leaves them blank.
          </p>

          {recordNotice ?? (
            <div>
              {recordDetails.map((lawyer) => (
                <div
                  key={lawyer.lawyer_id}
                  className="section-record"
                >

                  <header className="section-record-head">

                    <span className="section-row-avatar">
                      {initialsOf(lawyer.full_name)}
                    </span>

                    <div>
                      <strong>{lawyer.full_name}</strong>
                      <span>
                        {lawyer.lawyer_id}
                        {lawyer.enrollment_number
                          ? ` · Enr. ${lawyer.enrollment_number}`
                          : ""}
                      </span>
                    </div>

                    <span
                      className={`section-pill ${
                        lawyer.profile_status ? "good" : "warn"
                      }`}
                    >
                      {lawyer.profile_status || "No status recorded"}
                    </span>

                  </header>

                  <dl className="section-field-grid">

                    <div>
                      <dt>Bar council</dt>
                      <dd>{lawyer.bar_council || "—"}</dd>
                    </div>

                    <div>
                      <dt>Year of enrolment</dt>
                      <dd>{lawyer.year_of_enrollment || "—"}</dd>
                    </div>

                    <div>
                      <dt>Experience</dt>
                      <dd>
                        {lawyer.years_of_experience ?? 0} years
                      </dd>
                    </div>

                    <div>
                      <dt>Location</dt>
                      <dd>
                        {lawyer.city || lawyer.district || "—"}
                        {lawyer.state ? `, ${lawyer.state}` : ""}
                      </dd>
                    </div>

                    <div>
                      <dt>Phone</dt>
                      <dd>
                        {lawyer.professional_phone_number ||
                          lawyer.office_phone ||
                          "—"}
                      </dd>
                    </div>

                    <div>
                      <dt>Email</dt>
                      <dd>
                        {lawyer.professional_email || "—"}
                      </dd>
                    </div>

                  </dl>

                  <div className="section-record-block">

                    <span className="role-dashboard-section-label">
                      PRACTICE AREAS
                    </span>

                    {lawyer.practice_areas?.length ? (
                      <div className="section-chip-list">
                        {lawyer.practice_areas.map((area) => (
                          <span key={area} className="section-chip">
                            {area}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="section-record-note">Not listed.</p>
                    )}

                  </div>

                  <div className="section-record-block">

                    <span className="role-dashboard-section-label">
                      COURTS OF PRACTICE
                    </span>

                    {lawyer.courts_of_practice?.length ? (
                      <div className="section-chip-list">
                        {lawyer.courts_of_practice.map((court) => (
                          <span key={court} className="section-chip">
                            {court}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="section-record-note">Not listed.</p>
                    )}

                  </div>

                </div>
              ))}
            </div>
          )}

        </div>
      </RoleSectionView>
    );
  }

  /* =====================================================
     PLATFORM DATA
     ===================================================== */

  if (activeSection === "data") {
    const byCourt = new Map<string, number>();
    const byStage = new Map<string, number>();

    for (const item of allCases) {
      byCourt.set(
        item.court_name,
        (byCourt.get(item.court_name) ?? 0) + 1,
      );
      byStage.set(
        item.current_case_stage,
        (byStage.get(item.current_case_stage) ?? 0) + 1,
      );
    }

    const ownerIds = new Set(allCases.map((item) => item.owner_user_id));

    return (
      <RoleSectionView
        session={session}
        portal="NYAYMITRA ADMIN PORTAL"
        title="Platform"
        titleAccent="data."
        heroDescription="Platform-level figures — cases, citizens and the lawyer directory — counted from the records the services actually hold."
        workspaceTitle="Read the platform figures"
        workspaceSubtitle="Counted live, not stored"
        onBack={() => setActiveSection(null)}
      >
        <div className="section-stats">

          <div className="section-stat">
            <span>CASES ON FILE</span>
            <strong>{allCases.length}</strong>
            <small>Across all courts</small>
          </div>

          <div className="section-stat">
            <span>CITIZENS ON CASES</span>
            <strong>{ownerIds.size}</strong>
            <small>Distinct owners</small>
          </div>

          <div className="section-stat">
            <span>HEARINGS BOOKED</span>
            <strong>
              {allCases.reduce(
                (sum, item) =>
                  sum + (item.calculated_metrics?.total_hearings_scheduled ?? 0),
                0,
              )}
            </strong>
            <small>Scheduled to date</small>
          </div>

          <div className="section-stat">
            <span>LAWYERS</span>
            <strong>
              {lawyerStatus === "ready" ? lawyerList.length : "—"}
            </strong>
            <small>From the directory</small>
          </div>

        </div>

        <div className="section-card">

          <span className="role-dashboard-section-label">
            BREAKDOWN
          </span>

          <h3>Cases by court</h3>

          <p>
            Useful for spotting where filings concentrate, which is the
            first thing anyone asks when case numbers move.
          </p>

          <div className="section-stats">
            {[...byCourt.entries()].map(([court, count]) => (
              <div key={court} className="section-stat">
                <span>COURT</span>
                <strong>{count}</strong>
                <small>{court}</small>
              </div>
            ))}
          </div>

          <span className="role-dashboard-section-label section-sublabel">
            CASES BY STAGE
          </span>

          <div className="section-chip-list section-sublabel-list">
            {[...byStage.entries()].map(([stage, count]) => (
              <span key={stage} className="section-chip">
                {stage} · {count}
              </span>
            ))}
          </div>

        </div>

        <div className="section-card">

          <span className="role-dashboard-section-label">
            DIRECTORY SERVICE
          </span>

          <h3>Lawyer directory</h3>

          <p>
            The only figure here that does not come from local records —
            it is read from the lawyer API, so it waits for the service.
          </p>

          {lawyerNotice ?? (
            <div className="section-chip-list">
              <span className="section-chip">
                {lawyerList.length} records returned
              </span>
            </div>
          )}

        </div>
      </RoleSectionView>
    );
  }

  /* =====================================================
     ACCESS & ROLES SCREEN

     The administrator's own row is fixed — admin holds
     everything by definition — so the only thing that can
     change is what each staff account has been handed.
     ===================================================== */

  if (activeSection === "access") {
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
              Access
              <br />
              <span>&amp; roles.</span>
            </h1>

            <p>
              You hold every authority across all four
              dashboards. Delegate to each staff member only
              what their work needs — changes take effect on
              their dashboard straight away.
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

                <h2>Delegate staff authorities</h2>

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


          {/* =========================================
              ADMIN — LOCKED ON
              ========================================= */}

          <div className="admin-access-banner">

            <div>

              <span className="role-dashboard-section-label">
                ADMINISTRATOR
              </span>

              <h3>You hold every authority</h3>

              <p>
                Admin authority is not grantable or revocable —
                it covers every dashboard by definition.
              </p>

            </div>

            <span className="admin-access-count">
              {ADMIN_AUTHORITIES.length} of {AUTHORITY_CATALOG.length}
            </span>

          </div>


          {/* =========================================
              STAFF — GRANTABLE
              ========================================= */}

          {staffList.length === 0 ? (
            <div className="admin-staff-card">

              <span className="role-dashboard-section-label">
                NO STAFF
              </span>

              <h3>No staff accounts yet</h3>

              <p>
                Issue a staff account first, then decide here
                what that account is allowed to do.
              </p>

            </div>
          ) : (
            <div className="admin-access-grid">

              {staffList.map((member) => {

                const held =
                  grants[member.userId] ??
                  getAuthoritiesFor(member.userId);

                return (
                  <div
                    key={member.userId}
                    className="admin-staff-card admin-access-card"
                  >

                    <header className="admin-access-card-head">

                      <div>

                        <span className="role-dashboard-section-label">
                          STAFF
                        </span>

                        <h3>{member.fullName}</h3>

                        <p>
                          {member.email} · {member.userId}
                        </p>

                      </div>

                      <span className="admin-access-count">
                        {held.length} of {AUTHORITY_CATALOG.length}
                      </span>

                    </header>

                    <ul className="admin-access-list">

                      {AUTHORITY_CATALOG.map((authority) => (
                        <li key={authority.id}>
                          <label>

                            <input
                              type="checkbox"
                              checked={held.includes(authority.id)}
                              onChange={(event) =>
                                toggleAuthority(
                                  member.userId,
                                  authority.id,
                                  event.target.checked,
                                )
                              }
                            />

                            <span>
                              <strong>{authority.label}</strong>
                              <small>{authority.description}</small>
                            </span>

                          </label>
                        </li>
                      ))}

                    </ul>

                    <footer className="admin-access-actions">

                      <button
                        type="button"
                        onClick={() =>
                          bulkAuthorities(
                            member.userId,
                            AUTHORITY_CATALOG.map((a) => a.id),
                          )
                        }
                      >
                        Grant all
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          bulkAuthorities(member.userId, [])
                        }
                      >
                        Revoke all
                      </button>

                    </footer>

                  </div>
                );
              })}

            </div>
          )}

        </main>

      </div>
    );
  }

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
