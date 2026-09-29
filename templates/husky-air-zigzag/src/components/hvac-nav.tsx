"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "@core/web"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const LINKS = [
  { label: "Services", href: "#services" },
  { label: "Why Us",   href: "#why-us"   },
  { label: "Gallery",  href: "#gallery"  },
  { label: "Reviews",  href: "#reviews"  },
  { label: "FAQ",      href: "#faq"      },
  { label: "Contact",  href: "#contact"  },
]

export default function HvacNav({ config }: Props) {
  const { business } = config
  const navRef   = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen]  = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", onScroll, { passive: true })

    // Entrance
    if (navRef.current) {
      gsap.from(navRef.current, { opacity: 0, y: -16, duration: 0.6, ease: "power3.out", delay: 0.1 })
    }
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const navBg = scrolled
    ? "rgba(248,249,252,0.92)"
    : "transparent"
  const navBorder = scrolled
    ? "rgba(11,14,26,0.07)"
    : "transparent"

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: navBg,
        borderBottom: `1px solid ${navBorder}`,
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        transition: "all 0.4s ease",
      }}
      aria-label="Main navigation"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16 h-20 flex items-center justify-between gap-6">

        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-3 shrink-0"
          style={{ textDecoration: "none" }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--brand-accent)", boxShadow: "0 0 16px rgba(79,70,229,0.4)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <div>
            <span
              className="font-display font-700 uppercase"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1rem",
                letterSpacing: "0.05em",
                color: "var(--brand-fg)",
              }}
            >
              {business.name.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        </a>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-8">
          {LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.82rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(11,14,26,0.65)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = "#4F46E5")}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = "rgba(11,14,26,0.65)")}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA + mobile toggle */}
        <div className="flex items-center gap-3">
          <a
            href={business.phoneHref}
            className="btn-primary !hidden sm:!inline-flex items-center gap-2 px-5 py-2.5"
            style={{ fontSize: "0.82rem" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.003 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.85 6.85l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            {business.phone}
          </a>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="block h-px rounded-full"
                style={{
                  width: i === 1 ? 20 : 24,
                  background: "rgba(11,14,26,0.7)",
                  transition: "all 0.2s",
                }}
              />
            ))}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="lg:hidden"
          style={{
            background: "rgba(248,249,252,0.97)",
            borderTop: "1px solid rgba(11,14,26,0.07)",
            backdropFilter: "blur(20px)",
          }}
        >
          {LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="block px-6 py-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.95rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(11,14,26,0.7)",
                textDecoration: "none",
                borderBottom: "1px solid rgba(11,14,26,0.04)",
              }}
            >
              {label}
            </a>
          ))}
          <div className="px-6 py-4">
            <a
              href={business.phoneHref}
              className="btn-primary w-full text-center block py-3.5"
              style={{ fontSize: "0.9rem" }}
            >
              Call {business.phone}
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
