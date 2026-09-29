"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "@core/web"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

function FaqItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bodyRef.current) return
    if (open) {
      gsap.fromTo(bodyRef.current,
        { height: 0, opacity: 0 },
        { height: "auto", opacity: 1, duration: 0.35, ease: "power2.out" }
      )
    } else {
      gsap.to(bodyRef.current, { height: 0, opacity: 0, duration: 0.28, ease: "power2.in" })
    }
  }, [open])

  return (
    <div
      className="border-b"
      style={{ borderColor: "rgba(11,14,26,0.06)" }}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-5 text-left cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex items-center gap-4">
          <span
            className="font-display font-700 tabular-nums shrink-0"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              color: "var(--brand-accent)",
            }}
          >
            {String(idx + 1).padStart(2, "0")}
          </span>
          <span
            className="font-display font-600"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
              color: "var(--brand-fg)",
              letterSpacing: "-0.005em",
            }}
          >
            {q}
          </span>
        </div>
        <div
          className="shrink-0 ml-4 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: open ? "rgba(79,70,229,0.15)" : "rgba(11,14,26,0.05)",
            border: `1px solid ${open ? "rgba(79,70,229,0.35)" : "rgba(11,14,26,0.08)"}`,
            transition: "all 0.25s ease",
          }}
        >
          <svg
            width="12" height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={open ? "var(--brand-accent)" : "rgba(11,14,26,0.5)"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? "rotate(45deg)" : "none", transition: "transform 0.25s ease" }}
          >
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
      </button>
      <div ref={bodyRef} style={{ overflow: "hidden", height: 0, opacity: 0 }}>
        <p
          className="pb-5 pl-10"
          style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", lineHeight: 1.75, color: "var(--brand-fg-muted)" }}
        >
          {a}
        </p>
      </div>
    </div>
  )
}

export default function HvacFaq({ config }: Props) {
  const faq        = config.faq ?? []
  const sectionRef = useRef<HTMLElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const areas      = config.business.serviceAreas ?? []

  useEffect(() => {
    if (!headRef.current) return
    gsap.from(headRef.current, {
      opacity: 0, y: 30, duration: 0.7, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: headRef.current, start: "top 85%", once: true },
    })
    const items = sectionRef.current?.querySelectorAll<HTMLElement>(".faq-row")
    if (items) {
      gsap.from(items, {
        opacity: 0, y: 20, stagger: 0.05, duration: 0.5, ease: "power2.out",
        immediateRender: false,
        scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
      })
    }
  }, [])

  const half = Math.ceil(faq.length / 2)
  const col1 = faq.slice(0, half)
  const col2 = faq.slice(half)

  return (
    <section
      ref={sectionRef}
      id="faq"
      className="relative py-24 lg:py-32"
      style={{ background: "var(--brand-bg)" }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,107,74,0.15), transparent)" }}
      />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16">
        {/* Heading + service areas */}
        <div ref={headRef} className="mb-14 grid lg:grid-cols-[1fr_auto] gap-10 items-start">
          <div>
            <p className="section-label mb-3">FAQ</p>
            <h2
              className="font-display font-700 uppercase"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 5vw, 4rem)",
                lineHeight: 0.95,
                color: "var(--brand-fg)",
                letterSpacing: "-0.02em",
              }}
            >
              Questions?
              <br />
              <span style={{ color: "var(--brand-accent)" }}>We've Got Answers.</span>
            </h2>
          </div>

          {/* Service areas */}
          <div
            className="rounded-xl p-6 shrink-0"
            style={{
              background: "var(--brand-bg-card)",
              border: "1px solid rgba(11,14,26,0.07)",
              minWidth: 280,
            }}
          >
            <p
              className="section-label mb-4"
              style={{ color: "rgba(11,14,26,0.4)" }}
            >
              Service Areas
            </p>
            <div className="flex flex-wrap gap-2">
              {areas.map(area => (
                <span key={area} className="area-pill px-3.5 py-1.5 text-xs font-body font-500"
                  style={{ color: "rgba(11,14,26,0.7)", fontSize: "0.82rem" }}
                >
                  {area}
                </span>
              ))}
            </div>
            <div
              className="mt-5 pt-4"
              style={{ borderTop: "1px solid rgba(11,14,26,0.06)" }}
            >
              <p
                style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "rgba(11,14,26,0.35)" }}
              >
                Not sure if we cover your area? Call us — if we can't help, we'll refer someone who can.
              </p>
            </div>
          </div>
        </div>

        {/* Two-column FAQ */}
        <div className="grid lg:grid-cols-2 gap-x-12">
          <div>
            {col1.map((item, i) => (
              <div key={i} className="faq-row">
                <FaqItem q={item.q} a={item.a} idx={i} />
              </div>
            ))}
          </div>
          <div>
            {col2.map((item, i) => (
              <div key={i} className="faq-row">
                <FaqItem q={item.q} a={item.a} idx={i + half} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
