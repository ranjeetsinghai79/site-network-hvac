// Password hashing for the client portal (edge runtime → WebCrypto only).
// PBKDF2-SHA256, 100k iterations (the maximum Cloudflare Workers allows), 16-byte random salt.
// Format: pbkdf2$<iterations>$<saltB64>$<hashB64>. Iterations are stored so they can be raised later.

const ITERATIONS = 100_000
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password) as unknown as ArrayBuffer, "PBKDF2", false, ["deriveBits"])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as ArrayBuffer, iterations }, key, 256))
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]
  return r === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // Always burn the same CPU, so a missing account can't be told apart from a wrong password by timing.
  const parts = (stored ?? "").split("$")
  if (parts.length !== 4 || parts[0] !== "pbkdf2") { await derive(password, new Uint8Array(16), ITERATIONS); return false }
  const iterations = Number(parts[1])
  return constantTimeEqual(await derive(password, unb64(parts[2]), iterations), unb64(parts[3]))
}

const COMMON = new Set(["password", "password1", "password123", "1234567890", "12345678910", "qwertyuiop", "letmein123", "welcome123", "iloveyou123", "admin12345", "abc1234567"])

/** Returns an error message, or null if the password is acceptable. */
export function validatePassword(password: string, email: string): string | null {
  if (password.length < 10) return "Use at least 10 characters."
  if (password.length > 128) return "Use 128 characters or fewer."
  if (/^(.)\1+$/.test(password)) return "Choose something less repetitive."
  const lower = password.toLowerCase()
  if (COMMON.has(lower)) return "That password is too common. Pick something harder to guess."
  const local = email.split("@")[0]?.toLowerCase()
  if (local && local.length >= 4 && lower.includes(local)) return "Don't include your email name in your password."
  return null
}
