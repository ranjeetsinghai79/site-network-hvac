"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, Minus } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"

interface Props {
  config: SiteConfig
  label?: string
  heading?: string
}

function FAQItem({ q, a, reduced }: { q: string; a: string; reduced: boolean }) {
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return

    if (reduced) {
      el.style.height = open ? "auto" : "0px"
      el.style.opacity = open ? "1" : "0"
      return
    }

    if (open) {
      el.style.height = "0px"
      el.style.overflow = "hidden"
      gsap.to(el, {
        height: "auto",
        opacity: 1,
        duration: 0.35,
        ease: "power2.out",
        onComplete: () => { el.style.overflow = "visible" },
      })
    } else {
      el.style.overflow = "hidden"
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.28,
        ease: "power2.in",
      })
    }
  }, [open, reduced])

  return (
    <div
      className="border-b"
      style={{ borderColor: "var(--brand-card-border)" }}
    >
      <button
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className="font-display text-white text-sm md:text-base leading-snug"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          {q}
        </span>
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: open
              ? "var(--brand-accent)"
              : "color-mix(in srgb, var(--brand-accent) 12%, transparent)",
            color: open ? "#fff" : "var(--brand-accent)",
            transition: "background 0.25s ease, color 0.25s ease",
          }}
        >
          {open ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </span>
      </button>

      <div
        ref={bodyRef}
        style={{ height: 0, opacity: 0, overflow: "hidden" }}
      >
        <p
          className="font-body text-white/60 text-sm leading-relaxed pb-5"
          style={{ maxWidth: "52rem" }}
        >
          {a}
        </p>
      </div>
    </div>
  )
}

export function FAQ({ config, label = "FAQ", heading }: Props) {
  const items = config.faq ?? []
  if (!items.length) return null

  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const h = gsap.from(headingRef.current, {
      opacity: 0, y: 28, duration: 0.65, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 85%", once: true },
    })
    scope.add(h)
    if (h.scrollTrigger) scope.add(h.scrollTrigger)

    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-faq-item]")
    if (rows?.length) {
      const t = gsap.from(rows, {
        opacity: 0, y: 20, stagger: 0.06, duration: 0.5, ease: "power3.out",
        scrollTrigger: { trigger: listRef.current, start: "top 88%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="faq"
      className="py-24 px-6"
      style={{ background: "var(--brand-bg)" }}
    >
      <div className="max-w-3xl mx-auto">
        <div ref={headingRef} className="text-center mb-12">
          <span className="section-label">{label}</span>
          <h2
            className="font-display text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            {heading ?? "Common Questions"}
          </h2>
        </div>

        <div ref={listRef}>
          {items.map((item, i) => (
            <div key={i} data-faq-item>
              <FAQItem q={item.q} a={item.a} reduced={reduced} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
