import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "epoxy-flooring",
    name: "IronCoat Epoxy Floors",
    tagline: "Built Tough. Looks Incredible.",
    phone: "(555) 210-0345",
    phoneHref: "tel:+15552100345",
    email: "hello@ironcoatepoxy.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Mountain House", "Manteca", "Stockton", "Turlock", "Modesto"],
    license: "CSLB #C-33 #889012",
    since: "2012",
    google_rating: "4.9",
    review_count: "267",
    emergency: false,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      instagram: "https://instagram.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "Garage Floors, Commercial Floors, Industrial Floors — Done Right",
    body: "Since 2012, IronCoat has transformed floors across Central California with professional-grade polyurea and polyaspartic coatings — not the big-box-store epoxy kits. Our coatings cure in 4 hours (not 72), handle chemicals, hot tires, and heavy loads, and come in dozens of colors and flake patterns.",
    highlights: [
      { icon: "zap",         text: "Polyurea & polyaspartic coating — same-day drive-on, not 72-hour cure epoxy kits" },
      { icon: "shield-check", text: "10-year coating warranty — chip, peel, and hot-tire transfer resistant" },
      { icon: "star",        text: "Dozens of colors and flake patterns — custom looks for every space" },
    ],
  },

  services: [
    { icon: "home",     image: "/service-1.jpg", title: "Garage Floor Coating",        desc: "Full-broadcast color flake over polyurea base. UV-stable topcoat. Hot-tire and chemical resistant. Cure in 4 hours — park same day.", urgent: false },
    { icon: "building", image: "/service-2.jpg", title: "Commercial Flooring",          desc: "Showrooms, retail, restaurants, medical offices, gyms. Decorative and industrial coatings with slip-resistant additives and FDA-compliant options.", urgent: false },
    { icon: "layers",   image: "/service-3.jpg", title: "Metallic Epoxy Floors",        desc: "Swirled metallic pearl finishes — each floor is one-of-a-kind. Ideal for upscale garages, showrooms, home bars, and basements.", urgent: false },
    { icon: "shield",   image: "/service-4.jpg", title: "Industrial Floor Coatings",    desc: "Heavy forklift traffic, chemical exposure, impact resistance. MIL-spec and FDA-compliant options. Surface prep to SSPC standards.", urgent: false },
    { icon: "sparkles", image: "/service-5.jpg", title: "Concrete Grinding & Prep",     desc: "Diamond grinding and shot-blasting to proper CSP profile. The number-one reason DIY coatings peel is bad prep — we don't cut corners here.", urgent: false },
    { icon: "droplets", image: "/service-6.jpg", title: "Concrete Sealing & Staining",  desc: "Penetrating sealers and acid stains for patios, driveways, and walkways. Low maintenance, UV-stable, and beautiful.", urgent: false },
  ],

  testimonials: [
    { name: "Steve W.",    location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=steve_tracy_epoxy",    text: "Three-car garage with full-broadcast flake. Cars were back in same day. 2 years later it looks exactly the same — no chips, no peeling. Wish I'd done this sooner." },
    { name: "Lisa M.",     location: "Manteca, CA",  stars: 5, avatar: "https://i.pravatar.cc/80?u=lisa_manteca_epoxy",  text: "Metallic floor in our home bar area. Every single person who sees it asks who did it. The process took one day. The result is stunning." },
    { name: "Jerry K.",    location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=jerry_stockton_epoxy", text: "Commercial kitchen floor. FDA compliant, non-slip, holds up to constant foot traffic and cleaning chemicals. Far better than the tile we replaced." },
  ],

  trustBadges: [
    "CSLB C-33 Licensed",
    "10-Year Coating Warranty",
    "Same-Day Drive-On",
    "Polyurea Not Cheap Epoxy",
    "Commercial & Residential",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.9,  label: "Google Rating",     suffix: "★",  decimals: 1 },
    { value: 267,  label: "Floors Coated",     suffix: "+",  decimals: 0 },
    { value: 12,   label: "Years Experience",  suffix: "+",  decimals: 0 },
    { value: 4,    label: "Hour Cure Time",    suffix: "hr",  decimals: 0 },
  ],

  reasons: [
    { icon: "zap",          title: "Polyurea — Not Epoxy Kits", desc: "We use professional polyurea and polyaspartic — not the $150 kits from the hardware store. Faster cure, harder film, and no hot-tire transfer." },
    { icon: "shield-check", title: "10-Year Warranty",           desc: "We warrant our coatings against peeling and chipping for 10 years. That warranty is worthless if the prep work fails — so we never rush it." },
    { icon: "star",         title: "Same-Day Usability",         desc: "Park your car back in the garage the same day. Our topcoat is foot-traffic-ready in 1 hour and vehicle-ready in 4." },
    { icon: "layers",       title: "Surface Prep Experts",       desc: "Diamond grinding to the proper concrete surface profile is everything. Poor prep = peeling. We grind until the profile is right." },
    { icon: "award",        title: "Custom Design",              desc: "Dozens of flake blends, metallic colors, and solid tones. We'll show you samples on your actual floor before committing." },
    { icon: "building",     title: "Commercial Certified",       desc: "USDA-approved, FDA-compliant, and ADA slip-resistant coatings available. We work with architects and general contractors." },
  ],

  faq: [
    { q: "Why is professional coating better than a kit?", a: "Professional polyurea coatings are 4x harder than consumer epoxy kits, cure in hours instead of days, and won't lift from hot tire contact. The prep process is also completely different." },
    { q: "How long before I can park my car?", a: "With our polyurea topcoat, vehicles can return in 4 hours. Foot traffic in 1 hour. This is vastly faster than standard epoxy." },
    { q: "Do you prep the concrete first?", a: "Always. Diamond grinding to ICRI surface profile 3–4 is required for proper adhesion. This is the most important step and we never skip it." },
    { q: "Can you coat a floor with cracks?", a: "Yes — hairline and shrinkage cracks are filled and ground flush. Large structural cracks are repaired before coating." },
    { q: "How do I maintain an epoxy floor?", a: "Sweep or blow it off. Mop with a neutral cleaner. That's it. No waxing, no sealing, no re-coating for years." },
  ],

  formServiceOptions: [
    "Garage Floor",
    "Commercial / Retail Floor",
    "Metallic Epoxy",
    "Industrial Floor",
    "Concrete Sealing / Staining",
    "Other / Not Sure",
  ],
}
