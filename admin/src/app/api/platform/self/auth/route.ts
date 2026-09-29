export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, createInvite, platformPool } from '@/lib/platform-control'

export async function POST(request: NextRequest) {
  const generic = NextResponse.json({ ok: true, message: 'If your account is active, a sign-in link has been sent.' })
  try {
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email.includes('@') || !await checkRateLimit(`login:${email}`, 'agency_login', 5, 60)) return generic
    const { rows } = await platformPool().query(`SELECT agency_id,role FROM agency_members WHERE lower(email)=lower($1) AND status='active' LIMIT 1`, [email])
    const member = rows[0]
    if (!member) return generic
    const invite = await createInvite({ agencyId: member.agency_id, actorEmail: email, email, role: member.role, preserveMemberStatus: true })
    const base = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3010'
    const url = `${base}/agency/auth/${invite.token}`
    if (process.env.RESEND_API_KEY) await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.OUTREACH_FROM_EMAIL ?? 'WebCrew <noreply@webcrew.app>', to: email, subject: 'Sign in to WebCrew', html: `<p><a href="${url}">Sign in to your agency platform</a></p><p>This link expires in 7 days.</p>` }) })
    return NextResponse.json({ ok: true, message: generic.statusText || 'Sign-in link sent.', ...(process.env.NODE_ENV !== 'production' ? { devLink: url } : {}) })
  } catch {
    return generic
  }
}
