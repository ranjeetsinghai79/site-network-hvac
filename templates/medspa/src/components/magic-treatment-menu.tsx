"use client"

// Adapted from 21st.dev component #18963 (mikolajdobrucki/pricing) —
// restructured as a med spa treatment menu, framer/shadcn deps replaced
// with GSAP + CSS vars per house rules.

import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import ScrollTrigger from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger, useGSAP)

interface Treatment {
  name: string
  description: string
  duration: string
  price: string
}

interface TreatmentCategory {
  category: string
  featured?: boolean
  treatments: Treatment[]
}

const MENU: TreatmentCategory[] = [
  {
    category: "Injectables",
    featured: true,
    treatments: [
      { name: "Botox / Dysport", description: "Smooth fine lines and prevent new ones forming", duration: "30 min", price: "from $12/unit" },
      { name: "Dermal Filler", description: "Restore volume in lips, cheeks and jawline", duration: "45 min", price: "from $650" },
      { name: "Sculptra", description: "Collagen stimulation for gradual, natural fullness", duration: "60 min", price: "from $850" },
    ],
  },
  {
    category: "Facials",
    treatments: [
      { name: "Signature HydraFacial", description: "Deep cleanse, exfoliate and hydrate in one visit", duration: "50 min", price: "$225" },
      { name: "Chemical Peel", description: "Resurface texture, tone and sun damage", duration: "40 min", price: "from $180" },
      { name: "Dermaplaning", description: "Instant glow and smoother makeup application", duration: "30 min", price: "$120" },
    ],
  },
  {
    category: "Laser",
    treatments: [
      { name: "Laser Hair Removal", description: "Permanent reduction for any area, all skin types", duration: "15–60 min", price: "from $99" },
      { name: "IPL Photofacial", description: "Erase sun spots, redness and pigmentation", duration: "45 min", price: "from $350" },
      { name: "Laser Resurfacing", description: "Collagen renewal for scars and deep lines", duration: "60 min", price: "from $600" },
    ],
  },
  {
    category: "IV Therapy",
    treatments: [
      { name: "Beauty Drip", description: "Biotin + glutathione blend for skin, hair, nails", duration: "45 min", price: "$199" },
      { name: "Myers' Cocktail", description: "The classic energy and immunity infusion", duration: "45 min", price: "$175" },
      { name: "NAD+ Boost", description: "Cellular anti-aging and mental clarity", duration: "90 min", price: "from $325" },
    ],
  },
]

export function MagicTreatmentMenu() {
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (prefersReduced) return

      gsap.from(".tm-heading", {
        opacity: 0, y: 48, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: ".tm-heading", start: "top 85%", once: true },
      })
      gsap.from(".tm-card", {
        opacity: 0, y: 48, scale: 0.97, stagger: 0.07, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: ".tm-grid", start: "top 82%", once: true },
      })
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      className="px-6 py-28"
      style={{ background: "var(--brand-bg, #FAF6F0)" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="tm-heading mb-16 text-center">
          <span
            className="champagne-rule mx-auto mb-6"
            aria-hidden
          />
          <h2
            className="text-4xl md:text-5xl"
            style={{ fontFamily: "var(--font-display)", color: "var(--brand-fg, #1E1915)", fontWeight: 600 }}
          >
            The Treatment Menu
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-lg"
            style={{ fontFamily: "var(--font-body)", color: "var(--brand-muted, #6B6258)" }}
          >
            Every service performed by licensed medical providers — tailored to
            your skin, your goals, your timeline.
          </p>
        </div>

        <div className="tm-grid grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {MENU.map(({ category, featured, treatments }) => (
            <div
              key={category}
              className="tm-card hover-lift flex flex-col rounded-2xl p-7 transition-shadow duration-500"
              style={{
                background: featured ? "var(--brand-fg, #1E1915)" : "var(--brand-surface, #fff)",
                border: "1px solid " + (featured ? "transparent" : "var(--brand-border, rgba(0,0,0,0.08))"),
                boxShadow: featured
                  ? "0 24px 64px -16px var(--medspa-rose-glow)"
                  : "0 8px 32px -12px rgba(30,25,21,0.10)",
              }}
            >
              <h3
                className="text-2xl"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  color: featured ? "#fff" : "var(--brand-fg, #1E1915)",
                }}
              >
                {category}
              </h3>
              {featured && (
                <span
                  className="mt-2 inline-block w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
                  style={{ background: "var(--medspa-rose)", color: "#fff" }}
                >
                  Most requested
                </span>
              )}
              <ul className="mt-6 flex flex-col gap-6">
                {treatments.map((t) => (
                  <li key={t.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className="text-base font-700"
                        style={{ fontFamily: "var(--font-body)", color: featured ? "#fff" : "var(--brand-fg, #1E1915)" }}
                      >
                        {t.name}
                      </span>
                      <span
                        className="whitespace-nowrap text-sm"
                        style={{ color: "var(--brand-accent, #B8955A)" }}
                      >
                        {t.price}
                      </span>
                    </div>
                    <p
                      className="mt-1 text-sm leading-relaxed"
                      style={{ fontFamily: "var(--font-body)", color: featured ? "rgba(255,255,255,0.65)" : "var(--brand-muted, #6B6258)" }}
                    >
                      {t.description}
                    </p>
                    <span
                      className="mt-1 block text-xs tracking-wide"
                      style={{ color: featured ? "rgba(255,255,255,0.4)" : "var(--brand-muted, #9C9285)" }}
                    >
                      {t.duration}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
