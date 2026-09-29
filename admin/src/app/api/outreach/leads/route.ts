import { NextResponse } from 'next/server'
import { getOutreachLeads } from '@/lib/db'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const leads = await getOutreachLeads()
    return NextResponse.json({ leads })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, leads: [] }, { status: 500 })
  }
}
