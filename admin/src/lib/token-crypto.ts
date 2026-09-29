// Mirror of pipeline/src/reception/token-crypto.ts (edge runtime, no Buffer) — the two MUST stay byte-compatible.
// AES-256-GCM, format base64(iv[12] | ciphertext+tag), key CALENDAR_TOKEN_KEY (base64, 32 bytes).

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))
const bytesToB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))

async function importKey(usage: "encrypt" | "decrypt") {
  const raw = process.env.CALENDAR_TOKEN_KEY
  if (!raw) throw new Error("CALENDAR_TOKEN_KEY not set")
  const bytes = b64ToBytes(raw)
  if (bytes.length !== 32) throw new Error("CALENDAR_TOKEN_KEY must be 32 bytes, base64-encoded")
  return crypto.subtle.importKey("raw", bytes as unknown as ArrayBuffer, { name: "AES-GCM" }, false, [usage])
}

export async function encryptToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as ArrayBuffer }, await importKey("encrypt"), new TextEncoder().encode(plain) as unknown as ArrayBuffer))
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length)
  return bytesToB64(out)
}

export async function decryptToken(blob: string): Promise<string> {
  const buf = b64ToBytes(blob)
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) as unknown as ArrayBuffer }, await importKey("decrypt"), buf.slice(12) as unknown as ArrayBuffer)
  return new TextDecoder().decode(pt)
}
