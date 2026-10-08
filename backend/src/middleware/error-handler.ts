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

  // 4. Rate limit (Fastify 429)
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

  // 5. Fastify 4xx client error
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

  // 6. Unhandled 500 Internal Server Error (hide internal trace in production/dev)
  const statusCode = ('statusCode' in error && typeof error.statusCode === 'number')
    ? error.statusCode
    : 500;

  return reply.status(statusCode).send(
    toErrorResponse(
      {
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'An internal server error occurred'
          : error.message || 'An unexpected error occurred',
      },
      requestId
    )
  );
}
