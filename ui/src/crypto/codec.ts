import { entropyToMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { getSodium } from './sodium';

/** Standard, padded base64 (the contract's transport encoding for blobs). */
export async function toBase64(bytes: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

export async function fromBase64(value: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(value, sodium.base64_variants.ORIGINAL);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8Encode(value: string): Uint8Array {
  return encoder.encode(value);
}

export function utf8Decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/**
 * Encode the 32-byte recovery secret as a 24-word BIP39 mnemonic for the user
 * to write down. The mnemonic is purely a reversible display encoding of the
 * raw secret - the secret bytes, not the words, are what feed the recovery KDF.
 */
export function secretToMnemonic(secret: Uint8Array): string {
  return entropyToMnemonic(secret, wordlist);
}

/** Decode a recovery mnemonic back to its 32-byte secret (validates checksum). */
export function mnemonicToSecret(mnemonic: string): Uint8Array {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  return mnemonicToEntropy(normalized, wordlist);
}
