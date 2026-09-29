"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"

const PHOTOS = [
  { src: "/hero-1.jpg",    label: "Ceramic Coating",    sub: "5-year protection" },
  { src: "/hero-2.jpg",    label: "Paint Correction",   sub: "Swirls removed" },
  { src: "/hero-3.jpg",    label: "Full Detail",        sub: "Interior + exterior" },
  { src: "/hero-4.jpg",    label: "Interior Steam",     sub: "Sanitized + fresh" },
  { src: "/hero-1.jpg",    label: "PPF Application",    sub: "Invisible armor" },
  { src: "/hero-2.jpg",    label: "Window Tinting",     sub: "Ceramic tint" },
]

export default function AutoDetailingPhotoStrip() {
  const rowRef  = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced || !rowRef.current) return
    const scope = createScope()
    const items = rowRef.current.querySelectorAll<HTMLElement>(".photo-item")
    const t = gsap.from(items, {
      opacity: 0, scale: 0.93, y: 36,
      stagger: 0.09, duration: 0.75, ease: "power3.out",
      scrollTrigger: { trigger: rowRef.current, start: "top 86%", once: true },
    })
    scope.add(t)
    if (t.scrollTrigger) scope.add(t.scrollTrigger)
    return () => scope.kill()
  }, [reduced])

  return (
    <div style={{ background: "var(--brand-bg)", padding: "3rem 0 4rem" }}>
      {/* Section label */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <span style={{
          fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "var(--brand-accent)",
        }}>
          Our Work
        </span>
      </div>

      <div
        ref={rowRef}
        style={{
          maxWidth: "1400px", margin: "0 auto", padding: "0 2rem",
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "0.75rem",
        }}
        className="photo-strip-grid"
      >
        {PHOTOS.map(({ src, label, sub }) => (
          <div
            key={label}
            className="photo-item"
            style={{ position: "relative", overflow: "hidden", borderRadius: "0.875rem", aspectRatio: "3/4", cursor: "pointer" }}
          >
            <img
              src={src}
              alt={label}
              className="w-full h-full object-cover object-center"
              style={{ transition: "transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1.07)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1)" }}
            />
            {/* Dark gradient overlay */}
            <div
              style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, transparent 40%, rgba(4,8,15,0.9) 100%)",
                transition: "opacity 0.3s",
              }}
            />
            {/* Image reveal accent line */}
            <div
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: "linear-gradient(90deg, transparent, var(--brand-accent), transparent)",
                opacity: 0, transition: "opacity 0.3s",
              }}
              className="photo-accent-line"
            />
            {/* Label */}
            <div style={{ position: "absolute", bottom: 0, left: 0, padding: "1rem 0.875rem" }}>
              <p style={{
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.85rem",
                color: "#fff", lineHeight: 1.1, marginBottom: "0.15rem",
              }}>
                {label}
              </p>
              <p style={{ fontSize: "0.68rem", color: "var(--brand-accent)" }}>{sub}</p>
            </div>
            {/* Blue dot accent */}
            <div
              style={{
                position: "absolute", top: "0.75rem", right: "0.75rem",
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--brand-accent)",
                boxShadow: "0 0 10px rgba(59,130,246,0.7)",
              }}
            />
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .photo-strip-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .photo-strip-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        .photo-item:hover .photo-accent-line { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
