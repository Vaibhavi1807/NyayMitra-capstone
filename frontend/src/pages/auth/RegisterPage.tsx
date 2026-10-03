import { useState } from "react";
import type { Session } from "../../auth/session";
import {
  register,
  registerLawyerAccount,
  uploadLawyerDocument,
} from "../../api/authApi";

/*
 * LoginPage's stylesheet defines the whole sign-in visual language
 * (hero, fields, submit, error, note, door cards) — this page
 * reuses it rather than forking the palette, so login and
 * registration stay one visual system.
 */
import "./LoginPage.css";

/* =========================================================
   REGISTER PAGE — choose an account type, then one form.

   First screen: "Create User Account" OR "Create Lawyer Account".

   - USER form: unchanged citizen self-registration — the server
     assigns USER (a submitted role field is rejected by the
     request model) and signs the person in immediately.
   - LAWYER form: name, email, password, licence/registration ID,
     practice areas, optional profile details and the licence
     document. The account is created PENDING and the document is
     uploaded in the same submission; the confirmation screen says
     so in plain words. There is NO "approve yourself" anywhere:
     verification_status is decided server-side by ADMIN only.
   - ADMIN cannot be self-registered at all, so no admin option
     is ever offered here.

   Client-side validation mirrors the backend's rules so mistakes
   surface instantly; the backend re-checks everything regardless
   (including magic-byte type checks and the size cap on the
   uploaded document).
   ========================================================= */

type RegisterPageProps = {
  onAuthenticated: (session: Session) => void;
  onBack: () => void;
};

type View = "choice" | "user" | "lawyer" | "submitted";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 8;

