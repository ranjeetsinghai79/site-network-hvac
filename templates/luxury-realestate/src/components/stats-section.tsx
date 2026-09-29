"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope, useReducedMotion } from "@core/web"
import { config } from "@/lib/config"

export default function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const itemsRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()
    const items = itemsRef.current?.querySelectorAll<HTMLElement>(".stat-item")
    if (items?.length) {
      const t = gsap.from(items, {
        opacity: 0, y: 30, stagger: 0.12, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: itemsRef.current, start: "top 85%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }
    return () => scope.kill()
  }, [reduced])

  if (!config.stats?.length) return null

  return (
    <section
      ref={sectionRef}
      className="py-20 px-6 relative overflow-hidden"
      style={{ background: "var(--brand-bg)" }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16"
        style={{ background: "linear-gradient(to bottom, var(--brand-accent), transparent)" }}
        aria-hidden
      />
      <div className="max-w-7xl mx-auto">
        <div
          ref={itemsRef}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x"
          style={{ borderColor: "color-mix(in srgb, var(--brand-accent) 12%, transparent)" }}
        >
          {config.stats.map(({ value, label }) => (
            <div key={label} className="stat-item text-center px-6 flex flex-col items-center">
              <div
                className="font-display text-gradient-animate mb-2"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", fontWeight: 300 }}
              >
                {value}
              </div>
              <div
                className="font-body uppercase tracking-[0.25em] text-white/40"
                style={{ fontSize: "0.6rem", fontWeight: 400 }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-16"
        style={{ background: "linear-gradient(to top, var(--brand-accent), transparent)" }}
        aria-hidden
      />
    </section>
  )
}
