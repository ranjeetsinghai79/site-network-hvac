"use client"

import { useEffect, useRef } from "react"
import { Bed, Bath, Maximize2, ArrowRight } from "lucide-react"
import { gsap, createScope, useReducedMotion, SplitText } from "@core/web"
import { config } from "@/lib/config"
type Property = {
  id: string | number
  title: string
  type?: string
  location: string
  price: string
  beds: number
  baths: number
  area?: string
  sqft?: string
  image?: string
  img?: string
  badge?: string
  tag?: string
}
const luxuryConfig = config as typeof config & { properties?: Property[] }
const DEFAULT_PROPERTIES: Property[] = [
  { id: "p1", title: "Luxury Estate Villa", type: "Villa", location: config.business.city, price: "$1.2M", beds: 5, baths: 4, area: "4,200 sq ft", image: "/hero-1.jpg", badge: "Featured" },
  { id: "p2", title: "Modern Penthouse", type: "Penthouse", location: config.business.city, price: "$890K", beds: 3, baths: 3, area: "2,800 sq ft", image: "/hero-2.jpg", badge: "New Listing" },
  { id: "p3", title: "Contemporary Townhome", type: "Townhome", location: config.business.city, price: "$650K", beds: 4, baths: 3, area: "2,400 sq ft", image: "/hero-3.jpg", badge: "Just Sold" },
]

export default function PropertiesSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const h = gsap.from(headingRef.current, {
      opacity: 0, y: 40, duration: 0.7, ease: "power3.out",
      scrollTrigger: { trigger: headingRef.current, start: "top 88%", once: true },
    })
    scope.add(h)
    if (h.scrollTrigger) scope.add(h.scrollTrigger)

    const cards = gridRef.current?.querySelectorAll<HTMLElement>(".property-card")
    if (cards?.length) {
      const t = gsap.from(cards, {
        opacity: 0, y: 60, scale: 0.96, stagger: 0.1, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: gridRef.current, start: "top 85%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="properties"
      className="py-28 px-6"
      style={{ background: "var(--brand-bg-section)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div ref={headingRef} className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <span className="section-label">Featured Properties</span>
            <h2
              className="font-display text-white"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.01em", lineHeight: 1.05, fontWeight: 300 }}
            >
              <SplitText>Exceptional Homes,</SplitText>
              <br />
              <em className="text-gradient-animate" style={{ fontWeight: 400 }}>
                <SplitText>Exceptional Living</SplitText>
              </em>
            </h2>
            <div className="brand-rule mt-4" />
          </div>
          <a href="#contact" className="btn-ghost self-start md:self-auto">
            View All Listings
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {(luxuryConfig.properties ?? DEFAULT_PROPERTIES).map((p) => (
            <div
              key={p.id}
              className="property-card glass-dark overflow-hidden cursor-pointer group hover-lift"
              style={{ borderRadius: "2px" }}
            >
              <div className="relative overflow-hidden" style={{ height: "220px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.img ?? p.image ?? '/hero-1.jpg'}
                  alt={p.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(5,5,5,0.6) 0%, transparent 50%)" }}
                />
                {p.badge && (
                  <div
                    className="absolute top-3 left-3 px-2.5 py-1 text-xs font-body tracking-[0.15em] uppercase"
                    style={{
                      background: "color-mix(in srgb, var(--brand-accent) 15%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--brand-accent) 40%, transparent)",
                      color: "var(--brand-accent-light)",
                      backdropFilter: "blur(8px)",
                      fontWeight: 600,
                    }}
                  >
                    {p.badge}
                  </div>
                )}
                <div
                  className="absolute top-3 right-3 px-2.5 py-1 text-xs font-body tracking-[0.1em] uppercase"
                  style={{
                    background: "rgba(5,5,5,0.7)",
                    color: "rgba(255,255,255,0.65)",
                    backdropFilter: "blur(8px)",
                    fontWeight: 500,
                  }}
                >
                  {p.type ?? p.tag}
                </div>
              </div>

              <div className="p-5">
                <div
                  className="font-body text-xs tracking-[0.2em] uppercase mb-1.5"
                  style={{ color: "var(--brand-accent)" }}
                >
                  {p.location}
                </div>
                <h3
                  className="font-display text-white mb-3 leading-snug group-hover:text-[var(--brand-accent-light)] transition-colors duration-300"
                  style={{ fontSize: "1.05rem", fontWeight: 400 }}
                >
                  {p.title}
                </h3>
                <div className="flex items-center gap-4 mb-4 text-white/45">
                  <span className="flex items-center gap-1.5 text-xs font-body">
                    <Bed className="w-3.5 h-3.5" /> {p.beds}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-body">
                    <Bath className="w-3.5 h-3.5" /> {p.baths}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-body">
                    <Maximize2 className="w-3.5 h-3.5" /> {p.area ?? p.sqft}
                  </span>
                </div>
                <div
                  className="flex items-end justify-between pt-4"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="font-display text-white"
                    style={{ fontSize: "1.1rem", letterSpacing: "-0.01em", fontWeight: 400 }}
                  >
                    {p.price}
                  </div>
                  <a
                    href="#contact"
                    className="font-body text-xs tracking-[0.15em] uppercase transition-colors duration-300 flex items-center gap-1.5"
                    style={{ color: "var(--brand-accent)" }}
                  >
                    Enquire
                    <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
