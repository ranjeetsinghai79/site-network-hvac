import { NextResponse } from 'next/server'
import { getSmsConversations } from '@/lib/db'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const conversations = await getSmsConversations()
    return NextResponse.json({ conversations })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, conversations: [] }, { status: 500 })
  }
}
