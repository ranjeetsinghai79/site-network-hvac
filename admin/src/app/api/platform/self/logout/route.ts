export const runtime = 'edge'

import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('agency_session')
  return response
}
