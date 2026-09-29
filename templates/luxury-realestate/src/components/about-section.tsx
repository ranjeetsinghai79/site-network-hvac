"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope, useReducedMotion, SplitText } from "@core/web"
import { config } from "@/lib/config"
type LuxuryAbout = { pillars: Array<{ num: string; title: string; desc: string }> }
const luxuryConfig = config as typeof config & { about?: LuxuryAbout }
const DEFAULT_PILLARS = [
  { num: "01", title: "Expertise", desc: "Deep market knowledge and personalized guidance for every client." },
  { num: "02", title: "Exclusivity", desc: "Access to the finest luxury properties and off-market listings." },
  { num: "03", title: "Integrity", desc: "Transparent communication and unwavering commitment to your goals." },
  { num: "04", title: "Results", desc: "Proven track record of successful transactions and client satisfaction." },
]

export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const business = config.business

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const l = gsap.from(leftRef.current, {
      opacity: 0, x: -50, duration: 0.8, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
    })
    scope.add(l)
    if (l.scrollTrigger) scope.add(l.scrollTrigger)

    const i = gsap.from(imgRef.current, {
      opacity: 0, scale: 0.95, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
    })
    scope.add(i)
    if (i.scrollTrigger) scope.add(i.scrollTrigger)

    const items = rightRef.current?.querySelectorAll<HTMLElement>(".pillar-item")
    if (items?.length) {
      const t = gsap.from(items, {
        opacity: 0, y: 30, stagger: 0.1, duration: 0.6, ease: "power3.out",
        scrollTrigger: { trigger: rightRef.current, start: "top 82%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    const p = gsap.to(imgRef.current, {
      yPercent: -10,
      ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top bottom",
        end: "bottom top",
        scrub: 1.5,
      },
    })
    scope.add(p)
    if (p.scrollTrigger) scope.add(p.scrollTrigger)

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="about"
      className="py-28 px-6"
      style={{ background: "var(--brand-bg)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div ref={leftRef} className="relative">
            <div
              ref={imgRef}
              className="overflow-hidden relative"
              style={{ height: "560px", borderRadius: "2px", border: "1px solid color-mix(in srgb, var(--brand-accent) 12%, transparent)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero-2.jpg"
                alt={business.name}
                className="w-full h-full object-cover"
                style={{ filter: "brightness(0.85) saturate(0.9)" }}
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(5,5,5,0.5) 0%, transparent 50%)" }}
              />
            </div>
            <div className="absolute bottom-6 left-6 right-6 p-5 glass-dark" style={{ borderRadius: "2px" }}>
              <div className="font-display text-white text-lg mb-1" style={{ fontWeight: 300 }}>
                Trusted Since {business.since}
              </div>
              <div className="font-body text-white/45 text-xs tracking-[0.2em] uppercase">
                {business.city} · {business.address.split(",").slice(-2).join(",").trim()}
              </div>
            </div>
          </div>

          <div ref={rightRef}>
            <span className="section-label">Our Approach</span>
            <h2
              className="font-display text-white mb-4"
              style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", lineHeight: 1.05, fontWeight: 300 }}
            >
              <SplitText>Real Estate Is Not</SplitText>
              <br />
              <em className="text-gradient-animate" style={{ fontWeight: 400 }}>
                <SplitText>Just Transactions</SplitText>
              </em>
            </h2>
            <div className="brand-rule mb-6" />
            <p className="font-body text-white/55 leading-relaxed mb-10" style={{ maxWidth: "34rem" }}>
              2,400+ properties. AED 8.2B+ in total sales. Every number represents a client who trusted
              us with one of the most important decisions of their life. That responsibility shapes
              everything we do.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {(luxuryConfig.about?.pillars ?? DEFAULT_PILLARS).map((p) => (
                <div key={p.num} className="pillar-item p-5 glass-dark" style={{ borderRadius: "2px" }}>
                  <div
                    className="font-display mb-2"
                    style={{
                      fontSize: "2.5rem",
                      color: "color-mix(in srgb, var(--brand-accent) 30%, transparent)",
                      lineHeight: 1,
                      fontWeight: 300,
                    }}
                  >
                    {p.num}
                  </div>
                  <div className="font-display text-white mb-2" style={{ fontSize: "1rem", fontWeight: 400 }}>
                    {p.title}
                  </div>
                  <p className="font-body text-white/55 text-sm leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
