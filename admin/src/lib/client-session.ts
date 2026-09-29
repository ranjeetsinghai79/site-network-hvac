// Signed client-portal session cookie.
// Value: `<email>|<version>.<hmac>`. The version is checked against client_accounts.session_version
// (see client-auth.ts), so changing a password or "sign out everywhere" revokes every older cookie.
// Legacy cookies were `<email>.<hmac>` — they parse as version 0, which is what accounts start at.

import { hmacSha256Hex, timingSafeEqual } from "@/lib/edge-crypto"

export const SESSION_COOKIE = "client_email"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180   // 180 days, renewed on every visit

// Signing secret: prefer an explicit SESSION_SECRET, fall back to ADMIN_PASSWORD
// (always set in any real deployment). No hardcoded constant fallback in prod —
// a known secret would let anyone forge sessions.
function signingSecret(): string {
  const s = process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD
  if (s) return s
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET or ADMIN_PASSWORD must be set in production")
  }
  return "dev-only-insecure-secret"
}

export async function signClientSession(email: string, version = 0): Promise<string> {
  const payload = version === 0 ? email.trim().toLowerCase() : `${email.trim().toLowerCase()}|${version}`
  return `${payload}.${await hmacSha256Hex(signingSecret(), payload)}`
}

/** Kept for callers that only need the email (v0 cookies sign just the email, exactly as before). */
export const signClientEmail = (email: string) => signClientSession(email, 0)

/** Verifies the signature only. Returns null if missing/forged/tampered. */
export async function readClientSession(cookieValue: string | undefined | null): Promise<{ email: string; version: number } | null> {
  if (!cookieValue) return null
  const dot = cookieValue.lastIndexOf(".")
  if (dot <= 0) return null
  const payload = cookieValue.slice(0, dot)
  const sig = cookieValue.slice(dot + 1)
  if (!payload || !sig) return null
  if (!timingSafeEqual(sig, await hmacSha256Hex(signingSecret(), payload))) return null
  const bar = payload.lastIndexOf("|")
  return bar < 0 ? { email: payload, version: 0 } : { email: payload.slice(0, bar), version: Number(payload.slice(bar + 1)) || 0 }
}

export async function verifyClientCookie(cookieValue: string | undefined | null): Promise<string | null> {
  return (await readClientSession(cookieValue))?.email ?? null
}

export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
})
