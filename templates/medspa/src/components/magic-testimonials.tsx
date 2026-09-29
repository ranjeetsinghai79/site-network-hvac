"use client"

// Adapted from 21st.dev component #7267 (sshahaider/testimonials-section) —
// framer-motion blur/stagger entrance re-implemented in GSAP, colors moved
// to CSS vars, copy rewritten for med spa patients.

import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import ScrollTrigger from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger, useGSAP)

type Testimonial = {
  name: string
  treatment: string
  quote: string
  image: string
}

const TESTIMONIALS: Testimonial[] = [
  { name: "Monica R.", treatment: "Botox + HydraFacial", quote: "I walked in nervous and walked out feeling like myself again — just rested. Nobody can tell, everybody notices.", image: "https://randomuser.me/api/portraits/women/44.jpg" },
  { name: "Jasmine T.", treatment: "Dermal Filler", quote: "The consultation alone was worth it. They talked me out of more product, not into it. That's when I knew I'd found my place.", image: "https://randomuser.me/api/portraits/women/68.jpg" },
  { name: "Karen L.", treatment: "IPL Photofacial", quote: "Ten years of sun damage gone in three sessions. My foundation bottle has been untouched for months.", image: "https://randomuser.me/api/portraits/women/65.jpg" },
  { name: "Danielle P.", treatment: "Laser Hair Removal", quote: "Painless, fast, and the front desk actually answers the phone. Booking touch-ups takes thirty seconds.", image: "https://randomuser.me/api/portraits/women/33.jpg" },
  { name: "Marcus W.", treatment: "NAD+ IV Therapy", quote: "Skeptical husband dragged in by my wife. Left a believer — slept better that week than I had all year.", image: "https://randomuser.me/api/portraits/men/32.jpg" },
  { name: "Sophia G.", treatment: "Signature HydraFacial", quote: "My monthly non-negotiable. The glow lasts weeks and the whole visit feels like a spa day, not a clinic.", image: "https://randomuser.me/api/portraits/women/26.jpg" },
]

export function MagicTestimonials() {
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (prefersReduced) return

      gsap.from(".ts-heading", {
        opacity: 0, y: 48, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: ".ts-heading", start: "top 85%", once: true },
      })
      // 21st original: framer blur(4px) → 0, y -8 → 0, 0.1s/card stagger
      gsap.fromTo(
        ".ts-card",
        { opacity: 0, y: -8, filter: "blur(4px)" },
        {
          opacity: 1, y: 0, filter: "blur(0px)",
          stagger: 0.1, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: ".ts-grid", start: "top 82%", once: true },
        },
      )
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      className="px-6 py-28"
      style={{ background: "var(--brand-surface, #fff)" }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="ts-heading mb-14 text-center">
          <span className="champagne-rule mx-auto mb-6" aria-hidden />
          <h2
            className="text-4xl md:text-5xl"
            style={{ fontFamily: "var(--font-display)", color: "var(--brand-fg, #1E1915)", fontWeight: 600 }}
          >
            Real Patients, Real Glow
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-lg"
            style={{ fontFamily: "var(--font-body)", color: "var(--brand-muted, #6B6258)" }}
          >
            Every review below is from a verified visit. We keep them unedited —
            glow included.
          </p>
        </div>

        <div className="ts-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map(({ name, treatment, quote, image }) => (
            <figure
              key={name}
              className="ts-card hover-lift rounded-xl p-6 transition-shadow duration-500"
              style={{
                background: "var(--brand-bg, #FAF6F0)",
                border: "1px dashed var(--brand-border, rgba(30,25,21,0.18))",
              }}
            >
              <div className="flex items-center gap-3">
                <img
                  src={image}
                  alt={name}
                  loading="lazy"
                  className="size-10 rounded-full object-cover"
                />
                <figcaption>
                  <p
                    className="text-sm font-700"
                    style={{ fontFamily: "var(--font-body)", color: "var(--brand-fg, #1E1915)" }}
                  >
                    {name}
                  </p>
                  <span
                    className="block text-[11px] tracking-tight"
                    style={{ color: "var(--brand-accent, #B8955A)" }}
                  >
                    {treatment}
                  </span>
                </figcaption>
              </div>
              <blockquote className="mt-4">
                <p
                  className="text-sm leading-relaxed"
                  style={{ fontFamily: "var(--font-body)", color: "var(--brand-muted, #4A443C)" }}
                >
                  “{quote}”
                </p>
              </blockquote>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
