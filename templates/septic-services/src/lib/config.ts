import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "septic-services",
    name: "AllClear Septic Services",
    tagline: "Pumped, Inspected, Certified.",
    phone: "(555) 987-0456",
    phoneHref: "tel:+15559870456",
    email: "hello@allclearseptic.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Mountain House", "Byron", "Brentwood", "Oakley", "Manteca"],
    license: "CA RWQCB License #901234",
    since: "2007",
    google_rating: "4.8",
    review_count: "219",
    emergency: true,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "Licensed Septic Contractors — Pumping, Repairs & Inspections Since 2007",
    body: "AllClear handles every aspect of septic systems in the tri-county area — routine pumping, line jetting, field repairs, real estate inspections, and new system installations. We're licensed by the Regional Water Quality Control Board and EPA compliant on every job.",
    highlights: [
      { icon: "shield-check", text: "RWQCB licensed — all work EPA compliant, properly disposed, documented" },
      { icon: "clock",        text: "24/7 emergency pumping — septic backups don't wait for business hours" },
      { icon: "search",       text: "Real estate certifications — SFHA inspections with written report, same week" },
    ],
  },

  services: [
    { icon: "droplets",  image: "/service-1.jpg", title: "Septic Tank Pumping",        desc: "Full pump-out and rinse of tank contents. Includes visual lid and baffle inspection. Certificate of pumping provided. Residential and commercial.", urgent: false },
    { icon: "search",    image: "/service-2.jpg", title: "Septic Inspection",           desc: "Full SFHA-compliant inspection with written report. Required for real estate transactions in most counties. Turn around in 48–72 hours.", urgent: false },
    { icon: "zap",       image: "/service-3.jpg", title: "Emergency Pumping",           desc: "Sewage backup, surfacing effluent, or overflow — we dispatch 24/7. Diagnosis included with emergency call. Prevent health hazard and property damage.", urgent: true },
    { icon: "settings",  image: "/service-4.jpg", title: "Line Jetting & Snaking",      desc: "Hydro-jetting of inlet and outlet lines, drain field headers, and distribution boxes. Clears roots, grease, and buildup.", urgent: false },
    { icon: "home",      image: "/service-5.jpg", title: "Tank & Drain Field Repair",   desc: "Baffle replacement, distribution box repair, leach line restoration, and full drain field replacement when needed. Permitted work.", urgent: false },
    { icon: "truck",     image: "/service-6.jpg", title: "New System Installation",     desc: "New conventional, low-pressure dose, and advanced treatment unit (ATU) systems. Engineering, permits, installation — full turnkey.", urgent: false },
  ],

  testimonials: [
    { name: "James H.",    location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=james_tracy_septic",    text: "Septic backed up on a Sunday. AllClear was there within 2 hours, pumped and diagnosed a baffle issue. Fixed by Monday. No panic." },
    { name: "Diane F.",    location: "Byron, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=diane_byron_septic",    text: "Needed a real estate inspection for a home sale. AllClear turned the report around in 48 hours. Clean system, deal closed on time." },
    { name: "Raymond O.",  location: "Brentwood, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=raymond_brentwood_septic", text: "Used them for annual pumping for 6 years. They track our service history and remind us when it's due. Never had a surprise." },
  ],

  trustBadges: [
    "RWQCB Licensed",
    "EPA Compliant Disposal",
    "24/7 Emergency Pumping",
    "Real Estate Certifications",
    "Permitted Repairs",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.8,  label: "Google Rating",     suffix: "★",  decimals: 1 },
    { value: 219,  label: "Systems Serviced",  suffix: "+",  decimals: 0 },
    { value: 17,   label: "Years Experience",  suffix: "+",  decimals: 0 },
    { value: 2,    label: "County Service Area", suffix: "hrs", decimals: 0 },
  ],

  reasons: [
    { icon: "shield-check", title: "RWQCB Licensed",          desc: "Regional Water Quality Control Board licensed for septic work. All waste properly documented and disposed at licensed facilities." },
    { icon: "clock",        title: "24/7 Emergency",          desc: "Sewage backup is a health emergency. We run 24/7 and dispatch same-day for active situations." },
    { icon: "search",       title: "Real Estate Experts",     desc: "We know what SFHA inspectors look for and document accordingly. Turn around real estate certs in 48 hours." },
    { icon: "star",         title: "Service History Tracking", desc: "We keep records of every service visit. No more guessing when you last pumped." },
    { icon: "dollar-sign",  title: "Flat-Rate Pumping",       desc: "Standard residential pump-out is flat-rate — no per-gallon surprises. Commercial quoted by tank size." },
    { icon: "home",         title: "Full-Service Contractor",  desc: "Pumping, inspection, repair, and new installation — one company for every septic need. No referrals, no runaround." },
  ],

  faq: [
    { q: "How often should I pump my septic tank?", a: "Every 3–5 years for a typical household. We can give a specific recommendation based on tank size and household size when we pump." },
    { q: "What are signs my septic needs attention?", a: "Slow drains throughout the house, gurgling sounds, sewage odors outdoors, wet spots or lush grass over the drain field, or a backed-up toilet." },
    { q: "Do I need a septic inspection to sell my home?", a: "In most counties, yes — a certified SFHA inspection is required or strongly recommended. We provide the written report within 48–72 hours." },
    { q: "Is septic work regulated?", a: "Yes — all septic contractors must be licensed by the county and Regional Water Quality Control Board. Always verify license before hiring. Ours is #901234." },
    { q: "Can you service commercial properties?", a: "Yes — restaurants, schools, mobile home parks, and agricultural facilities. Tanks of any size, scheduled contracts available." },
  ],

  formServiceOptions: [
    "Routine Pumping",
    "Real Estate Inspection",
    "Emergency Pumping",
    "Line Jetting / Snaking",
    "Tank or Drain Field Repair",
    "New System Installation",
  ],
}
