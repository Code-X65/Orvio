import { z } from 'zod';

import { AppError } from './app-error.js';

export function validate<TSchema extends z.ZodType>(schema: TSchema, value: unknown): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request.', result.error.flatten());
}
