export interface TierEconomics {
  name: string
  price: number
  estimatedCogs: number
  grossProfit: number
  grossMargin: number | null
  positioning: string
  usageCaps: string[]
}

export const TIER_ECONOMICS: TierEconomics[] = [
  {
    name: 'Free Audit',
    price: 0,
    estimatedCogs: 1.5,
    grossProfit: -1.5,
    grossMargin: null,
    positioning: 'Lead magnet',
    usageCaps: ['1 audit', 'no hosted site', 'no live receptionist'],
  },
  {
    name: 'Starter',
    price: 49,
    estimatedCogs: 8,
    grossProfit: 41,
    grossMargin: 84,
    positioning: 'Try-it-now AI Front Office',
    usageCaps: ['1 website', 'AI chat only', '250 SMS/email follow-ups combined', 'no live voice AI'],
  },
  {
    name: 'Founder Voice',
    price: 59,
    estimatedCogs: 5.5,
    grossProfit: 53.5,
    grossMargin: 91,
    positioning: 'First-10-customer voice pilot',
    usageCaps: ['25 voice minutes', 'AI reception', 'lead capture', 'appointment booking', 'call transcript and summary', 'no website or marketing content'],
  },
  {
    name: 'Founder Growth',
    price: 99,
    estimatedCogs: 9,
    grossProfit: 90,
    grossMargin: 91,
    positioning: 'First-10-customer growth pilot',
    usageCaps: ['100 voice minutes', 'website and hosting', 'AI reception', 'lead qualification', 'appointment booking', 'SMS/email lead alerts'],
  },
  {
    name: 'Growth',
    price: 149,
    estimatedCogs: 32,
    grossProfit: 117,
    grossMargin: 79,
    positioning: 'Best seller for appointment businesses',
    usageCaps: ['300 voice minutes', '750 SMS segments', '4 blog/SEO updates', '4 social drafts', 'approval-gated ads'],
  },
  {
    name: 'Pro',
    price: 349,
    estimatedCogs: 92,
    grossProfit: 257,
    grossMargin: 74,
    positioning: 'Done-for-you growth operator',
    usageCaps: ['900 voice minutes', '2,000 SMS segments', '12 social drafts', '8 ad drafts', 'ad spend pass-through'],
  },
  {
    name: 'Scale',
    price: 699,
    estimatedCogs: 210,
    grossProfit: 489,
    grossMargin: 70,
    positioning: 'Multi-location or high-volume front office',
    usageCaps: ['2,500 voice minutes', '6,000 SMS segments', 'multi-location reporting', 'usage overages required'],
  },
]

export function printTierEconomics(): string {
  const rows = TIER_ECONOMICS.map((tier) => {
    const margin = tier.grossMargin === null ? 'n/a' : `${tier.grossMargin}%`
    return [
      tier.name.padEnd(12),
      `$${tier.price}`.padStart(6),
      `$${tier.estimatedCogs}`.padStart(8),
      `$${tier.grossProfit}`.padStart(8),
      margin.padStart(6),
      tier.positioning,
    ].join('  ')
  })

  return [
    'Tier          Price      COGS    Profit  Margin  Positioning',
    '-------------------------------------------------------------',
    ...rows,
    '',
    'Assumptions: ad spend is pass-through; voice/SMS/content are capped; human support is excluded.',
  ].join('\n')
}
