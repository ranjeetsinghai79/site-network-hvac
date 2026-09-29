import { Phone, Mail, MapPin } from "lucide-react"
import type { SiteConfig } from "../types"
import { MobileCtaBar } from "./mobile-cta-bar"

interface Props {
  config: SiteConfig
}

const SOCIAL_LABELS: Record<string, string> = {
  google: "Google",
  yelp: "Yelp",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter / X",
}

const NICHE_TYPE: Record<string, string> = {
  hvac: "HVACBusiness",
  roofing: "RoofingContractor",
  dentist: "Dentist",
  medspa: "MedicalBusiness",
  lawfirm: "LegalService",
  remodeling: "HomeAndConstructionBusiness",
  cleaning: "HousePainter",
  "junk-removal": "LocalBusiness",
  daycare: "ChildCare",
  "auto-detailing": "AutoWash",
  restaurant: "Restaurant",
  "luxury-realestate": "RealEstateAgent",
  salon: "HairSalon",
  barbershop: "BarberShop",
  plumbing: "Plumber",
  landscaping: "LandscapingBusiness",
  "pressure-washing": "LocalBusiness",
  "foundation-repair": "HomeAndConstructionBusiness",
  "basement-waterproofing": "HomeAndConstructionBusiness",
  "epoxy-flooring": "HomeAndConstructionBusiness",
  "septic-services": "LocalBusiness",
  "tree-services": "LocalBusiness",
  "skin-clinic": "MedicalBusiness",
  "iv-therapy": "MedicalBusiness",
  "nail-studio": "NailSalon",
  "cosmetic-surgeon": "Physician",
}

function buildLocalBusinessSchema(config: SiteConfig): object {
  const b = config.business
  const type = NICHE_TYPE[b.niche] ?? "LocalBusiness"
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: b.name,
    description: b.tagline,
    telephone: b.phone,
    email: b.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: b.address,
      addressLocality: b.city,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: b.google_rating,
      reviewCount: b.review_count,
      bestRating: "5",
    },
    openingHoursSpecification: b.emergency
      ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], opens: "00:00", closes: "23:59" }]
      : undefined,
    areaServed: b.serviceAreas.map((area) => ({ "@type": "City", name: area })),
    ...(b.social?.google ? { sameAs: [b.social.google] } : {}),
  }
}

export function Footer({ config }: Props) {
  const business = config.business
  const year = new Date().getFullYear()
  const schema = buildLocalBusinessSchema(config)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <footer style={{ background: "#000", borderTop: "1px solid color-mix(in srgb, var(--brand-accent) 12%, transparent)" }}>
      {/* Emergency strip */}
      {business.emergency && (
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3"
          style={{ background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)", borderBottom: "1px solid color-mix(in srgb, var(--brand-accent) 15%, transparent)" }}
        >
          <div className="flex items-center gap-2">
            <span className="font-body text-[0.65rem] font-bold tracking-widest uppercase" style={{ color: "var(--brand-accent)" }}>
              24/7 Emergency
            </span>
            <span className="font-body text-white/55 text-sm">— We answer every call, day or night.</span>
          </div>
          <a
            href={business.phoneHref}
            className="btn-primary"
            style={{ fontSize: "0.8rem", padding: "0.4rem 1rem", gap: "0.4rem" }}
          >
            <Phone className="w-3.5 h-3.5" />
            {business.phone}
          </a>
        </div>
      )}

      <div className="px-6 py-14">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">

            {/* Brand */}
            <div>
              <div className="font-display text-white text-xl mb-1" style={{ fontWeight: 800 }}>
                {business.name}
              </div>
              <div className="font-body text-white/40 text-sm mb-4">{business.tagline}</div>
              <div className="flex items-center gap-1 mb-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4" viewBox="0 0 24 24" style={{ fill: "var(--brand-accent)" }} aria-hidden>
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ))}
                <span className="text-white text-sm ml-1" style={{ fontWeight: 700 }}>{business.google_rating}</span>
                <span className="text-white/40 text-xs ml-1">{business.review_count} reviews</span>
              </div>
              {business.license && <div className="text-white/40 text-xs font-body">{business.license}</div>}
              <div className="font-body text-white/30 text-xs mt-1">Est. {business.since}</div>

              {/* Social links */}
              {business.social && Object.keys(business.social).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-5">
                  {Object.entries(business.social).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-full transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      {SOCIAL_LABELS[platform] ?? platform}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Contact */}
            <div>
              <div className="font-display text-xs tracking-[0.3em] uppercase text-white/50 mb-4" style={{ fontWeight: 700 }}>
                Contact
              </div>
              <div className="space-y-3">
                <a href={business.phoneHref} className="flex items-center gap-3 text-white/65 hover:text-white transition-colors text-sm font-body">
                  <Phone className="w-4 h-4 shrink-0" style={{ color: "var(--brand-accent)" }} />
                  {business.phone}
                </a>
                <a href={`mailto:${business.email}`} className="flex items-center gap-3 text-white/65 hover:text-white transition-colors text-sm font-body">
                  <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--brand-accent)" }} />
                  {business.email}
                </a>
                <div className="flex items-start gap-3 text-white/55 text-sm font-body">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--brand-accent)" }} />
                  {business.address}
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <div className="font-display text-xs tracking-[0.3em] uppercase text-white/50 mb-4" style={{ fontWeight: 700 }}>
                Quick Links
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "About Us",    href: "#about" },
                  { label: "Services",    href: "#services" },
                  { label: "Why Choose Us", href: "#why-us" },
                  { label: "Reviews",     href: "#reviews" },
                  { label: "FAQ",         href: "#faq" },
                  { label: "Contact",     href: "#contact" },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="block font-body text-white/55 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Service Areas */}
            <div>
              <div className="font-display text-xs tracking-[0.3em] uppercase text-white/50 mb-4" style={{ fontWeight: 700 }}>
                Service Areas
              </div>
              <div className="flex flex-wrap gap-2">
                {business.serviceAreas.map((area) => (
                  <span
                    key={area}
                    className="font-body text-white/55 text-xs border border-white/10 px-3 py-1.5 rounded-full"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            className="pt-7 flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="font-body text-white/30 text-xs">
              © {year} {business.name}. All rights reserved.
            </div>
            <div className="font-body text-white/20 text-xs tracking-[0.1em] uppercase">
              {business.city} · {business.niche.replace(/-/g, " ")}
            </div>
          </div>
        </div>
      </div>
    </footer>
    <MobileCtaBar business={business} />
    </>
  )
}
