export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = await getDb()

  const { rows } = await db.query(`
    SELECT
      event_type,
      COUNT(*) as n
    FROM lead_events
    WHERE event_type IN (
      'email_opened','email_clicked','email_bounced',
      'sms_delivered','sms_failed','sms_undelivered',
      'sms_reply','sms_auto_reply'
    )
    GROUP BY event_type
    ORDER BY n DESC
  `)

  const stats: Record<string, number> = {}
  for (const r of rows) stats[r.event_type] = parseInt(r.n)

  // Totals
  const emailSent     = (await db.query(`SELECT COUNT(*) as n FROM leads WHERE outreach_sent=true`)).rows[0].n
  const smsSent       = (await db.query(`SELECT COUNT(*) as n FROM leads WHERE sms_sent=true`)).rows[0].n
  const conversations = (await db.query(`SELECT COUNT(*) as n FROM leads WHERE status='conversation_active'`)).rows[0].n
  const paid          = (await db.query(`SELECT COUNT(*) as n FROM leads WHERE status='paid' OR subscription_active=true`)).rows[0].n

  // Recent replies (last 10)
  const { rows: replies } = await db.query(`
    SELECT l.name, l.phone, l.niche, l.city, le.detail->>'body' as message, le.created_at
    FROM lead_events le
    JOIN leads l ON l.id = le.lead_id
    WHERE le.event_type = 'sms_reply'
    ORDER BY le.created_at DESC
    LIMIT 10
  `)

  return NextResponse.json({
    email: {
      sent:    parseInt(emailSent),
      opened:  stats['email_opened']  ?? 0,
      clicked: stats['email_clicked'] ?? 0,
      bounced: stats['email_bounced'] ?? 0,
      open_rate: emailSent > 0
        ? ((stats['email_opened'] ?? 0) / parseInt(emailSent) * 100).toFixed(1) + '%'
        : '0%',
    },
    sms: {
      sent:        parseInt(smsSent),
      delivered:   stats['sms_delivered']   ?? 0,
      failed:      stats['sms_failed']      ?? 0,
      replies:     stats['sms_reply']       ?? 0,
      auto_replied: stats['sms_auto_reply'] ?? 0,
    },
    funnel: {
      conversations: parseInt(conversations),
      paid:          parseInt(paid),
    },
    recent_replies: replies,
  })
}
