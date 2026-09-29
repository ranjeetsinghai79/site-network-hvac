import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
  city: "Tracy",
  theme: "clean",
  niche: "junk-removal",
  name: "Green Haul Junk Removal",
  tagline: "We Haul It. You Forget It.",
  phone: "(555) 890-1234",
  phoneHref: "tel:+15558901234",
  email: "hello@greenhaul.com",
  address: "Tracy, California",
  serviceAreas: ["Tracy", "Stockton", "Modesto", "Manteca", "Turlock", "Merced"],
  license: "CA Business #890123",
  since: "2016",
  google_rating: "4.9",
  review_count: "341",
  emergency: true,
  social: { google: "https://google.com", yelp: "https://yelp.com", facebook: "https://facebook.com" },
},

  services: [
  { icon: "sofa",      image: "/service-1.jpg", title: "Furniture Removal",    desc: "Sofas, beds, dressers, tables — we load and haul it all. Same-day available. No disassembly required.", urgent: false },
  { icon: "zap",       image: "/service-2.jpg", title: "Appliance Removal",    desc: "Refrigerators, washers, dryers, AC units. We recycle and donate whenever possible.", urgent: false },
  { icon: "home",      image: "/service-3.jpg", title: "Estate Cleanouts",     desc: "Compassionate whole-home cleanouts for estates, foreclosures, and hoarder situations. Discreet and efficient.", urgent: false },
  { icon: "hard-hat",  image: "/service-4.jpg", title: "Construction Debris",  desc: "Drywall, lumber, concrete, flooring scrap. Fast commercial and residential jobsite cleanup.", urgent: false },
  { icon: "tree-pine", image: "/service-5.jpg", title: "Yard Debris",          desc: "Tree trimmings, brush, old fencing, sheds, and more. We leave your property spotless.", urgent: false },
  { icon: "truck",     image: "/service-6.jpg", title: "Same-Day Service",     desc: "Call by noon for same-day haul. Most jobs booked and completed within 2 hours.", urgent: true },
],

  about: {
    heading: "We Haul It All — Same Day, No Surprises",
    body: "Since 2016, Green Haul has cleared 1,700+ loads across Tracy and the Central Valley. From single-item pickups to full estate cleanouts, we show up on time, give you a price before loading a single item, and leave the space spotless. We divert 70%+ of what we haul — donated, recycled, or responsibly disposed.",
    highlights: [
      { icon: "clock",        text: "Same-day service — call before noon and we're there today" },
      { icon: "dollar-sign",  text: "Upfront pricing — you approve the quote before we load anything" },
      { icon: "heart",        text: "Eco-friendly — 70%+ donated or recycled, never straight to landfill" },
    ],
  },

  testimonials: [
  { name: "Karen M.", location: "Tracy, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=karen_tracy_junkremoval", text: "Cleaned out my late mother's house in one day. Respectful, fast, and donated her furniture to local families. Felt right." },
  { name: "Contractor P.", location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=contractor_stockton_junkremoval", text: "Use Green Haul on every job site. They show up on time, clear debris fast, and the price is always fair. Best in the valley." },
  { name: "Alice T.", location: "Manteca, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=alice_manteca_junkremoval", text: "Called at 10am, they were here by noon. Took two old sofas and a pile of junk from the garage. Gone in 45 minutes. Incredible service." },
],

  trustBadges: [
  "Same-Day Available", "Eco-Friendly Disposal", "Licensed & Insured",
  "No Hidden Fees", "We Donate + Recycle", "Free Upfront Quotes"
],

  stats: [
  { value: 4.9,  label: "Google Rating",        suffix: "★",  decimals: 1 },
  { value: 1705, label: "Loads Hauled",         suffix: "+",  decimals: 0 },
  { value: 10,   label: "Years Experience",     suffix: "+",  decimals: 0 },
  { value: 70,   label: "Diverted from Landfill", suffix: "%", decimals: 0 },
],

  reasons: [
  { "icon": "clock", "title": "Same-Day Available", "desc": "Call before noon, gone today. Estate cleanouts, hoarder situations, post-renovation debris — we move fast." },
  { "icon": "dollar-sign", "title": "Upfront Pricing", "desc": "We look at the junk, give a price, you approve. No surprise charges when the truck is loaded." },
  { "icon": "heart", "title": "Donate & Recycle", "desc": "We divert 70%+ of what we haul. Usable items go to Habitat for Humanity, Goodwill, and local shelters." },
  { "icon": "shield", "title": "No Hidden Fees", "desc": "Fuel, dump fees, labor — all included in the quote. The price we say is the price you pay." },
  { "icon": "award", "title": "Fully Insured", "desc": "General liability + cargo insurance. We're bonded. Your property is protected while we work." },
  { "icon": "droplets", "title": "Eco-Friendly Disposal", "desc": "Certified e-waste disposal. Hazardous materials handled by certified carriers. We follow the rules." }
],

  formServiceOptions: [
  "Furniture Removal",
  "Appliance Removal",
  "Estate Cleanouts",
  "Construction Debris",
  "Yard Debris",
  "Same-Day Service",
],

  faq: [
    {
      q: "Can you really come same day?",
      a: "If you call before noon, we can typically dispatch the same day. For estate cleanouts or large commercial jobs, next-day is more common. We'll give you an honest ETA when you call.",
    },
    {
      q: "How do you price junk removal?",
      a: "We price by volume — how much of the truck your items fill. You get an upfront quote when we look at the junk. No loading starts until you approve the price. Fuel, dump fees, and labor are all included.",
    },
    {
      q: "Will you donate or recycle my items?",
      a: "We divert 70%+ of everything we haul. Furniture and household goods go to Habitat for Humanity, Goodwill, and local shelters. Electronics go to certified e-waste recyclers. Landfill is the last resort.",
    },
    {
      q: "Can you handle hazardous materials?",
      a: "Some, not all. We handle old electronics, fluorescent bulbs, and motor oil with certified carriers. We can't accept asbestos, biohazard materials, or certain chemicals. Call us and we'll tell you exactly what we can take.",
    },
    {
      q: "Do I need to be there for the pickup?",
      a: "You don't need to be present as long as you can show us what to take. Many clients leave items outside with a card on file. For estate cleanouts and large jobs, we recommend being available for walk-through.",
    },
    {
      q: "What areas do you serve?",
      a: "We serve Tracy, Stockton, Modesto, Manteca, Turlock, and Merced. For large commercial jobs, we'll travel further — just ask.",
    },
  ],
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
