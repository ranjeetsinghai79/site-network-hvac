// What a client signed up for and whether each service is actually working, derived from real data (never hard-coded
// "on"). Pure functions so the rules are testable; the page only renders what these return.
import { PLAN_CATALOG, type PlanKey } from "@/lib/plans"
import type { Portal } from "@/lib/client-portal"

export type ServiceState = "on" | "setup" | "partial" | "paused"
export interface Service {
  key: string
  title: string
  blurb: string
  state: ServiceState
  label: string                       // the status chip text
  detail: string                      // one line saying exactly what is happening for THIS client
  action?: { label: string; href: string }
}
export interface Upcoming { title: string; blurb: string }
export interface PlanSummary { name: string; price: string; state: "active" | "inactive"; label: string; note: string }

const phone = (n: string | null | undefined) => (n ? n.replace(/^\+?1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "")

export function planSummary(p: Pick<Portal, "lead">): PlanSummary {
  const key = (p.lead.subscription_plan ?? p.lead.client_plan ?? "") as PlanKey
  const def = PLAN_CATALOG[key]
  const active = !!p.lead.subscription_active || !!p.lead.paid
  return {
    name: def?.name ?? "Your plan",
    price: def ? `$${Math.round(def.price / 100)}${def.billing === "subscription" ? " a month" : " one time"}` : "",
    state: active ? "active" : "inactive",
    label: active ? "Active" : "Not started",
    note: def?.desc ?? "",
  }
}

export function buildServices(p: Pick<Portal, "reception" | "hasCalls" | "hasSite" | "siteUrl">, opts: { smsReady: boolean }): { services: Service[]; upcoming: Upcoming[] } {
  const r = p.reception
  const services: Service[] = []

  if (r) {
    // 1. Phone reception
    let reception: Service
    if (!r.active) {
      reception = { key: "reception", title: "AI phone reception", blurb: "Answers every call, takes messages, sends emergencies to you.", state: "paused", label: "Paused", detail: "Your receptionist is switched off. Contact us to turn it back on.", action: { label: "Contact us", href: "/client/support" } }
    } else if (!r.twilioPhone) {
      reception = { key: "reception", title: "AI phone reception", blurb: "Answers every call, takes messages, sends emergencies to you.", state: "setup", label: "Being set up", detail: "We are getting your number ready. You will get an email as soon as it is live." }
    } else if (!p.hasCalls) {
      reception = { key: "reception", title: "AI phone reception", blurb: "Answers every call, takes messages, sends emergencies to you.", state: "setup", label: "Ready for calls", detail: `Your AI number is ${phone(r.twilioPhone)}. Forward your business phone to it and the first call will switch this to On.`, action: { label: "See forwarding steps", href: "/client/receptionist" } }
    } else {
      reception = { key: "reception", title: "AI phone reception", blurb: "Answers every call, takes messages, sends emergencies to you.", state: "on", label: "On", detail: `Answering calls 24/7 on ${phone(r.twilioPhone)}.` }
    }
    services.push(reception)

    // 2. Booking
    services.push(r.hasCalendar
      ? { key: "booking", title: "Appointment booking", blurb: "Books, moves and cancels appointments on your calendar while callers are on the phone.", state: "on", label: "On", detail: `Booking on your ${r.calendarProvider === "google" ? "Google Calendar" : "calendar"}${r.googleEmail ? ` (${r.googleEmail})` : ""}.` }
      : { key: "booking", title: "Appointment booking", blurb: "Books, moves and cancels appointments on your calendar while callers are on the phone.", state: "setup", label: "Needs setup", detail: "Connect your calendar so the AI can book for you. Until then it takes a message instead.", action: { label: "Connect calendar", href: "/client/receptionist" } })

    // 3. Follow-ups (reminders exist only for bookings)
    if (!r.hasCalendar) {
      services.push({ key: "followups", title: "Reminders and follow-ups", blurb: "Reminds customers before a visit and nudges you about leads nobody has called back.", state: "setup", label: "Starts with booking", detail: "Turns on automatically once your calendar is connected." })
    } else if (opts.smsReady) {
      services.push({ key: "followups", title: "Reminders and follow-ups", blurb: "Reminds customers before a visit and nudges you about leads nobody has called back.", state: "on", label: "On", detail: "Customers get a text or email reminder. You are alerted if a lead is not called back within 2 hours." })
    } else {
      services.push({ key: "followups", title: "Reminders and follow-ups", blurb: "Reminds customers before a visit and nudges you about leads nobody has called back.", state: "partial", label: "Partly on", detail: "Reminders go out by email. Text messages switch on once our carrier registration is approved." })
    }

    // 4. Website assistant (embeddable widget) — ready as soon as reception exists, since it's the same AI/tools.
    services.push({
      key: "widget", title: "Website assistant", blurb: "A talking AI you can add to your own website with one script tag — no rebuild needed.",
      state: "on", label: "Ready to add", detail: "Get the embed code and paste it into your site whenever you're ready.",
      action: { label: "Get embed code", href: "/client/website-assistant" },
    })
  }

  // 5. Website (only when the plan includes one)
  if (p.hasSite) {
    services.push({ key: "website", title: "Your website", blurb: "The site customers see, kept online for you.", state: "on", label: "Live", detail: p.siteUrl ?? "", action: { label: "Open website", href: "/client/website" } })
  }

  const upcoming: Upcoming[] = [
    { title: "Review requests", blurb: "After a visit, customers get a message with your Google review link, so happy customers leave reviews." },
  ]
  return { services, upcoming }
}
