import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
  city: "Tracy",
  theme: "clean",
  niche: "roofing",
  name: "Peak Shield Roofing",
  tagline: "Storm-Ready. Storm-Proof.",
  phone: "(555) 234-5678",
  phoneHref: "tel:+15552345678",
  email: "hello@peakshieldroofing.com",
  address: "Tracy, California",
  serviceAreas: ["Tracy", "Stockton", "Modesto", "Manteca", "Turlock", "Lodi"],
  license: "CSLB #123987",
  since: "2005",
  google_rating: "4.8",
  review_count: "287",
  emergency: true,
  social: {
    google: "https://google.com",
    yelp: "https://yelp.com",
    facebook: "https://facebook.com",
  },
},

  services: [
  { icon: "home",            image: "/service-1.jpg", title: "Roof Replacement",    desc: "Full tear-off and replacement with 30-year architectural shingles. Manufacturer warranty + our 10-year workmanship guarantee.", urgent: false },
  { icon: "cloud-lightning", image: "/service-2.jpg", title: "Storm Damage Repair", desc: "Wind, hail, and rain damage repaired fast. We document everything for your insurance claim.", urgent: true },
  { icon: "file-text",       image: "/service-3.jpg", title: "Insurance Claims",    desc: "We work directly with your insurance adjuster. 95% of our storm repairs are fully covered.", urgent: false },
  { icon: "shield",          image: "/service-4.jpg", title: "Emergency Tarping",   desc: "Same-day emergency tarp service. 24/7 response. Protect your home while we schedule full repair.", urgent: true },
  { icon: "droplets",        image: "/service-5.jpg", title: "Gutter Installation", desc: "Seamless aluminum gutters with leaf guards. Protect your foundation and landscaping.", urgent: false },
  { icon: "search",          image: "/service-6.jpg", title: "Free Inspections",    desc: "Thorough roof inspection with photo report. Know exactly what you have before buying or selling.", urgent: false },
],

  about: {
    heading: "Storm-Ready Roofing — Backed by 21 Years of California Winters",
    body: "Since 2005, Peak Shield has protected homes across Tracy and the Central Valley from California's harshest storms. GAF Master Elite certified — top 3% of roofers nationwide. We pull every permit, document every job for insurance, and back our work with a 10-year workmanship warranty. Over 1,400 roofs replaced, zero unresolved insurance claims.",
    highlights: [
      { icon: "clock",        text: "Same-day emergency tarping — storm damage contained within hours" },
      { icon: "shield",       text: "GAF Master Elite certified — manufacturer-backed system warranty included" },
      { icon: "dollar-sign",  text: "Insurance claim experts — 95% of storm repairs fully covered, we handle the adjuster" },
    ],
  },

  testimonials: [
  {
    name: "Robert M.",
    location: "Tracy, CA",
    stars: 5,
    avatar: "https://i.pravatar.cc/80?u=robert_tracy_roofing",
    text: "Hail storm took out half our roof. Peak Shield had emergency tarps up same day, full replacement done in 3 days. Insurance paid everything.",
  },
  {
    name: "Sarah L.",
    location: "Stockton, CA",
    stars: 5,
    avatar: "https://i.pravatar.cc/80?u=sarah_stockton_roofing",
    text: "They handled the entire insurance claim for us. Didn't pay a dollar out of pocket. New roof looks better than the original.",
  },
  {
    name: "Tom K.",
    location: "Manteca, CA",
    stars: 5,
    avatar: "https://i.pravatar.cc/80?u=tom_manteca_roofing",
    text: "Pre-listing inspection found issues the buyer's inspector would've caught. Fixed it fast, sold for full price. Worth every penny.",
  },
],

  trustBadges: [
  "Licensed & Insured",
  "Storm Damage Specialists",
  "Insurance Claim Experts",
  "GAF Master Elite Contractor",
  "Lifetime Warranty Available",
  "Free Inspections",
],

  stats: [
  { value: 4.8,  label: "Google Rating",       suffix: "★",  decimals: 1 },
  { value: 1435, label: "Roofs Replaced",       suffix: "+",  decimals: 0 },
  { value: 21,   label: "Years Experience",     suffix: "+",  decimals: 0 },
  { value: 95,   label: "Insurance Covered",    suffix: "%",  decimals: 0 },
],

  reasons: [
  { "icon": "award", "title": "Licensed & Insured", "desc": "CA Contractor License #987654. Full liability and worker's comp — never a liability to you." },
  { "icon": "shield", "title": "50-Year Warranty Available", "desc": "GAF and Owens Corning certified installer. Manufacturer-backed system warranties on qualifying roofs." },
  { "icon": "zap", "title": "Emergency Tarping", "desc": "Leak or storm damage? We tarp within hours to stop damage from spreading while you wait for repairs." },
  { "icon": "dollar-sign", "title": "Insurance Claims Help", "desc": "We work directly with your insurance adjuster. Most clients pay only their deductible." },
  { "icon": "star", "title": "Free Inspections", "desc": "Drone inspection + written report at no charge. Know exactly what your roof needs before you decide." },
  { "icon": "users", "title": "Local Roofers", "desc": "We've reroofed 800+ homes in this valley. Our reputation is everything — we live here too." }
],

  formServiceOptions: [
  "Roof Replacement",
  "Storm Damage Repair",
  "Insurance Claims",
  "Emergency Tarping",
  "Gutter Installation",
  "Free Inspections",
],

  faq: [
    {
      q: "Will my insurance cover the roof replacement?",
      a: "Most storm damage is covered. We work directly with your adjuster and document everything — hail size, impact patterns, photos. 95% of our storm repairs are fully covered. We've never had a legitimate claim denied when we prepared the documentation.",
    },
    {
      q: "How long does a roof replacement take?",
      a: "Most residential replacements are completed in 1–2 days. A 2,000 sq ft home typically takes one full day from tear-off to cleanup. We leave your property clean — no nails in the driveway, debris removed same day.",
    },
    {
      q: "What is a GAF Master Elite certification?",
      a: "It's the highest certification GAF awards, given to only the top 3% of roofing contractors. It qualifies us to offer the Golden Pledge warranty — the strongest manufacturer warranty available, backed by GAF directly.",
    },
    {
      q: "Do I need to be home during the replacement?",
      a: "No. Most homeowners leave for the day and return to a finished roof. We just need access to the property. We'll send before/after photos and lock up when done.",
    },
    {
      q: "Do you offer any warranty?",
      a: "Yes. Manufacturer warranty (25–50 years on materials depending on product) plus our 10-year workmanship guarantee. If anything fails due to installation, we fix it at no cost.",
    },
    {
      q: "How do I know if I need a repair or full replacement?",
      a: "We do a free drone inspection with a written photo report. Under 25% damage often means repair. Over 25%, or if the roof is 15+ years old, replacement usually costs less long-term. We'll give you an honest recommendation — we won't push replacement if repair makes sense.",
    },
  ],
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
