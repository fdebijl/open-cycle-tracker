import { aeadDecrypt, aeadEncrypt } from './primitives';
import { fromBase64, toBase64, utf8Decode, utf8Encode } from './codec';

export async function encryptString(plaintext: string, dek: Uint8Array): Promise<string> {
  return toBase64(await aeadEncrypt(utf8Encode(plaintext), dek));
}

export async function decryptString(blobB64: string, dek: Uint8Array): Promise<string> {
  return utf8Decode(await aeadDecrypt(await fromBase64(blobB64), dek));
}

/** Encrypt an arbitrary JSON-serializable value (e.g. user `info`/`settings`). */
export async function encryptJson(value: unknown, dek: Uint8Array): Promise<string> {
  return encryptString(JSON.stringify(value), dek);
}

export async function decryptJson<T>(blobB64: string, dek: Uint8Array): Promise<T> {
  return JSON.parse(await decryptString(blobB64, dek)) as T;
}
