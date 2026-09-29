"use client"

import { useEffect } from "react"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "./use-reduced-motion"

interface Options {
  to: number
  decimals?: number
  suffix?: string
  prefix?: string
  duration?: number
  start?: string
  onComplete?: () => void
}

export function useCounter(
  ref: React.RefObject<HTMLElement | null>,
  options: Options,
) {
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const format = (val: number) =>
      `${options.prefix ?? ""}${
        options.decimals && options.decimals > 0
          ? val.toFixed(options.decimals)
          : Math.round(val).toLocaleString()
      }${options.suffix ?? ""}`

    if (reduced) {
      el.textContent = format(options.to)
      return
    }

    const scope = createScope()
    const obj = { val: 0 }
    const tween = gsap.to(obj, {
      val: options.to,
      duration: options.duration ?? 1.8,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: options.start ?? "top 85%",
        once: true,
      },
      onUpdate() {
        el.textContent = format(obj.val)
      },
      onComplete: options.onComplete,
    })
    scope.add(tween)
    if (tween.scrollTrigger) scope.add(tween.scrollTrigger)

    return () => scope.kill()
  }, [ref, reduced, options.to, options.decimals, options.suffix, options.prefix, options.duration, options.start, options.onComplete])
}
