import { deriveKeyRaw } from './primitives';
import type { KdfParams } from './types';
import type { DeriveRequest, DeriveResponse } from './worker';

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (key: Uint8Array) => void; reject: (err: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<DeriveResponse>) => {
      const { id } = event.data;
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if ('error' in event.data) entry.reject(new Error(event.data.error));
      else entry.resolve(event.data.key);
    };
    worker.onerror = (event) => {
      // A worker-level failure rejects everything in flight rather than hanging.
      for (const [, entry] of pending) entry.reject(new Error(event.message || 'KDF worker error'));
      pending.clear();
    };
  }
  return worker;
}

/**
 * Derive a key from a password and salt, using argon2id.
 *
 * This function runs in a worker to prevent the slow, memory-hard KDF from slowing down the UI.
 */
export async function deriveKey(
  password: string | Uint8Array,
  salt: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  if (typeof Worker === 'undefined') {
    return deriveKeyRaw(password, salt, params);
  }
  const id = nextId++;
  return new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, password, salt, params } satisfies DeriveRequest);
  });
}
