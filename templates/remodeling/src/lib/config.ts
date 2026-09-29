import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
  city: "Tracy",
  theme: "clean",
  niche: "remodeling",
  name: "Craftsman Home Remodeling",
  tagline: "Built With Pride. Built to Last.",
  phone: "(555) 678-9012",
  phoneHref: "tel:+15556789012",
  email: "hello@craftsmanremodel.com",
  address: "Tracy, California",
  serviceAreas: ["Tracy", "Stockton", "Modesto", "Manteca", "Dublin", "Pleasanton"],
  license: "CSLB #654321",
  since: "2008",
  google_rating: "4.8",
  review_count: "198",
  emergency: false,
  social: { google: "https://google.com", yelp: "https://yelp.com", facebook: "https://facebook.com" },
},

  services: [
  { icon: "utensils", image: "/service-1.jpg", title: "Kitchen Remodel",     desc: "Custom cabinets, quartz countertops, full layout redesigns. Transform your kitchen into the heart of your home.", urgent: false },
  { icon: "bath",     image: "/service-2.jpg", title: "Bathroom Renovation", desc: "Walk-in showers, soaking tubs, double vanities. Spa-level bathrooms that add immediate home value.", urgent: false },
  { icon: "home",     image: "/service-3.jpg", title: "Room Additions",      desc: "Expand your living space without moving. Master suites, family rooms, ADUs built to code and on budget.", urgent: false },
  { icon: "layers",   image: "/service-4.jpg", title: "Flooring",            desc: "Hardwood, LVP, tile, and carpet. Expert installation for all flooring types throughout your home.", urgent: false },
  { icon: "sun",      image: "/service-5.jpg", title: "Deck & Outdoor",      desc: "Custom decks, pergolas, and outdoor kitchens. Extend your living space outdoors.", urgent: false },
  { icon: "tool",     image: "/service-6.jpg", title: "Full Home Renovation", desc: "Complete gut-and-rebuild or whole-home refresh. One contractor for every trade. Clear timeline, no surprises.", urgent: false },
],

  about: {
    heading: "Your Home Deserves More Than a Handshake and a Guess",
    body: "Since 2008, Craftsman has transformed kitchens, bathrooms, and entire homes across Tracy and the Bay Area — on time, on budget, with written contracts that protect you at every step. One contractor for every trade. 3D design previews before a single wall comes down. Licensed, insured, and backed by a 10-year workmanship warranty.",
    highlights: [
      { icon: "users",  text: "Dedicated project manager — one point of contact from design to final walkthrough" },
      { icon: "star",   text: "3D design preview — see the finished result before demolition ever starts" },
      { icon: "clock",  text: "On-time guarantee — written completion date in every contract, daily credit if missed" },
    ],
  },

  testimonials: [
  { name: "Kevin H.", location: "Tracy, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=kevin_tracy_remodeling", text: "Full kitchen remodel in 3 weeks. They stuck to the budget and timeline. The craftsmanship is stunning — every guest asks who did it." },
  { name: "Lisa W.", location: "Dublin, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=lisa_dublin_remodeling", text: "Master bath renovation was beyond our expectations. Heated floors, custom tile, frameless glass. It looks like a $50k job. They beat every quote we got." },
  { name: "Mark & Amy D.", location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=mark_stockton_remodeling", text: "Added a 400 sq ft family room addition. Permits pulled, work done in 6 weeks. Seamlessly matches the original house. Worth every dollar." },
],

  trustBadges: [
  "Licensed General Contractor", "Design + Build", "On Budget Guarantee",
  "15 Years Experience", "Financing Available", "Free Design Consultation"
],

  stats: [
  { value: 4.8,  label: "Google Rating",        suffix: "★",  decimals: 1 },
  { value: 990,  label: "Projects Completed",   suffix: "+",  decimals: 0 },
  { value: 18,   label: "Years Experience",     suffix: "+",  decimals: 0 },
  { value: 10,   label: "Year Warranty",        suffix: "yr", decimals: 0 },
],

  reasons: [
  { "icon": "award", "title": "Licensed Contractor", "desc": "CA General Contractor License. Every trade is licensed — no unlicensed subs, ever." },
  { "icon": "users", "title": "Dedicated Project Manager", "desc": "One point of contact from design to final walkthrough. Never chasing down who's responsible." },
  { "icon": "thumbs-up", "title": "On-Time Guarantee", "desc": "Written completion date in every contract. We miss it — you get a daily credit until we finish." },
  { "icon": "star", "title": "3D Design Preview", "desc": "See your remodel before demolition starts. Full 3D renders with your actual materials and finishes." },
  { "icon": "shield", "title": "Permit Ready", "desc": "We pull every required permit. Work done without permits can't be insured or sold — we protect you." },
  { "icon": "clock", "title": "10-Year Workmanship Warranty", "desc": "The longest warranty in the valley. If something fails due to our work, we fix it — period." }
],

  formServiceOptions: [
  "Kitchen Remodel",
  "Bathroom Renovation",
  "Room Additions",
  "Flooring",
  "Deck & Outdoor Living",
  "Full Home Renovation",
],

  faq: [
    {
      q: "How long does a kitchen remodel take?",
      a: "A standard kitchen remodel (cabinets, counters, appliances) takes 3–5 weeks. Full layout changes or custom cabinetry can run 6–8 weeks. We'll give you a firm timeline in the contract before any work begins.",
    },
    {
      q: "How much does a bathroom renovation cost?",
      a: "A mid-range bathroom renovation runs $12,000–$25,000 depending on size and fixtures. High-end renovations with heated floors and custom tile start around $30,000. We'll give you an itemized quote after the design consultation.",
    },
    {
      q: "Do I need permits for a remodel?",
      a: "Structural changes, additions, and electrical/plumbing work require permits. We pull every required permit — work done without permits can invalidate your homeowner's insurance and create problems when you sell.",
    },
    {
      q: "Can you show me what it will look like before you start?",
      a: "Yes. Every project includes full 3D renders with your actual materials, finishes, and fixtures. You'll see it and approve it before a single wall comes down.",
    },
    {
      q: "Do you do design as well as construction?",
      a: "Yes. We're a design-build firm — one team handles everything from concept to completion. No separate architect or designer needed.",
    },
    {
      q: "What warranty do you offer?",
      a: "We provide a 10-year workmanship warranty — the longest in the valley. If anything fails due to our work within 10 years, we fix it at no cost. Materials are backed separately by manufacturer warranties.",
    },
  ],
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
