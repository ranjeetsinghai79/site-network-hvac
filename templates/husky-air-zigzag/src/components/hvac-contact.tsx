"use client"

import { useRef, useState, useEffect } from "react"
import { gsap } from "@core/web"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const SERVICES = [
  { icon: "❄️", label: "AC Repair",    value: "AC Repair"        },
  { icon: "🔥", label: "Heating",      value: "Heating Repair"   },
  { icon: "🆕", label: "New Install",  value: "New Installation" },
  { icon: "🔧", label: "Tune-Up",      value: "Tune-Up"          },
  { icon: "⚡", label: "Emergency",    value: "Emergency"        },
  { icon: "💨", label: "Air Quality",  value: "Air Quality"      },
]

type Step = 1 | 2 | 3

export default function HvacContact({ config }: Props) {
  const { business } = config
  const DISPATCH_STATS = [
    { label: "Google Rating",   value: `${business.google_rating}★` },
    { label: "Google Reviews",  value: business.review_count },
    { label: "5-Star Reviews",  value: "156" },
    { label: "Availability",    value: "24/7" },
  ]
  const sectionRef = useRef<HTMLElement>(null)
  const leftRef    = useRef<HTMLDivElement>(null)
  const formRef    = useRef<HTMLDivElement>(null)

  const [step, setStep]     = useState<Step>(1)
  const [service, setService] = useState("")
  const [name, setName]     = useState("")
  const [phone, setPhone]   = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  useEffect(() => {
    if (!leftRef.current) return
    gsap.from(leftRef.current, {
      opacity: 0, x: -40, duration: 0.8, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true },
    })
    if (formRef.current) {
      gsap.from(formRef.current, {
        opacity: 0, x: 40, duration: 0.8, ease: "power3.out",
        immediateRender: false,
        scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true },
      })
    }
  }, [])

  const animateStep = () => {
    if (!formRef.current) return
    gsap.fromTo(formRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }
    )
  }

  const pickService = (val: string) => {
    setService(val)
    setStep(2)
    setTimeout(animateStep, 10)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !phone) return
    setStatus("sending")
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PIPELINE_API_URL ?? ""}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, service, source: "contact_form", niche: "hvac", city: business.city }),
      })
      setStatus(res.ok ? "sent" : "error")
      if (res.ok) setStep(3)
    } catch {
      setStatus("error")
    }
  }

  const inputCls: React.CSSProperties = {
    width: "100%",
    background: "rgba(11,14,26,0.05)",
    border: "1px solid rgba(11,14,26,0.12)",
    borderRadius: 10,
    padding: "14px 16px",
    color: "var(--brand-fg)",
    fontFamily: "var(--font-body)",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.2s",
    minHeight: 52,
  }

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="relative py-20 lg:py-32 pb-32 lg:pb-32"
      style={{ background: "var(--brand-bg-2)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(79,70,229,0.3), transparent)" }}
      />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-12 xl:px-16">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 xl:gap-20 items-start">

          {/* ── Left: info ── */}
          <div ref={leftRef}>
            <p className="section-label mb-3">Book Service</p>
            <h2
              className="font-display font-700 uppercase mb-5"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.8rem, 4.5vw, 3.5rem)",
                lineHeight: 0.95,
                color: "var(--brand-fg)",
                letterSpacing: "-0.02em",
              }}
            >
              Tell Us What<br />
              <span style={{ color: "var(--brand-accent)" }}>You Need.</span>
            </h2>

            <p className="mb-6"
              style={{ fontFamily: "var(--font-body)", fontSize: "1rem", lineHeight: 1.7, color: "var(--brand-fg-muted)", maxWidth: "44ch" }}
            >
              Takes 30 seconds. We call you back to confirm — no waiting on hold, no voicemail maze.
            </p>

            {/* Direct call — big on mobile */}
            <a
              href={business.phoneHref}
              className="flex items-center gap-4 px-5 py-4 rounded-xl mb-4 cursor-pointer hover-lift"
              style={{
                background: "rgba(79,70,229,0.08)",
                border: "1px solid rgba(79,70,229,0.25)",
                textDecoration: "none",
                minHeight: 64,
              }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(79,70,229,0.15)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.003 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.85 6.85l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.12em", color: "rgba(79,70,229,0.7)", textTransform: "uppercase" }}>
                  Emergency / Call Direct
                </p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, color: "var(--brand-fg)" }}>
                  {business.phone}
                </p>
              </div>
              <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(79,70,229,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>

            {/* Dispatch board */}
            <div className="rounded-xl overflow-hidden hidden sm:block"
              style={{ border: "1px solid rgba(11,14,26,0.07)", background: "var(--brand-bg-card)" }}
            >
              <div className="px-5 py-3 flex items-center gap-2"
                style={{ borderBottom: "1px solid rgba(11,14,26,0.06)", background: "rgba(0,0,0,0.2)" }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: "#22C55E", boxShadow: "0 0 8px #22C55E" }} />
                <span className="text-xs uppercase tracking-widest font-display font-600"
                  style={{ fontFamily: "var(--font-display)", color: "rgba(11,14,26,0.5)", letterSpacing: "0.2em" }}
                >
                  Dispatch — Live
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y" style={{ borderColor: "rgba(11,14,26,0.05)" }}>
                {DISPATCH_STATS.map(s => (
                  <div key={s.label} className="p-4">
                    <p className="font-display font-700 tabular-nums"
                      style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "var(--brand-accent)", lineHeight: 1 }}
                    >
                      {s.value}
                    </p>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "rgba(11,14,26,0.4)", marginTop: 4 }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Conversational form ── */}
          <div
            ref={formRef}
            className="rounded-2xl p-6 sm:p-8 lg:p-10"
            style={{ background: "var(--brand-bg-card)", border: "1px solid rgba(11,14,26,0.07)" }}
          >
            {/* Step 3 — Success */}
            {step === 3 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-5">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)" }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-display font-700 uppercase mb-2"
                    style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "var(--brand-fg)" }}
                  >
                    You're All Set, {name.split(" ")[0]}!
                  </h3>
                  <p style={{ fontFamily: "var(--font-body)", color: "var(--brand-fg-muted)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                    We'll call <strong style={{ color: "var(--brand-fg)" }}>{phone}</strong> shortly to confirm your {service} appointment.
                  </p>
                </div>
                <a href={business.phoneHref}
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3 mt-2"
                  style={{ fontSize: "0.9rem" }}
                >
                  Can't wait? Call us now
                </a>
              </div>
            ) : (
              <>
                {/* Progress dots */}
                <div className="flex items-center gap-2 mb-6">
                  {[1, 2].map(n => (
                    <div key={n} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-700"
                        style={{
                          background: step >= n ? "var(--brand-accent)" : "rgba(11,14,26,0.08)",
                          color: step >= n ? "#fff" : "rgba(11,14,26,0.3)",
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: "0.7rem",
                          transition: "all 0.3s",
                        }}
                      >
                        {step > n ? "✓" : n}
                      </div>
                      {n < 2 && (
                        <div className="h-px w-8"
                          style={{ background: step > n ? "var(--brand-accent)" : "rgba(11,14,26,0.1)", transition: "background 0.3s" }}
                        />
                      )}
                    </div>
                  ))}
                  <span className="ml-2 text-xs" style={{ color: "rgba(11,14,26,0.35)", fontFamily: "var(--font-body)" }}>
                    Step {step} of 2
                  </span>
                </div>

                {/* Step 1 — Pick service */}
                {step === 1 && (
                  <div>
                    <h3 className="font-display font-700 mb-2"
                      style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "var(--brand-fg)", letterSpacing: "-0.01em" }}
                    >
                      What do you need help with?
                    </h3>
                    <p className="mb-5" style={{ fontFamily: "var(--font-body)", fontSize: "0.88rem", color: "var(--brand-fg-muted)" }}>
                      Tap to select — takes 2 seconds.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {SERVICES.map(({ icon, label, value }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => pickService(value)}
                          className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer"
                          style={{
                            minHeight: 80,
                            padding: "14px 10px",
                            background: "rgba(11,14,26,0.04)",
                            border: "1px solid rgba(11,14,26,0.09)",
                            color: "var(--brand-fg)",
                            fontFamily: "var(--font-display)",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget
                            el.style.border = "1px solid rgba(79,70,229,0.5)"
                            el.style.background = "rgba(79,70,229,0.08)"
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget
                            el.style.border = "1px solid rgba(11,14,26,0.09)"
                            el.style.background = "rgba(11,14,26,0.04)"
                          }}
                        >
                          <span style={{ fontSize: "1.4rem" }}>{icon}</span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 2 — Name + Phone */}
                {step === 2 && (
                  <form onSubmit={handleSubmit}>
                    <div className="flex items-center gap-3 mb-5">
                      <button
                        type="button"
                        onClick={() => { setStep(1); setTimeout(animateStep, 10) }}
                        className="cursor-pointer"
                        style={{
                          background: "rgba(11,14,26,0.06)",
                          border: "1px solid rgba(11,14,26,0.1)",
                          borderRadius: 8,
                          padding: "6px 10px",
                          color: "rgba(11,14,26,0.5)",
                          fontSize: "0.75rem",
                          fontFamily: "var(--font-body)",
                          cursor: "pointer",
                        }}
                        aria-label="Go back"
                      >
                        ← Back
                      </button>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                        style={{ background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.2)" }}
                      >
                        <span style={{ fontSize: "0.95rem" }}>
                          {SERVICES.find(s => s.value === service)?.icon}
                        </span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 600, color: "#4F46E5" }}>
                          {service}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-display font-700 mb-1"
                      style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "var(--brand-fg)" }}
                    >
                      Almost done — where do we reach you?
                    </h3>
                    <p className="mb-5" style={{ fontFamily: "var(--font-body)", fontSize: "0.88rem", color: "var(--brand-fg-muted)" }}>
                      We'll call you back shortly.
                    </p>

                    <div className="flex flex-col gap-4 mb-5">
                      <div>
                        <label className="block mb-2"
                          style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(11,14,26,0.45)" }}
                        >
                          Your Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="First & Last Name"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          style={inputCls}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block mb-2"
                          style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(11,14,26,0.45)" }}
                        >
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="(555) 000-0000"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          style={inputCls}
                          inputMode="tel"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={status === "sending" || !name || !phone}
                      className="btn-primary w-full cursor-pointer"
                      style={{ minHeight: 52, fontSize: "1rem", opacity: (!name || !phone) ? 0.5 : 1 }}
                    >
                      {status === "sending"
                        ? "Sending…"
                        : "Request a Callback"}
                    </button>

                    {status === "error" && (
                      <p className="mt-3 text-center text-sm" style={{ color: "#F87171" }}>
                        Something went wrong. Please call {business.phone}.
                      </p>
                    )}

                    <p className="mt-4 text-center"
                      style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "rgba(11,14,26,0.28)" }}
                    >
                      By submitting you agree to receive a callback from {business.name}. No spam.
                    </p>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
