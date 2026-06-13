import type { z } from 'zod';
import { HttpError } from './errors.js';

/**
 * Parse/validate untrusted input against a Zod schema, throwing a 400 with a
 * compact field-error map on failure. Returns the parsed, typed value.
 */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors;
    throw new HttpError(400, 'Validation failed', 'validation_failed', fields);
  }
  return result.data;
}
