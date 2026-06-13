import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { seedGlobalCategories } from '../src/db/globalCategories.js';
import * as crypto from '../src/crypto-client/index.js';

export const app: Express = createApp();

/** Truncate all tables and re-seed global categories. Call in beforeEach. */
export async function resetDb(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE users, cycles, days, categories, category_levels, factors, revoked_tokens RESTART IDENTITY CASCADE`,
  );
  await seedGlobalCategories(db);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

export type TestUser = {
  token: string;
  userId: string;
  dek: Uint8Array;
  identifier: string;
  password: string;
  recoveryCode: string;
};

let counter = 0;

/**
 * Register a user the way a real client would: build the encryption envelope
 * client-side (crypto-client), POST it to /auth/signup, and keep the DEK in
 * memory. Returns the access token + DEK for use in subsequent requests.
 */
export async function registerUser(
  overrides: { identifier?: string; password?: string } = {},
): Promise<TestUser> {
  await crypto.ready();
  const identifier = overrides.identifier ?? `user_${Date.now()}_${counter++}`;
  const password = overrides.password ?? 'correct horse battery staple';

  const envelope = crypto.buildSignupEnvelope(password);
  const res = await request(app)
    .post('/auth/signup')
    .send({ identifier, ...envelope.payload })
    .expect(201);

  return {
    token: res.body.token,
    userId: res.body.user.id,
    dek: envelope.dek,
    identifier,
    password,
    recoveryCode: envelope.recoveryCode,
  };
}

/** Promote a user to admin directly in the DB (no admin signup endpoint). */
export async function makeAdmin(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ isAdmin: true })
    .where(sql`${users.id} = ${userId}`);
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Encrypt a plaintext field with a user's DEK, returning base64 for the API. */
export function enc(plaintext: string, dek: Uint8Array): string {
  return crypto.encryptField(plaintext, dek);
}

export function dec(blobB64: string, dek: Uint8Array): string {
  return crypto.decryptField(blobB64, dek);
}

export { request, crypto };
