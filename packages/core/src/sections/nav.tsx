"use client"

import { useEffect, useState } from "react"
import { Menu, X, Phone } from "lucide-react"
import type { SiteConfig } from "../types"

interface NavLink {
  label: string
  href: string
}

interface Props {
  config: SiteConfig
  links?: NavLink[]
  /** Right-side CTA. Defaults to phone link. Pass null to remove. */
  cta?: React.ReactNode | null
  /** Logo / brand block on the left. Default = business name. */
  brand?: React.ReactNode
  /** Background style for scrolled state. Default semi-opaque white. */
  scrolledTheme?: "light" | "dark"
}

export function Nav({ config, links, cta, brand, scrolledTheme = "dark" }: Props) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const business = config.business

  const defaultLinks: NavLink[] = [
    { label: "Services", href: "#services" },
    { label: "Why Us", href: "#why-us" },
    { label: "Reviews", href: "#reviews" },
    { label: "Areas", href: "#areas" },
    { label: "Contact", href: "#contact" },
  ]
  const navLinks = links ?? defaultLinks

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const isLight = scrolledTheme === "light"
  const scrolledBg = isLight ? "rgba(255,255,255,0.95)" : "rgba(5,5,5,0.92)"
  const scrolledBorder = isLight
    ? "1px solid rgba(15,31,61,0.08)"
    : `1px solid color-mix(in srgb, var(--brand-accent) 12%, transparent)`
  const linkColor = scrolled && isLight ? "rgba(51,65,85,0.85)" : "rgba(255,255,255,0.85)"
  const logoColor = scrolled && isLight ? "var(--brand-bg)" : "#fff"

  const defaultBrand = business.logoUrl ? (
    <a href="#" className="flex items-center cursor-pointer">
      {/* Real logo scraped from the business's own site (see fetchBusinessLogo /
          builder.ts) — rendered as-is instead of the text wordmark below. */}
      <img
        src={business.logoUrl}
        alt={business.name}
        className="h-9 w-auto object-contain"
        style={{ maxWidth: "160px" }}
      />
    </a>
  ) : (
    <a href="#" className="flex flex-col cursor-pointer">
      <span
        className="font-display leading-none"
        style={{ color: logoColor, fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em" }}
      >
        {business.name.split(" ")[0]}
      </span>
      {business.name.split(" ").length > 1 && (
        <span
          className="font-body tracking-[0.3em] uppercase mt-0.5"
          style={{ color: "var(--brand-accent)", fontSize: "0.55rem", fontWeight: 600 }}
        >
          {business.name.split(" ").slice(1).join(" ")}
        </span>
      )}
    </a>
  )

  const defaultCta = (
    <a href={business.phoneHref} className="btn-primary text-xs py-2.5 px-5">
      <Phone className="w-3.5 h-3.5" />
      {business.phone}
    </a>
  )

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? scrolledBg : "transparent",
        borderBottom: scrolled ? scrolledBorder : "1px solid transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        {brand ?? defaultBrand}

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-body text-xs tracking-[0.15em] uppercase transition-colors duration-300 cursor-pointer relative group"
              style={{ color: linkColor, fontWeight: 500 }}
            >
              {l.label}
              <span
                className="absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full"
                style={{ background: "var(--brand-accent)" }}
              />
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          {cta === undefined ? defaultCta : cta}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden cursor-pointer p-2"
          style={{ color: logoColor }}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div
          className="md:hidden px-6 pb-6 pt-2 flex flex-col gap-5"
          style={{
            background: scrolledBg,
            borderTop: scrolledBorder,
          }}
        >
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="font-body text-sm tracking-[0.15em] uppercase transition-colors cursor-pointer"
              style={{ color: linkColor }}
            >
              {l.label}
            </a>
          ))}
          {cta !== null && (
            <div onClick={() => setOpen(false)}>{cta ?? defaultCta}</div>
          )}
        </div>
      )}
    </header>
  )
}
