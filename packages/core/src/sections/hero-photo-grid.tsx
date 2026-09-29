"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "../lib/gsap-init"
import { useReducedMotion } from "../hooks/use-reduced-motion"

/**
 * HeroPhotoGrid — 2×2 asymmetric photo grid for hero rightSlot.
 * Uses all 4 AI-generated hero images (hero-1 through hero-4).
 *
 * Used by: cleaning, dentist, medspa (service/interior-photo heavy niches).
 * For niches better served by cinematic bg: use posterSrc/videoSrc instead.
 *
 * Layout (desktop):
 *   Col A: hero-1 (tall 220px) / hero-2 (short 160px)
 *   Col B: hero-3 (short 160px) / hero-4 (tall 220px)
 *
 * Each card:
 *   - Shimmer skeleton while loading
 *   - Fade + rise on mount (staggered)
 *   - scale(1.05) on hover
 *   - Handles cached-image onLoad edge case
 */

interface PhotoCardProps {
  src:   string
  alt:   string
  delay: number
  tall?: boolean
}

function PhotoCard({ src, alt, delay, tall }: PhotoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const imgRef  = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!cardRef.current || reduced) return
    gsap.from(cardRef.current, { opacity: 0, y: 30, duration: 0.65, ease: "power3.out", delay })
    return () => { gsap.killTweensOf(cardRef.current) }
  }, [delay, reduced])

  // Cached images fire onLoad before React hydrates → check complete on mount
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl overflow-hidden group"
      style={{
        height:     tall ? "220px" : "160px",
        background: "rgba(255,255,255,0.05)",
        border:     "1px solid rgba(255,255,255,0.08)",
        boxShadow:  "0 8px 32px -8px rgba(0,0,0,0.5)",
        flexShrink: 0,
      }}
    >
      {/* Shimmer skeleton */}
      {!loaded && (
        <div
          className="absolute inset-0 shimmer-skeleton"
          style={{
            background:     "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)",
            backgroundSize: "200% 100%",
            animation:      "shimmer 1.6s ease-in-out infinite",
          }}
        />
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={{ transition: "transform 0.5s ease" }}
        onLoad={()  => setLoaded(true)}
        onError={e  => { (e.currentTarget.parentElement as HTMLElement).style.display = "none" }}
        loading="eager"
        decoding="sync"
      />

      {/* Bottom gradient vignette */}
      <div
        className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)" }}
      />
    </div>
  )
}

interface HeroPhotoGridProps {
  /** Business name — used for alt text */
  businessName?: string
  /** Base path for images. Default "/". Override if images live elsewhere. */
  basePath?: string
  /** Gap between cards (Tailwind spacing scale). Default "gap-3". */
  gap?: string
}

export function HeroPhotoGrid({
  businessName = "Business",
  basePath = "",
  gap = "gap-3",
}: HeroPhotoGridProps) {
  const images = [
    { src: `${basePath}/hero-1.jpg`, alt: `${businessName} — photo 1`, delay: 0.35, tall: true  },
    { src: `${basePath}/hero-2.jpg`, alt: `${businessName} — photo 2`, delay: 0.45, tall: false },
    { src: `${basePath}/hero-3.jpg`, alt: `${businessName} — photo 3`, delay: 0.50, tall: false },
    { src: `${basePath}/hero-4.jpg`, alt: `${businessName} — photo 4`, delay: 0.60, tall: true  },
  ]

  return (
    <div className={`grid grid-cols-2 ${gap} w-full max-w-md xl:max-w-lg`}>
      {/* Col A: tall → short */}
      <div className={`flex flex-col ${gap}`}>
        <PhotoCard {...images[0]} />
        <PhotoCard {...images[1]} />
      </div>
      {/* Col B: short → tall */}
      <div className={`flex flex-col ${gap}`}>
        <PhotoCard {...images[2]} />
        <PhotoCard {...images[3]} />
      </div>
    </div>
  )
}
