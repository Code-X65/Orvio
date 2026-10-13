import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, toErrorResponse } from '../lib/errors.js';
import { nextAvailableCandidates } from '../modules/organizations/subdomain.js';

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const isClientError =
    (error instanceof AppError && error.statusCode < 500) ||
    (error instanceof ZodError) ||
    ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500);

  if (isClientError) {
    request.log.info({ err: error, statusCode: (error as any).statusCode || 400 }, error.message);
  } else {
    request.log.error(error);
  }

  const requestId = request.id;

  // 1. Handled AppError
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(
      toErrorResponse(
        {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        requestId
      )
    );
  }

  // 2. Zod or Fastify AJV Validation Error
  if (error instanceof ZodError) {
    const fields = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    const fieldMap: Record<string, string> = {};
    fields.forEach((f) => {
      if (!fieldMap[f.field]) fieldMap[f.field] = f.message;
    });

    return reply.status(400).send(
      toErrorResponse(
        {
          code: 'VALIDATION_ERROR',
          message: fields[0]?.message ?? 'Validation failed',
          details: { fields, fieldMap },
        },
        requestId
      )
    );
  }

  if ('validation' in error || ('code' in error && error.code === 'FST_ERR_VALIDATION')) {
    return reply.status(400).send(
      toErrorResponse(
        {
          code: 'VALIDATION_ERROR',
          message: error.message || 'Validation failed',
          details: 'validation' in error ? { fields: error.validation } : undefined,
        },
        requestId
      )
    );
  }

  // 3. Prisma Unique Constraint Violation (P2002)
  const isPrismaError = error instanceof Prisma.PrismaClientKnownRequestError || (typeof error === 'object' && error !== null && 'code' in error);
  const prismaCode = isPrismaError ? (error as { code?: string }).code : undefined;

  if (prismaCode === 'P2002') {
    const pError = error as Prisma.PrismaClientKnownRequestError;
    const targetArray = Array.isArray(pError.meta?.target)
      ? (pError.meta.target as string[])
      : typeof pError.meta?.target === 'string'
      ? [pError.meta.target]
      : [];
    const targetStr = (targetArray.join(', ') + ' ' + (pError.message || '')).toLowerCase();

    if (targetStr.includes('subdomain')) {
      const suggestions = nextAvailableCandidates('org', 3);
      return reply.status(409).send(
        toErrorResponse(
          {
            code: 'SUBDOMAIN_TAKEN',
            message: 'This organization subdomain is already taken',
            details: {
              field: 'subdomain',
              resource: 'subdomain',
              suggestions,
            },
          },
          requestId
        )
      );
    }

    if (targetStr.includes('email')) {
      return reply.status(409).send(
        toErrorResponse(
          {
            code: 'DUPLICATE_EMAIL',
            message: 'An account with this email address already exists. Please log in.',
            details: {
              field: 'email',
              resource: 'email',
            },
          },
          requestId
        )
      );
    }

    if (targetStr.includes('phone')) {
      return reply.status(409).send(
        toErrorResponse(
          {
            code: 'DUPLICATE_PHONE',
            message: 'An account with this phone number already exists',
            details: {
              field: 'phone',
              resource: 'phone',
            },
          },
          requestId
        )
      );
    }

    if (targetStr.includes('product') || targetStr.includes('workspace_products')) {
      return reply.status(409).send(
        toErrorResponse(
          {
            code: 'DUPLICATE_RESOURCE',
            message: 'This application is already installed in your workspace',
            details: { resource: pError.meta?.target },
          },
          requestId
        )
      );
    }

    const target = targetArray.length > 0 ? targetArray.join(', ') : 'resource';
    return reply.status(409).send(
      toErrorResponse(
        {
          code: 'DUPLICATE_RESOURCE',
          message: `A record with this ${target} already exists`,
          details: { resource: pError.meta?.target },
        },
        requestId
      )
    );
  }

  // 4. Prisma Database Infrastructure / Connection Failures
  const dbConnectionCodes = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1011', 'P1017', 'P2024']);
  const isDbConnectionError =
    (prismaCode && dbConnectionCodes.has(prismaCode)) ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    (error as Error).name === 'PrismaClientInitializationError' ||
    (error as Error).name === 'PrismaClientRustPanicError' ||
    ((error as Error).message && (
      (error as Error).message.includes('Timed out fetching a new connection from the connection pool') ||
      (error as Error).message.includes("Can't reach database server")
    ));

  if (isDbConnectionError) {
    const isDev = process.env.NODE_ENV !== 'production';
    return reply.status(503).send(
      toErrorResponse(
        {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database service is temporarily unavailable. Please try again shortly.',
          details: isDev
            ? {
                debug: {
                  code: prismaCode,
                  name: (error as Error).name,
                  originalMessage: (error as Error).message,
                },
              }
            : undefined,
        },
        requestId
      )
    );
  }

  // 5. Rate limit (Fastify 429)
  if ('statusCode' in error && error.statusCode === 429) {
    return reply.status(429).send(
      toErrorResponse(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
        requestId
      )
    );
  }

  // 6. Fastify 4xx client error
  if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
    return reply.status(error.statusCode).send(
      toErrorResponse(
        {
          code: 'BAD_REQUEST',
          message: error.message,
        },
        requestId
      )
    );
  }

  // 7. Unhandled 500 Internal Server Error (sanitize internal traces)
  const statusCode = ('statusCode' in error && typeof error.statusCode === 'number')
    ? error.statusCode
    : 500;

  const isDev = process.env.NODE_ENV !== 'production';
  const rawMsg = (error as Error).message || '';
  const containsSensitiveTrace =
    rawMsg.includes('\n') ||
    rawMsg.includes('/home/') ||
    rawMsg.includes('/src/') ||
    rawMsg.includes('invocation in') ||
    rawMsg.includes('Prisma') ||
    rawMsg.includes('connection pool');

  const safeMessage = containsSensitiveTrace || !rawMsg
    ? 'An unexpected server error occurred. Please try again later.'
    : (isDev ? rawMsg : 'An internal server error occurred');

  return reply.status(statusCode).send(
    toErrorResponse(
      {
        code: 'INTERNAL_SERVER_ERROR',
        message: safeMessage,
        details: isDev
          ? {
              debug: {
                name: (error as Error).name || 'Error',
                originalMessage: rawMsg,
                stack: (error as Error).stack,
              },
            }
          : undefined,
      },
      requestId
    )
  );
}
