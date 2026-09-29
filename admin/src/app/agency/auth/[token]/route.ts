export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { sha256Hex } from '@/lib/edge-crypto'
import { auditPlatform, platformPool } from '@/lib/platform-control'
import { signPlatformSession } from '@/lib/platform-session'

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const hash = await sha256Hex(token)
  const client = await platformPool().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(`
      SELECT pi.*,aa.status AS agency_status FROM platform_invites pi JOIN agency_accounts aa ON aa.id=pi.agency_id
      WHERE pi.token_hash=$1 AND pi.accepted_at IS NULL AND pi.revoked_at IS NULL AND pi.expires_at>now() FOR UPDATE
    `, [hash])
    const invite = rows[0]
    if (!invite || invite.agency_status !== 'active') {
      await client.query('ROLLBACK')
      return NextResponse.redirect(new URL('/agency/login?error=expired', request.url))
    }
    await client.query(`UPDATE platform_invites SET accepted_at=now() WHERE id=$1`, [invite.id])
    await client.query(`UPDATE agency_members SET status='active',role=$3,last_login_at=now(),updated_at=now() WHERE agency_id=$1 AND lower(email)=lower($2)`, [invite.agency_id, invite.email, invite.role])
    await client.query('COMMIT')
    await auditPlatform({ agencyId: invite.agency_id, actorEmail: invite.email, actorRole: invite.role, action: 'session.created', entityType: 'agency_member', entityId: invite.email })
    const response = NextResponse.redirect(new URL('/agency/dashboard', request.url))
    response.cookies.set('agency_session', await signPlatformSession({ agencyId: invite.agency_id, email: invite.email, role: invite.role }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' })
    return response
  } catch {
    await client.query('ROLLBACK')
    return NextResponse.redirect(new URL('/agency/login?error=failed', request.url))
  } finally {
    client.release()
  }
}
