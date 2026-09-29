export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, createOnboarding, defaultAgencyId, platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const agencyId = await defaultAgencyId()
    const { rows } = await platformPool().query(`SELECT * FROM onboarding_sessions WHERE agency_id=$1 ORDER BY created_at DESC LIMIT 100`, [agencyId])
    return NextResponse.json({ sessions: rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const agencyId = await defaultAgencyId()
    if (!await checkRateLimit(`agency:${agencyId}`, 'onboarding', 10, 60)) return NextResponse.json({ error: 'Onboarding limit reached. Try again later.' }, { status: 429 })
    const body = await request.json()
    if (!body.websiteUrl) return NextResponse.json({ error: 'websiteUrl required' }, { status: 400 })
    const session = await createOnboarding({ agencyId, actorEmail: String(body.actorEmail ?? 'admin@webcrew.app'), websiteUrl: String(body.websiteUrl), niche: body.niche ? String(body.niche) : undefined })
    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
