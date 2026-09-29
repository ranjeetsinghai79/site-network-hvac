"use client"

import { useState, useEffect, useRef } from "react"
import { Phone, Mail, Clock, Send, MapPin } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"

interface Props {
  config: SiteConfig
  label?: string
  heading?: React.ReactNode
  paragraph?: string
  submitText?: string
  /** Override service select options. Defaults to config.services titles. */
  serviceOptions?: string[]
  /** Replace standard hours block */
  hoursNode?: React.ReactNode
}

export function Contact({
  config,
  label = "Get In Touch",
  heading,
  paragraph,
  submitText = "Request Free Estimate",
  serviceOptions,
  hoursNode,
}: Props) {
  const business = config.business
  const services = config.services ?? []

  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const infoCards = leftRef.current?.querySelectorAll<HTMLElement>("a.glass-dark, div.glass-dark, .p-5")
    if (infoCards?.length) {
      const ic = gsap.from(infoCards, {
        opacity: 0, y: 35, scale: 0.96, stagger: 0.09, duration: 0.75, ease: "expo.out",
        scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
      })
      scope.add(ic)
      if (ic.scrollTrigger) scope.add(ic.scrollTrigger)
    }

    const l = gsap.from(leftRef.current, {
      opacity: 0, x: -60, duration: 1.0, ease: "expo.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true },
    })
    scope.add(l)
    if (l.scrollTrigger) scope.add(l.scrollTrigger)

    const r = gsap.from(rightRef.current, {
      opacity: 0, x: 60, duration: 1.0, ease: "expo.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true },
    })
    scope.add(r)
    if (r.scrollTrigger) scope.add(r.scrollTrigger)

    return () => scope.kill()
  }, [reduced])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.fname,
          lastName: data.lname,
          phone: data.phone,
          email: data.email,
          service: data.service,
          message: data.message,
        }),
      })
    } catch {
      /* best-effort */
    }
    setSent(true)
    setLoading(false)
  }

  const opts = serviceOptions ?? config.formServiceOptions ?? services.map((s) => s.title)

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="py-24 px-6"
      style={{ background: "var(--brand-bg)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="section-label">{label}</span>
          <h2
            className="font-display text-white mb-4"
            style={{
              fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              letterSpacing: "-0.02em",
            }}
          >
            {heading ?? (
              <>
                Get a{" "}
                <span style={{ color: "var(--brand-accent)" }}>Free Estimate</span>
              </>
            )}
          </h2>
          <p className="font-body text-white/55 max-w-xl mx-auto leading-relaxed mb-8">
            {paragraph ?? "Fill out the form and we'll call you back within 15 minutes during business hours."}
          </p>
          {/* Trust stats strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--brand-accent)" }}>⚡</span>
              <span className="font-body text-white/60 text-sm">15-min callback guarantee</span>
            </div>
            <div className="w-px h-4 bg-white/15 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--brand-accent)" }}>★</span>
              <span className="font-body text-white/60 text-sm">
                {business.google_rating} rated · {business.review_count}+ reviews
              </span>
            </div>
            <div className="w-px h-4 bg-white/15 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--brand-accent)" }}>✓</span>
              <span className="font-body text-white/60 text-sm">Free estimate, no obligation</span>
            </div>
          </div>
          <div className="brand-rule brand-rule-center mt-6" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div ref={leftRef}>
            <div className="space-y-4 mb-8">
              <a
                href={business.phoneHref}
                className="flex items-center gap-4 p-5 rounded-2xl glass-dark group"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "color-mix(in srgb, var(--brand-accent) 20%, transparent)", color: "var(--brand-accent)" }}
                >
                  <Phone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="font-body text-white/50 text-xs mb-0.5">Call or Text Anytime</div>
                  <div className="font-display text-white text-xl group-hover:text-[var(--brand-accent-light)] transition-colors" style={{ fontWeight: 700 }}>
                    {business.phone}
                  </div>
                </div>
              </a>

              <a
                href={`mailto:${business.email}`}
                className="flex items-center gap-4 p-5 rounded-2xl glass-dark"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)", color: "var(--brand-accent)" }}
                >
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-body text-white/50 text-xs mb-0.5">Email Us</div>
                  <div className="font-body text-white text-sm" style={{ fontWeight: 500 }}>{business.email}</div>
                </div>
              </a>

              {hoursNode !== undefined ? (
                hoursNode
              ) : (
                <div className="flex items-center gap-4 p-5 rounded-2xl glass-dark">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)", color: "var(--brand-accent)" }}
                  >
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-body text-white/50 text-xs mb-0.5">Hours</div>
                    <div className="font-body text-white text-sm" style={{ fontWeight: 500 }}>Mon–Fri: 7AM–8PM</div>
                    <div className="font-body text-white text-sm" style={{ fontWeight: 500 }}>Sat–Sun: 8AM–6PM</div>
                    {business.emergency && (
                      <div className="font-body text-xs mt-1" style={{ color: "var(--brand-accent)", fontWeight: 700 }}>
                        24/7 for emergencies
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-4 p-5 rounded-2xl glass-dark">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)", color: "var(--brand-accent)" }}
                >
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-body text-white/50 text-xs mb-0.5">Office</div>
                  <div className="font-body text-white text-sm" style={{ fontWeight: 500 }}>{business.address}</div>
                </div>
              </div>
            </div>

            {business.emergency && (
              <div
                className="p-5 rounded-2xl"
                style={{
                  background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--brand-accent) 25%, transparent)",
                }}
              >
                <div className="font-display text-white mb-1" style={{ fontWeight: 700 }}>Emergency? Don&apos;t fill a form.</div>
                <div className="font-body text-white/55 text-sm mb-3">Call directly for fastest response.</div>
                <a href={business.phoneHref} className="btn-primary">
                  <Phone className="w-4 h-4" />
                  {business.phone}
                </a>
              </div>
            )}
          </div>

          <div ref={rightRef}>
            {sent ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 px-8 rounded-2xl glass-dark">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                  style={{ background: "color-mix(in srgb, var(--brand-accent) 18%, transparent)" }}
                >
                  <Send className="w-8 h-8" style={{ color: "var(--brand-accent)" }} />
                </div>
                <h3 className="font-display text-white text-2xl mb-2" style={{ fontWeight: 700 }}>Got it!</h3>
                <p className="font-body text-white/65">We&apos;ll call you back within 15 minutes.</p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl glass-dark p-8 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormInput name="fname" label="First Name" placeholder="John" required />
                  <FormInput name="lname" label="Last Name" placeholder="Smith" required />
                </div>
                <FormInput name="phone" type="tel" label="Phone" placeholder="(555) 555-5555" required />
                <FormInput name="email" type="email" label="Email" placeholder="you@example.com" />
                <div>
                  <label
                    className="font-body text-xs uppercase tracking-wider mb-1.5 block"
                    style={{ color: "var(--brand-fg-muted)", fontWeight: 700 }}
                    htmlFor="service"
                  >
                    Service Needed
                  </label>
                  <select
                    id="service"
                    name="service"
                    required
                    className="w-full rounded-xl px-4 py-3 font-body text-sm text-white cursor-pointer outline-none transition-colors"
                    style={{
                      background: "var(--brand-input-bg)",
                      border: "1px solid var(--brand-input-border)",
                    }}
                  >
                    <option value="">Select a service...</option>
                    {opts.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label
                    className="font-body text-xs uppercase tracking-wider mb-1.5 block"
                    style={{ color: "var(--brand-fg-muted)", fontWeight: 700 }}
                    htmlFor="message"
                  >
                    Describe the Issue
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={3}
                    placeholder="Tell us what's happening..."
                    className="w-full rounded-xl px-4 py-3 font-body text-sm text-white placeholder-white/30 resize-none outline-none transition-colors"
                    style={{
                      background: "var(--brand-input-bg)",
                      border: "1px solid var(--brand-input-border)",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                  style={{ opacity: loading ? 0.6 : 1 }}
                >
                  <Send className="w-4 h-4" />
                  {loading ? "Sending..." : submitText}
                </button>
                <p className="font-body text-white/35 text-xs text-center">
                  Response in 15 min · No spam · No obligation
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function FormInput({
  name, label, placeholder, required, type = "text",
}: {
  name: string; label: string; placeholder?: string; required?: boolean; type?: string
}) {
  return (
    <div>
      <label
        className="font-body text-xs uppercase tracking-wider mb-1.5 block"
        style={{ color: "var(--brand-fg-muted)", fontWeight: 700 }}
        htmlFor={name}
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 font-body text-sm text-white placeholder-white/30 outline-none transition-colors"
        style={{
          background: "var(--brand-input-bg)",
          border: "1px solid var(--brand-input-border)",
        }}
      />
    </div>
  )
}
