import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "basement-waterproofing",
    name: "DryShield Waterproofing",
    tagline: "Dry Basement. Permanent Solution.",
    phone: "(555) 543-0876",
    phoneHref: "tel:+15555430876",
    email: "hello@dryshieldwaterproofing.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Stockton", "Modesto", "Manteca", "Sacramento", "Turlock"],
    license: "CSLB #C-36 #778901",
    since: "2008",
    google_rating: "4.9",
    review_count: "334",
    emergency: true,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "We've Dried Over 334 Basements — Yours Will Be Next",
    body: "DryShield finds the source of water intrusion and eliminates it permanently — interior drain tile, exterior waterproofing membranes, sump systems, and vapor barriers. We don't patch symptoms. We fix the cause. Every system comes with a written transferable lifetime warranty.",
    highlights: [
      { icon: "shield-check", text: "Transferable lifetime warranty — covers the system for the life of the home" },
      { icon: "search",       text: "Free assessment — we find the exact source before recommending any solution" },
      { icon: "clock",        text: "24-hour emergency pump-out for active flooding situations" },
    ],
  },

  services: [
    { icon: "droplets",   image: "/service-1.jpg", title: "Interior Drain Tile",         desc: "Perimeter drain channel below slab level captures and redirects water to sump. Most effective solution for persistent seepage. Lifetime warranty.", urgent: false },
    { icon: "shield",     image: "/service-2.jpg", title: "Exterior Waterproofing",       desc: "Excavate foundation, apply waterproof membrane and drainage board. The only way to truly stop water before it enters the wall.", urgent: false },
    { icon: "zap",        image: "/service-3.jpg", title: "Sump Pump Installation",       desc: "Primary and battery backup sump systems. 1/3 HP to 1 HP pumps with alarm monitoring. Power outage protection included.", urgent: true },
    { icon: "layers",     image: "/service-4.jpg", title: "Crawl Space Encapsulation",    desc: "20-mil vapor barrier sealed to walls and piers. Eliminates moisture, mold, and wood rot. Dramatically reduces HVAC costs in the home above.", urgent: false },
    { icon: "home",       image: "/service-5.jpg", title: "Window Well Drains",           desc: "Basement window flooding prevention. Drain covers, gravel beds, and connected tile systems to redirect window well accumulation.", urgent: false },
    { icon: "cloud-rain", image: "/service-6.jpg", title: "Emergency Water Removal",      desc: "Active flooding? 24-hour emergency pump-out service. We extract, dry, and document for insurance. Insurance claim assistance included.", urgent: true },
  ],

  testimonials: [
    { name: "Nancy L.",    location: "Tracy, CA",      stars: 5, avatar: "https://i.pravatar.cc/80?u=nancy_tracy_water",      text: "Had 3 inches of water after every heavy rain. DryShield installed interior drain tile and a sump. Haven't had a drop in 3 years." },
    { name: "Gerald B.",   location: "Sacramento, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=gerald_sacramento_water", text: "The assessment was free and completely honest — they told us exterior waterproofing was the right solution, not the cheaper inside fix. That integrity earned my business." },
    { name: "Patricia S.", location: "Modesto, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=patricia_modesto_water",  text: "Crawl space had mold and standing water. Encapsulation solved the moisture problem and our AC runs 20% less. Incredible difference in the home." },
  ],

  trustBadges: [
    "CSLB Licensed C-36",
    "Transferable Lifetime Warranty",
    "Free Waterproofing Assessment",
    "24-Hour Emergency Service",
    "Insurance Claim Assistance",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.9,  label: "Google Rating",       suffix: "★",  decimals: 1 },
    { value: 334,  label: "Basements Dried",     suffix: "+",  decimals: 0 },
    { value: 16,   label: "Years Experience",    suffix: "+",  decimals: 0 },
    { value: 100,  label: "Transferable Warranty", suffix: "%", decimals: 0 },
  ],

  reasons: [
    { icon: "search",       title: "Find the Source First",   desc: "We diagnose the exact entry point before recommending anything. Some problems need $400 fixes. Some need $8,000 ones. We'll tell you which honestly." },
    { icon: "shield-check", title: "Lifetime Warranty",       desc: "Fully transferable to the next owner. Becomes a marketable feature when you sell your home." },
    { icon: "award",        title: "Not a Band-Aid",          desc: "We don't caulk cracks and call it done. Every solution targets the root cause — hydrostatic pressure, drainage failure, or wall penetration." },
    { icon: "clock",        title: "Emergency Response",      desc: "Flooding is an emergency. We run a 24-hour line for active water intrusion and dispatch pump-out crews same night." },
    { icon: "home",         title: "Insurance Help",          desc: "We document everything for insurance claims. Most water damage claims benefit from a professional assessment report." },
    { icon: "droplets",     title: "Proven Systems",          desc: "WaterGuard and SuperSump products from Basement Systems — the most-tested waterproofing systems in the industry." },
  ],

  faq: [
    { q: "What causes basement water problems?", a: "Hydrostatic pressure from saturated soil, cracks in foundation walls, inadequate exterior grading, and failed or missing drain tile are the most common causes." },
    { q: "Interior drain tile vs. exterior — which is better?", a: "Exterior is more thorough but costs more due to excavation. Interior drain tile effectively manages water that enters and is the right solution for most homes. We'll tell you which fits your situation." },
    { q: "How long does installation take?", a: "Interior drain tile for a full perimeter typically takes 1–2 days. Crawl space encapsulation takes 1 day for most spaces." },
    { q: "Is the warranty really transferable?", a: "Yes — our written warranty transfers to the next homeowner at no charge. Realtors and buyers view this as a major positive." },
    { q: "Will you help me file an insurance claim?", a: "Yes — we provide written assessment reports and document the damage for your insurance company. We've helped dozens of clients get claims approved." },
  ],

  formServiceOptions: [
    "Basement Seepage / Flooding",
    "Interior Drain Tile",
    "Exterior Waterproofing",
    "Sump Pump Installation",
    "Crawl Space Encapsulation",
    "Emergency Water Removal",
  ],
}
