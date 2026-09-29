# Secret management

Local development uses ignored `.env` files copied from each application's `.env.example`. Never commit a populated `.env` file, database connection string, token, password, or provider credential.

## GitHub environments

Create `staging` and `production` GitHub Environments before deployment. Store each deployment environment's `DATABASE_URL` as an environment secret, scope it to the deployment workflow, and require approval for production. CI uses only an isolated disposable PostgreSQL URL and never accesses deployment secrets.

When future integrations require credentials, add their names and owning environment to this document before use. Do not expose server-only values through `VITE_*` frontend variables.
# Proxy and session deployment requirements

`TRUST_PROXY_HOPS` is required in production. Set it to the exact number of trusted reverse-proxy hops in front of the API (normally `1`); never set it higher than the infrastructure actually provides. This preserves accurate client IPs for audit logs and IP-based throttling.

The frontend and API must be same-site (for example `app.orvio.com` and `api.orvio.com`) because refresh cookies use `SameSite=Strict`. Deploying them on unrelated registrable domains prevents session restoration.

Terminate TLS at the trusted proxy and expose only HTTPS public URLs in production. The API rejects requests whose trusted forwarded protocol is not HTTPS; do not route direct HTTP traffic to it.

## Audit-log retention

Routine auth, onboarding, session, and notification audit records are retained for five years through `AUDIT_LOG_RETENTION_DAYS` (minimum 1,825 days). Audit logs are append-only at the database layer; only the controlled retention procedure may purge expired rows. Do not include passwords, tokens, secrets, or free-text survey answers in audit metadata.

Run database migrations with the controlled migration role, and run the API with a distinct non-owner database role. This is required for the audit-log retention procedure to remain the only permitted deletion path.
