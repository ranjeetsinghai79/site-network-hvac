export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createInvite, defaultAgencyId, platformPool } from '@/lib/platform-control'
import type { PlatformRole } from '@/lib/platform-session'

const roles = new Set<PlatformRole>(['owner','operator','specialist','approver','client'])

export async function GET() {
  try {
    const agencyId = await defaultAgencyId()
    const { rows } = await platformPool().query(`SELECT id,email,role,status,last_login_at,created_at FROM agency_members WHERE agency_id=$1 ORDER BY created_at`, [agencyId])
    return NextResponse.json({ members: rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const agencyId = await defaultAgencyId()
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const role = String(body.role ?? 'operator') as PlatformRole
    if (!email.includes('@') || !roles.has(role)) return NextResponse.json({ error: 'Valid email and role required' }, { status: 400 })
    const invite = await createInvite({ agencyId, actorEmail: String(body.actorEmail ?? 'admin@webcrew.app'), email, role })
    const base = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3010'
    const inviteUrl = `${base}/agency/auth/${invite.token}`
    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.OUTREACH_FROM_EMAIL ?? 'WebCrew <noreply@webcrew.app>', to: email, subject: 'Your WebCrew agency platform invitation', html: `<p>You have been invited as <strong>${role}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>` }),
      })
    }
    return NextResponse.json({ ok: true, expiresAt: invite.expires_at, ...(process.env.NODE_ENV !== 'production' ? { inviteUrl } : {}) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
