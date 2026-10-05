import type { FastifyRequest } from 'fastify';
import { requireAuth } from './auth.js';
import { AppError } from '../lib/errors.js';

export async function requireActiveOrg(request: FastifyRequest): Promise<void> {
  if (!request.auth) {
    await requireAuth(request);
  }

  const auth = request.auth;
  if (!auth) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  // 1. Verify email status
  if (!auth.user.email_verified_at) {
    throw new AppError(
      'EMAIL_NOT_VERIFIED',
      'Please verify your email address before accessing this workspace',
      403
    );
  }

  // 2. Verify organization presence
  if (!auth.organization) {
    throw new AppError(
      'ORGANIZATION_NOT_FOUND',
      'No organization associated with this session',
      404
    );
  }

  // 3. Verify organization status is active
  if (auth.organization.status === 'pending') {
    throw new AppError(
      'ORG_PENDING',
      'This organization is pending activation. Please verify your email.',
      403
    );
  }

  if (auth.organization.status === 'suspended' || auth.organization.status === 'deleted') {
    throw new AppError(
      'ORG_SUSPENDED',
      'This organization workspace has been suspended or deleted',
      403
    );
  }

  // 4. Verify cross-tenant isolation if x-tenant-subdomain header is sent
  const headerSubdomain = request.headers['x-tenant-subdomain'];
  if (
    typeof headerSubdomain === 'string' &&
    headerSubdomain.trim() &&
    auth.organization.subdomain.toLowerCase() !== headerSubdomain.toLowerCase().trim()
  ) {
    throw new AppError(
      'ORGANIZATION_ACCESS_DENIED',
      `Session credentials for "${auth.organization.subdomain}" cannot access "${headerSubdomain}" workspace.`,
      403
    );
  }
}
