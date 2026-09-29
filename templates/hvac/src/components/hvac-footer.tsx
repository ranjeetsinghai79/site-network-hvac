"use client"

import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

export default function HvacFooter({ config }: Props) {
  const { business } = config

  return (
    <footer
      style={{
        background: "#030609",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "var(--brand-accent)", boxShadow: "0 0 12px rgba(249,115,22,0.35)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
              </div>
              <span
                className="font-display font-700 uppercase"
                style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "var(--brand-fg)", letterSpacing: "0.05em" }}
              >
                {business.name.split(" ").slice(0, 2).join(" ")}
              </span>
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", lineHeight: 1.7, color: "rgba(248,250,252,0.4)", maxWidth: "30ch" }}>
              {business.tagline}. Serving {business.city} and the Central Valley since {business.since}.
            </p>
            {business.license && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "rgba(248,250,252,0.25)", marginTop: 12 }}>
                {business.license}
              </p>
            )}
          </div>

          {/* Services */}
          <div>
            <p
              className="mb-4 text-xs uppercase tracking-widest font-display font-600"
              style={{ fontFamily: "var(--font-display)", color: "rgba(248,250,252,0.4)", letterSpacing: "0.18em" }}
            >
              Services
            </p>
            {(config.formServiceOptions ?? []).map(s => (
              <a
                key={s}
                href="#services"
                className="block mb-2"
                style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "rgba(248,250,252,0.5)", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => ((e.target as HTMLElement).style.color = "#F97316")}
                onMouseLeave={e => ((e.target as HTMLElement).style.color = "rgba(248,250,252,0.5)")}
              >
                {s}
              </a>
            ))}
          </div>

          {/* Areas */}
          <div>
            <p
              className="mb-4 text-xs uppercase tracking-widest font-display font-600"
              style={{ fontFamily: "var(--font-display)", color: "rgba(248,250,252,0.4)", letterSpacing: "0.18em" }}
            >
              Service Areas
            </p>
            {(business.serviceAreas ?? []).map(area => (
              <p key={area}
                style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "rgba(248,250,252,0.5)", marginBottom: 8 }}
              >
                {area}
              </p>
            ))}
          </div>

          {/* Contact */}
          <div>
            <p
              className="mb-4 text-xs uppercase tracking-widest font-display font-600"
              style={{ fontFamily: "var(--font-display)", color: "rgba(248,250,252,0.4)", letterSpacing: "0.18em" }}
            >
              Contact
            </p>
            <a
              href={business.phoneHref}
              className="block mb-3 font-display font-700"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", color: "#F97316", textDecoration: "none" }}
            >
              {business.phone}
            </a>
            <a
              href={`mailto:${business.email}`}
              style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "rgba(248,250,252,0.5)", display: "block", marginBottom: 8, textDecoration: "none" }}
            >
              {business.email}
            </a>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "rgba(248,250,252,0.35)" }}>
              {business.address}
            </p>

            {/* Emergency badge */}
            <div
              className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{
                background: "rgba(249,115,22,0.1)",
                border: "1px solid rgba(249,115,22,0.25)",
                color: "#F97316",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                letterSpacing: "0.1em",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#F97316", boxShadow: "0 0 6px #F97316" }}
              />
              24/7 Emergency
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "rgba(248,250,252,0.25)" }}>
            © {new Date().getFullYear()} {business.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {Object.entries(business.social ?? {}).map(([platform]) => (
              <span
                key={platform}
                className="text-xs uppercase tracking-wider"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "rgba(248,250,252,0.25)",
                  letterSpacing: "0.12em",
                }}
              >
                {platform}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
