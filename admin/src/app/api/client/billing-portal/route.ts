export const runtime = 'edge'
import { cookies } from 'next/headers'
import { getClientLead } from '@/lib/db'
import { requireClient } from "@/lib/client-auth"

const STRIPE_KEY = () => process.env.STRIPE_SECRET_KEY ?? ''

async function stripePost(path: string, params: URLSearchParams): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  return res.json()
}

export async function POST(req: Request): Promise<Response> {
  const email = await requireClient()
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = await getClientLead(email)
  if (!lead) return Response.json({ error: 'Not found' }, { status: 404 })

  if (!lead.stripe_customer_id) {
    return Response.json({ error: 'No billing account found' }, { status: 400 })
  }

  if (!STRIPE_KEY()) {
    return Response.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const origin = new URL(req.url).origin
  const returnUrl = `${origin}/client/dashboard`

  const p = new URLSearchParams()
  p.set('customer', lead.stripe_customer_id)
  p.set('return_url', returnUrl)

  const session = await stripePost('/billing_portal/sessions', p)

  if (!session?.url) {
    return Response.json({ error: 'Failed to create billing session' }, { status: 500 })
  }

  return Response.json({ url: session.url })
}
