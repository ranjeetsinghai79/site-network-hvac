import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

// Fetch recent Twilio SMS messages and return delivery status per phone
export async function GET() {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !auth || !from) {
    return NextResponse.json({ error: 'Twilio env vars missing' }, { status: 500 })
  }

  try {
    // Fetch last 1000 outbound messages from our number
    const params = new URLSearchParams({
      From:     from,
      PageSize: '1000',
    })

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?${params}`,
      {
        headers: {
          Authorization: 'Basic ' + btoa(`${sid}:${auth}`),
        },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }

    const data = await res.json() as any
    const messages = (data.messages ?? []) as Array<{
      to: string
      status: string
      date_sent: string
      body: string
      sid: string
      error_code: string | null
      price: string | null
    }>

    // Build map: normalised phone → latest message status
    const byPhone: Record<string, { status: string; date_sent: string; sid: string; error_code: string | null }> = {}
    for (const msg of messages) {
      const digits = msg.to.replace(/\D/g, '').slice(-10)
      if (!byPhone[digits]) {
        byPhone[digits] = {
          status:     msg.status,
          date_sent:  msg.date_sent,
          sid:        msg.sid,
          error_code: msg.error_code,
        }
      }
    }

    return NextResponse.json({ byPhone, total: messages.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
