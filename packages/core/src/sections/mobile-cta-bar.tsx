"use client"

import { Phone, MessageCircle } from "lucide-react"
import type { Business } from "../types"

interface Props {
  business: Business
  quoteLabel?: string
}

export function MobileCtaBar({ business, quoteLabel = "Free Quote" }: Props) {
  return (
    <div
      className="mobile-cta-bar"
      role="navigation"
      aria-label="Quick contact"
    >
      <a
        href={business.phoneHref}
        className="mobile-cta-btn mobile-cta-btn--primary"
        aria-label={`Call ${business.name}`}
      >
        <Phone className="w-4 h-4 shrink-0" aria-hidden />
        <span>Call Now</span>
      </a>
      {business.whatsapp ? (
        <a
          href={`https://wa.me/${business.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-cta-btn mobile-cta-btn--ghost"
          aria-label={`WhatsApp ${business.name}`}
        >
          <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
          <span>WhatsApp</span>
        </a>
      ) : (
        <a
          href="#contact"
          className="mobile-cta-btn mobile-cta-btn--ghost"
          aria-label="Get a free quote"
        >
          <span>{quoteLabel}</span>
        </a>
      )}
    </div>
  )
}
