/** Shared types for all lead sources and enrichers */

export interface SourceLead {
  name:         string
  phone?:       string
  email?:       string      // business email
  website?:     string
  address?:     string
  city:         string
  state:        string
  niche:        string
  rating?:      number
  reviewCount?: number
  hasWebsite:   boolean
  ownerName?:   string
  ownerEmail?:  string
  ownerPhone?:  string
  source:       string      // 'yelp' | 'yp' | 'bbb' | 'angi' | etc.
  sourceUrl?:   string
}

export interface EnrichResult {
  ownerName?:   string
  ownerEmail?:  string
  ownerPhone?:  string
  ownerTitle?:  string      // e.g. "Owner", "CEO", "Principal"
  phone?:       string      // better phone if found
  email?:       string      // better email if found
  source:       string
}

// Maps niche label → search terms per directory
export const NICHE_TERMS: Record<string, { yelp: string[]; yp: string[]; general: string[] }> = {
  medspa:     { yelp:['medical spas'],        yp:['medical spa'],        general:['medspa','medical spa'] },
  hvac:       { yelp:['heating cooling'],     yp:['air conditioning'],   general:['hvac','heating cooling'] },
  roofing:    { yelp:['roofing'],             yp:['roofing contractor'], general:['roofing'] },
  plumbing:   { yelp:['plumbers'],            yp:['plumber'],            general:['plumbing'] },
  cleaning:   { yelp:['home cleaning'],       yp:['cleaning service'],   general:['house cleaning'] },
  landscaping:{ yelp:['landscaping'],         yp:['landscaping'],        general:['landscaping'] },
  restaurant: { yelp:['restaurants'],         yp:['restaurant'],         general:['restaurant'] },
  dentist:    { yelp:['dentists'],            yp:['dentist'],            general:['dental office'] },
  salon:      { yelp:['hair salons'],         yp:['hair salon'],         general:['hair salon'] },
  barbershop: { yelp:['barbers'],             yp:['barber shop'],        general:['barbershop'] },
  lawfirm:    { yelp:['lawyers'],             yp:['attorney'],           general:['law firm','attorney'] },
  realestate: { yelp:['real estate agents'],  yp:['real estate'],        general:['real estate agent'] },
  autodetail: { yelp:['auto detailing'],      yp:['auto detailing'],     general:['auto detailing'] },
  skinclinic: { yelp:['skin care'],           yp:['skin care'],          general:['skin clinic'] },
  ivtherapy:  { yelp:['iv hydration'],        yp:['iv therapy'],         general:['iv therapy'] },
  nailstudio: { yelp:['nail salons'],         yp:['nail salon'],         general:['nail studio'] },
  remodeling: { yelp:['contractors'],         yp:['remodeling'],         general:['remodeling contractor'] },
  financial:  { yelp:['financial advising'],  yp:['financial advisor'],  general:['financial advisor'] },
}
