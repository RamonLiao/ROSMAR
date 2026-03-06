/**
 * Client-side AES-GCM 256-bit encryption for Vault secrets.
 * Key derivation: PBKDF2 from wallet signature + random salt.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** Derive an AES-GCM-256 key from a wallet signature (used as password) */
export async function deriveKey(
  signature: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signature),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt plaintext with AES-GCM.
 * Returns: salt (16B) || iv (12B) || ciphertext
 */
export async function encrypt(
  plaintext: string,
  signature: string,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(signature, salt);

  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  );

  // Concatenate: salt + iv + ciphertext
  const result = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, SALT_BYTES);
  result.set(new Uint8Array(ciphertext), SALT_BYTES + IV_BYTES);
  return result;
}

/**
 * Decrypt data encrypted by `encrypt()`.
 * Input: salt (16B) || iv (12B) || ciphertext
 */
export async function decrypt(
  data: Uint8Array,
  signature: string,
): Promise<string> {
  const salt = data.slice(0, SALT_BYTES);
  const iv = data.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = data.slice(SALT_BYTES + IV_BYTES);

  const key = await deriveKey(signature, salt);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plainBuffer);
}

/** Convert Uint8Array to base64 for transport */
export function toBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

/** Convert base64 back to Uint8Array */
export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
