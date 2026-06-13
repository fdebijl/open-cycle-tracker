/// <reference lib="webworker" />
import { deriveKeyRaw } from './primitives';
import type { KdfParams } from './types';

export interface DeriveRequest {
  id: number;
  password: string | Uint8Array;
  salt: Uint8Array;
  params: KdfParams;
}

export type DeriveResponse = { id: number; key: Uint8Array } | { id: number; error: string };

// Argon2id is deliberately slow and memory-hard; running it here keeps the main
// thread (and the UI) responsive while a key is derived.
self.onmessage = async (event: MessageEvent<DeriveRequest>) => {
  const { id, password, salt, params } = event.data;
  try {
    const key = await deriveKeyRaw(password, salt, params);
    (self as DedicatedWorkerGlobalScope).postMessage({ id, key } satisfies DeriveResponse);
  } catch (error) {
    (self as DedicatedWorkerGlobalScope).postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies DeriveResponse);
  }
};
