import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "pressure-washing",
    name: "HydroBlast Pro",
    tagline: "Blast It Clean. One Pass.",
    phone: "(555) 432-0987",
    phoneHref: "tel:+15554320987",
    email: "hello@hydroblastpro.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Mountain House", "Manteca", "Stockton", "Modesto", "Turlock"],
    since: "2014",
    google_rating: "4.9",
    review_count: "341",
    emergency: false,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "Hot Water, High Pressure — Your Property Back to Factory Fresh",
    body: "HydroBlast Pro uses professional hot-water and soft-wash systems to safely clean every surface without damage. No bleach stains on your landscaping, no stripped paint, no blown-out mortar — just clean. Commercial accounts and residential properties across the Central Valley since 2014.",
    highlights: [
      { icon: "zap",         text: "Hot-water systems — removes grease, oil, and biological growth others leave behind" },
      { icon: "shield-check", text: "Soft-wash for delicate surfaces — roofs, stucco, wood siding, painted surfaces" },
      { icon: "droplets",    text: "Commercial & residential — HOA lots, driveways, fleet vehicles, warehouses" },
    ],
  },

  services: [
    { icon: "home",        image: "/service-1.jpg", title: "Driveway & Concrete",        desc: "Hot-water pressure washing removes oil stains, tire marks, mildew, and grime from concrete and asphalt. Before & after photos with every job.", urgent: false },
    { icon: "droplets",    image: "/service-2.jpg", title: "House Exterior Wash",         desc: "Soft-wash system for vinyl siding, stucco, brick, and wood. Removes algae, mildew, and dirt without damaging paint or seals.", urgent: false },
    { icon: "sun",         image: "/service-3.jpg", title: "Deck & Patio Cleaning",       desc: "Wood, composite, pavers, concrete patios blasted clean. Prep for sealing and staining included. UV-brightener treatment available.", urgent: false },
    { icon: "building",    image: "/service-4.jpg", title: "Commercial Property",          desc: "Parking lots, storefronts, warehouses, restaurant grease pads, loading docks. Scheduled contracts and one-time jobs both available.", urgent: false },
    { icon: "layers",      image: "/service-5.jpg", title: "Roof Soft-Wash",              desc: "Low-pressure algae and moss treatment for asphalt shingles, tile, and metal roofs. Safe method that doesn't void your roof warranty.", urgent: false },
    { icon: "truck",       image: "/service-6.jpg", title: "Fleet & Equipment Wash",      desc: "Commercial vehicles, construction equipment, trailers, and agricultural equipment. On-site or at our wash station. Reclaim systems available.", urgent: false },
  ],

  testimonials: [
    { name: "Paul H.",    location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=paul_tracy_wash",    text: "15-year-old driveway looks brand new. The oil stains I thought were permanent are completely gone. Incredible result in two hours." },
    { name: "Sandra M.",  location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=sandra_stockton_wash", text: "Did our entire commercial property — parking lot, storefront, dumpster pad. HOA compliance issue resolved same week. Worth every penny." },
    { name: "Tom F.",     location: "Manteca, CA",  stars: 5, avatar: "https://i.pravatar.cc/80?u=tom_manteca_wash",   text: "Roof soft-wash eliminated the black streaks I've been staring at for years. Other companies said we needed a new roof. $350 fix." },
  ],

  trustBadges: [
    "Licensed & Insured",
    "Hot-Water Systems",
    "Soft-Wash Certified",
    "Before & After Photos",
    "Commercial Accounts",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.9,  label: "Google Rating",       suffix: "★",  decimals: 1 },
    { value: 341,  label: "Properties Cleaned",  suffix: "+",  decimals: 0 },
    { value: 10,   label: "Years Experience",    suffix: "+",  decimals: 0 },
    { value: 100,  label: "Satisfaction",        suffix: "%",  decimals: 0 },
  ],

  reasons: [
    { icon: "zap",          title: "Hot-Water Systems",    desc: "Commercial hot-water units reach 250°F — eliminates grease and biological growth that cold-water machines leave behind." },
    { icon: "shield-check", title: "No Surface Damage",    desc: "We match pressure, temperature, and chemistry to each surface. No blasted mortar, no stripped paint, no voided warranties." },
    { icon: "star",         title: "Before & After Photos", desc: "Every job is documented with before and after photos. You see exactly what changed." },
    { icon: "dollar-sign",  title: "Transparent Pricing",  desc: "Square footage pricing — you know the cost before we mobilize. No trip charges, no surprises." },
    { icon: "building",     title: "Commercial Ready",      desc: "From single driveways to multi-acre commercial properties. Reclaim water systems available for environmentally sensitive sites." },
    { icon: "users",        title: "Local Crew Only",       desc: "No franchise, no subcontractors. Same crew, same standards, every time." },
  ],

  faq: [
    { q: "Can you remove oil stains from concrete?", a: "Yes — our hot-water systems and specialized degreasers remove fresh and old oil stains. We'll tell you upfront if a stain is permanently set." },
    { q: "Will pressure washing damage my siding?", a: "We use soft-wash (low pressure + biodegradable solution) on painted surfaces and siding. It's the same method used by professional painters to prep surfaces." },
    { q: "Can you soft-wash my roof without voiding my warranty?", a: "Yes — our roof cleaning method is specifically recommended by major shingle manufacturers and won't void your warranty." },
    { q: "Do you offer commercial maintenance contracts?", a: "Yes — monthly, quarterly, and seasonal contracts available for commercial properties. Discounted rates for recurring accounts." },
    { q: "Do you haul away the water?", a: "For commercial jobs in storm-drain-sensitive areas, we use water reclamation systems to collect and properly dispose of wash water." },
  ],

  formServiceOptions: [
    "Driveway / Concrete",
    "House Exterior",
    "Deck / Patio",
    "Commercial Property",
    "Roof Soft-Wash",
    "Fleet / Equipment Wash",
  ],
}
