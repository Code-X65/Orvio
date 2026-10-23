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
  | 'ACCOUNT_SUSPENDED'
  | 'MEMBERSHIP_DEACTIVATED'
  | 'ORGANIZATION_SUSPENDED'
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
  | 'INVALID_HANDOFF_TICKET'
  | 'USER_NOT_FOUND'
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
  | 'CATEGORY_HAS_PRODUCTS'
  | 'INVALID_REASSIGNMENT_CATEGORY'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_SKU_DUPLICATE'
  | 'PRODUCT_BARCODE_DUPLICATE'
  | 'PRODUCT_PRICE_INVALID'
  | 'PRODUCT_HAS_STOCK'
  | 'PRODUCT_HAS_RESERVED_STOCK'
  | 'PRODUCT_HAS_VARIANTS'
  | 'VARIANT_NOT_FOUND'
  | 'VARIANT_ATTRIBUTES_DUPLICATE'
  | 'VARIANT_REQUIRED_FOR_STOCK_OPERATION'
  | 'IMAGE_NOT_FOUND'
  | 'IMAGE_UPLOAD_FAILED'
  | 'INVALID_IMAGE_TYPE'
  | 'SPOOFED_IMAGE_MIME_TYPE'
  | 'MALFORMED_IMAGE'
  | 'IMAGE_DIMENSIONS_TOO_LARGE'
  | 'IMAGE_COUNT_EXCEEDED'
  | 'IMAGE_FILE_TOO_LARGE'
  | 'CSRF_ORIGIN_INVALID'
  | 'CSRF_TOKEN_MISSING'
  | 'CSRF_TOKEN_MISMATCH'
  | 'CROSS_TENANT_SESSION_REJECTED'
  | 'BRANCH_NOT_FOUND'
  | 'BRANCH_HAS_STOCK'
  | 'BRANCH_HAS_RESERVED_STOCK'
  | 'IS_PRIMARY_BRANCH'
  | 'CANNOT_DELETE_ONLY_BRANCH'
  | 'DUPLICATE_BRANCH_CODE'
  | 'DUPLICATE_BRANCH_NAME'
  | 'BRAND_NOT_FOUND'
  | 'BRAND_SLUG_DUPLICATE'
  | 'BRAND_HAS_PRODUCTS'
  | 'BRANCH_PRODUCT_NOT_FOUND'
  | 'CATALOG_IMPORT_FAILED'
  | 'STORAGE_CONFIG_ERROR'
  | 'STORAGE_UPLOAD_FAILED'
  | 'SUPPLIER_NOT_FOUND'
  | 'SUPPLIER_INACTIVE'
  | 'DUPLICATE_RECEIPT_REFERENCE'
  | 'RECEIPT_NOT_FOUND'
  | 'VARIANT_REQUIRED'
  | 'INSUFFICIENT_STOCK'
  | 'DATABASE_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'NETWORK_TIMEOUT'
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
