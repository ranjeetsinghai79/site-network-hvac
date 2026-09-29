"use client"

import { useEffect } from "react"

export function ScrollProgress() {
  useEffect(() => {
    const update = () => {
      const scrolled = window.scrollY
      const total = document.documentElement.scrollHeight - window.innerHeight
      const pct = total > 0 ? (scrolled / total) * 100 : 0
      document.documentElement.style.setProperty("--scroll-pct", pct + "%")
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  return <div className="scroll-progress" aria-hidden />
}
