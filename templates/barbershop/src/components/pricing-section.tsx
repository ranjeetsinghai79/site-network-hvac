"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface MenuEntry {
  name: string
  price: string
  note?: string
  popular?: boolean
}

interface MenuCategory {
  label: string
  items: MenuEntry[]
}

const MENU: MenuCategory[] = [
  {
    label: "Cuts",
    items: [
      { name: "Classic Haircut", price: "$25", note: "wash, cut & style" },
      { name: "Fade — Low / Mid / High", price: "$35", popular: true },
      { name: "Skin Fade", price: "$40" },
      { name: "Taper Cut", price: "$30" },
      { name: "Buzz Cut", price: "$20" },
      { name: "Shape-Up / Line-Up", price: "$20" },
      { name: "Kids Cut (under 12)", price: "$20" },
    ],
  },
  {
    label: "Beard",
    items: [
      { name: "Beard Trim & Shape", price: "$25" },
      { name: "Straight-Razor Line-Up", price: "$15" },
      { name: "Full Hot Towel Shave", price: "$45", note: "30–40 min" },
      { name: "Beard & Line-Up Combo", price: "$35" },
    ],
  },
  {
    label: "Packages",
    items: [
      { name: "Cut + Beard Combo", price: "$55", popular: true, note: "most requested" },
      { name: "Cut + Hot Shave", price: "$70" },
      { name: "Father & Son (2 cuts)", price: "$55" },
      { name: "Color / Gray Blend", price: "$65+", note: "in-chair, no wait" },
    ],
  },
]

interface Props { config: SiteConfig }

export function PricingSection({ config }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const headRef   = useRef<HTMLDivElement>(null)
  const bodyRef   = useRef<HTMLDivElement>(null)
  const reduced   = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const ht = gsap.from(headRef.current, {
      opacity: 0, y: 36, duration: 0.75, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
    })
    scope.add(ht)
    if (ht.scrollTrigger) scope.add(ht.scrollTrigger)

    const rows = bodyRef.current?.querySelectorAll<HTMLElement>(".menu-row")
    if (rows?.length) {
      const rt = gsap.from(rows, {
        opacity: 0, y: 20, stagger: 0.035, duration: 0.5, ease: "power3.out",
        scrollTrigger: { trigger: bodyRef.current, start: "top 82%", once: true },
      })
      scope.add(rt)
      if (rt.scrollTrigger) scope.add(rt.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="services"
      style={{ position: "relative", background: "var(--brand-bg-section)", padding: "8rem 0", overflow: "hidden" }}
    >
      {/* Gold radial glow */}
      <div style={{
        position: "absolute", top: "-100px", left: "50%", transform: "translateX(-50%)",
        width: "700px", height: "500px",
        background: "radial-gradient(ellipse at top, rgba(201,169,110,0.07) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      {/* Decorative scissors SVG */}
      <div style={{
        position: "absolute", bottom: "3rem", right: "5%",
        opacity: 0.04, transform: "rotate(-35deg)",
        pointerEvents: "none",
      }}>
        <svg width="180" height="180" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
          <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
          <line x1="8.12" y1="8.12" x2="12" y2="12"/>
        </svg>
      </div>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 2rem" }}>

        {/* Header */}
        <div ref={headRef} style={{ textAlign: "center", marginBottom: "4.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", justifyContent: "center", marginBottom: "1.75rem" }}>
            <div style={{ flex: 1, maxWidth: "80px", height: "1px", background: "linear-gradient(to right, transparent, rgba(201,169,110,0.5))" }} />
            <span style={{ fontSize: "0.62rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--brand-accent)", fontFamily: "var(--font-body)", fontWeight: 600 }}>
              Est. 2017 · Tracy, California
            </span>
            <div style={{ flex: 1, maxWidth: "80px", height: "1px", background: "linear-gradient(to left, transparent, rgba(201,169,110,0.5))" }} />
          </div>

          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.8rem, 6vw, 4.5rem)",
            fontWeight: 700,
            color: "var(--brand-fg)",
            letterSpacing: "-0.01em",
            lineHeight: 1,
            marginBottom: "1.25rem",
            fontStyle: "italic",
          }}>
            The Menu
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--brand-fg-muted)", lineHeight: 1.75, fontFamily: "var(--font-body)", maxWidth: "420px", margin: "0 auto" }}>
            Straight pricing. No add-ons. No surprises.<br />
            Walk-ins welcome — book online for your preferred barber.
          </p>
        </div>

        {/* Menu body */}
        <div ref={bodyRef}>
          {MENU.map((cat, ci) => (
            <div key={cat.label} style={{ marginBottom: ci < MENU.length - 1 ? "3.5rem" : 0 }}>

              {/* Category header */}
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.25rem" }}>
                <span style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "var(--brand-accent)",
                  whiteSpace: "nowrap",
                }}>
                  {cat.label}
                </span>
                <div style={{ flex: 1, height: "1px", background: "rgba(201,169,110,0.18)" }} />
              </div>

              {/* Rows */}
              {cat.items.map((item) => (
                <div
                  key={item.name}
                  className="menu-row"
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "0.5rem",
                    padding: "0.85rem 0.5rem",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    transition: "background 0.2s ease",
                    borderRadius: "4px",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,169,110,0.04)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                >
                  {/* Service name */}
                  <span style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.975rem",
                    fontWeight: item.popular ? 500 : 400,
                    color: item.popular ? "var(--brand-accent)" : "var(--brand-fg)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}>
                    {item.name}
                  </span>

                  {/* Note */}
                  {item.note && (
                    <span style={{
                      fontSize: "0.72rem",
                      color: "var(--brand-fg-sub)",
                      fontStyle: "italic",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}>
                      · {item.note}
                    </span>
                  )}

                  {/* Popular tag */}
                  {item.popular && (
                    <span style={{
                      fontSize: "0.57rem",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#0A0804",
                      background: "var(--brand-accent)",
                      padding: "0.15rem 0.55rem",
                      borderRadius: "999px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}>
                      Popular
                    </span>
                  )}

                  {/* Dot leaders */}
                  <span style={{
                    flex: 1,
                    borderBottom: "2px dotted rgba(201,169,110,0.18)",
                    marginBottom: "4px",
                    minWidth: "20px",
                  }} />

                  {/* Price */}
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: item.popular ? "var(--brand-accent)" : "var(--brand-fg)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}>
                    {item.price}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: "4rem" }}>
          <a
            href={config.business.phoneHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              padding: "1rem 2.75rem",
              background: "var(--brand-accent)",
              color: "#0A0804",
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: "0.8rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "999px",
              boxShadow: "var(--shadow-cta)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-2px)" }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)" }}
          >
            Book Your Session
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
          <p style={{ marginTop: "1.1rem", fontSize: "0.77rem", color: "var(--brand-fg-sub)", fontFamily: "var(--font-body)" }}>
            Walk-ins always welcome · {config.business.phone}
          </p>
        </div>
      </div>
    </section>
  )
}
