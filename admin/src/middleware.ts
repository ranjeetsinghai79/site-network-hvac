import { NextRequest, NextResponse } from "next/server"
import { readClientSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/client-session"
import { verifyPlatformSession } from "@/lib/platform-session"

// Cached within the isolate — crypto.subtle ops are expensive; only run once per isolate lifecycle
let _cachedToken: string | null = null
let _cachedPassword: string | null = null

async function getExpectedToken(password: string): Promise<string> {
  if (_cachedToken !== null && _cachedPassword === password) return _cachedToken
  const secret = process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "dev-only-insecure-secret"
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(password))
  _cachedToken    = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("")
  _cachedPassword = password
  return _cachedToken
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Client portal auth — verify signed cookie, not just presence
  const PORTAL = ["/client/dashboard", "/client/leads", "/client/calls", "/client/appointments", "/client/receptionist", "/client/website", "/client/billing", "/client/support", "/client/account", "/client/welcome"]
  if (PORTAL.some(r => pathname === r || pathname.startsWith(`${r}/`))) {
    // Signature only here (fast, edge); the page/API re-checks the account's session version in the DB.
    const value = req.cookies.get(SESSION_COOKIE)?.value
    if (!(await readClientSession(value))) return NextResponse.redirect(new URL("/client/login", req.url))
    // Sliding session: every visit renews the cookie, so an active client is never asked to sign in again.
    const res = NextResponse.next()
    res.cookies.set(SESSION_COOKIE, value!, sessionCookieOptions())
    return res
  }

  if (pathname.startsWith("/agency/dashboard")) {
    const session = await verifyPlatformSession(req.cookies.get("agency_session")?.value)
    if (!session) return NextResponse.redirect(new URL("/agency/login", req.url))
    return NextResponse.next()
  }

  // Skip auth for: login page, client routes, public API, static assets
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/client/") ||
    pathname.startsWith("/api/client/") ||
    pathname === "/agency/login" ||
    pathname.startsWith("/agency/auth/") ||
    pathname.startsWith("/api/platform/self/") ||
    (pathname.startsWith("/api/integrations/") && pathname.endsWith("/callback")) ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    // Stripe authenticates this public machine endpoint with its own HMAC.
    pathname === "/api/stripe/webhook" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")

  if (isPublic) return NextResponse.next()

  // Admin auth — check session cookie
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return NextResponse.next()

  const session = req.cookies.get("admin_session")?.value
  const expected = await getExpectedToken(adminPassword)

  if (session !== expected) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
