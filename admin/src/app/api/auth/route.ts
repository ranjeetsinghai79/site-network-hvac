export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"

async function makeToken(password: string): Promise<string> {
  // Sign with SESSION_SECRET, or the admin password itself — never a public constant.
  const secret = process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "dev-only-insecure-secret"
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(password))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("")
}

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set("admin_session", await makeToken("dev"), {
      httpOnly: true,
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 30,
      path:     "/",
    })
    return res
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 })
  }

  const token = await makeToken(adminPassword)
  const res = NextResponse.json({ ok: true })
  res.cookies.set("admin_session", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 30,
    path:     "/",
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete("admin_session")
  return res
}
