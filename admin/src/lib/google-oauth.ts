// Google Calendar "Sign in with Google" for client receptionists (edge runtime).
// Scope is deliberately narrow: calendar.events (create/move/cancel the appointments the AI books
// and read busy times) + identity. No full-calendar scope, no contacts, no mail.

import { hmacSha256Hex, timingSafeEqual, randomHex } from "@/lib/edge-crypto"

export const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"]
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"

/** Off until Google's console is configured (redirect URI registered, scope added, app published) — see docs/google-calendar-setup.md. */
export function googleCalendarEnabled(): boolean {
  return process.env.GOOGLE_CALENDAR_ENABLED === "true" && !!oauthClient()
}

export function oauthClient() {
  const id = process.env.GOOGLE_CALENDAR_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID
  const secret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET
  return id && secret ? { id, secret } : null
}

export function redirectUri(reqUrl: string): string {
  const base = (process.env.ADMIN_URL ?? new URL(reqUrl).origin).replace(/\/$/, "")
  return `${base}/api/client/google/callback`
}

function signingSecret(): string {
  const s = process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET or ADMIN_PASSWORD must be set in production")
  return s ?? "dev-only-insecure-secret"
}

const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const unb64url = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"))

/** State ties the OAuth round trip to one signed-in client + receptionist and expires in 10 minutes (CSRF + replay guard). */
export async function signState(email: string, configId: string): Promise<string> {
  const body = b64url(JSON.stringify({ e: email, c: configId, x: Date.now() + 10 * 60_000, n: randomHex(8) }))
  return `${body}.${await hmacSha256Hex(signingSecret(), body)}`
}

export async function verifyState(state: string | null): Promise<{ email: string; configId: string } | null> {
  if (!state) return null
  const dot = state.lastIndexOf(".")
  if (dot <= 0) return null
  const body = state.slice(0, dot)
  if (!timingSafeEqual(state.slice(dot + 1), await hmacSha256Hex(signingSecret(), body))) return null
  try {
    const p = JSON.parse(unb64url(body))
    if (typeof p.x !== "number" || p.x < Date.now() || typeof p.e !== "string" || typeof p.c !== "string") return null
    return { email: p.e, configId: p.c }
  } catch { return null }
}

/** Email from Google's id_token. Safe to read unverified: it came straight from Google's token endpoint over TLS in the same request. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  try { return JSON.parse(unb64url(idToken!.split(".")[1])).email ?? null } catch { return null }
}
