import { z, type ZodType } from 'zod';
import { ValidationError } from './errors';

/** Parse `value` with a Zod schema, throwing a typed 400 on failure. */
export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(
      'Invalid request',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/**
 * Query-string boolean. `z.coerce.boolean()` is wrong for this job because
 * Boolean("false") === true.
 */
export const booleanParam = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
