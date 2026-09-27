import type { Role } from "../auth/roles";
import type { Session } from "../auth/session";

/* =========================================================
   NYAYMITRA — AUTH API (MOCK FIRST)

   One login system detects the role and returns a session.

   CURRENT STATE: mock authentication (no backend required).

   LATER: replace the body of login() with a real FastAPI
   call, exactly like lawyerApi.ts does:

       POST ${API_BASE_URL}/api/auth/login

   Expected JSON response (draft contract for the backend
   team):

       {
         "access_token": "eyJ...",
         "token_type": "bearer",
         "user": {
           "user_id": "USER_0001",
           "full_name": "Asha Verma",
           "email": "asha@example.com",
           "role": "USER",
           "lawyer_id": "LAWYER_0003"   // optional, LAWYER only
         }
       }

   Keep this function signature and nothing else in the
   frontend has to change when the backend arrives.
   ========================================================= */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/* =========================================================
   USE MOCK?
   ========================================================= */

const USE_MOCK =
  (import.meta.env.VITE_AUTH_MODE || "mock") !== "api";

/* =========================================================
   LOGIN INPUT
   ========================================================= */

export interface LoginInput {
  /* The door the person entered from (see LoginPage). */
  role: Role;
  identifier: string;
  password: string;
}

/* =========================================================
   MOCK ACCOUNTS

   Demo credentials for the capstone demo.
   STAFF accounts are issued by ADMIN — see issueStaffAccount().
   ========================================================= */

interface MockAccount {
  userId: string;
  fullName: string;
  email: string;
  password: string;
  role: Role;
  lawyerId?: string;
}

const MOCK_ACCOUNTS: MockAccount[] = [
  {
    userId: "USER_0001",
    fullName: "Asha Verma",
    email: "asha@example.com",
    password: "user123",
    role: "USER",
  },
  {
    userId: "LAWYER_0003",
    fullName: "Adv. Rohan Deshmukh",
    email: "rohan@example.com",
    password: "lawyer123",
    role: "LAWYER",
    lawyerId: "LAWYER_0003",
  },
  {
    userId: "ADMIN_0001",
    fullName: "Site Administrator",
    email: "admin@nyaymitra.in",
    password: "admin123",
    role: "ADMIN",
  },
  {
    userId: "STAFF_0001",
    fullName: "Kavya Iyer",
    email: "kavya@nyaymitra.in",
    password: "staff123",
    role: "STAFF",
  },
];

/* =========================================================
   MOCK: ISSUE A STAFF ACCOUNT

   Staff login goes through the admin login:

   Admin signs in → Admin dashboard → Staff management →
   issue credentials → staff member can now sign in.

   In mock mode the seeded staff account above always
   exists so the demo works out of the box, but this
   function documents the intended flow for the real API.
   ========================================================= */

export interface StaffInvite {
  fullName: string;
  email: string;
  password: string;
}

export function issueStaffAccount(
  invite: StaffInvite,
  issuedBy: Session,
): MockAccount {
  if (issuedBy.role !== "ADMIN") {
    throw new Error(
      "Only an administrator can issue staff accounts.",
    );
  }

  const account: MockAccount = {
    userId: `STAFF_${String(MOCK_ACCOUNTS.length).padStart(4, "0")}`,
    fullName: invite.fullName.trim(),
    email: invite.email.trim().toLowerCase(),
    password: invite.password,
    role: "STAFF",
  };

  MOCK_ACCOUNTS.push(account);

  return account;
}

/* =========================================================
   MOCK LOGIN
   ========================================================= */

function mockLogin(input: LoginInput): Session {
  const identifier = input.identifier.trim().toLowerCase();

  if (!identifier) {
    throw new Error("Enter your email or user ID.");
  }

  if (!input.password) {
    throw new Error("Enter your password.");
  }

  const account = MOCK_ACCOUNTS.find(
    (candidate) =>
      candidate.email.toLowerCase() === identifier ||
      candidate.userId.toLowerCase() === identifier,
  );

  if (!account) {
    throw new Error(
      "No account found for that email or user ID.",
    );
  }

  /*
   * ROLE MISMATCH
   *
   * The login page already knows which door the person
   * entered through. Signing in through the wrong door
   * is rejected here — this is the "one login system
   * detects the role" rule.
   */
  if (account.role !== input.role) {
    throw new Error(
      `This account is a ${account.role} account. ` +
        `Please sign in through the ${account.role} door.`,
    );
  }

  if (account.password !== input.password) {
    throw new Error("Incorrect password.");
  }

  return {
    userId: account.userId,
    fullName: account.fullName,
    email: account.email,
    role: account.role,
    token: `mock-token-${account.userId}`,
    loginAt: new Date().toISOString(),
    lawyerId: account.lawyerId,
  };
}

/* =========================================================
   REAL API LOGIN (placeholder — not used yet)
   ========================================================= */

async function apiLogin(input: LoginInput): Promise<Session> {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/login`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: input.role,
        identifier: input.identifier,
        password: input.password,
      }),
    },
  );

  if (!response.ok) {
    let message =
      `Login failed with status ${response.status}.`;

    try {
      const errorData: unknown = await response.json();

      if (
        errorData &&
        typeof errorData === "object" &&
        "detail" in errorData &&
        typeof errorData.detail === "string"
      ) {
        message = errorData.detail;
      }
    } catch {
      /* Keep default HTTP error message. */
    }

    throw new Error(message);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type: string;
    user: {
      user_id: string;
      full_name: string;
      email: string;
      role: Role;
      lawyer_id?: string;
    };
  };

  return {
    userId: data.user.user_id,
    fullName: data.user.full_name,
    email: data.user.email,
    role: data.user.role,
    token: data.access_token,
    loginAt: new Date().toISOString(),
    lawyerId: data.user.lawyer_id,
  };
}

/* =========================================================
   PUBLIC: LOGIN
   ========================================================= */

export async function login(
  input: LoginInput,
): Promise<Session> {
  if (USE_MOCK) {
    /* Simulated network delay so the UI shows its
       loading state the same way it will with FastAPI. */
    await new Promise((resolve) =>
      setTimeout(resolve, 450),
    );

    return mockLogin(input);
  }

  return apiLogin(input);
}

/* =========================================================
   DEMO CREDENTIALS (shown on the login page)
   ========================================================= */

export const DEMO_ACCOUNTS = MOCK_ACCOUNTS.map(
  (account) => ({
    userId: account.userId,
    role: account.role,
    fullName: account.fullName,
    email: account.email,
    password: account.password,
  }),
);
