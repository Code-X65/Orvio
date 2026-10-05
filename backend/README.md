# Orvio Backend Service

Multi-tenant API backend service for Orvio Hub built with Fastify, TypeScript, Prisma ORM, and PostgreSQL.

---

## 1. Quick Start & Setup

### Prerequisites
- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0`
- **PostgreSQL**: `>= 15.0` (Local or Supabase)

### Installation
```powershell
# Install dependencies
pnpm install

# Copy environment variables
Copy-Item .env.example .env

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate

# Start development server
pnpm dev
```

The API will boot at `http://localhost:3000`. Swagger documentation is accessible at `http://localhost:3000/docs`.

---

## 2. Environment Variables Reference

| Variable | Type | Default / Example | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `string` | `development` | Runtime environment (`development`, `production`, `test`). |
| `HOST` | `string` | `0.0.0.0` | Network binding interface. |
| `PORT` | `number` | `3000` | HTTP port the server listens on. |
| `TRUST_PROXY` | `boolean` | `true` | Enables proxy header parsing (`X-Forwarded-For`) for accurate IP rate limiting. |
| `DATABASE_URL` | `string` | `postgresql://...` | Connection string for Prisma ORM query pool. |
| `DIRECT_URL` | `string` | `postgresql://...` | Direct connection string for Prisma migrations (bypasses pgBouncer in production). |
| `APP_BASE_DOMAIN` | `string` | `orvio.com` | Root domain used for tenant subdomain derivation (`<subdomain>.orvio.com`). |
| `FRONTEND_APP_URL` | `string` | `http://localhost:4000` | Origin URL for the web frontend client. |
| `PUBLIC_API_URL` | `string` | `http://localhost:3000` | Canonical public URL for the API backend (used in email links). |
| `JWT_ACCESS_SECRET` | `string` | `(32+ chars)` | HS256 secret for signing short-lived access tokens. |
| `JWT_REFRESH_SECRET` | `string` | `(32+ chars)` | HS256 secret for signing long-lived refresh tokens. |
| `JWT_ACCESS_TTL` | `string` | `15m` | Access token lifespan. |
| `JWT_REFRESH_TTL` | `string` | `30d` | Refresh token lifespan (stored in HTTP-only cookie). |
| `VERIFY_TOKEN_TTL` | `string` | `24h` | Email verification token validity duration. |
| `RESEND_COOLDOWN_SECONDS` | `number` | `60` | Cooldown period between email verification resend attempts. |
| `EMAIL_TRANSPORT` | `string` | `console` | Email provider (`console` for dev/test logging, `brevo` for transactional delivery). |
| `BREVO_API_KEY` | `string` | `xkeysib-...` | Brevo (Sendinblue) API key (required when `EMAIL_TRANSPORT=brevo`). |
| `BREVO_FROM_EMAIL` | `string` | `no-reply@orvio.com` | Verified sender email address in Brevo. |
| `BREVO_FROM_NAME` | `string` | `Orvio` | Verified sender display name. |
| `CORS_ORIGINS` | `string` | `http://localhost:4000` | Comma-separated list of allowed CORS origins. |
| `RATE_LIMIT_MAX` | `number` | `100` | Global default requests per window. |
| `RATE_LIMIT_WINDOW_MS`| `number` | `60000` | Global rate limit window in milliseconds (1 minute). |
| `LOG_LEVEL` | `string` | `info` | Pino log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`). |

---

## 3. Database Operations

```powershell
# Apply pending migrations to the database
pnpm prisma:migrate

# Create a new migration after editing prisma/schema.prisma
pnpm prisma:migrate:dev --name your_migration_name

# Regenerate Prisma client types
pnpm prisma:generate

# Launch Prisma Studio web GUI
pnpm prisma:studio

