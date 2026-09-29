"use client"

import { useEffect, useRef } from "react"
import { MapPin } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { SplitText } from "../effects/split-text"

interface Props {
  config: SiteConfig
  label?: string
  heading?: React.ReactNode
  paragraph?: string
  /** Show Google Maps embed centered on city */
  showMap?: boolean
}

export function ServiceAreas({
  config,
  label = "Where We Work",
  heading,
  paragraph,
  showMap = true,
}: Props) {
  const business = config.business
  const sectionRef = useRef<HTMLElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const l = gsap.from(leftRef.current, {
      opacity: 0, x: -40, duration: 0.75, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
    })
    scope.add(l)
    if (l.scrollTrigger) scope.add(l.scrollTrigger)

    const r = gsap.from(rightRef.current, {
      opacity: 0, x: 40, duration: 0.75, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
    })
    scope.add(r)
    if (r.scrollTrigger) scope.add(r.scrollTrigger)

    const items = rightRef.current?.querySelectorAll<HTMLElement>(".area-pill")
    if (items?.length) {
      const t = gsap.from(items, {
        opacity: 0, x: -20, stagger: 0.06, duration: 0.4, ease: "power3.out",
        scrollTrigger: { trigger: rightRef.current, start: "top 85%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  const mapQuery = business.location
    ? `${business.location.lat},${business.location.lng}`
    : encodeURIComponent(business.address || business.city)

  return (
    <section
      ref={sectionRef}
      id="areas"
      className="py-24 px-6"
      style={{ background: "var(--brand-bg-section)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {showMap && (
            <div
              ref={leftRef}
              className="rounded-2xl overflow-hidden border border-white/10 h-80 lg:h-[420px]"
            >
              <iframe
                src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                width="100%"
                height="100%"
                style={{ border: 0, filter: "grayscale(0.4) contrast(0.95)" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Service area map"
              />
            </div>
          )}

          <div ref={rightRef}>
            <span className="section-label">{label}</span>
            <h2 className="font-display text-white text-4xl md:text-5xl mb-4" style={{ fontWeight: 800 }}>
              {heading ?? <SplitText>Service Areas</SplitText>}
            </h2>
            <p className="font-body text-white/55 leading-relaxed mb-8 max-w-md">
              {paragraph ?? `We serve customers throughout ${business.city}. Don't see your city? Call us — we may still cover you.`}
            </p>

            <div className="flex flex-wrap gap-2.5 mb-8">
              {business.serviceAreas.map((area) => (
                <div
                  key={area}
                  className="area-pill flex items-center gap-2 px-4 py-2.5 rounded-full glass-dark hover-lift cursor-default"
                >
                  <MapPin className="w-3.5 h-3.5" style={{ color: "var(--brand-accent)" }} />
                  <span className="font-body text-white/85 text-sm" style={{ fontWeight: 500 }}>{area}</span>
                </div>
              ))}
            </div>

            <a href={business.phoneHref} className="btn-ghost">
              <MapPin className="w-4 h-4" />
              Check My Area — {business.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
