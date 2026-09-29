// AES-256-GCM for OAuth refresh tokens at rest. Format: base64(iv[12] | ciphertext+tag).
// admin/src/lib/token-crypto.ts is the mirror (edge runtime) — the two MUST stay byte-compatible.
// Key: CALENDAR_TOKEN_KEY = base64 of 32 random bytes (same value in Cloud Run and the admin app).

function keyBytes(): Uint8Array {
  const raw = process.env.CALENDAR_TOKEN_KEY
  if (!raw) throw new Error('CALENDAR_TOKEN_KEY not set')
  const bytes = Buffer.from(raw, 'base64')
  if (bytes.length !== 32) throw new Error('CALENDAR_TOKEN_KEY must be 32 bytes, base64-encoded')
  return bytes
}

async function importKey(usage: 'encrypt' | 'decrypt') {
  return globalThis.crypto.subtle.importKey('raw', keyBytes() as unknown as ArrayBuffer, { name: 'AES-GCM' }, false, [usage])
}

export async function encryptToken(plain: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey('encrypt'), new TextEncoder().encode(plain)))
  return Buffer.concat([iv, ct]).toString('base64')
}

export async function decryptToken(blob: string): Promise<string> {
  const buf = Buffer.from(blob, 'base64')
  const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(0, 12) }, await importKey('decrypt'), buf.subarray(12))
  return new TextDecoder().decode(pt)
}
