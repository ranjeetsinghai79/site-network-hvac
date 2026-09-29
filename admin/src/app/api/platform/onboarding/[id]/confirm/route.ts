export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { confirmOnboarding, defaultAgencyId } from '@/lib/platform-control'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const result = await confirmOnboarding({ agencyId: await defaultAgencyId(), actorEmail: String(body.actorEmail ?? 'admin@webcrew.app'), onboardingId: id, playbookId: body.playbookId, serviceTier: body.serviceTier })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
