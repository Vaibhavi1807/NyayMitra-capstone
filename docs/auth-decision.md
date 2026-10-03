# NyayMitra Authentication & Authorization Decision

## 1. Authentication

NyayMitra will use token-based authentication for authenticated users.

The frontend will communicate with the backend authentication API for:

- User registration
- User login
- Logout
- Authentication state

The exact authentication implementation and token handling will be finalized during backend integration.

---

## 2. JWT

JWT-based authentication is planned for communication between the frontend and backend.

The frontend should not make assumptions about the final JWT payload until the backend authentication contract is finalized.

Expected flow:

Login
  ↓
Backend validates credentials
  ↓
Backend issues authentication token
  ↓
Frontend maintains authenticated session
  ↓
Frontend sends authenticated requests to protected APIs

---

## 3. Role-Based Access Control (RBAC)

NyayMitra will use role-based access control.

The application defines four roles:

- USER
- LAWYER
- ADMIN
- STAFF

Role definitions:

| Role | Responsibility |
|------|----------------|
| USER | Access personal cases, case status, guidance, court orders and related services |
| LAWYER | Access lawyer-related functionality and assigned/relevant case information |
| ADMIN | Manage administrative functions and platform-level data |
| STAFF | Perform authorized staff/case-management operations |

---

## 4. Frontend Role Handling

The frontend will use a centralized role definition located at:

`src/auth/roles.ts`

This prevents different parts of the application from using inconsistent role names.

Frontend route/page access will eventually be controlled according to the authenticated user's role.

---

## 5. Backend Authority

The backend remains the final authority for authentication and authorization.

Frontend route protection is only a user-interface/access-control layer and must not be treated as a security boundary.

Every protected API endpoint must independently validate authentication and authorization on the backend.

---

## 6. Current Scope

At this stage:

- Role constants are defined.
- The authentication architecture is documented.
- JWT implementation is not yet connected.
- Backend authentication endpoints are not yet integrated.
- Protected routes will be implemented after the backend authentication contract is available.

This approach allows frontend and backend development to proceed independently while keeping a clear authentication contract.