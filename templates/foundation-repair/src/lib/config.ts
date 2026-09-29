import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "foundation-repair",
    name: "Solid Ground Foundation Repair",
    tagline: "Stop Cracks. Stabilize Everything.",
    phone: "(555) 876-0234",
    phoneHref: "tel:+15558760234",
    email: "hello@solidgroundrepair.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Stockton", "Modesto", "Manteca", "Turlock", "Fresno"],
    license: "CSLB #C-61 #667890",
    since: "2006",
    google_rating: "4.8",
    review_count: "298",
    emergency: true,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "Structural Engineers On Staff — We Fix What Others Are Afraid to Quote",
    body: "Since 2006, Solid Ground has stabilized foundations across Central Valley homes using engineered pier systems, wall anchors, and helical piles. We have licensed structural engineers on staff — not just salespeople. Our repairs come with a transferable lifetime warranty and are fully permitted.",
    highlights: [
      { icon: "shield-check", text: "Licensed structural engineers on staff — not just sales estimators" },
      { icon: "award",        text: "Transferable lifetime warranty — value follows the home, not the owner" },
      { icon: "clock",        text: "Emergency stabilization available — same-day response for active movement" },
    ],
  },

  services: [
    { icon: "arrow-down",    image: "/service-1.jpg", title: "Pier Systems",              desc: "Steel push piers and helical piers driven to bedrock to permanently stop foundation settlement. Engineered solution with lifetime warranty.", urgent: false },
    { icon: "shield",        image: "/service-2.jpg", title: "Wall Crack Repair",          desc: "Carbon fiber straps, wall anchors, and helical tiebacks to stabilize bowing or leaning basement and crawl space walls.", urgent: false },
    { icon: "home",          image: "/service-3.jpg", title: "Crawl Space Repair",         desc: "Sagging floors, rotted beams, failing joists, and encapsulation. SmartJack adjustable support posts backed by manufacturer warranty.", urgent: false },
    { icon: "search",        image: "/service-4.jpg", title: "Foundation Inspection",       desc: "Full written inspection report with photos. Identifies active vs. historic movement. We show you exactly what needs repair and what doesn't.", urgent: false },
    { icon: "droplets",      image: "/service-5.jpg", title: "Waterproofing",               desc: "Interior and exterior drain tile systems, sump pumps, and vapor barriers. Keeps water out of basements and crawl spaces permanently.", urgent: false },
    { icon: "zap",           image: "/service-6.jpg", title: "Void Fill & Slab Lifting",   desc: "Polyurethane foam injection lifts and stabilizes concrete slabs — driveways, floors, stoops. No excavation, same-day cure.", urgent: true },
  ],

  testimonials: [
    { name: "Bill A.",     location: "Tracy, CA",   stars: 5, avatar: "https://i.pravatar.cc/80?u=bill_tracy_foundation",   text: "Three companies came out and gave me vague quotes. Solid Ground sent a structural engineer who showed me exactly what was happening and why. Trust earned immediately." },
    { name: "Connie R.",   location: "Modesto, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=connie_modesto_foundation", text: "Foundation had been settling for years. Pier system installed, floors leveled back, doors and windows close properly again. Lifetime warranty transferred when I sold the house." },
    { name: "Marcus T.",   location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=marcus_stockton_foundation", text: "Crawl space was a disaster — sagging floor, rotted beams. Solid Ground replaced everything and encapsulated. Can't believe what was under my house." },
  ],

  trustBadges: [
    "CSLB Licensed C-61",
    "Structural Engineers On Staff",
    "Transferable Lifetime Warranty",
    "Permitted Work Only",
    "Free Inspections",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.8,  label: "Google Rating",         suffix: "★",  decimals: 1 },
    { value: 298,  label: "Foundations Repaired",  suffix: "+",  decimals: 0 },
    { value: 18,   label: "Years Experience",      suffix: "+",  decimals: 0 },
    { value: 100,  label: "Lifetime Warranty",     suffix: "%",  decimals: 0 },
  ],

  reasons: [
    { icon: "award",        title: "Engineers On Staff",      desc: "Licensed structural engineers assess every job — not commissioned salespeople pushing upsells." },
    { icon: "shield-check", title: "Lifetime Warranty",       desc: "Transferable to the next homeowner. Our warranty is a selling point, not a liability." },
    { icon: "home",         title: "Fully Permitted Work",    desc: "Every repair is permitted through the city. Passing inspection is standard — not optional." },
    { icon: "search",       title: "Honest Inspection",       desc: "We tell you what needs repair and what doesn't. We've saved homeowners thousands by not overselling." },
    { icon: "zap",          title: "Proven Pier Systems",     desc: "Earth Contact Products piers with load-tested ratings. Not contractor-grade — engineered structural solutions." },
    { icon: "clock",        title: "Emergency Response",      desc: "Active foundation movement doesn't wait. We dispatch stabilization crews same-day when structural emergency is confirmed." },
  ],

  faq: [
    { q: "How do I know if my foundation needs repair?", a: "Look for diagonal cracks in drywall, doors/windows that stick, sloping floors, gaps between walls and ceiling, or water in the basement. Call us for a free inspection." },
    { q: "How long does foundation repair take?", a: "Most pier installations take 1–2 days. Crawl space repairs vary by scope. We give you a realistic timeline at the inspection." },
    { q: "Does the warranty transfer when I sell my home?", a: "Yes — our lifetime warranty is fully transferable. Many of our customers use it as a selling point when listing their home." },
    { q: "Is the work permitted?", a: "Always. We pull permits, schedule inspections, and provide final documentation. No unpermitted work — ever." },
    { q: "What causes foundation settlement in Tracy?", a: "Expansive clay soils in the Central Valley shrink in summer and swell in winter, causing movement. Proper pier systems transfer load to stable soil or bedrock below the active zone." },
  ],

  formServiceOptions: [
    "Foundation Settlement / Piers",
    "Wall Cracks / Bowing Walls",
    "Crawl Space Repair",
    "Foundation Inspection",
    "Basement Waterproofing",
    "Slab Lifting / Void Fill",
  ],
}
