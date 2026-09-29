export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { attemptLogin, normEmail } from "@/lib/client-auth"
import { SESSION_COOKIE, sessionCookieOptions, signClientSession } from "@/lib/client-session"

// Same answer for "no such account" and "wrong password" — the response never reveals which emails have accounts.
const INVALID = { error: "That email and password don't match. Forgot your password? Use the link below." }

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({})) as { email?: string; password?: string }
  if (typeof email !== "string" || typeof password !== "string" || !email.includes("@") || !password || password.length > 256) {
    return NextResponse.json(INVALID, { status: 400 })
  }
  const result = await attemptLogin(email, password)
  if (!result.ok) {
    return result.reason === "locked"
      ? NextResponse.json({ error: "Too many attempts. Wait 15 minutes, or reset your password with the link below." }, { status: 429 })
      : NextResponse.json(INVALID, { status: 401 })
  }
  const res = NextResponse.json({ ok: true, next: "/client/dashboard" })
  res.cookies.set(SESSION_COOKIE, await signClientSession(normEmail(email), result.version), sessionCookieOptions())
  return res
}