/* Lawyer form bounds — mirrors auth/routes.py + auth/documents.py. */
const MAX_PRACTICE_AREAS = 10;
const MAX_PRACTICE_AREA_LENGTH = 100;
const MAX_BAR_COUNCIL_LENGTH = 200;
const MAX_YEARS_EXPERIENCE = 70;
const MAX_BIO_LENGTH = 1000;
const PHONE_PATTERN = /^[0-9+()\-\s]{5,50}$/;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function RegisterPage({
  onAuthenticated,
  onBack,
}: RegisterPageProps) {
  const [view, setView] = useState<View>("choice");

  /* Citizen form — unchanged fields. */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  /* Lawyer form. */
  const [lawName, setLawName] = useState("");
  const [lawEmail, setLawEmail] = useState("");
  const [lawPassword, setLawPassword] = useState("");
  const [lawConfirmation, setLawConfirmation] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [practiceAreas, setPracticeAreas] = useState("");
  const [barCouncil, setBarCouncil] = useState("");
  const [years, setYears] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [documentFile, setDocumentFile] =
    useState<File | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /*
   * Set once the LAWYER account exists but before/while the
   * document uploads: a failed upload then never re-runs the
   * registration (the second attempt would collide on the email) —
   * it only retries the upload half of the same submission.
   */
  const [createdSession, setCreatedSession] =
    useState<Session | null>(null);

  const switchView = (next: View) => {
    setError("");
    setView(next);
  };

  /* =======================================================
     CITIZEN SUBMIT
     ======================================================= */

  const handleSubmit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const name = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!name) {
      setError("Enter your full name.");
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const session = await register({
        fullName: name,
        email: normalizedEmail,
        password,
        passwordConfirmation: confirmation,
      });

      onAuthenticated(session);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create the account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     LAWYER SUBMIT — register, then attach the document.
     ======================================================= */

  const handleLawyerSubmit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const name = lawName.trim();
    const normalizedEmail = lawEmail.trim().toLowerCase();
    const license = licenseId.trim();
    const areas = practiceAreas
      .split(/[,;]/)
      .map((area) => area.trim())
      .filter(Boolean);
    const council = barCouncil.trim();
    const yearsText = years.trim();
    const phoneText = phone.trim();
    const bioText = bio.trim();

    if (!name) {
      setError("Enter your full name.");
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (lawPassword.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    if (lawPassword !== lawConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    if (!license) {
      setError("Enter your licence or registration number.");
      return;
    }

    if (!areas.length) {
      setError("List at least one practice area.");
      return;
    }

    if (areas.length > MAX_PRACTICE_AREAS) {
      setError(
        `List at most ${MAX_PRACTICE_AREAS} practice areas.`,
      );
      return;
    }

    if (
      areas.some(
        (area) => area.length > MAX_PRACTICE_AREA_LENGTH,
      )
    ) {
      setError(
        `Each practice area must be ${MAX_PRACTICE_AREA_LENGTH} characters or fewer.`,
      );
      return;
    }

    if (council.length > MAX_BAR_COUNCIL_LENGTH) {
      setError(
        `Bar Council must be ${MAX_BAR_COUNCIL_LENGTH} characters or fewer.`,
      );
      return;
    }

    let yearsValue: number | null = null;

    if (yearsText) {
      yearsValue = Number(yearsText);

      if (
        !Number.isInteger(yearsValue) ||
        yearsValue < 0 ||
        yearsValue > MAX_YEARS_EXPERIENCE
      ) {
        setError(
          `Years of experience must be between 0 and ${MAX_YEARS_EXPERIENCE}.`,
        );
        return;
      }
    }

    if (phoneText && !PHONE_PATTERN.test(phoneText)) {
      setError("Enter a valid phone number.");
      return;
    }

    if (bioText.length > MAX_BIO_LENGTH) {
      setError(
        `Bio must be ${MAX_BIO_LENGTH} characters or fewer.`,
      );
      return;
    }

    if (!documentFile) {
      setError(
        "Attach your licence or registration document " +
          "(PDF, JPG or PNG).",
      );
      return;
    }

    if (
      !DOCUMENT_EXTENSIONS.test(documentFile.name) ||
      (documentFile.type &&
        !DOCUMENT_MIME_TYPES.includes(documentFile.type))
    ) {
      setError("Upload a PDF, JPG or PNG file.");
      return;
    }

    if (documentFile.size > MAX_DOCUMENT_BYTES) {
      setError(
        "File too large. Maximum allowed size is 10 MB.",
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      let session = createdSession;

      if (!session) {
        session = await registerLawyerAccount({
          fullName: name,
          email: normalizedEmail,
          password: lawPassword,
          passwordConfirmation: lawConfirmation,
          licenseId: license,
          practiceAreas: areas.join(", "),
          barCouncil: council || undefined,
          yearsOfExperience: yearsValue,
          phone: phoneText || undefined,
          bio: bioText || undefined,
        });

        setCreatedSession(session);
      }

      await uploadLawyerDocument(session.token, documentFile);

      setView("submitted");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit the registration. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     SHARED HERO
     ======================================================= */

  const hero = (
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
          CREATE ACCOUNT
        </div>

        <h1>
          Join
          <br />
          <span>NyayMitra.</span>
        </h1>

        <p>
          One citizen account for case search, timelines, court
          orders, translation and conversations with verified
          lawyers — or register as a lawyer to take those
          conversations.
        </p>

      </div>

    </section>
  );

  /* =======================================================
     VIEW: CHOOSE AN ACCOUNT TYPE
     ======================================================= */

  if (view === "choice") {
    return (
      <div className="login-page login-page--form">

        {hero}

        <main className="login-main login-main--form">

          <div className="login-form">

            <div className="login-form-heading">

              <button
                type="button"
                className="login-back"
                onClick={onBack}
              >
                ← Back to sign in
              </button>

              <span className="login-section-label">
                ACCOUNT TYPE
              </span>

              <h2>How will you use NyayMitra?</h2>

              <p>
                Pick the account you want to create.
              </p>

            </div>

            <div className="login-door-grid login-door-grid--two">

              <button
                type="button"
                className="login-door-card"
                onClick={() => switchView("user")}
              >
                <div className="login-door-icon">👤</div>
                <span className="login-door-role">Citizen</span>
                <h3>Create User Account</h3>
                <p>
                  Search and save cases, read court orders,
                  translate, and chat with verified lawyers.
                </p>
                <div className="login-door-cta">
                  Continue →
                </div>
              </button>

              <button
                type="button"
                className="login-door-card"
                onClick={() => switchView("lawyer")}
              >
                <div className="login-door-icon">⚖</div>
                <span className="login-door-role">Advocate</span>
                <h3>Create Lawyer Account</h3>
                <p>
                  Register with your licence and practice areas.
                  Your registration is verified before you can
                  receive chats from users.
                </p>
                <div className="login-door-cta">
                  Continue →
                </div>
              </button>

            </div>

            <button
              type="button"
              className="login-staff-link"
              onClick={onBack}
            >
              Already have an account? Sign in →
            </button>

          </div>

        </main>

      </div>
    );
  }

  /* =======================================================
     VIEW: REGISTRATION SUBMITTED (lawyer, pending)
     ======================================================= */

  if (view === "submitted") {
    return (
      <div className="login-page login-page--form">

        {hero}

        <main className="login-main login-main--form">

          <div className="login-form">

            <div className="login-form-heading">

              <span className="login-section-label">
                LAWYER
              </span>

              <h2>Registration submitted</h2>

            </div>

            <div
              className="register-pending"
              role="status"
            >

              <strong>
                Your lawyer registration is pending
                admin verification.
              </strong>

              <p>
                An administrator will review your licence
                document and practice details. Until your
                account is approved, verified-lawyer features —
                such as receiving chats from users — stay
                locked. You can sign in with your email and
                password at any time to check your status.
              </p>

            </div>

            <button
              type="button"
              className="login-submit"
              onClick={onBack}
            >
              Go to sign in
            </button>

          </div>

        </main>

      </div>
    );
  }

  /* =======================================================
     VIEW: CITIZEN FORM (unchanged)
     ======================================================= */

  if (view === "user") {
    return (
      <div className="login-page login-page--form">

        {hero}

        <main className="login-main login-main--form">

          <form
            className="login-form"
            onSubmit={handleSubmit}
          >

            <div className="login-form-heading">

              <button
                type="button"
                className="login-back"
                onClick={() => switchView("choice")}
              >
                ← Choose account type
              </button>

              <span className="login-section-label">
                CITIZEN
              </span>

              <h2>Create your account</h2>

              <p>
                Your role is set for you — sign-in detects it
                automatically.
              </p>

            </div>

            <label className="login-field">

              <span>Full name</span>

              <input
                type="text"
                autoComplete="name"
                placeholder="e.g. Asha Verma"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
              />

            </label>

            <label className="login-field">

              <span>Email</span>

              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />

            </label>

            <label className="login-field">

              <span>Password</span>

              <div className="login-password">

                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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

            <label className="login-field">

              <span>Confirm password</span>

              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat the password"
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value)
                }
              />

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
                ? "Creating your account..."
                : "Create account"}
            </button>

            <button
              type="button"
              className="login-staff-link"
              onClick={onBack}
            >
              Already have an account? Sign in →
            </button>

          </form>

        </main>

      </div>
    );
  }

  /* =======================================================
     VIEW: LAWYER FORM
     ======================================================= */

  return (
    <div className="login-page login-page--form">

      {hero}

      <main className="login-main login-main--form">

        <form
          className="login-form"
          onSubmit={handleLawyerSubmit}
        >

          <div className="login-form-heading">

            <button
              type="button"
              className="login-back"
              onClick={() => switchView("choice")}
            >
              ← Choose account type
            </button>

            <span className="login-section-label">
              LAWYER
            </span>

            <h2>Register as a lawyer</h2>

            <p>
              Your registration starts as pending — an admin
              verifies your licence before you can receive
              chats from users.
            </p>

          </div>

          <label className="login-field">

            <span>Full name</span>

            <input
              type="text"
              autoComplete="name"
              placeholder="e.g. Adv. Priya Sharma"
              value={lawName}
              onChange={(event) =>
                setLawName(event.target.value)
              }
            />

          </label>

          <label className="login-field">

            <span>Email</span>

            <input
              type="email"
              autoComplete="email"
              placeholder="advocate@example.com"
              value={lawEmail}
              onChange={(event) =>
                setLawEmail(event.target.value)
              }
            />

          </label>

          <label className="login-field">

            <span>Password</span>

            <div className="login-password">

              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={lawPassword}
                onChange={(event) =>
                  setLawPassword(event.target.value)
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

          <label className="login-field">

            <span>Confirm password</span>

            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat the password"
              value={lawConfirmation}
              onChange={(event) =>
                setLawConfirmation(event.target.value)
              }
            />

          </label>

          <label className="login-field">

            <span>
              Licence / Bar Council registration ID
            </span>

            <input
              type="text"
              autoComplete="off"
              placeholder="e.g. MAH/1234/2020"
              value={licenseId}
              onChange={(event) =>
                setLicenseId(event.target.value)
              }
            />

          </label>

          <label className="login-field">

            <span>Practice areas</span>

            <input
              type="text"
              autoComplete="off"
              placeholder="e.g. Criminal Law, Family Law"
              value={practiceAreas}
              onChange={(event) =>
                setPracticeAreas(event.target.value)
              }
            />

            <small>
              Separate each area with a comma.
            </small>

          </label>

          <div className="register-optional-heading">
            Other profile information
            <span> optional </span>
          </div>

          <label className="login-field">

            <span>Bar Council</span>

            <input
              type="text"
              autoComplete="organization"
              placeholder="e.g. Bar Council of Maharashtra"
              value={barCouncil}
              onChange={(event) =>
                setBarCouncil(event.target.value)
              }
            />

          </label>

          <label className="login-field">

            <span>Years of experience</span>

            <input
              type="number"
              min={0}
              max={70}
              placeholder="e.g. 7"
              value={years}
              onChange={(event) =>
                setYears(event.target.value)
              }
            />

          </label>

          <label className="login-field">

            <span>Phone</span>

            <input
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
            />

          </label>

          <label className="login-field">

            <span>Short bio</span>

            <textarea
              rows={3}
              placeholder="A line about your practice (optional)"
              value={bio}
              onChange={(event) =>
                setBio(event.target.value)
              }
            />

          </label>

          <label className="login-field register-file-field">

            <span>
              Licence / registration document
            </span>

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) =>
                setDocumentFile(
                  event.target.files?.[0] ?? null,
                )
              }
            />

            <small>
              PDF, JPG or PNG — up to 10 MB. An admin checks
              this document during verification.
            </small>

            {documentFile && (
              <small className="register-file-name">
                {documentFile.name} ·{" "}
                {formatSize(documentFile.size)}
              </small>
            )}

          </label>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          {createdSession && !loading && (
            <div className="register-note" role="status">
              Your account was created — submitting again
              only retries the document upload.
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading
              ? "Submitting registration..."
              : createdSession
                ? "Retry document upload"
                : "Submit lawyer registration"}
          </button>

          <button
            type="button"
            className="login-staff-link"
            onClick={onBack}
          >
            Already have an account? Sign in →
          </button>

        </form>

      </main>

    </div>
  );
}

export default RegisterPage;
