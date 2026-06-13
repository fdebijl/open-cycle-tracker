import { z } from 'zod';
import { cipherField } from '../../lib/validation.js';

/**
 * Editable user fields. `name`/`info`/`settings` are E2EE blobs (parity with
 * the Rails columns). `email` is optional plaintext. Unknown keys rejected.
 * Omitted keys are left unchanged; explicit null clears a value.
 */
export const updateUserSchema = z
  .object({
    email: z.string().email().max(320).nullable().optional(),
    encName: cipherField.nullable().optional(),
    encInfo: cipherField.nullable().optional(),
    encSettings: cipherField.nullable().optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
