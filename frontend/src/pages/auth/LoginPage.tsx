import { useState } from "react";
import { ROLES, type Role } from "../../auth/roles";
import type { Session } from "../../auth/session";
import { login, DEMO_ACCOUNTS } from "../../api/authApi";
import "./LoginPage.css";

/* =========================================================
   LOGIN PAGE

   ONE login system. The user picks the door they belong
   to, and after successful authentication the role on the
   returned session decides which dashboard opens:

       USER   → User dashboard
       LAWYER → Lawyer dashboard
       ADMIN  → Admin dashboard
       STAFF  → Staff dashboard  (staff sign in through
                the Admin door)

   Authentication is currently MOCK (see api/authApi.ts).
   When FastAPI ships, only authApi.ts changes.
   ========================================================= */

type Door = "USER" | "LAWYER" | "ADMIN";

type LoginPageProps = {
  onAuthenticated: (session: Session) => void;
};

/* =========================================================
   DOOR OPTIONS
   ========================================================= */

const DOORS: Array<{
  door: Door;
  icon: string;
  title: string;
  role: string;
  description: string;
}> = [
  {
    door: "USER",
    icon: "🧑‍💼",
    title: "I am a Citizen",
    role: "User",
    description:
      "Search cases, track timelines, read court orders, " +
      "find lawyers and translate legal documents.",
  },
  {
    door: "LAWYER",
    icon: "⚖️",
    title: "I am a Lawyer",
    role: "Lawyer",
    description:
      "Manage your professional profile, cases, hearings " +
      "and client communication.",
  },
  {
    door: "ADMIN",
    icon: "🛡️",
    title: "I am an Administrator",
    role: "Admin",
    description:
      "Manage users, lawyers, staff and platform access. " +
      "Staff members sign in through this door.",
  },
];

