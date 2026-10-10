# Testing Data Safety & Isolation Rules

## 1. Zero Destruction of User Data
- **Never perform destructive global operations** on databases or shared storage (e.g. `deleteMany({})`, `TRUNCATE`, `prisma migrate reset --force`, `db push --force-reset`).
- **Never alter or delete existing non-test records** (real organizations, accounts, inventory items, or settings).

## 2. Test Fixture Namespacing & Isolation
- All automated and manual test data must use distinct, clearly identifiable test prefixes/identifiers:
  - Subdomains: `test-*` or `e2e-*`
  - Emails: `*@orviotest.com` or `test-*@*`
  - Idempotency Keys: `test-idemp-*`
  - Organizations / Branches: `Test Org *` / `Test Branch *`
- When running integration or manual tests, restrict cleanup / tear-down queries exclusively to these test-specific identifiers.

## 3. Post-Test Data Relocation & Cleanup
- Ensure all test artifacts, temporary test fixtures, and test records generated during testing sessions are either cleanly removed or relocated/archived so they do not pollute active workspaces or user views.
