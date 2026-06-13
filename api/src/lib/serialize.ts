/**
 * Encode a `bytea` ciphertext column to base64 for JSON, preserving null.
 *
 * Drizzle returns bytea differently depending on the query path:
 *  - `db.select()` / `.returning()` → a Node `Buffer`
 *  - relational queries (`db.query.x.findFirst({ with })`) build nested rows
 *    via JSON aggregation in Postgres, which emits bytea as a hex string of the
 *    form `\x<hex>`.
 * We normalize both to base64 so serializers don't have to care which path
 * produced the value.
 */
export function encOut(value: Buffer | string | null | undefined): string | null {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (typeof value === 'string' && value.startsWith('\\x')) {
    return Buffer.from(value.slice(2), 'hex').toString('base64');
  }
  // Already base64 (or empty) — return as-is.
  return value;
}