function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [door, setDoor] = useState<Door | null>(null);

  /* Inside the Admin door, staff have their own sign-in. */
  const [staffMode, setStaffMode] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showDemo, setShowDemo] = useState(false);

  /* =======================================================
     WHICH ROLE ARE WE AUTHENTICATING AS?
     ======================================================= */

  const effectiveRole: Role = staffMode
    ? ROLES.STAFF
    : door || ROLES.USER;

  /* =======================================================
     PICK A DOOR
     ======================================================= */

  const pickDoor = (nextDoor: Door) => {
    setDoor(nextDoor);
    setStaffMode(false);
    setError("");
    setPassword("");
  };

  const backToDoors = () => {
    setDoor(null);
    setStaffMode(false);
    setError("");
    setPassword("");
  };

  /* =======================================================
     SUBMIT
     ======================================================= */

  const handleSubmit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const session = await login({
        role: effectiveRole,
        identifier,
        password,
      });

      onAuthenticated(session);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     FILL DEMO CREDENTIALS
     ======================================================= */

  const fillDemo = (email: string, pass: string) => {
    setIdentifier(email);
    setPassword(pass);
    setError("");
  };

  /* =======================================================
     STEP 1 — CHOOSE A DOOR
     ======================================================= */

  if (!door) {
    return (
      <div className="login-page">

        <section className="login-hero">

          <div className="login-hero-glow" />

          <div className="login-hero-content">

            <div className="login-brand">

              <div className="login-brand-icon">
                ⚖
              </div>

              <div>
                <strong>NyayMitra</strong>
                <span>AI Court Assistant</span>
              </div>

            </div>

            <div className="login-eyebrow">
              ONE PLATFORM • FOUR ROLES
            </div>

            <h1>
              Welcome to
              <br />
              <span>NyayMitra.</span>
            </h1>

            <p>
              A single login system identifies whether you
              are a user, lawyer, administrator or staff
              member — and opens the dashboard built for
              your role.
            </p>

          </div>

        </section>

        <main className="login-main">

          <div className="login-door-heading">

            <span className="login-section-label">
              SIGN IN
            </span>

            <h2>Login as what role?</h2>

            <p>
              Choose the door that matches your role.
            </p>

          </div>

          <div className="login-door-grid">

            {DOORS.map((option) => (
              <button
                key={option.door}
                type="button"
                className="login-door-card"
                onClick={() => pickDoor(option.door)}
              >

                <div className="login-door-icon">
                  {option.icon}
                </div>

                <span className="login-door-role">
                  {option.role}
                </span>

                <h3>{option.title}</h3>

                <p>{option.description}</p>

                <div className="login-door-cta">
                  Continue →
                </div>

              </button>
            ))}

          </div>

          <button
            type="button"
            className="login-demo-toggle"
            onClick={() => setShowDemo((value) => !value)}
          >
            {showDemo
              ? "Hide demo credentials"
              : "Show demo credentials"}
          </button>

          {showDemo && (
            <div className="login-demo-panel">

              <span className="login-section-label">
                DEMO ACCOUNTS — MOCK AUTH
              </span>

              <div className="login-demo-list">

                {DEMO_ACCOUNTS.map((account) => (
                  <div
                    key={account.email}
                    className="login-demo-row"
                  >

                    <div>
                      <strong>{account.role}</strong>
                      <span>{account.fullName}</span>
                      <small>
                        {account.email} / {account.password}
                      </small>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        /*
                         * STAFF signs in through the
                         * ADMIN door, so a staff demo
                         * account opens the admin door
                         * in staff mode.
                         */
                        const nextDoor: Door =
                          account.role === "STAFF"
                            ? "ADMIN"
                            : (account.role as Door);

                        pickDoor(nextDoor);

                        setStaffMode(
                          account.role === "STAFF",
                        );

                        fillDemo(
                          account.email,
                          account.password,
                        );
                      }}
                    >
                      Use
                    </button>

                  </div>
                ))}

              </div>

            </div>
          )}

        </main>

      </div>
    );
  }

  /* =======================================================
     STEP 2 — CREDENTIALS
     ======================================================= */

  const doorInfo = DOORS.find(
    (option) => option.door === door,
  );

  return (
    <div className="login-page login-page--form">

      <section className="login-hero login-hero--compact">

        <div className="login-hero-glow" />

        <div className="login-hero-content">

          <div className="login-brand">

            <div className="login-brand-icon">
              ⚖
            </div>

            <div>
              <strong>NyayMitra</strong>
              <span>AI Court Assistant</span>
            </div>

          </div>

          <div className="login-eyebrow">
            {staffMode
              ? "STAFF SIGN-IN"
              : `${doorInfo?.role.toUpperCase()} SIGN-IN`}
          </div>

          <h1>
            {staffMode ? (
              <>
                Staff access
                <br />
                <span>via Admin.</span>
              </>
            ) : (
              <>
                Sign in to
                <br />
                <span>your dashboard.</span>
              </>
            )}
          </h1>

          <p>
            {staffMode
              ? "Staff accounts are issued and managed by the administrator. Sign in with the credentials you were given."
              : doorInfo?.description}
          </p>

        </div>

      </section>

      <main className="login-main login-main--form">

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >

          <div className="login-form-heading">

            <button
              type="button"
              className="login-back"
              onClick={backToDoors}
            >
              ← Change role
            </button>

            <span className="login-section-label">
              {staffMode
                ? "STAFF"
                : doorInfo?.role.toUpperCase()}
            </span>

            <h2>
              {staffMode
                ? "Staff sign-in"
                : `Sign in as ${doorInfo?.role}`}
            </h2>

            {!staffMode && door === "ADMIN" && (
              <button
                type="button"
                className="login-staff-link"
                onClick={() => {
                  setStaffMode(true);
                  setError("");
                  setPassword("");
                }}
              >
                Are you staff? Sign in here →
              </button>
            )}

            {staffMode && (
              <button
                type="button"
                className="login-staff-link"
                onClick={() => {
                  setStaffMode(false);
                  setError("");
                  setPassword("");
                }}
              >
                ← Administrator sign-in
              </button>
            )}

          </div>

          <label className="login-field">

            <span>
              {effectiveRole === "STAFF"
                ? "Staff email"
                : "Email or User ID"}
            </span>

            <input
              type="text"
              autoComplete="username"
              placeholder={
                effectiveRole === "STAFF"
                  ? "you@nyaymitra.in"
                  : "you@example.com or USER_0001"
              }
              value={identifier}
              onChange={(event) =>
                setIdentifier(event.target.value)
              }
            />

          </label>

          <label className="login-field">

            <span>Password</span>

            <div className="login-password">

              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((value) => !value)
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>

            </div>

          </label>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading
              ? "Verifying role..."
              : staffMode
                ? "Sign in as Staff"
                : `Sign in as ${doorInfo?.role}`}
          </button>

          <p className="login-note">
            Authentication is running in mock mode. Your
            role is detected on sign-in and the matching
            dashboard opens automatically.
          </p>

        </form>

      </main>

    </div>
  );
}

export default LoginPage;
