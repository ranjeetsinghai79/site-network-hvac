"use client"

import { useEffect, useRef } from "react"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"

interface Props {
  src: string
  alt: string
  className?: string
  imgClassName?: string
  style?: React.CSSProperties
}

export function ImageReveal({ src, alt, className, imgClassName, style }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const wrapper = wrapperRef.current
    const img = imgRef.current
    if (!wrapper || !img) return

    if (reduced) {
      gsap.set(wrapper, { clipPath: "inset(0 0% 0 0)" })
      gsap.set(img, { scale: 1 })
      return
    }

    const scope = createScope()
    gsap.set(wrapper, { clipPath: "inset(0 100% 0 0)" })
    gsap.set(img, { scale: 1.15 })

    const tween = gsap.timeline({
      scrollTrigger: {
        trigger: wrapper,
        start: "top 85%",
        once: true,
      },
    })
    tween
      .to(wrapper, { clipPath: "inset(0 0% 0 0)", duration: 1.0, ease: "power3.out" })
      .to(img, { scale: 1, duration: 1.2, ease: "power3.out" }, "-=1.0")

    scope.add(tween)
    if (tween.scrollTrigger) scope.add(tween.scrollTrigger)

    return () => scope.kill()
  }, [reduced])

  return (
    <div ref={wrapperRef} className={`img-reveal overflow-hidden ${className ?? ""}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`w-full h-full object-cover ${imgClassName ?? ""}`}
      />
    </div>
  )
}
