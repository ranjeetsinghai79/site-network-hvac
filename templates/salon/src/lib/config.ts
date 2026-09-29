import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "salon",
    name: "Luxe Hair Studio",
    tagline: "Your Best Hair. Every Visit.",
    phone: "(555) 123-7890",
    phoneHref: "tel:+15551237890",
    email: "hello@luxehairstudio.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Mountain House", "Manteca", "Stockton", "Lathrop", "Lodi"],
    since: "2013",
    google_rating: "4.9",
    review_count: "384",
    emergency: false,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      instagram: "https://instagram.com",
      facebook: "https://facebook.com",
    },
  },

  about: {
    heading: "The Salon Where Your Hair Goals Actually Happen",
    body: "Since 2013, Luxe Hair Studio has been Tracy's go-to for precision cuts, lived-in color, and blowouts that last. Our licensed stylists specialize in balayage, keratin treatments, and extensions. Every visit includes a complimentary consultation — we don't start until we both love the plan.",
    highlights: [
      { icon: "star",         text: "Balayage specialists — natural, dimensional color every client loves" },
      { icon: "clock",        text: "Online booking in 60 seconds — no waiting, no phone tag" },
      { icon: "shield-check", text: "Licensed stylists only — no apprentices working unsupervised" },
    ],
  },

  services: [
    { icon: "scissors", image: "/service-1.jpg", title: "Precision Haircut",  desc: "Consultation + wash + cut + blowout. Every cut tailored to your face shape, lifestyle, and texture. From classic bobs to lived-in layers.", urgent: false },
    { icon: "sparkles", image: "/service-2.jpg", title: "Balayage & Color",   desc: "Hand-painted balayage, highlights, full color, and toning. Natural, dimensional results that grow out beautifully. Includes gloss.", urgent: false },
    { icon: "sun",      image: "/service-3.jpg", title: "Blowout & Styling",  desc: "Volume blowout, smooth and sleek, waves, or updo. Long-lasting finish. Perfect for events, date night, or just because.", urgent: false },
    { icon: "zap",      image: "/service-4.jpg", title: "Keratin Treatment",  desc: "Smooth, frizz-free hair for 3–5 months. Brazilian and formaldehyde-free options. Walk out with the hair you've always wanted.", urgent: false },
    { icon: "layers",   image: "/service-5.jpg", title: "Hair Extensions",    desc: "Tape-in, weft, and micro-link extensions. Natural-looking length and volume. Color-matched by hand for perfect blend.", urgent: false },
    { icon: "heart",    image: "/service-6.jpg", title: "Deep Conditioning",  desc: "Olaplex, protein, and moisture treatments for damaged, over-processed, or color-treated hair. Restore strength and shine.", urgent: false },
  ],

  testimonials: [
    { name: "Jessica M.", location: "Tracy, CA",    stars: 5, avatar: "https://i.pravatar.cc/80?u=jessica_tracy_salon",    text: "Asked for balayage and got exactly what I showed on Pinterest — somehow better. People ask who does my hair every week." },
    { name: "Ashley T.",  location: "Manteca, CA",  stars: 5, avatar: "https://i.pravatar.cc/80?u=ashley_manteca_salon",   text: "Keratin treatment changed my mornings. Hair that used to take 45 minutes now takes 5. Worth every dollar." },
    { name: "Divya P.",   location: "Stockton, CA", stars: 5, avatar: "https://i.pravatar.cc/80?u=divya_stockton_salon",   text: "Only salon I've found that actually works with thick South Asian hair. Stylists know what they're doing. Loyal for 4 years." },
  ],

  trustBadges: [
    "Licensed Cosmetologists",
    "Balayage Specialists",
    "Olaplex Certified",
    "Online Booking",
    "All Hair Types Welcome",
    "5-Star Google Rated",
  ],

  stats: [
    { value: 4.9, label: "Google Rating",    suffix: "★",  decimals: 1 },
    { value: 384, label: "Happy Clients",    suffix: "+",  decimals: 0 },
    { value: 13,  label: "Years Experience", suffix: "+",  decimals: 0 },
    { value: 98,  label: "Rebooking Rate",   suffix: "%",  decimals: 0 },
  ],

  reasons: [
    { icon: "award",        title: "Balayage Specialists",  desc: "Not every salon does balayage well. Ours trained specifically in lived-in, natural color techniques." },
    { icon: "clock",        title: "Book Online 24/7",      desc: "Pick your stylist, service, and time slot from your phone. Instant confirmation, reminder texts, no phone tag." },
    { icon: "star",         title: "All Hair Types",        desc: "Fine, coarse, curly, straight, color-treated — our stylists work with all textures. No turning clients away." },
    { icon: "dollar-sign",  title: "Transparent Pricing",   desc: "No surprise add-ons. Price quotes are given at consultation. You know the total before we mix a drop of color." },
    { icon: "shield-check", title: "Licensed Only",         desc: "Every stylist is a licensed cosmetologist. No apprentices working unsupervised. Your hair deserves trained hands." },
    { icon: "droplets",     title: "Olaplex Treatments",    desc: "We use Olaplex in every color service to protect hair integrity. Healthy hair holds color longer and looks better." },
  ],

  formServiceOptions: [
    "Precision Haircut",
    "Balayage & Color",
    "Blowout & Styling",
    "Keratin Treatment",
    "Hair Extensions",
    "Deep Conditioning",
  ],

  faq: [
    { q: "How far in advance should I book a color appointment?", a: "For balayage and full-color, book 1–2 weeks ahead — especially weekends. Cuts can often be booked same week. New clients get a complimentary consultation before any color service." },
    { q: "How much does balayage cost?", a: "Balayage starts at $175–$250 depending on hair length and complexity. We quote at consultation so you know the total before we start. No surprises." },
    { q: "Do you work on all hair types and textures?", a: "Yes. Our stylists are trained in fine, thick, curly, coily, and chemically-treated hair. If you've been told 'we don't do that here' elsewhere — come see us." },
    { q: "How long does a keratin treatment last?", a: "3–5 months depending on your hair type and wash frequency. Using sulfate-free shampoo extends results. We give you a full care guide at checkout." },
    { q: "Can I bring a photo of what I want?", a: "Please do — it's the best way to communicate. We'll look at your photos and give an honest assessment of what's achievable with your hair's current condition." },
    { q: "Do you offer hair extensions?", a: "Yes — tape-in, weft, and micro-link extensions. Color-matched by hand. Extensions start at $350 for tape-ins. Free consultation to assess your hair and pick the right method." },
  ],
}

export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
