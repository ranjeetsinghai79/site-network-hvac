"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"


const PHOTOS = [
  { src: "/hero-1.jpg",    label: "Portfolio Strategy" },
  { src: "/hero-2.jpg",    label: "Retirement Planning" },
  { src: "/hero-3.jpg",    label: "Life Insurance" },
  { src: "/hero-4.jpg",    label: "Tax Strategy" },
  { src: "/hero-1.jpg",    label: "Estate Planning" },
  { src: "/hero-2.jpg",    label: "Business Advisory" },
]

export default function FinancialAdvisorPhotoStrip() {
  const stripRef = useRef<HTMLDivElement>(null)
  const reduced  = useReducedMotion()

  useEffect(() => {
    if (reduced || !stripRef.current) return
    const scope = createScope()
    const cards = stripRef.current.querySelectorAll<HTMLElement>(".fa-photo-card")
    const t = gsap.from(cards, { opacity: 0, scale: 0.93, y: 36, stagger: 0.09, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: stripRef.current, start: "top 82%", once: true } })
    scope.add(t); if (t.scrollTrigger) scope.add(t.scrollTrigger)
    return () => scope.kill()
  }, [reduced])

  return (
    <section style={{ padding: "5rem 2rem", background: "var(--brand-surface, #111822)", overflow: "hidden" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div ref={stripRef} style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "0.75rem" }} className="fa-strip-grid">
          {PHOTOS.map((p, i) => (
            <div key={i} className="fa-photo-card" style={{ position: "relative", aspectRatio: "3/4", borderRadius: 10, overflow: "hidden", cursor: "pointer" }}>
              <img
                src={p.src}
                alt={p.label}
                style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94)", display: "block" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.07)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,12,18,0.85) 0%, transparent 55%)" }} />
              {/* Gold accent dot */}
              <div style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: "var(--brand-accent, #C9A55A)", boxShadow: "0 0 8px rgba(201,165,90,0.6)" }} />
              <span style={{ position: "absolute", bottom: "0.75rem", left: "0.75rem", fontFamily: "var(--font-body)", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(232,224,208,0.8)" }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media(max-width:900px){ .fa-strip-grid{ grid-template-columns:repeat(3,1fr)!important; } }
        @media(max-width:540px){ .fa-strip-grid{ grid-template-columns:repeat(2,1fr)!important; } }
      `}</style>
    </section>
  )
}
