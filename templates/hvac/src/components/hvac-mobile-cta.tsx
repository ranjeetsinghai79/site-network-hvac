"use client"

import { useEffect, useState } from "react"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

export default function HvacMobileCta({ config }: Props) {
  const { business } = config
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show after user scrolls 120px past hero
    const onScroll = () => setVisible(window.scrollY > 120)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "rgba(5,10,15,0.97)",
        borderTop: "1px solid rgba(249,115,22,0.25)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      aria-label="Quick contact bar"
    >
      <div className="grid grid-cols-2 gap-3 p-3">
        {/* Call Now */}
        <a
          href={business.phoneHref}
          className="flex items-center justify-center gap-2.5 rounded-xl cursor-pointer"
          style={{
            minHeight: 52,
            background: "var(--brand-accent)",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontSize: "0.9rem",
            fontWeight: 700,
            letterSpacing: "0.03em",
            textDecoration: "none",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.003 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.85 6.85l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
          Call Now
        </a>

        {/* Free Quote */}
        <a
          href="#contact"
          className="flex items-center justify-center gap-2.5 rounded-xl cursor-pointer"
          style={{
            minHeight: 52,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--brand-fg)",
            fontFamily: "var(--font-display)",
            fontSize: "0.9rem",
            fontWeight: 700,
            letterSpacing: "0.03em",
            textDecoration: "none",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
          Free Quote
        </a>
      </div>
    </div>
  )
}
