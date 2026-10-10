export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE_RESOURCE'
  | 'DUPLICATE_EMAIL'
  | 'DUPLICATE_PHONE'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'ORG_PENDING'
  | 'ORG_SUSPENDED'
  | 'ORGANIZATION_NOT_FOUND'
  | 'ORGANIZATION_ACCESS_DENIED'
  | 'INVALID_SUBDOMAIN'
  | 'SUBDOMAIN_TAKEN'
  | 'INVALID_STEP'
  | 'INCOMPLETE_ONBOARDING'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_ALREADY_USED'
  | 'ALREADY_VERIFIED'
  | 'PASSWORD_NOT_SET'
  | 'MISSING_REFRESH_TOKEN'
  | 'INVALID_REFRESH_TOKEN'
  | 'EMAIL_DELIVERY_FAILED'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'IDEMPOTENCY_PAYLOAD_MISMATCH'
  | 'REQUEST_IN_PROGRESS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PRODUCT_NOT_INSTALLED'
  | 'CATEGORY_NOT_FOUND'
  | 'INVALID_CATEGORY_HIERARCHY'
  | 'DUPLICATE_CATEGORY'
  | 'CANNOT_DELETE_PARENT_CATEGORY'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_SKU_DUPLICATE'
  | 'PRODUCT_BARCODE_DUPLICATE'
  | 'INTERNAL_SERVER_ERROR';

export interface ErrorResponseEnvelope {
  status: 'error';
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toErrorResponse(
  error: { code: string; message: string; details?: unknown },
  requestId?: string
): ErrorResponseEnvelope {
  return {
    status: 'error',
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
    ...(requestId ? { requestId } : {}),
  };
}
