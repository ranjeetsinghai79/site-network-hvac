import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  tier: "regular",
  business: {
    city: "Tracy",
    theme: "clean",
    niche: "financial-advisor",
    name: "Pinnacle Wealth Advisors",
    tagline: "Your Wealth. Your Legacy. Our Mission.",
    phone: "(555) 678-9012",
    phoneHref: "tel:+15556789012",
    email: "hello@pinnaclewealthadvisors.com",
    address: "Tracy, California",
    serviceAreas: ["Tracy", "Stockton", "Modesto", "Dublin", "Pleasanton", "Livermore"],
    license: "CFP® | FINRA/SEC Registered",
    since: "2002",
    google_rating: "4.9",
    review_count: "189",
    emergency: false,
    social: {
      google: "https://google.com",
      yelp: "https://yelp.com",
      facebook: "https://facebook.com",
    },
  },

  services: [
    {
      icon: "trending-up",
      image: "/service-1.jpg",
      title: "Wealth Management",
      desc: "Personalized investment portfolios built around your goals, risk tolerance, and timeline. Fee-only advisory — no hidden commissions. Ever.",
      meta: "Free 60-min consultation",
      urgent: false,
    },
    {
      icon: "shield",
      image: "/service-2.jpg",
      title: "Retirement Planning",
      desc: "401(k) optimization, IRA strategies, Social Security maximization, and sustainable withdrawal planning. Retire on your terms.",
      meta: "Target: your number",
      urgent: false,
    },
    {
      icon: "umbrella",
      image: "/service-3.jpg",
      title: "Insurance & Protection",
      desc: "Life, disability, long-term care — comprehensive coverage analysis to protect what you've built. We shop 40+ carriers for the best rate.",
      meta: "Coverage gap analysis included",
      urgent: false,
    },
    {
      icon: "file-text",
      image: "/service-4.jpg",
      title: "Tax Strategy",
      desc: "Tax-loss harvesting, Roth conversions, charitable giving strategies, and business owner deductions — keep more of what you earn.",
      meta: "Avg client saves $8,200/yr",
      urgent: false,
    },
    {
      icon: "home",
      image: "/service-5.jpg",
      title: "Estate Planning",
      desc: "Wills, trusts, beneficiary designations, and legacy planning — coordinate with your attorney to ensure your wishes are honored.",
      meta: "Trust setup guidance included",
      urgent: false,
    },
    {
      icon: "briefcase",
      image: "/service-6.jpg",
      title: "Business Owner Services",
      desc: "SEP-IRA, Solo 401(k), buy-sell agreements, key person insurance, and exit strategy planning for business owners and entrepreneurs.",
      meta: "Business valuation included",
      urgent: false,
    },
  ],

  about: {
    heading: "Fiduciary Advisors. Zero Conflicts. Total Transparency.",
    body: "At Pinnacle Wealth Advisors, we are legally obligated to act in your best interest — always. As fee-only, fiduciary CFP® professionals, we earn nothing from product sales or commissions. Our only incentive is your financial success.\n\nFounded in 2002, we've guided hundreds of Tracy-area families through market volatility, life transitions, and generational wealth transfer. We don't just manage money — we build clarity.",
  },

  testimonials: [
    {
      name: "Robert & Karen T.",
      role: "Retired, Tracy CA",
      text: "Pinnacle helped us retire 3 years early with a plan we actually understand. After 22 years with a commission-based advisor, the difference is night and day.",
      stars: 5,
    },
    {
      name: "Michael Chen",
      role: "Business Owner, Stockton CA",
      text: "They restructured my business retirement plan and saved me over $40,000 in taxes last year. Wish I'd found them sooner.",
      stars: 5,
    },
    {
      name: "Sarah & David M.",
      role: "Young Family, Dublin CA",
      text: "We didn't think we were 'wealthy enough' for a financial advisor. Pinnacle showed us how to build wealth from where we are right now.",
      stars: 5,
    },
  ],

  reasons: [
    {
      icon: "shield-check",
      title: "Fiduciary — Always",
      desc: "Legally required to put your interests first. No product sales, no commissions, no conflicts.",
    },
    {
      icon: "award",
      title: "CFP® Certified",
      desc: "Certified Financial Planners with 20+ years combined experience in wealth management.",
    },
    {
      icon: "eye",
      title: "Full Transparency",
      desc: "Flat fee or AUM pricing — you always know exactly what you pay and why.",
    },
    {
      icon: "users",
      title: "White-Glove Service",
      desc: "A dedicated advisor, not a call center. Quarterly reviews, annual deep-dives, always responsive.",
    },
  ],

  stats: [
    { value: "4.9", suffix: "★", label: "Google Rating" },
    { value: "$2.4B+", label: "Assets Advised" },
    { value: 22, suffix: "+", label: "Years Experience" },
    { value: "100", suffix: "%", label: "Fiduciary Standard" },
  ],

  faq: [
    {
      q: "Do I need a minimum investment to work with you?",
      a: "No hard minimum. We work with clients across all wealth levels. Most clients have $250K–$5M+ in investable assets, but we also offer standalone financial planning for those building toward that.",
    },
    {
      q: "How do you charge for your services?",
      a: "Fee-only: either a flat annual planning fee ($2,500–$5,000) or an AUM fee (0.75%–1% annually). No commissions. No product sales. Full disclosure in writing before we start.",
    },
    {
      q: "What is a fiduciary advisor?",
      a: "A fiduciary is legally required to act in your best interest at all times — unlike a broker or insurance agent who only needs to recommend 'suitable' products. We are fiduciaries 100% of the time.",
    },
    {
      q: "How is your first meeting structured?",
      a: "A free 60-minute discovery call where we learn your goals, review your current situation, and outline a recommended approach. No sales pitch. No pressure.",
    },
  ],
}
