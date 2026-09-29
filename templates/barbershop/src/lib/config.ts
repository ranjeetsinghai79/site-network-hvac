import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  heroVideo: "https://assets.mixkit.co/videos/preview/mixkit-barber-clipping-the-hair-of-a-client-42749-large.mp4",
  business: {
    city: "Tracy",
    theme: "dubai",
    niche: "barbershop",
    name: "Sharp Edge Barbershop",
    tagline: "The Art of the Cut.",
    phone: "(555) 456-0987",
    phoneHref: "tel:+15554560987",
    email: "hello@sharpedgebarber.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Mountain House", "Manteca", "Stockton", "Lathrop", "Banta"],
    since: "2017",
    google_rating: "4.9",
    review_count: "521",
    emergency: false,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      instagram: "https://instagram.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "The Barbershop Where Every Cut Is a Craft",
    body: "Since 2017, Sharp Edge has been cutting hair for Tracy's men, kids, and everyone in between. Our licensed barbers specialize in fades, tapers, and line-ups — executed precisely, every time. Walk-ins welcome. Online booking available. No waiting room TV with nothing on — just a clean shop, good music, and a great cut.",
    highlights: [
      { icon: "scissors",    text: "Fade specialists — skin, low, mid, and high fades done right" },
      { icon: "clock",       text: "Walk-ins welcome + online booking — your time isn't wasted here" },
      { icon: "shield-check", text: "Licensed barbers only — state-certified, trained in current techniques" },
    ],
  },

  services: [
    { icon: "scissors", image: "/service-1.jpg", title: "Haircut & Fade",      desc: "Classic, taper, skin fade, or buzz. Includes wash, cut, and style. Tailored to your head shape and lifestyle. Walk out looking fresh.", urgent: false },
    { icon: "star",     image: "/service-2.jpg", title: "Beard Trim & Shape",  desc: "Straight-razor beard line-up, shape, and trim. Hot towel finish. Clean lines that last 2–3 weeks.", urgent: false },
    { icon: "zap",      image: "/service-3.jpg", title: "Cut + Beard Combo",   desc: "Full haircut and beard service together. Most popular option. Save time, look complete.", urgent: false },
    { icon: "sun",      image: "/service-4.jpg", title: "Kids Haircut",        desc: "Ages 2–12. Patient barbers who make kids feel comfortable. Fun chairs, no tears. Parents relax.", urgent: false },
    { icon: "droplets", image: "/service-5.jpg", title: "Hot Towel Shave",     desc: "Traditional straight-razor wet shave with pre-shave oil, warm lather, and hot towel finish. Classic barbershop experience.", urgent: false },
    { icon: "sparkles", image: "/service-6.jpg", title: "Color & Gray Blend",  desc: "Natural color blending to cover gray, add dimension, or refresh your look. All done in-chair, no extra time." , urgent: false },
  ],

  testimonials: [
    { name: "Carlos V.",  location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=carlos_tracy_barber",    text: "Best fade in Tracy, period. I've tried 6 other shops. These guys are consistent every single time. Won't go anywhere else." },
    { name: "Mike T.",    location: "Manteca, CA",  stars: 5, avatar: "https://i.pravatar.cc/80?u=mike_manteca_barber",    text: "Bring my two sons every 3 weeks. Staff is patient with kids and the cuts are always clean. Best 45 minutes of our weekend." },
    { name: "Jordan S.",  location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=jordan_stockton_barber", text: "Hot towel shave was the best I've ever had. Straight razor, warm lather, no nicks. Felt like a different era. Will be back." },
  ],

  trustBadges: [
    "Licensed Barbers",
    "Walk-Ins Welcome",
    "Online Booking",
    "Kids Welcome",
    "Straight-Razor Shaves",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.9,  label: "Google Rating",    suffix: "★",  decimals: 1 },
    { value: 521,  label: "Happy Clients",    suffix: "+",  decimals: 0 },
    { value: 9,    label: "Years Experience", suffix: "+",  decimals: 0 },
    { value: 3,    label: "Avg Wait Time",    suffix: "min", decimals: 0 },
  ],

  reasons: [
    { icon: "award",        title: "Fade Specialists",      desc: "Skin, low, mid, high — executed clean and consistent. No guessing, no blending mistakes." },
    { icon: "clock",        title: "Walk-Ins Welcome",      desc: "No appointment needed. Check our live wait time online before you drive over." },
    { icon: "star",         title: "Kids Welcome",          desc: "Patient barbers who know how to work with wiggly kids. First haircut? We make it easy." },
    { icon: "dollar-sign",  title: "Transparent Pricing",   desc: "Cuts from $25. Combos from $40. No surprise add-ons. Tip is always up to you." },
    { icon: "shield-check", title: "Licensed Barbers",      desc: "Every barber is state-licensed. No cosmetology crossover — this is a real barbershop." },
    { icon: "users",        title: "Community First",       desc: "We live in Tracy too. This shop is for the neighborhood, and we treat every client like a regular." },
  ],

  formServiceOptions: [
    "Haircut & Fade",
    "Beard Trim & Shape",
    "Cut + Beard Combo",
    "Kids Haircut",
    "Hot Towel Shave",
    "Color & Gray Blend",
  ],

  faq: [
    { q: "Do I need an appointment or can I walk in?", a: "Both. Walk-ins are always welcome — check our live wait time on our website before you head over. Online booking available if you want a guaranteed slot with your preferred barber." },
    { q: "How much does a haircut cost?", a: "Haircuts start at $25 for a basic cut, $35 for a fade. Beard combos from $40. Kids cuts are $20. No hidden add-ons — what you see is what you pay." },
    { q: "How often should I come in?", a: "Most clients with fades come every 2–3 weeks to keep lines sharp. Longer styles can go 4–6 weeks. We'll tell you what works for your cut." },
    { q: "Do you do kids' haircuts?", a: "Yes. We specialize in making kids comfortable — patient barbers, fun chairs, and we go at their pace. Ages 2 and up. No tears policy (we try hard)." },
    { q: "What's included in the hot towel shave?", a: "Pre-shave oil, hot lather, straight razor shave, hot towel finish, and aftershave. Full classic barbershop experience. Takes about 30–40 minutes." },
    { q: "Can you match a photo or style I bring in?", a: "Absolutely. Bring a photo on your phone and show your barber. We'll tell you honestly if it works for your hair type and how to get there." },
  ],
}

export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