# Seed initial platform data (if seed script configured)
pnpm prisma:seed
```

---

## 4. API Surface Reference

All endpoints return a standard envelope format:
- **Success (`2xx`)**: `{ "status": "success", "data": { ... }, "meta": { "requestId": "..." } }`
- **Error (`4xx`/`5xx`)**: `{ "status": "error", "error": { "code": "...", "message": "...", "details": { ... } }, "meta": { "requestId": "..." } }`

### Public Endpoints

#### `POST /api/v1/auth/register`
Provisions an atomic tenant organization, admin user, owner membership, default branch, and email verification token. Rate-limited to 5 registrations per IP per hour.
- **Request Body**:
  ```json
  {
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+2348012345678",
    "password": "SecurePassword123!",
    "organizationName": "Acme Retailers",
    "subdomain": "acmeretailers",
    "planCode": "inventory",
    "timezone": "Africa/Lagos",
    "currency": "NGN"
  }
  ```
- **Responses**:
  - `201 Created`: User created, org status `pending`, HTTP-only refresh cookie set.
  - `409 Conflict`: `RESOURCE_CONFLICT` with `details.suggestions` if subdomain is taken; `DUPLICATE_RESOURCE` if email already exists.
  - `429 Too Many Requests`: `RATE_LIMITED` when 5/hr threshold is exceeded.

#### `GET /api/v1/orgs/check-subdomain`
Public debounced lookup to verify subdomain availability and receive alternative suggestions.
- **Query Parameters**: `?subdomain=acme`
- **Responses**:
  - `200 OK`: `{ "available": true, "subdomain": "acme" }` or `{ "available": false, "reason": "ALREADY_TAKEN", "suggestions": ["acme1", "acme2", "acme3"] }`

#### `POST /api/v1/auth/verify-email`
Validates verification token, flips organization status to `active`, marks user email verified, and dispatches a welcome email.
- **Request Body**: `{ "token": "a1b2c3d4..." }`
- **Responses**:
  - `200 OK`: Organization activated.
  - `400 Bad Request`: `INVALID_TOKEN` if expired, reused, or nonexistent.

#### `POST /api/v1/auth/resend-verification`
Dispatches a new verification token with a 60-second cooldown per user.
- **Request Body**: `{ "email": "jane@example.com" }`
- **Responses**:
  - `200 OK`: New verification email enqueued.
  - `429 Too Many Requests`: `COOLDOWN_ACTIVE` if requested within 60s of previous attempt.

#### `POST /api/v1/auth/refresh`
Refreshes access token using the HTTP-only refresh cookie.

### Protected Endpoints

#### `GET /api/v1/orgs/me`
Requires `Authorization: Bearer <accessToken>` and active organization status.
- **Responses**:
  - `200 OK`: Returns authenticated user's organization profile, membership role, and default store branch.
  - `401 Unauthorized`: Missing or invalid token.
  - `403 Forbidden`: `ORG_PENDING` if organization has not completed email verification.

#### System
- `GET /health` — Service liveness and health probe.
- `GET /docs` — Interactive Swagger / OpenAPI documentation UI.

---

## 5. Subdomain Algorithm & Platform Contract

The subdomain derivation and validation rules form a permanent contract for multi-tenant routing:

### Derivation Rules
1. Strip non-alphanumeric characters (hyphens and underscores are removed).
2. Convert to lowercase.
3. Clamp length to a minimum of 3 and a maximum of 30 characters.
4. If empty or invalid, fallback to randomized candidate strings.

### Collision Resolution Formula
When a subdomain collision occurs, the platform generates 3 available candidate suggestions by appending incremental digits (e.g., `acme` ➡️ `acme1`, `acme2`, `acme3`).

### Canonical Reserved Words (16-item list)
The following subdomains are reserved for platform infrastructure and cannot be claimed by tenants:
```
admin, app, api, auth, billing, dashboard, dev, docs, help, mail, root, status, staging, support, test, www
```

---

## 6. Email Transport & Deliverability

### Configuration
Set `EMAIL_TRANSPORT=brevo` for production transactional delivery.
- Ensure the sender domain (`orvio.com`) has verified **SPF** (`v=spf1 include:spf.sendinblue.com ~all`) and **DKIM** DNS TXT records configured in Brevo.
- Set `BREVO_FROM_EMAIL=no-reply@orvio.com` and `BREVO_FROM_NAME="Orvio Hub"`.

### Delivery Recovery
- If transactional email delivery fails, the error is logged as `EMAIL_DELIVERY_FAILED` with the user and recipient metadata.
- Users can self-recover at any time via the resend verification endpoint (`POST /api/v1/auth/resend-verification`) or the signup confirmation screen.

---

## 7. Infrastructure & Wildcard DNS Requirements

Before exposing tenant workspace URLs (`https://<subdomain>.orvio.com`) in production:
1. **Wildcard DNS**: Configure a wildcard DNS record:
   - `*.orvio.com` ➡️ CNAME / A record pointing to the application ingress load balancer.
2. **Wildcard TLS Certificate**: Ensure an active SSL/TLS certificate covers `*.orvio.com` and `orvio.com` (e.g., via Let's Encrypt / Cloudflare SSL).

---

## 8. Observability & Monitoring Runbooks

The backend emits structured JSON logs using Pino with correlation IDs (`requestId`).

### Key Log Events & Queries
- **New Tenant Registrations**:
  ```json
  { "event": "auth:register:success", "userId": "...", "organizationId": "...", "subdomain": "...", "planCode": "..." }
  ```
- **Subdomain Collisions (409 Conflict Rate)**:
  ```json
  { "event": "auth:register:conflict", "subdomain": "...", "reason": "ALREADY_TAKEN" }
  ```
- **Email Delivery Failures**:
  ```json
  { "event": "email:send:failure", "recipient": "...", "template": "verify_email", "error": "..." }
  ```
- **Rate Limit Hits**:
  ```json
  { "event": "rate_limit:exceeded", "ip": "...", "route": "/api/v1/auth/register" }
  ```

---

## 9. Development & Testing Commands

```powershell
# Run all unit and integration tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Execute linter
pnpm lint

# Execute TypeScript type checker
pnpm typecheck

# Build for production
pnpm build
```
