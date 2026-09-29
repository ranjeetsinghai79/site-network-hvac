import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "landscaping",
    name: "GreenScape Landscaping",
    tagline: "Your Best Yard. All Year.",
    phone: "(555) 654-0789",
    phoneHref: "tel:+15556540789",
    email: "hello@greenscapetracy.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Mountain House", "Manteca", "Stockton", "Brentwood", "Lathrop"],
    license: "CSLB #C-27 #556789",
    since: "2010",
    google_rating: "4.9",
    review_count: "478",
    emergency: false,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      instagram: "https://instagram.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "Full-Service Landscaping That Actually Transforms Your Property",
    body: "Since 2010, GreenScape has been designing and maintaining residential and commercial landscapes across the Central Valley. We don't just mow lawns — we build outdoor spaces that increase property value and get compliments from the neighbors.",
    highlights: [
      { icon: "star",        text: "Full design-to-install service — concept, permits, planting, hardscape" },
      { icon: "droplets",    text: "Drip and smart irrigation — cut water bills 40% on average" },
      { icon: "shield-check", text: "Licensed C-27 landscaping contractor — permitted work, proper materials" },
    ],
  },

  services: [
    { icon: "home",        image: "/service-1.jpg", title: "Landscape Design & Install", desc: "Full landscape transformation — concept design, plants, sod, mulch, boulders, lighting. We handle permits. You approve the plan before we break ground.", urgent: false },
    { icon: "droplets",    image: "/service-2.jpg", title: "Irrigation Systems",          desc: "Smart drip and sprinkler installation or repair. Hunter, Rachio, and Netafim systems. Saves 30–50% on water vs traditional heads.", urgent: false },
    { icon: "sun",         image: "/service-3.jpg", title: "Lawn Maintenance",            desc: "Weekly or bi-weekly mow, edge, blow, and haul. Includes string trimming, blow-down, and same-day debris removal.", urgent: false },
    { icon: "layers",      image: "/service-4.jpg", title: "Hardscape & Pavers",          desc: "Patios, walkways, retaining walls, and outdoor kitchens. Belgard and Unilock certified installers. Permits included.", urgent: false },
    { icon: "tree",        image: "/service-5.jpg", title: "Planting & Seasonal Color",   desc: "Trees, shrubs, native plants, and seasonal flowers. Plant selection matched to Tracy's climate, soil, and sun exposure.", urgent: false },
    { icon: "sparkles",    image: "/service-6.jpg", title: "Drought-Tolerant Conversion", desc: "Replace thirsty grass with water-wise plants, decomposed granite, and drip irrigation. Qualifies for SJVMWD rebates up to $1,000.", urgent: false },
  ],

  testimonials: [
    { name: "Jennifer P.",  location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=jennifer_tracy_landscape",    text: "Complete backyard transformation — turf, patio, pergola, lighting. Every neighbor stops to ask who did it. GreenScape delivered beyond what I imagined." },
    { name: "Robert S.",    location: "Mountain House, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=robert_mh_landscape", text: "New smart irrigation cut my water bill by $80/month. The drip system keeps everything healthier than the old sprinklers ever did." },
    { name: "Angela W.",    location: "Manteca, CA",  stars: 5, avatar: "https://i.pravatar.cc/80?u=angela_manteca_landscape",  text: "Weekly maintenance crew is always on time, always thorough. My front yard has never looked this consistently good in 12 years." },
  ],

  trustBadges: [
    "C-27 Licensed Contractor",
    "Irrigaion Specialists",
    "Free Design Consultation",
    "Belgard Certified Installer",
    "Water-Wise Conversion",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.9,  label: "Google Rating",       suffix: "★",  decimals: 1 },
    { value: 478,  label: "Properties Serviced", suffix: "+",  decimals: 0 },
    { value: 14,   label: "Years Experience",    suffix: "+",  decimals: 0 },
    { value: 40,   label: "Average Water Saved",  suffix: "%",  decimals: 0 },
  ],

  reasons: [
    { icon: "award",        title: "C-27 Licensed",          desc: "Full California landscaping contractor license. Permitted installations, proper materials, work that passes inspection." },
    { icon: "droplets",     title: "Smart Irrigation",       desc: "Rachio and Hunter smart systems that adjust to weather. Real-time savings on your water bill from day one." },
    { icon: "star",         title: "Design Included",        desc: "Every install project gets a proper design — plant placement, hardscape layout, lighting plan — before we begin." },
    { icon: "dollar-sign",  title: "Rebate Help",            desc: "We handle SJVMWD water rebate applications for drought-tolerant conversions. Free money for going water-wise." },
    { icon: "shield-check", title: "Fully Insured",          desc: "General liability and workers' comp coverage. Your property is protected at every stage of work." },
    { icon: "users",        title: "Local Crew, No Subs",    desc: "Our crews are our employees, not subcontractors. Same faces, same standards, every visit." },
  ],

  faq: [
    { q: "Do you offer free estimates?", a: "Yes — on-site design consultation and written quote, no charge. We walk the property with you and present design concepts at the meeting." },
    { q: "How much does a full backyard landscape cost?", a: "A complete backyard transformation typically runs $8,000–$25,000 depending on size, hardscape, and materials. We provide itemized quotes." },
    { q: "Do you handle permits for retaining walls and patios?", a: "Yes — we pull all necessary permits and handle inspections. You don't need to contact the city directly." },
    { q: "Can you replace my lawn with drought-tolerant plants?", a: "Absolutely. We design and install drought-tolerant landscapes and help you apply for SJVMWD rebates up to $1,000." },
    { q: "How often does lawn maintenance happen?", a: "Weekly or bi-weekly depending on season and growth. We adjust frequency automatically in summer vs. winter." },
  ],

  formServiceOptions: [
    "Full Landscape Design & Install",
    "Irrigation Installation / Repair",
    "Weekly Maintenance",
    "Hardscape / Pavers",
    "Drought-Tolerant Conversion",
    "Planting & Trees",
  ],
}
