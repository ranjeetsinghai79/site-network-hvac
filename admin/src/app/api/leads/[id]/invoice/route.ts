export const runtime = "edge"

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { PLAN_CATALOG, PLAN_KEYS, type PlanKey } from "@/lib/plans"

const STRIPE_KEY  = process.env.STRIPE_SECRET_KEY  ?? ""
const FROM_EMAIL  = process.env.OUTREACH_FROM_EMAIL ?? "hello@webcrew.app"
const RESEND_KEY  = process.env.RESEND_API_KEY      ?? ""

async function stripePost(path: string, params: URLSearchParams): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  })
  return res.json()
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  })
  return res.json()
}

// Get or create a Stripe customer for this lead
async function getOrCreateCustomer(lead: any): Promise<string> {
  // If we already have a stripe_customer_id, use it
  if (lead.stripe_customer_id) return lead.stripe_customer_id

  const p = new URLSearchParams()
  p.set("email",            lead.email)
  p.set("name",             lead.name ?? "")
  p.set("metadata[lead_id]", lead.id)
  if (lead.phone) p.set("phone", lead.phone)

  const customer = await stripePost("/customers", p)
  if (!customer.id) throw new Error(customer.error?.message ?? "Customer creation failed")

  const db = await getDb()
  await db.query(`UPDATE leads SET stripe_customer_id = $1 WHERE id = $2`, [customer.id, lead.id])

  return customer.id
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!STRIPE_KEY) return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 })

  const { id } = await params
  const body   = await req.json() as {
    amount_cents?:  number    // required for custom invoices
    description?:  string
    plan?:         string     // a PlanKey from admin/src/lib/plans.ts, or "custom"
    due_days?:     number     // days until due (default 7)
    note?:         string     // internal note
    send?:         boolean    // auto-send invoice (default true)
  }

  const db = await getDb()
  const { rows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [id])
  const lead = rows[0]
  if (!lead)       return NextResponse.json({ error: "Lead not found" },        { status: 404 })
  if (!lead.email) return NextResponse.json({ error: "Lead has no email" },     { status: 400 })

  const dueDays   = body.due_days ?? 7
  const autoSend  = body.send !== false
  const planKey   = body.plan ?? "custom"

  // Resolve amount + description from plan or custom
  let amountCents: number
  let description: string

  if (planKey !== "custom" && (PLAN_KEYS as string[]).includes(planKey)) {
    const plan = PLAN_CATALOG[planKey as PlanKey]
    if (!plan.available) return NextResponse.json({ error: `${plan.name} is not available yet` }, { status: 400 })
    amountCents = plan.price
    description = `WebCrew ${plan.name}${plan.billing === "one_time" ? " — one-time ownership" : " — monthly plan"}`
  } else {
    if (!body.amount_cents || body.amount_cents < 50) {
      return NextResponse.json({ error: "amount_cents required (min 50) for custom invoices" }, { status: 400 })
    }
    amountCents = body.amount_cents
    description = body.description ?? `WebCrew — Custom plan for ${lead.name}`
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateCustomer(lead)

  // Create invoice item
  const itemParams = new URLSearchParams()
  itemParams.set("customer",    customerId)
  itemParams.set("amount",      String(amountCents))
  itemParams.set("currency",    "usd")
  itemParams.set("description", description)
  if (body.note) itemParams.set("metadata[note]", body.note)
  itemParams.set("metadata[lead_id]", id)

  const item = await stripePost("/invoiceitems", itemParams)
  if (!item.id) return NextResponse.json({ error: item.error?.message ?? "Invoice item failed" }, { status: 502 })

  // Create invoice
  const invParams = new URLSearchParams()
  invParams.set("customer",          customerId)
  invParams.set("collection_method", "send_invoice")
  invParams.set("days_until_due",    String(dueDays))
  invParams.set("metadata[lead_id]", id)
  invParams.set("metadata[plan]",    planKey)
  invParams.set("auto_advance",      "false")  // we control finalize + send
  if (FROM_EMAIL) {
    invParams.set("custom_fields[0][name]",  "From")
    invParams.set("custom_fields[0][value]", "WebCrew Team")
  }

  const invoice = await stripePost("/invoices", invParams)
  if (!invoice.id) return NextResponse.json({ error: invoice.error?.message ?? "Invoice creation failed" }, { status: 502 })

  // Finalize invoice (makes it payable)
  const finalized = await stripePost(`/invoices/${invoice.id}/finalize`, new URLSearchParams())
  if (!finalized.id) return NextResponse.json({ error: "Invoice finalize failed" }, { status: 502 })

  // Auto-send if requested
  if (autoSend) {
    await stripePost(`/invoices/${invoice.id}/send`, new URLSearchParams())
  }

  // Get the hosted invoice URL
  const invoiceUrl  = finalized.hosted_invoice_url ?? ""
  const invoicePdf  = finalized.invoice_pdf ?? ""
  const invoiceNum  = finalized.number ?? ""

  // Persist to DB
  await db.query(
    `UPDATE leads SET stripe_payment_link = $1, status = 'payment_link_sent', updated_at = NOW() WHERE id = $2`,
    [invoiceUrl, id]
  )

  return NextResponse.json({
    ok:          true,
    invoiceId:   invoice.id,
    invoiceNum,
    invoiceUrl,
    invoicePdf,
    amountCents,
    customerId,
    sent:        autoSend,
  })
}

// GET: list invoices for a lead
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!STRIPE_KEY) return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 })

  const { id } = await params
  const db = await getDb()
  const { rows } = await db.query(`SELECT stripe_customer_id FROM leads WHERE id = $1`, [id])
  const lead = rows[0]
  if (!lead?.stripe_customer_id) return NextResponse.json({ invoices: [] })

  const data = await stripeGet(`/invoices?customer=${lead.stripe_customer_id}&limit=20`)
  const invoices = (data.data ?? []).map((inv: any) => ({
    id:          inv.id,
    number:      inv.number,
    status:      inv.status,
    amount:      inv.amount_due,
    currency:    inv.currency,
    created:     inv.created,
    due_date:    inv.due_date,
    invoice_url: inv.hosted_invoice_url,
    invoice_pdf: inv.invoice_pdf,
    description: inv.lines?.data?.[0]?.description ?? "",
  }))

  return NextResponse.json({ invoices })
}
