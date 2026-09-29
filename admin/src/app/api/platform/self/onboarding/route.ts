export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformContext } from '@/lib/platform-auth'
import { checkRateLimit, createOnboarding, platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const context = await requirePlatformContext()
    const { rows } = await platformPool().query(`SELECT * FROM onboarding_sessions WHERE agency_id=$1 ORDER BY created_at DESC LIMIT 50`, [context.agencyId])
    return NextResponse.json({ sessions: rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePlatformContext(['owner','operator'])
    if (!await checkRateLimit(`agency:${context.agencyId}`, 'onboarding', 10, 60)) return NextResponse.json({ error: 'Onboarding limit reached' }, { status: 429 })
    const body = await request.json()
    const session = await createOnboarding({ agencyId: context.agencyId, actorEmail: context.email, websiteUrl: String(body.websiteUrl ?? ''), niche: body.niche })
    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'FORBIDDEN' ? 403 : message === 'UNAUTHORIZED' ? 401 : 400 })
  }
}
