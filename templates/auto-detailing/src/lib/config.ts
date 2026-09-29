import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
  city: "Tracy",
  theme: "clean",
  niche: "auto-detailing",
  name: "Apex Auto Detailing",
  tagline: "Every Detail. Perfected.",
  phone: "(555) 012-3456",
  phoneHref: "tel:+15550123456",
  email: "hello@apexautodetail.com",
  address: "Tracy, California",
  serviceAreas: ["Tracy", "Stockton", "Modesto", "Manteca", "Pleasanton", "Livermore"],
  license: "CA Business #012345",
  since: "2014",
  google_rating: "5.0",
  review_count: "276",
  emergency: false,
  social: { google: "https://google.com", yelp: "https://yelp.com", facebook: "https://facebook.com" },
},

  services: [
  { icon: "sparkles", image: "/service-1.jpg", title: "Ceramic Coating",    desc: "9H hardness nano-ceramic protection. 5-year warranty. Hydrophobic, scratch-resistant, showroom shine that lasts years.", urgent: false },
  { icon: "star",     image: "/service-2.jpg", title: "Paint Correction",   desc: "Multi-stage machine polishing removes swirls, scratches, and oxidation. Restore your car's true shine.", urgent: false },
  { icon: "zap",      image: "/service-3.jpg", title: "Full Detail Package", desc: "Interior + exterior deep clean. Clay bar, hand wax, leather conditioning, engine bay. The full treatment.", urgent: false },
  { icon: "droplets", image: "/service-4.jpg", title: "Interior Detail",    desc: "Deep extraction shampoo, leather cleaning and conditioning, dashboard and trim dressing. Fresh from the inside.", urgent: false },
  { icon: "shield",   image: "/service-5.jpg", title: "PPF (Paint Film)",   desc: "Self-healing urethane film for bumpers, hoods, mirrors. Invisible protection against rock chips and scratches.", urgent: false },
  { icon: "sun",      image: "/service-6.jpg", title: "Window Tinting",     desc: "Premium ceramic tint. Heat rejection, UV protection, privacy. Legal limits honored. Lifetime warranty.", urgent: false },
],

  about: {
    heading: "Your Car Deserves Better Than a Gas Station Wash",
    body: "Since 2014, Apex has detailed 1,380+ vehicles across Tracy, the Bay Area, and the Central Valley. Ceramic Pro certified. Gyeon and Gtechniq authorized installer. From paint correction to PPF and ceramic coating, we use the same premium products as top European detailing shops — and back every ceramic coat with a 5-year warranty.",
    highlights: [
      { icon: "award",   text: "Ceramic Pro certified — manufacturer-backed 5-year warranty on all coatings" },
      { icon: "star",    text: "Paint correction specialists — swirls, scratches, and oxidation removed before any coating" },
      { icon: "truck",   text: "Mobile service available — we come to your home or office, no waiting at a shop" },
    ],
  },

  testimonials: [
  { name: "Marcus J.", location: "Tracy, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=marcus_tracy_autodetail", text: "Ceramic coated my BMW last year. Water beads off like nothing. Hasn't been to a car wash since. Worth every single dollar." },
  { name: "Tyler R.", location: "Pleasanton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=tyler_pleasanton_autodetail", text: "Paint correction on my 10-year-old Mustang made it look brand new. The swirl marks are completely gone. Insane transformation." },
  { name: "David K.", location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=david_stockton_autodetail", text: "Full interior detail after a road trip disaster. Kids had destroyed it. Looks like I just drove it off the lot. Literally perfect." },
],

  trustBadges: [
  "Ceramic Pro Certified", "Paint Correction Specialists", "5-Star Google Rated",
  "5-Year Ceramic Warranty", "Mobile Service Available", "Free Estimates"
],

  stats: [
  { value: 5,    label: "Google Rating",        suffix: "★",   decimals: 1 },
  { value: 1380, label: "Vehicles Detailed",    suffix: "+",   decimals: 0 },
  { value: 12,   label: "Years Experience",     suffix: "+",   decimals: 0 },
  { value: 5,    label: "Ceramic Warranty",     suffix: "-yr", decimals: 0 },
],

  reasons: [
  { "icon": "award", "title": "Ceramic Coating Certified", "desc": "IDA-certified detailer. Gyeon and Gtechniq authorized installer. Protection that lasts years, not weeks." },
  { "icon": "star", "title": "Paint Correction", "desc": "Swirl marks, scratches, oxidation removed before any coating. We don't just cover problems — we fix them." },
  { "icon": "droplets", "title": "Interior Steam Clean", "desc": "Chemical-free steam sanitization kills bacteria and odors. No harsh solvents near your leather or plastics." },
  { "icon": "truck", "title": "Mobile Service Available", "desc": "We come to your home or office. No waiting at a shop — we work around your schedule." },
  { "icon": "shield", "title": "Insured & Bonded", "desc": "Full coverage for any accidental damage while your vehicle is in our care. Zero risk to you." },
  { "icon": "sparkles", "title": "Premium Products Only", "desc": "Koch Chemie, CarPro, Gyeon — same products used in high-end European detailing shops." }
],

  formServiceOptions: [
  "Ceramic Coating",
  "Paint Correction",
  "Full Detail Package",
  "Interior Detail",
  "PPF (Paint Film)",
  "Window Tinting",
],

  faq: [
    {
      q: "How long does ceramic coating last?",
      a: "Our ceramic coatings are rated for 5 years with proper maintenance. We back it with a written 5-year warranty — if the hydrophobic properties fail before then, we recoat at no charge.",
    },
    {
      q: "What is paint correction and do I need it?",
      a: "Paint correction removes swirl marks, scratches, and oxidation through machine polishing. If your car has swirls visible in sunlight, correction makes a dramatic difference. We always recommend correction before any ceramic coating.",
    },
    {
      q: "Can you come to my home or office?",
      a: "Yes. Our mobile service covers Tracy, Stockton, Modesto, Manteca, Pleasanton, and Livermore. We bring everything needed — water, power, all equipment. Most details are completed at your location in 3–6 hours.",
    },
    {
      q: "How much does ceramic coating cost?",
      a: "Single-stage coating (3-year): $699–$999. Premium 5-year coating with paint correction: $1,400–$1,800 depending on vehicle size and paint condition. Free paint assessment before quoting.",
    },
    {
      q: "How long do I have to wait after a detail?",
      a: "Exterior details can get wet immediately. Ceramic coatings need 7 days cure time before washing. We'll give you a care sheet specific to your treatment at pickup.",
    },
    {
      q: "What brands of products do you use?",
      a: "Koch Chemie, CarPro, Gyeon, and Gtechniq — the same products used in top European detailing shops. No cheap consumer-grade wax or sealant. Your investment deserves the best.",
    },
  ],
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
