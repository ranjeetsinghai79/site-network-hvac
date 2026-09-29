"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"

// Local service images are guaranteed to load and are barbershop-appropriate.
// Grayscale filter on "before" + full-colour "after" creates clear transformation read.
// Zero duplicates across comparisons, work grid, and barbers section.
const COMPARISONS = [
  {
    label: "High Skin Fade",
    before: "/service-1.jpg",
    after:  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=700&q=85&fit=crop",
  },
  {
    label: "Taper + Beard",
    before: "/service-2.jpg",
    after:  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=700&q=85&fit=crop",
  },
]

// Work grid — all unique, no overlap with comparisons or barbers portraits
const WORK_PHOTOS = [
  { src: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&q=80&fit=crop", label: "Precision Cut" },
  { src: "/service-4.jpg",  label: "Kids Cut"    },
  { src: "/service-6.jpg",  label: "Color Blend" },
  { src: "/hero-1.jpg",     label: "The Shop"    },
  { src: "/service-3.jpg",  label: "Combo"       },
  { src: "/service-5.jpg",  label: "Hot Shave"   },
]

function BeforeAfter({ item }: { item: typeof COMPARISONS[0] }) {
  const [pos, setPos] = useState(50)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const clamp = (v: number) => Math.max(4, Math.min(96, v))

  const calcPos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos(clamp(((clientX - rect.left) / rect.width) * 100))
  }, [])

  const onMouseMove  = (e: React.MouseEvent)  => { if (dragging) calcPos(e.clientX) }
  const onTouchMove  = (e: React.TouchEvent)  => calcPos(e.touches[0].clientX)
  const onMouseDown  = () => setDragging(true)
  const onMouseUp    = () => setDragging(false)
  const onMouseLeave = () => setDragging(false)
  const onClick      = (e: React.MouseEvent)  => calcPos(e.clientX)

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", aspectRatio: "4/3", borderRadius: "1.1rem", overflow: "hidden", cursor: "col-resize", userSelect: "none", boxShadow: "0 12px 48px rgba(0,0,0,0.5)" }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onTouchMove={onTouchMove}
      onClick={onClick}
    >
      {/* Before image (full) */}
      <img
        src={item.before}
        alt={`Before — ${item.label}`}
        draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(40%) brightness(0.85)" }}
      />

      {/* After image (clipped) */}
      <div
        style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        aria-hidden
      >
        <img
          src={item.after}
          alt={`After — ${item.label}`}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Divider line */}
      <div
        style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${pos}%`,
          transform: "translateX(-50%)",
          width: "2px",
          background: "var(--brand-accent)",
          boxShadow: "0 0 12px rgba(201,169,110,0.6)",
          pointerEvents: "none",
        }}
      >
        {/* Handle */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "40px", height: "40px",
          borderRadius: "50%",
          background: "var(--brand-accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 24px rgba(201,169,110,0.55), 0 4px 16px rgba(0,0,0,0.4)",
          cursor: "col-resize",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A0804" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
            <line x1="9" y1="12" x2="15" y2="12" style={{ display: "none" }}/>
          </svg>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A0804" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "-4px" }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div style={{ position: "absolute", bottom: "1rem", left: "1rem", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", padding: "0.22rem 0.65rem", borderRadius: "999px", fontFamily: "var(--font-body)" }}>
        Before
      </div>
      <div style={{ position: "absolute", bottom: "1rem", right: "1rem", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0A0804", background: "var(--brand-accent)", padding: "0.22rem 0.65rem", borderRadius: "999px", fontFamily: "var(--font-body)" }}>
        After
      </div>
      {/* Top label */}
      <div style={{ position: "absolute", top: "1rem", left: "50%", transform: "translateX(-50%)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", padding: "0.22rem 0.85rem", borderRadius: "999px", whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
        {item.label}
      </div>
    </div>
  )
}

export function GallerySection() {
  const sectionRef  = useRef<HTMLElement>(null)
  const headRef     = useRef<HTMLDivElement>(null)
  const slidersRef  = useRef<HTMLDivElement>(null)
  const gridRef     = useRef<HTMLDivElement>(null)
  const reduced     = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const ht = gsap.from(headRef.current, {
      opacity: 0, y: 36, duration: 0.75, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
    })
    scope.add(ht)
    if (ht.scrollTrigger) scope.add(ht.scrollTrigger)

    const sliders = slidersRef.current ? Array.from(slidersRef.current.children) : []
    if (sliders.length) {
      const st = gsap.from(sliders, {
        opacity: 0, y: 48, stagger: 0.15, duration: 0.8, ease: "power3.out",
        scrollTrigger: { trigger: slidersRef.current, start: "top 82%", once: true },
      })
      scope.add(st)
      if (st.scrollTrigger) scope.add(st.scrollTrigger)
    }

    const cells = gridRef.current?.querySelectorAll<HTMLElement>(".gallery-cell")
    if (cells?.length) {
      const gt = gsap.from(cells, {
        opacity: 0, scale: 0.94, stagger: 0.07, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: gridRef.current, start: "top 82%", once: true },
      })
      scope.add(gt)
      if (gt.scrollTrigger) scope.add(gt.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="gallery"
      style={{ position: "relative", background: "var(--brand-bg-section)", padding: "8rem 0", overflow: "hidden" }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", bottom: 0, right: "-100px",
        width: "500px", height: "500px",
        background: "radial-gradient(ellipse, rgba(201,169,110,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>

        {/* Header */}
        <div ref={headRef} style={{ textAlign: "center", marginBottom: "4.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", justifyContent: "center", marginBottom: "1.75rem" }}>
            <div style={{ width: "48px", height: "1px", background: "rgba(201,169,110,0.45)" }} />
            <span style={{ fontSize: "0.62rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--brand-accent)", fontFamily: "var(--font-body)", fontWeight: 600 }}>
              The Craft
            </span>
            <div style={{ width: "48px", height: "1px", background: "rgba(201,169,110,0.45)" }} />
          </div>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 5vw, 3.75rem)",
            fontWeight: 700,
            color: "var(--brand-fg)",
            letterSpacing: "-0.01em",
            lineHeight: 1.05,
            marginBottom: "1.1rem",
          }}>
            Before & After
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--brand-fg-muted)", lineHeight: 1.75, fontFamily: "var(--font-body)" }}>
            Drag the slider to see the transformation. Every cut. Every time.
          </p>
        </div>

        {/* Before/After sliders */}
        <div
          ref={slidersRef}
          className="sliders-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.5rem", marginBottom: "3.5rem" }}
        >
          {COMPARISONS.map((item, i) => (
            <BeforeAfter key={i} item={item} />
          ))}
        </div>

        {/* Work grid — masonry-style */}
        <div
          ref={gridRef}
          className="work-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}
        >
          {WORK_PHOTOS.map((photo, i) => (
            <div
              key={i}
              className="gallery-cell"
              style={{ position: "relative", aspectRatio: "1", borderRadius: "0.875rem", overflow: "hidden" }}
            >
              <img
                src={photo.src}
                alt={photo.label}
                className="gallery-img"
                style={{
                  width: "100%", height: "100%", objectFit: "cover",
                  filter: "grayscale(18%) contrast(1.05)",
                  transition: "transform 0.5s ease, filter 0.4s ease",
                  display: "block",
                }}
              />
              {/* Hover overlay */}
              <div className="gallery-overlay" style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(10,8,4,0.75) 0%, transparent 55%)",
                opacity: 0,
                transition: "opacity 0.3s ease",
              }} />
              {/* Label */}
              <div className="gallery-label" style={{
                position: "absolute", bottom: "0.85rem", left: "0.85rem",
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--brand-accent)",
                fontFamily: "var(--font-body)",
                opacity: 0,
                transform: "translateY(6px)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
              }}>
                {photo.label}
              </div>
            </div>
          ))}
        </div>

        {/* Instagram CTA */}
        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <a
            href={`https://instagram.com`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--brand-fg-muted)",
              textDecoration: "none",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              paddingBottom: "3px",
              fontFamily: "var(--font-body)",
              transition: "color 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--brand-accent)"; e.currentTarget.style.borderColor = "rgba(201,169,110,0.4)" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--brand-fg-muted)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
            See more on Instagram
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .sliders-grid { grid-template-columns: 1fr !important; }
          .work-grid    { grid-template-columns: repeat(2, 1fr) !important; }
        }
        .gallery-cell:hover .gallery-img     { transform: scale(1.07); filter: grayscale(0%) contrast(1.05); }
        .gallery-cell:hover .gallery-overlay { opacity: 1; }
        .gallery-cell:hover .gallery-label   { opacity: 1; transform: translateY(0); }
      `}</style>
    </section>
  )
}
