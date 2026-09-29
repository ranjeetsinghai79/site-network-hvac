export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformContext } from '@/lib/platform-auth'
import { confirmOnboarding } from '@/lib/platform-control'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requirePlatformContext(['owner','operator'])
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const result = await confirmOnboarding({ agencyId: context.agencyId, actorEmail: context.email, onboardingId: id, playbookId: body.playbookId, serviceTier: body.serviceTier })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'FORBIDDEN' ? 403 : message === 'UNAUTHORIZED' ? 401 : 400 })
  }
}
