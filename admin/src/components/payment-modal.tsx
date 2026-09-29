"use client"

import { useState, useEffect } from "react"
import { X, CreditCard, Copy, Check, ExternalLink, Send, MessageSquare, Tag, Plus, Trash2, Link } from "lucide-react"
import type { Lead } from "@/lib/db"
import { PLAN_CATALOG, type PlanKey } from "@/lib/plans"

// Each property access below must stay a literal `process.env.NEXT_PUBLIC_*`
// expression — Next.js inlines these at build time via static string
// replacement, which only works on a direct literal access, not a computed
// one like `process.env[someVar]` (that would just be undefined in the
// browser bundle at runtime).
const QUICK_LINK_URLS: Record<PlanKey, string> = {
  website_only:      process.env.NEXT_PUBLIC_STRIPE_LINK_WEBSITE_ONLY ?? "",
  website_hosted:    process.env.NEXT_PUBLIC_STRIPE_LINK_WEBSITE_HOSTED ?? "",
  ai_front_office:   process.env.NEXT_PUBLIC_STRIPE_LINK_AI_FRONT_OFFICE ?? "",
  ai_reception_only: process.env.NEXT_PUBLIC_STRIPE_LINK_AI_RECEPTION_ONLY ?? "",
  everything:        process.env.NEXT_PUBLIC_STRIPE_LINK_EVERYTHING ?? "",
  marketing_only:    process.env.NEXT_PUBLIC_STRIPE_LINK_MARKETING_ONLY ?? "",
}
const QUICK_LINK_COLOR: Record<PlanKey, string> = {
  website_only: "#10b981", website_hosted: "#6366f1", ai_front_office: "#8b5cf6",
  ai_reception_only: "#f59e0b", everything: "#ec4899", marketing_only: "#ec4899",
}

// ── Permanent payment links (buy.stripe.com) — live plans only ───────────────
const QUICK_LINKS = (Object.entries(PLAN_CATALOG) as [PlanKey, typeof PLAN_CATALOG[PlanKey]][])
  .filter(([, plan]) => plan.available)
  .map(([key, plan]) => ({
    key,
    label:    `${plan.name} — $${plan.price / 100}${plan.billing === "subscription" ? "/mo" : ""}`,
    sublabel: plan.desc,
    amount:   `$${plan.price / 100}${plan.billing === "subscription" ? "/mo" : ""}`,
    color:    QUICK_LINK_COLOR[key],
    url:      QUICK_LINK_URLS[key],
  }))

const PRESETS = [
  ...(Object.entries(PLAN_CATALOG) as [PlanKey, typeof PLAN_CATALOG[PlanKey]][])
    .filter(([, plan]) => plan.available)
    .map(([key, plan]) => ({
      key, label: plan.name, amount: plan.price / 100,
      interval: plan.billing === "one_time" ? "one-time" : "monthly",
      desc: plan.desc,
    })),
  { key: "custom", label: "Custom", amount: 0, interval: "one-time", desc: "Set your own price for this client" },
]

type Tab = "quick" | "session" | "promos"

interface PromoCode {
  id: string; code: string; active: boolean
  percent_off: number | null; amount_off: number | null
  max_redemptions: number | null; times_redeemed: number; expires_at: number | null
}

interface Props {
  lead: Lead
  onClose: () => void
  onSuccess: (url: string, status: string) => void
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }
  return { copied, copy }
}

