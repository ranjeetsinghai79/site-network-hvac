import type { SiteConfig, Property } from "@core/web/types"

export const config: SiteConfig & { properties: Property[]; about: { pillars: Array<{ num: string; title: string; desc: string }> } } = {
  business: {
    name: "ARQ Real Estate",
    tagline: "Dubai's Future Lives Here.",
    phone: "+971 4 123 4567",
    phoneHref: "tel:+97141234567",
    email: "hello@arq.ae",
    address: "Level 28, Burj Daman, DIFC, Dubai, UAE",
    city: "Dubai",
    serviceAreas: ["Downtown Dubai", "Palm Jumeirah", "Dubai Marina", "Business Bay", "DIFC", "JBR"],
    since: "2015",
    google_rating: "4.9",
    review_count: "248",
    whatsapp: "https://wa.me/97141234567",
    social: { instagram: "#", linkedin: "#" },
    theme: "dubai",
    niche: "luxury-realestate",
  },

  testimonials: [
    {
      name: "Khalid Al Mansouri",
      role: "CEO, Al Mansouri Group",
      text: "ARQ found us a portfolio of 4 properties in Business Bay that delivered 12% ROI in the first year. Their market intelligence is unmatched in Dubai.",
      stars: 5,
    },
    {
      name: "Sarah Mitchell",
      role: "UK Investor",
      text: "As an overseas buyer, I was nervous. ARQ handled everything — viewings, legal, handover. My Palm Jumeirah apartment was rented within 2 weeks of completion.",
      stars: 5,
    },
    {
      name: "Rajesh Nair",
      role: "Tech Entrepreneur",
      text: "Bought my first Dubai property through ARQ. The process was seamless and the team's knowledge of upcoming developments helped me get ahead of the market.",
      stars: 5,
    },
  ],

  stats: [
    { value: "2,400+", label: "Properties Sold" },
    { value: "AED 8.2B+", label: "Total Sales Value" },
    { value: "10+", label: "Years in Dubai" },
    { value: "4.9★", label: "Client Rating" },
  ],

  formServiceOptions: [
    "Luxury Apartments",
    "Penthouses",
    "Villas",
    "Off-Plan Investment",
    "Commercial Property",
  ],

  properties: [
    {
      id: "p1",
      title: "Sky Penthouse — The Address",
      type: "Penthouse",
      location: "Downtown Dubai",
      price: "AED 18,500,000",
      beds: 4,
      baths: 5,
      area: "6,200 sq ft",
      image: "/hero-2.jpg",
      badge: "New Listing",
    },
    {
      id: "p2",
      title: "Marina Residences Tower A",
      type: "Apartment",
      location: "Dubai Marina",
      price: "AED 4,200,000",
      beds: 3,
      baths: 3,
      area: "2,100 sq ft",
      image: "/hero-3.jpg",
      badge: "High ROI",
    },
    {
      id: "p3",
      title: "Palm Vista Villa",
      type: "Villa",
      location: "Palm Jumeirah",
      price: "AED 32,000,000",
      beds: 6,
      baths: 7,
      area: "12,500 sq ft",
      image: "/hero-4.jpg",
      badge: "Exclusive",
    },
    {
      id: "p4",
      title: "Business Bay Tower — Unit 4402",
      type: "Apartment",
      location: "Business Bay",
      price: "AED 2,800,000",
      beds: 2,
      baths: 2,
      area: "1,450 sq ft",
      image: "/hero-1.jpg",
    },
  ],

  about: {
    body: "Dubai's most trusted luxury real estate advisors — 10+ years, 2,400+ transactions, white-glove service from first viewing to key handover.",
    pillars: [
      { num: "01", title: "Market Intelligence", desc: "10+ years of Dubai real estate data. We know which towers deliver returns and which ones don't. Our clients invest smarter." },
      { num: "02", title: "Off-Plan Access", desc: "Direct developer relationships mean our clients get pre-launch pricing on the most sought-after projects before they hit the market." },
      { num: "03", title: "White Glove Service", desc: "From first viewing to key handover, we handle every detail. Legal, financing, snagging — all coordinated on your behalf." },
      { num: "04", title: "Global Network", desc: "2,400+ transactions across Dubai. A network that opens doors others can't." },
    ],
  },
}

// Re-exports for backward compat with old code (deprecated, prefer config.*)
export const BUSINESS = config.business
export const PROPERTIES = config.properties
export const STATS = config.stats!
export const TESTIMONIALS = config.testimonials!
