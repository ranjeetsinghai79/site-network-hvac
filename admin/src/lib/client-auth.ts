import { cookies } from "next/headers"
import { getDb } from "@/lib/db"
import { hashPassword, verifyPassword } from "@/lib/password"
import { readClientSession, SESSION_COOKIE } from "@/lib/client-session"
import { randomHex, sha256Hex } from "@/lib/edge-crypto"

export const normEmail = (e: string) => e.trim().toLowerCase()

const MAX_FAILURES = 5
const LOCK_MINUTES = 15

export interface Account { email: string; passwordHash: string | null; version: number; failed: number; lockedUntil: Date | null }

/** Only paying customers get a dashboard login — not the thousands of scraped prospects in `leads`. */
export async function findClientLead(email: string): Promise<{ id: string; email: string; phone: string | null; name: string } | null> {
  const { rows } = await (await getDb()).query(
    `SELECT id, email, phone, name FROM leads WHERE lower(email) = $1 AND (paid = TRUE OR handed_off = TRUE) ORDER BY created_at DESC LIMIT 1`,
    [normEmail(email)])
  return rows[0] ?? null
}

/** The email of a paying customer whose business phone matches (last 10 digits) — for "I forgot which email I used". */
export async function findClientEmailByPhone(phone: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, "").slice(-10)
  if (digits.length < 10) return null
  const { rows } = await (await getDb()).query(
    `SELECT email FROM leads WHERE email IS NOT NULL AND (paid = TRUE OR handed_off = TRUE)
       AND RIGHT(regexp_replace(coalesce(phone,''),'\\D','','g'),10) = $1 ORDER BY created_at DESC LIMIT 1`, [digits])
  return rows[0]?.email ? normEmail(rows[0].email) : null
}

export async function getAccount(email: string): Promise<Account | null> {
  const { rows } = await (await getDb()).query(
    `SELECT email, password_hash, session_version, failed_attempts, locked_until FROM client_accounts WHERE email = $1`, [normEmail(email)])
  const r = rows[0]
  return r ? { email: r.email, passwordHash: r.password_hash, version: r.session_version, failed: r.failed_attempts, lockedUntil: r.locked_until } : null
}

export async function ensureAccount(email: string): Promise<void> {
  await (await getDb()).query(`INSERT INTO client_accounts (email) VALUES ($1) ON CONFLICT DO NOTHING`, [normEmail(email)])
}

export async function hasPassword(email: string): Promise<boolean> {
  return !!(await getAccount(email))?.passwordHash
}

/**
 * The signed-in client's email, or null. Verifies the cookie signature AND that its version still matches
 * the account — so changing a password or "sign out everywhere" ends every other session immediately.
 */
export async function requireClient(): Promise<string | null> {
  const store = await cookies()
  const session = await readClientSession(store.get(SESSION_COOKIE)?.value)
  if (!session) return null
  const acct = await getAccount(session.email)
  return session.version === (acct?.version ?? 0) ? session.email : null
}

export type LoginResult = { ok: true; version: number } | { ok: false; reason: "invalid" | "locked" }

export async function attemptLogin(emailRaw: string, password: string): Promise<LoginResult> {
  const email = normEmail(emailRaw)
  const db = await getDb()
  const [acct, lead] = await Promise.all([getAccount(email), findClientLead(email)])
  if (acct?.lockedUntil && acct.lockedUntil.getTime() > Date.now()) return { ok: false, reason: "locked" }

  const valid = await verifyPassword(password, acct?.passwordHash ?? null)   // runs even when there is no account (timing)
  if (!valid || !lead || !acct) {
    if (acct) {
      await db.query(
        `UPDATE client_accounts SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval ELSE locked_until END
         WHERE email = $1`, [email, MAX_FAILURES, String(LOCK_MINUTES)])
    }
    return { ok: false, reason: "invalid" }
  }
  await db.query(`UPDATE client_accounts SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE email = $1`, [email])
  return { ok: true, version: acct.version }
}

/** Sets a new password and revokes every older session. Returns the new session version. */
export async function setPassword(emailRaw: string, password: string): Promise<number> {
  const email = normEmail(emailRaw)
  const { rows } = await (await getDb()).query(
    `INSERT INTO client_accounts (email, password_hash, password_updated_at, session_version, last_login_at)
     VALUES ($1, $2, NOW(), 1, NOW())
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, password_updated_at = NOW(),
       session_version = client_accounts.session_version + 1, failed_attempts = 0, locked_until = NULL, last_login_at = NOW()
     RETURNING session_version`, [email, await hashPassword(password)])
  return rows[0].session_version
}

/** "Sign out everywhere": invalidates all existing cookies. */
export async function bumpSessionVersion(emailRaw: string): Promise<number> {
  await ensureAccount(emailRaw)
  const { rows } = await (await getDb()).query(`UPDATE client_accounts SET session_version = session_version + 1 WHERE email = $1 RETURNING session_version`, [normEmail(emailRaw)])
  return rows[0].session_version
}

// ── Reset / welcome tokens ────────────────────────────────────────────────────

/** Creates a single-use token. Returns null when this email already asked for 3 in the last 15 minutes. */
export async function createResetToken(emailRaw: string, purpose: "reset" | "welcome", ttlMinutes: number): Promise<string | null> {
  const email = normEmail(emailRaw)
  const db = await getDb()
  const recent = await db.query(`SELECT count(*)::int n FROM client_reset_tokens WHERE email = $1 AND created_at > NOW() - interval '15 minutes'`, [email])
  if (recent.rows[0].n >= 3) return null
  const token = randomHex(32)
  await db.query(
    `INSERT INTO client_reset_tokens (token_hash, email, purpose, expires_at) VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)`,
    [await sha256Hex(token), email, purpose, String(ttlMinutes)])
  return token
}

export async function peekResetToken(token: string): Promise<{ email: string; purpose: string } | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const { rows } = await (await getDb()).query(
    `SELECT email, purpose FROM client_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`, [await sha256Hex(token)])
  return rows[0] ?? null
}

/** Atomically spends the token (single use). */
export async function consumeResetToken(token: string): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const { rows } = await (await getDb()).query(
    `UPDATE client_reset_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() RETURNING email`, [await sha256Hex(token)])
  return rows[0]?.email ?? null
}
