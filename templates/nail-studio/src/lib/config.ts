import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  tier: "regular",
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "nail-studio",
    name: "Luxe Nail Studio",
    tagline: "Art On Every Nail.",
    phone: "(555) 456-1234",
    phoneHref: "tel:+15554561234",
    email: "hello@luxenailstudio.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Stockton", "Manteca", "Mountain House", "Lodi", "Modesto"],
    license: "CA COS #34211",
    since: "2017",
    google_rating: "4.9",
    review_count: "312",
    emergency: false,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
  },

  services: [
    {
      icon: "sparkles",
      image: "/service-1.jpg",
      title: "Gel Manicure",
      desc: "Long-lasting gel color with a mirror-shine finish. Chip-free for 2–3 weeks. Soak-off removal included. Choose from 200+ shades including seasonal collections.",
      meta: "45 min · from $45",
      urgent: false,
    },
    {
      icon: "star",
      image: "/service-2.jpg",
      title: "Acrylic Full Set",
      desc: "Custom acrylic enhancements — square, almond, coffin, stiletto, or oval. Strong, lightweight, and sculpted to your exact shape. Fill appointments available every 2–3 weeks.",
      meta: "75 min · from $55",
      urgent: false,
    },
    {
      icon: "zap",
      image: "/service-3.jpg",
      title: "Nail Art Design",
      desc: "Hand-painted designs, 3D florals, chrome powder, ombre gradients, and intricate detail work. From minimalist line art to full-blown editorial looks. Every nail is a canvas.",
      meta: "from $10/nail",
      urgent: false,
    },
    {
      icon: "droplets",
      image: "/service-4.jpg",
      title: "Gel Pedicure",
      desc: "Full pedicure with warm foot soak, cuticle care, exfoliation, and long-lasting gel color. Callus removal available. Walk out ready to show off your toes.",
      meta: "60 min · from $55",
      urgent: false,
    },
    {
      icon: "activity",
      image: "/service-5.jpg",
      title: "Dip Powder",
      desc: "SNS and APRES gel-dip for naturally strong, lightweight nails without UV curing. Odor-free. Lasts 3–4 weeks. Perfect for clients who want durability with a natural look.",
      meta: "60 min · from $50",
      urgent: false,
    },
    {
      icon: "sun",
      image: "/service-6.jpg",
      title: "Express Manicure",
      desc: "Quick clean-up, shape, and regular polish in 20 minutes. Perfect for touch-ups or maintenance appointments. Walk-ins always welcome for express service.",
      meta: "20 min · $25",
      urgent: false,
    },
  ],

  about: {
    heading: "Premium Nails. Every Time. No Appointment Needed.",
    body: "Since 2017, Luxe Nail Studio has been Tracy's go-to for nail art, gel, acrylics, and pedicures. Walk in or book online — we're open 7 days a week. Every technician is licensed by the California Board of Barbering and Cosmetology. We use only premium products: OPI, Gelish, APRES, and CND. Sanitation is our non-negotiable.",
    highlights: [
      { icon: "award",        text: "All technicians state-licensed — California Board of Barbering & Cosmetology certified" },
      { icon: "sparkles",     text: "Premium products only — OPI, Gelish, APRES, CND — no off-brand substitutes" },
      { icon: "star",         text: "Open 7 days a week — walk-ins always welcome, online booking available" },
    ],
  },

  testimonials: [
    {
      name: "Vanessa L.",
      location: "Tracy, CA",
      stars: 5,
      avatar: "https://i.pravatar.cc/80?u=vanessa_tracy_nail",
      text: "I've been coming every 3 weeks for 2 years. My gel manicures last 3 weeks without a single chip. The nail art is incredible — my technician did hand-painted cherry blossoms that looked like they belonged in a gallery. Never going anywhere else.",
    },
    {
      name: "Taylor B.",
      location: "Manteca, CA",
      stars: 5,
      avatar: "https://i.pravatar.cc/80?u=taylor_manteca_nail",
      text: "Got acrylic coffin nails for my birthday and they looked PERFECT. When I sent photos to my friends they thought they were press-ons because they were so clean and shaped so well. Booked my fill the same day.",
    },
    {
      name: "Priya R.",
      location: "Stockton, CA",
      stars: 5,
      avatar: "https://i.pravatar.cc/80?u=priya_stockton_nail",
      text: "The dip powder nails are amazing. I work with my hands all day and they lasted 4 full weeks before I needed a fill. The salon is so clean and the staff are genuinely kind — not just going through the motions.",
    },
  ],

  trustBadges: [
    "CA State Licensed Techs",
    "Premium Products Only",
    "Walk-Ins Welcome",
    "Open 7 Days a Week",
    "Hospital-Grade Sanitation",
    "4.9★ on Google",
  ],

  stats: [
    { value: 4.9,  label: "Google Rating",       suffix: "★",  decimals: 1 },
    { value: 1560, label: "Nails Perfected",     suffix: "+",  decimals: 0 },
    { value: 8,    label: "Years in Tracy",      suffix: "+",  decimals: 0 },
    { value: 98,   label: "Return Client Rate",  suffix: "%",  decimals: 0 },
  ],

  reasons: [
    {
      icon: "award",
      title: "State-Licensed Technicians",
      desc: "Every nail tech is licensed by the California Board of Barbering and Cosmetology. No unlicensed staff — ever.",
    },
    {
      icon: "sparkles",
      title: "Premium Products Only",
      desc: "We use OPI, Gelish, APRES, and CND exclusively. No off-brand acrylics or mystery dip powders that damage your natural nails.",
    },
    {
      icon: "droplets",
      title: "Hospital-Grade Sanitation",
      desc: "Every tool is sterilized in an autoclave between clients. Single-use files and buffers. No cross-contamination — ever.",
    },
    {
      icon: "star",
      title: "Open 7 Days a Week",
      desc: "Walk in any day — we save time for walk-ins and don't turn away clients. Book online for priority scheduling.",
    },
    {
      icon: "activity",
      title: "Expert Nail Artists",
      desc: "From clean minimalism to elaborate 3D florals, our techs are trained in advanced nail art. Bring inspo pics — we'll nail it.",
    },
    {
      icon: "sun",
      title: "Gentle on Natural Nails",
      desc: "We prioritize nail health. E-file with proper speed, proper removal techniques, and regular nail health checks — your natural nails stay strong.",
    },
  ],

  formServiceOptions: [
    "Gel Manicure",
    "Acrylic Full Set",
    "Nail Art Design",
    "Gel Pedicure",
    "Dip Powder",
    "Express Manicure",
  ],

  faq: [
    {
      q: "Do I need an appointment or can I walk in?",
      a: "Both! Walk-ins are always welcome — we keep slots open every day. For nail art or longer services (acrylic sets, pedicures), booking online guarantees your preferred time and tech.",
    },
    {
      q: "How long does a gel manicure last?",
      a: "2–3 weeks with proper care — avoid prolonged hot water soaking, wear gloves for cleaning, and moisturize your cuticles. We apply a durable top coat that adds extra chip resistance.",
    },
    {
      q: "Can you do the nail art design I found on Instagram?",
      a: "Absolutely — bring the photo. Our techs specialize in replicating inspiration photos. Show us what you want at your appointment and we'll match it as closely as possible.",
    },
    {
      q: "Are your products safe for pregnant clients?",
      a: "Yes. We carry low-odor, 5-free, and 9-free polishes on request. Let us know when you book and we'll set you up with the safest products available.",
    },
    {
      q: "What's the difference between gel, acrylic, and dip?",
      a: "Gel: natural look, flexible, soak-off. Acrylic: strong extensions, sculpted. Dip/SNS: no UV, odor-free, lightweight — lasts longest. We'll help you pick the best for your lifestyle at your appointment.",
    },
    {
      q: "How do you sanitize your tools?",
      a: "Every metal tool (nippers, pushers, clippers) is autoclaved between clients. Files and buffers are single-use. Pedicure bowls are disinfected with hospital-grade solution after every client.",
    },
  ],
}

export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