const s = {
  label:  { display: "block", color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 600 },
  input:  { width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  btn:    (active = false, color = "#6366f1") => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: active ? `${color}33` : "#1e293b",
    border:     `1px solid ${active ? color + "66" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 9, padding: "9px 14px", color: active ? "#fff" : "rgba(255,255,255,0.7)",
    fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const,
  }),
  pill: (color: string) => ({
    display: "inline-block", background: `${color}22`, border: `1px solid ${color}44`,
    borderRadius: 6, padding: "2px 8px", color, fontSize: 11, fontWeight: 700,
  }),
}

export function PaymentModal({ lead, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<Tab>("quick")

  // ── Quick Links state ─────────────────────────────────────────────────────
  const { copied, copy } = useCopy()
  const [qlStatus, setQlStatus] = useState<Record<string, { email?: boolean; sms?: boolean; sending?: string }>>({})
  const [customUrl, setCustomUrl] = useState("")
  const [customUrlSent, setCustomUrlSent] = useState<{ email?: boolean; sms?: boolean }>({})

  // ── Session generator state ───────────────────────────────────────────────
  const [selected,   setSelected]   = useState("ai_front_office")
  const [customAmt,  setCustomAmt]  = useState("")
  const [customDesc, setCustomDesc] = useState("")
  const [interval,   setInterval]   = useState<"one-time" | "monthly">("one-time")
  const [note,       setNote]       = useState("")
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<{ url: string } | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [sessionSent, setSessionSent] = useState<{ email?: boolean; sms?: boolean }>({})
  const [sessionSending, setSessionSending] = useState<string | null>(null)

  // ── Promo codes state ─────────────────────────────────────────────────────
  const [promos,       setPromos]       = useState<PromoCode[]>([])
  const [promosLoading, setPromosLoading] = useState(false)
  const [newCode,      setNewCode]      = useState("")
  const [newPct,       setNewPct]       = useState("")
  const [newAmt,       setNewAmt]       = useState("")
  const [newMax,       setNewMax]       = useState("")
  const [newDays,      setNewDays]      = useState("")
  const [newPlan,      setNewPlan]      = useState("")
  const [promoType,    setPromoType]    = useState<"percent" | "amount">("percent")
  const [promoError,   setPromoError]   = useState<string | null>(null)
  const [promoCreating, setPromoCreating] = useState(false)

  const preset    = PRESETS.find(p => p.key === selected)!
  const isCustom  = selected === "custom"
  const finalAmt  = isCustom ? parseFloat(customAmt || "0") : preset.amount
  const finalMode = isCustom ? interval : preset.interval as "one-time" | "monthly"

  // ── Send helpers ──────────────────────────────────────────────────────────
  async function sendEmail(url: string, planKey: string, stateKey: string, note?: string) {
    const setState = stateKey === "session"
      ? (v: any) => setSessionSent(p => ({ ...p, email: true }))
      : stateKey === "custom"
      ? (v: any) => setCustomUrlSent(p => ({ ...p, email: true }))
      : (v: any) => setQlStatus(p => ({ ...p, [stateKey]: { ...p[stateKey], email: true } }))

    if (stateKey === "session") setSessionSending("email")
    else setQlStatus(p => ({ ...p, [stateKey]: { ...p[stateKey], sending: "email" } }))

    await fetch(`/api/leads/${lead.id}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan:         planKey,
        checkout_url: url,
        send_email:   true,
        note:         note || "",
        ...(planKey === "custom" ? {
          custom_amount:      Math.round(finalAmt * 100),
          custom_description: customDesc,
          custom_interval:    finalMode,
        } : {}),
      }),
    })

    setState(true)
    if (stateKey === "session") setSessionSending(null)
    else setQlStatus(p => ({ ...p, [stateKey]: { ...p[stateKey], sending: undefined } }))
    onSuccess(url, "payment_link_sent")
  }

  async function sendSms(url: string, stateKey: string) {
    const message = `Hi! Here's your WebCrew payment link:\n${url}\n\nReply STOP to opt out.`

    if (stateKey === "session") setSessionSending("sms")
    else setQlStatus(p => ({ ...p, [stateKey]: { ...p[stateKey], sending: "sms" } }))

    const res = await fetch(`/api/leads/${lead.id}/sms`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message }),
    })

    if (stateKey === "session") {
      setSessionSent(p => ({ ...p, sms: res.ok }))
      setSessionSending(null)
    } else if (stateKey === "custom") {
      setCustomUrlSent(p => ({ ...p, sms: res.ok }))
    } else {
      setQlStatus(p => ({ ...p, [stateKey]: { ...p[stateKey], sms: res.ok, sending: undefined } }))
    }
  }

  // ── Session generation ────────────────────────────────────────────────────
  async function generate() {
    if (finalAmt <= 0) { setError("Enter a valid amount"); return }
    setError(null); setLoading(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/checkout`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          plan:               isCustom ? "custom" : selected,
          custom_amount:      isCustom ? Math.round(finalAmt * 100) : undefined,
          custom_description: isCustom ? (customDesc || `WebCrew — Custom plan for ${lead.name}`) : undefined,
          custom_interval:    isCustom ? finalMode : undefined,
          note,
          send_email: false,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error); return }
      setResult({ url: d.checkoutUrl })
      onSuccess(d.checkoutUrl, "payment_link_sent")
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Promo code CRUD ───────────────────────────────────────────────────────
  async function loadPromos() {
    setPromosLoading(true)
    const res = await fetch("/api/stripe/promos").catch(() => null)
    if (res?.ok) {
      const d = await res.json()
      setPromos(d.codes ?? [])
    }
    setPromosLoading(false)
  }

  async function createPromo() {
    if (!newCode.trim()) { setPromoError("Code name required"); return }
    if (promoType === "percent" && (!newPct || parseFloat(newPct) <= 0 || parseFloat(newPct) > 100)) {
      setPromoError("Enter 1–100 for percent off"); return
    }
    if (promoType === "amount" && (!newAmt || parseFloat(newAmt) <= 0)) {
      setPromoError("Enter dollar amount off"); return
    }
    setPromoError(null); setPromoCreating(true)
    try {
      const res = await fetch("/api/stripe/promos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          code:               newCode.trim().toUpperCase(),
          percent_off:        promoType === "percent" ? parseFloat(newPct) : undefined,
          amount_off:         promoType === "amount"  ? Math.round(parseFloat(newAmt) * 100) : undefined,
          max_redemptions:    newMax  ? parseInt(newMax)  : undefined,
          expires_days:       newDays ? parseInt(newDays) : undefined,
          applies_to_plan:    newPlan || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setPromoError(d.error); return }
      setNewCode(""); setNewPct(""); setNewAmt(""); setNewMax(""); setNewDays(""); setNewPlan("")
      await loadPromos()
    } catch (e: any) { setPromoError(e.message) }
    finally { setPromoCreating(false) }
  }

  async function deletePromo(promoId: string) {
    await fetch("/api/stripe/promos", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ promo_id: promoId }),
    })
    setPromos(p => p.filter(x => x.id !== promoId))
  }

  useEffect(() => { if (tab === "promos") loadPromos() }, [tab])

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <CreditCard size={15} style={{ color: "#10b981" }} />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Send Payment Link</span>
            </div>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
              {lead.name} · {lead.email ?? "no email"} · {lead.phone ?? "no phone"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 4 }}>
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          {([
            { key: "quick",   icon: <Link size={13} />,    label: "Quick Links" },
            { key: "session", icon: <CreditCard size={13} />, label: "Custom Session" },
            { key: "promos",  icon: <Tag size={13} />,     label: "Promo Codes" },
          ] as { key: Tab; icon: React.ReactNode; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: "none", border: "none", borderBottom: tab === t.key ? "2px solid #6366f1" : "2px solid transparent",
                padding: "12px 8px", color: tab === t.key ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 22px" }}>

          {/* ── TAB: Quick Links ──────────────────────────────────────────── */}
          {tab === "quick" && (
            <div>
              <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 1.5 }}>
                Permanent links — never expire. Copy, email, or SMS directly to client.
              </p>

              {QUICK_LINKS.map(ql => {
                const st = qlStatus[ql.key] ?? {}
                const hasUrl = !!ql.url
                return (
                  <div key={ql.key} style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{ql.label}</span>
                        <span style={{ marginLeft: 8, ...s.pill(ql.color) }}>{ql.amount}</span>
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{ql.sublabel}</span>
                    </div>
                    {!hasUrl ? (
                      <p style={{ margin: 0, color: "#f87171", fontSize: 11 }}>
                        NEXT_PUBLIC_STRIPE_LINK_{ql.key.toUpperCase()} not set in env
                      </p>
                    ) : (
                      <div style={{ display: "flex", gap: 7 }}>
                        <button onClick={() => copy(ql.url, ql.key)} style={s.btn(copied === ql.key, "#10b981")}>
                          {copied === ql.key ? <Check size={13} /> : <Copy size={13} />}
                          {copied === ql.key ? "Copied" : "Copy"}
                        </button>
                        <a href={ql.url} target="_blank" rel="noopener noreferrer" style={{ ...s.btn(), textDecoration: "none" }}>
                          <ExternalLink size={13} /> Open
                        </a>
                        {lead.email && (
                          <button
                            onClick={() => !st.email && sendEmail(ql.url, ql.key, ql.key)}
                            disabled={st.email || st.sending === "email"}
                            style={s.btn(!!st.email, "#6366f1")}
                          >
                            {st.email ? <Check size={13} /> : <Send size={13} />}
                            {st.email ? "Emailed" : st.sending === "email" ? "…" : "Email"}
                          </button>
                        )}
                        {lead.phone && (
                          <button
                            onClick={() => !st.sms && sendSms(ql.url, ql.key)}
                            disabled={st.sms || st.sending === "sms"}
                            style={s.btn(!!st.sms, "#8b5cf6")}
                          >
                            {st.sms ? <Check size={13} /> : <MessageSquare size={13} />}
                            {st.sms ? "Sent" : st.sending === "sms" ? "…" : "SMS"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Custom URL paste */}
              <div style={{ marginTop: 20, padding: "16px", background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
                <p style={{ ...s.label, marginBottom: 8 }}>Paste any custom link</p>
                <input
                  type="url"
                  placeholder="https://buy.stripe.com/..."
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  style={{ ...s.input, marginBottom: 10 }}
                />
                {customUrl && (
                  <div style={{ display: "flex", gap: 7 }}>
                    <button onClick={() => copy(customUrl, "custom")} style={s.btn(copied === "custom")}>
                      {copied === "custom" ? <Check size={13} /> : <Copy size={13} />}
                      {copied === "custom" ? "Copied" : "Copy"}
                    </button>
                    {lead.email && (
                      <button
                        onClick={() => !customUrlSent.email && sendEmail(customUrl, "custom", "custom")}
                        disabled={customUrlSent.email}
                        style={s.btn(!!customUrlSent.email, "#6366f1")}
                      >
                        {customUrlSent.email ? <Check size={13} /> : <Send size={13} />}
                        {customUrlSent.email ? "Emailed" : "Email"}
                      </button>
                    )}
                    {lead.phone && (
                      <button
                        onClick={() => !customUrlSent.sms && sendSms(customUrl, "custom")}
                        disabled={customUrlSent.sms}
                        style={s.btn(!!customUrlSent.sms, "#8b5cf6")}
                      >
                        {customUrlSent.sms ? <Check size={13} /> : <MessageSquare size={13} />}
                        {customUrlSent.sms ? "Sent" : "SMS"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Custom Session ───────────────────────────────────────── */}
          {tab === "session" && (
            <div>
              <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                Generates a Stripe Checkout Session (expires 24h). Use Quick Links for permanent links.
              </p>

              {/* Plan picker */}
              <p style={{ ...s.label, marginBottom: 8 }}>Plan</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                {PRESETS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => { setSelected(p.key); if (p.key !== "custom") setInterval(p.interval as any) }}
                    style={{ background: selected === p.key ? "rgba(99,102,241,0.2)" : "#1e293b", border: `1px solid ${selected === p.key ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "11px 13px", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{p.label}</span>
                      {p.key !== "custom" ? (
                        <span style={{ color: "#10b981", fontSize: 13, fontWeight: 800 }}>${p.amount}{p.interval === "monthly" ? "/mo" : ""}</span>
                      ) : (
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>free-form</span>
                      )}
                    </div>
                    <p style={{ margin: "3px 0 0", color: "rgba(255,255,255,0.4)", fontSize: 11, lineHeight: 1.4 }}>
                      {p.key === "custom" ? "Any price, one-time or monthly" : p.desc}
                    </p>
                  </button>
                ))}
              </div>

              {isCustom && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={s.label}>Amount (USD)</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 700 }}>$</span>
                        <input type="number" min="1" placeholder="299" value={customAmt} onChange={e => setCustomAmt(e.target.value)}
                          style={{ ...s.input, paddingLeft: 24 }} />
                      </div>
                    </div>
                    <div>
                      <label style={s.label}>Billing</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["one-time", "monthly"] as const).map(v => (
                          <button key={v} onClick={() => setInterval(v)}
                            style={{ flex: 1, background: interval === v ? "rgba(99,102,241,0.25)" : "#1e293b", border: `1px solid ${interval === v ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: interval === v ? "#a5b4fc" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, padding: "9px 4px", cursor: "pointer" }}>
                            {v === "one-time" ? "One-time" : "Monthly"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Description (shown on checkout)</label>
                    <input type="text" placeholder={`WebCrew — Custom plan for ${lead.name}`} value={customDesc} onChange={e => setCustomDesc(e.target.value)} style={s.input} />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={s.label}>Note to client <span style={{ textTransform: "none", opacity: 0.6 }}>(optional — in email subject)</span></label>
                <input type="text" placeholder='e.g. "Special rate as discussed"' value={note} onChange={e => setNote(e.target.value)} style={s.input} />
              </div>

              {finalAmt > 0 && (
                <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "11px 15px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{isCustom ? (customDesc || "Custom plan") : preset.desc}</span>
                  <span style={{ color: "#10b981", fontWeight: 800, fontSize: 17 }}>${finalAmt}{finalMode === "monthly" ? "/mo" : ""}</span>
                </div>
              )}

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#fca5a5", fontSize: 13 }}>{error}</div>
              )}

              {result ? (
                <div>
                  <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, padding: "12px 15px", marginBottom: 10 }}>
                    <p style={{ margin: "0 0 6px", color: "#6ee7b7", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>✓ Link ready (expires 24h)</p>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: 11, wordBreak: "break-all", fontFamily: "monospace" }}>{result.url}</p>
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button onClick={() => copy(result.url, "session")} style={s.btn(copied === "session", "#10b981")}>
                      {copied === "session" ? <Check size={13} /> : <Copy size={13} />}
                      {copied === "session" ? "Copied" : "Copy"}
                    </button>
                    <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ ...s.btn(), textDecoration: "none" }}>
                      <ExternalLink size={13} /> Preview
                    </a>
                    {lead.email && (
                      <button
                        onClick={() => !sessionSent.email && sendEmail(result.url, isCustom ? "custom" : selected, "session", note)}
                        disabled={!!sessionSent.email || sessionSending === "email"}
                        style={s.btn(!!sessionSent.email, "#6366f1")}
                      >
                        {sessionSent.email ? <Check size={13} /> : <Send size={13} />}
                        {sessionSent.email ? "Emailed" : sessionSending === "email" ? "…" : "Email"}
                      </button>
                    )}
                    {lead.phone && (
                      <button
                        onClick={() => !sessionSent.sms && sendSms(result.url, "session")}
                        disabled={!!sessionSent.sms || sessionSending === "sms"}
                        style={s.btn(!!sessionSent.sms, "#8b5cf6")}
                      >
                        {sessionSent.sms ? <Check size={13} /> : <MessageSquare size={13} />}
                        {sessionSent.sms ? "Sent" : sessionSending === "sms" ? "…" : "SMS"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={generate}
                  disabled={loading || finalAmt <= 0}
                  style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#4f46e5)", border: "none", borderRadius: 10, padding: "13px 20px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading || finalAmt <= 0 ? "not-allowed" : "pointer", opacity: loading || finalAmt <= 0 ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <CreditCard size={15} />
                  {loading ? "Generating…" : `Generate $${finalAmt > 0 ? finalAmt : "—"}${finalMode === "monthly" ? "/mo" : ""} Link`}
                </button>
              )}
            </div>
          )}

          {/* ── TAB: Promo Codes ──────────────────────────────────────────── */}
          {tab === "promos" && (
            <div>
              <p style={{ margin: "0 0 16px", color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 1.5 }}>
                Codes are created server-side via Stripe. Only you (admin) can create them. Clients enter the code at checkout — Stripe validates and applies the discount.
              </p>

              {/* Create form */}
              <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px", marginBottom: 20 }}>
                <p style={{ ...s.label, marginBottom: 12, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Create New Code</p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={s.label}>Code</label>
                    <input type="text" placeholder="WELCOME50" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} style={s.input} />
                  </div>
                  <div>
                    <label style={s.label}>Discount type</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["percent", "amount"] as const).map(v => (
                        <button key={v} onClick={() => setPromoType(v)}
                          style={{ flex: 1, background: promoType === v ? "rgba(99,102,241,0.25)" : "#0f172a", border: `1px solid ${promoType === v ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, color: promoType === v ? "#a5b4fc" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, padding: "9px 4px", cursor: "pointer" }}>
                          {v === "percent" ? "% Off" : "$ Off"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={s.label}>{promoType === "percent" ? "% Off" : "$ Off"}</label>
                    {promoType === "percent" ? (
                      <input type="number" min="1" max="100" placeholder="20" value={newPct} onChange={e => setNewPct(e.target.value)} style={s.input} />
                    ) : (
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>$</span>
                        <input type="number" min="1" placeholder="50" value={newAmt} onChange={e => setNewAmt(e.target.value)} style={{ ...s.input, paddingLeft: 22 }} />
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={s.label}>Max uses</label>
                    <input type="number" min="1" placeholder="∞" value={newMax} onChange={e => setNewMax(e.target.value)} style={s.input} />
                  </div>
                  <div>
                    <label style={s.label}>Expires (days)</label>
                    <input type="number" min="1" placeholder="∞" value={newDays} onChange={e => setNewDays(e.target.value)} style={s.input} />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={s.label}>Restrict to plan <span style={{ textTransform: "none", opacity: 0.6 }}>(optional)</span></label>
                  <select value={newPlan} onChange={e => setNewPlan(e.target.value)}
                    style={{ ...s.input, appearance: "none" as any }}>
                    <option value="">Any plan</option>
                    {(Object.values(PLAN_CATALOG) as (typeof PLAN_CATALOG)[PlanKey][]).filter(p => p.available).map(p => (
                      <option key={p.key} value={p.key}>{p.name} (${p.price / 100}{p.billing === "subscription" ? "/mo" : ""})</option>
                    ))}
                  </select>
                </div>

                {promoError && (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, color: "#fca5a5", fontSize: 12 }}>{promoError}</div>
                )}

                <button
                  onClick={createPromo}
                  disabled={promoCreating || !newCode}
                  style={{ width: "100%", background: promoCreating || !newCode ? "#1e293b" : "linear-gradient(135deg,#6366f1,#4f46e5)", border: "none", borderRadius: 9, padding: "11px", color: promoCreating || !newCode ? "rgba(255,255,255,0.3)" : "#fff", fontSize: 13, fontWeight: 700, cursor: promoCreating || !newCode ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Plus size={14} /> {promoCreating ? "Creating…" : "Create Promo Code"}
                </button>
              </div>

              {/* Active codes list */}
              <p style={{ ...s.label, marginBottom: 10 }}>Active Codes</p>
              {promosLoading ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Loading…</p>
              ) : promos.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No active promo codes yet.</p>
              ) : promos.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "11px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, fontFamily: "monospace" }}>{p.code}</span>
                    <span style={s.pill("#10b981")}>
                      {p.percent_off ? `${p.percent_off}% off` : `$${((p.amount_off ?? 0) / 100).toFixed(0)} off`}
                    </span>
                    {p.max_redemptions && (
                      <span style={s.pill("rgba(255,255,255,0.4)")}>
                        {p.times_redeemed}/{p.max_redemptions} used
                      </span>
                    )}
                    {p.expires_at && (
                      <span style={s.pill("#f59e0b")}>
                        exp {new Date(p.expires_at * 1000).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => copy(p.code, `promo-${p.id}`)} style={{ ...s.btn(copied === `promo-${p.id}`), padding: "6px 10px" }}>
                      {copied === `promo-${p.id}` ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <button onClick={() => deletePromo(p.id)} style={{ ...s.btn(false, "#ef4444"), padding: "6px 10px", color: "#fca5a5" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
