/**
 * design-library.ts
 *
 * Structured design system library built from:
 *   - ui-ux-pro-max skill (67 styles, 96 palettes, 57 font pairings, 30 landing patterns)
 *   - frontend-design skill (anti-slop aesthetics, bold directions)
 *   - taste-skill quality bar
 *
 * Every business gets a DETERMINISTIC unique combination via hash(name + niche).
 * 12 personalities × 24 font pairs × 8 hero layouts × 6 section orders = 13,824 combos.
 * Same business = same design. Different business = different design.
 *
 * Usage:
 *   import { getDesignProfile } from './design-library.js'
 *   const design = getDesignProfile(lead.name, lead.niche)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FontPairing {
  name: string
  displayFont: string
  bodyFont: string
  googleImport: string
  mood: string
  /** CSS: font-family value for --font-display */
  displayStack: string
  /** CSS: font-family value for --font-body */
  bodyStack: string
  /** Tailwind className for headings */
  headingWeight: string
}

export interface DesignPersonality {
  id: string
  name: string
  description: string
  /** What makes this feel non-AI, non-template */
  differentiation: string
  /** CSS effect keywords for Gemini prompt */
  cssKeywords: string[]
  /** Atmosphere sentence for Gemini image prompts */
  visualMood: string
  /** Section background treatment */
  bgTreatment: string
  /** Card style */
  cardStyle: string
  /** Heading treatment */
  headingTreatment: string
  /** Button style */
  buttonStyle: string
}

export interface ColorPalette {
  name: string
  primary: string
  secondary: string
  accent: string
  bg: string
  bgSection: string
  text: string
  textMuted: string
  /** Token overrides — injected into globals.css :root */
  tokens: Record<string, string>
}

export interface HeroLayout {
  id: string
  name: string
  description: string
  /** Component to use in page.tsx */
  component: 'Hero' | 'HeroPhotoGrid' | 'ScrollHero' | 'HeroDiagonal' | 'HeroCentered' | 'HeroSplit' | 'HeroBento'
  /** Gemini prompt hint for section copy */
  copyStyle: string
  /** Works on these niches */
  bestFor: string[]
  /** Avoid on these niches */
  avoidFor: string[]
}

export interface SectionOrder {
  id: string
  /** Ordered list of section ids */
  sections: string[]
}

export interface DesignProfile {
  personality: DesignPersonality
  fonts: FontPairing
  hero: HeroLayout
  sectionOrder: SectionOrder
  colors: ColorPalette
  /** Full Gemini design brief — inject into config-generator prompt */
  geminiBrief: string
  /** Google Fonts import URL — inject into globals.css */
  googleFontsUrl: string
}

// ─── 12 Design Personalities ─────────────────────────────────────────────────
// Source: frontend-design skill + ui-ux-pro-max styles.csv
// Rule: NEVER use generic AI slop (purple gradients, Space Grotesk, card grids)

const PERSONALITIES: DesignPersonality[] = [
  {
    id: 'editorial-luxury',
    name: 'Editorial Luxury',
    description: 'Magazine-inspired. Generous white space. Serif authority. Refined restraint.',
    differentiation: 'Oversized pull-quotes, editorial grid breaking, asymmetric image placement, thin rule lines',
    cssKeywords: ['editorial layout', 'asymmetric grid', 'serif display', 'generous whitespace', 'thin dividers', 'pull-quote styling'],
    visualMood: 'High-end magazine spread. Clean, architectural, confident. Like Vogue meets McKinsey.',
    bgTreatment: 'Near-white (#FAFAF8) with section breaks via horizontal rules and background shifts',
    cardStyle: 'Borderless cards. Content separated by whitespace and subtle rules, not boxes.',
    headingTreatment: 'Large serif display font. Mix of weights. Some italic for contrast.',
    buttonStyle: 'Thin border button. No fill. Uppercase tracking. Or a solid dark rectangle — no rounded corners.',
  },
  {
    id: 'bold-industrial',
    name: 'Bold Industrial',
    description: 'Raw power. Condensed type. High contrast. Built for trades.',
    differentiation: 'Condensed display type at massive scale, diagonal accent lines, industrial texture overlays, bleed-to-edge imagery',
    cssKeywords: ['condensed font', 'bold contrast', 'diagonal lines', 'high contrast', 'industrial texture', 'bleed layout'],
    visualMood: 'Workshop floor meets brand identity. Masculine, direct, no-nonsense power.',
    bgTreatment: 'Dark near-black sections alternating with stark white. No gradients.',
    cardStyle: 'Solid bordered cards. Left accent bar. Bold icon treatment.',
    headingTreatment: 'Condensed typeface at 6-8rem. All caps. Letterspacing tight.',
    buttonStyle: 'Full-width solid rectangle. High contrast. All caps text. Arrow →',
  },
  {
    id: 'soft-wellness',
    name: 'Soft Wellness',
    description: 'Organic shapes. Warm neutrals. Gentle curves. Calming authority.',
    differentiation: 'Blob/organic SVG shapes, warm off-white backgrounds, rounded everything, botanical illustration accents',
    cssKeywords: ['organic shapes', 'warm neutrals', 'border-radius generous', 'soft shadows', 'pastel accent', 'flowing layout'],
    visualMood: 'Spa-like tranquility. Warm, trustworthy, human. Like a boutique wellness brand from LA.',
    bgTreatment: 'Warm off-white (#FAF8F5). Organic blob shapes as section dividers.',
    cardStyle: 'Heavily rounded (border-radius: 24px+). Soft box shadows. Warm tinted backgrounds.',
    headingTreatment: 'Humanist serif or soft sans. Medium weight. Never aggressive.',
    buttonStyle: 'Fully rounded pill. Warm accent color. Soft shadow on hover.',
  },
  {
    id: 'minimal-clinical',
    name: 'Minimal Clinical',
    description: 'Swiss grid. Pure function. Type as architecture. Zero decoration.',
    differentiation: 'Strict 12-column Swiss grid, monospace accents, data-like stat presentations, rule-based sections',
    cssKeywords: ['swiss grid', 'monospace accent', 'strict alignment', 'typographic hierarchy', 'no decoration', 'systematic spacing'],
    visualMood: 'German engineering precision. Clinical trust. Every element earns its place.',
    bgTreatment: 'Pure white. Section breaks via background color (#F5F5F5) or thin 1px rule.',
    cardStyle: 'No card style. Content on white. Type hierarchy does all the work.',
    headingTreatment: 'Geometric sans. Tight letter-spacing. Strong size contrast between levels.',
    buttonStyle: 'Flat rectangle. Brand color fill. No shadow. Clean.',
  },
  {
    id: 'warm-artisan',
    name: 'Warm Artisan',
    description: 'Handcrafted feel. Warm earth tones. Texture. Local character.',
    differentiation: 'Grain texture overlays, warm photography treatment, handwritten accent elements, community-first messaging',
    cssKeywords: ['grain texture', 'warm earthy palette', 'slight imperfection', 'handcrafted feel', 'community texture'],
    visualMood: 'Family-owned since 1987. Craft, pride, local roots. Not corporate — real.',
    bgTreatment: 'Cream (#FEF9F0) base with subtle grain texture overlay. Warm accent sections.',
    cardStyle: 'Slightly rounded. Warm tinted bg. Bottom border accent strip.',
    headingTreatment: 'Mixed serif/sans. Can include a script or slab typeface for warmth.',
    buttonStyle: 'Warm accent color. Rounded-md. Slight texture on hover.',
  },
  {
    id: 'dark-authority',
    name: 'Dark Authority',
    description: 'Near-black. Premium positioning. Strong hierarchy. Commanding.',
    differentiation: 'Deep charcoal/near-black base, gold or vibrant single accent, dramatic type scale, luxury space',
    cssKeywords: ['dark background', 'premium accent', 'dramatic type scale', 'luxury spacing', 'strong shadow', 'cinematic'],
    visualMood: 'Premium law firm meets luxury auto brand. Confident, authoritative, expensive.',
    bgTreatment: 'Near-black (#0A0A0A or #0F0F0F). Single vivid or gold accent color only.',
    cardStyle: 'Subtle glass (rgba(255,255,255,0.04)) with 1px rgba border. Glow on hover.',
    headingTreatment: 'Display serif or strong sans. White. Large scale. Gradient on key word.',
    buttonStyle: 'Accent color fill OR white border. Glow shadow. No rounded — sharp or pill only.',
  },
  {
    id: 'fresh-vibrant',
    name: 'Fresh & Vibrant',
    description: 'Bright, energetic, modern. Optimism without being garish.',
    differentiation: 'Bold color blocking, oversized typography in vibrant color, geometric shapes, high-energy CTAs',
    cssKeywords: ['color blocking', 'vibrant palette', 'geometric shapes', 'bold typography', 'energetic layout', 'grid-breaking'],
    visualMood: 'Startup energy with local roots. Modern, optimistic, approachable. Not corporate.',
    bgTreatment: 'White base with bold color-blocked sections. Accent color used generously.',
    cardStyle: 'Bold border cards. Accent color header strip. White content area.',
    headingTreatment: 'Bold rounded sans. Vibrant color on key words. Large scale.',
    buttonStyle: 'Bold accent fill. Fully rounded. Strong hover state (darken or lift).',
  },
  {
    id: 'cinematic-premium',
    name: 'Cinematic Premium',
    description: 'Full-bleed imagery. Dramatic type. Feels like a movie trailer.',
    differentiation: 'Full-viewport sections, type over dark imagery, widescreen aspect ratios, cinematic color grading',
    cssKeywords: ['full bleed', 'type overlay', 'cinematic color', 'widescreen', 'dramatic scale', 'film grain'],
    visualMood: 'Opening shot of a prestige TV show. Every frame is intentional. Premium.',
    bgTreatment: 'Full-bleed imagery with color-graded overlays. Content sits on top.',
    cardStyle: 'Dark glass cards. Imagery-forward. Minimal text overlay.',
    headingTreatment: 'Display type at massive scale. Overlaid on imagery. High contrast.',
    buttonStyle: 'White on dark. Or vibrant accent. Large padding. Cinema-style.',
  },
  {
    id: 'brutalist-raw',
    name: 'Brutalist Raw',
    description: 'Unpolished on purpose. Bold borders. Grid-breaking. Provocative.',
    differentiation: 'Thick borders, intentional asymmetry, raw typography, visible grid lines, anti-card aesthetic',
    cssKeywords: ['thick borders', 'brutalist typography', 'raw aesthetic', 'anti-glossy', 'visible structure', 'intentional imperfection'],
    visualMood: 'Architecture zine. Bold, honest, unapologetic. Stands out by not trying to please.',
    bgTreatment: 'Pure white or raw concrete grey. Bold black borders. No gradients.',
    cardStyle: 'Thick bordered boxes. Offset shadow (4px solid color). No border-radius.',
    headingTreatment: 'Slab serif or condensed bold. Black. Massive. No gradient.',
    buttonStyle: 'Thick bordered. Offset shadow. Square corners. Hover fills solid.',
  },
  {
    id: 'glassmorphism-modern',
    name: 'Glassmorphism Modern',
    description: 'Frosted glass depth. Layered. Tech-forward. Ethereal.',
    differentiation: 'Multi-layer glass cards, blurred backgrounds, depth through transparency, aurora color effects',
    cssKeywords: ['backdrop-filter blur', 'glass card', 'rgba transparency', 'aurora gradient', 'depth layers', 'frosted ui'],
    visualMood: 'macOS meets premium web. Depth, clarity, high-tech craft. Modern.',
    bgTreatment: 'Dark gradient or aurora mesh background. Glass panels sit on top.',
    cardStyle: 'Glass: rgba(255,255,255,0.08) + backdrop-blur(16px) + 1px rgba border.',
    headingTreatment: 'Clean sans on glass. Gradient text on key phrase.',
    buttonStyle: 'Glass button with glow on hover. Or solid accent for primary CTA.',
  },
  {
    id: 'organic-natural',
    name: 'Organic Natural',
    description: 'Nature-inspired. Flowing curves. Earthy palette. Living brand.',
    differentiation: 'Wavy section dividers, organic illustration accents, nature photography, flowing shapes',
    cssKeywords: ['wave divider', 'organic curve', 'earthy palette', 'nature illustration', 'flowing shapes', 'botanical accent'],
    visualMood: 'Brand that grows. Connection to nature, community, life. Authentic.',
    bgTreatment: 'Soft sage/cream base. Wavy SVG section dividers. Organic blobs.',
    cardStyle: 'Soft rounded. Botanical illustration or nature photo. Warm tint.',
    headingTreatment: 'Humanist serif. Warm color. Natural weight variation.',
    buttonStyle: 'Nature-toned fill. Leaf green or earthy terracotta. Rounded pill.',
  },
  {
    id: 'retro-revival',
    name: 'Retro Revival',
    description: 'Period-accurate. Nostalgic palettes. Vintage type. Timeless.',
    differentiation: 'Period-specific typography choices, muted vintage palettes, retro badge/stamp elements, grain overlays',
    cssKeywords: ['vintage typography', 'retro badge', 'muted palette', 'grain overlay', 'period aesthetic', 'nostalgic'],
    visualMood: 'Established since day one. Trusted, community-proven, not chasing trends.',
    bgTreatment: 'Aged cream (#FBF7F0) or muted slate. Grain texture. Vintage badge sections.',
    cardStyle: 'Bordered like a menu or certificate. Retro badge header.',
    headingTreatment: 'Slab serif or display with period character. Muted dark ink color.',
    buttonStyle: 'Stamp/badge style. Dark fill. White text. Slight texture on hover.',
  },
]

// ─── 24 Font Pairings (curated from 57, non-generic) ─────────────────────────
// Rule: NO Space Grotesk, NO Inter as display, NO Roboto. Variety is mandatory.

const FONT_PAIRINGS: FontPairing[] = [
  {
    name: 'Cormorant + Lato',
    displayFont: 'Cormorant Garamond',
    bodyFont: 'Lato',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Lato:wght@300;400;700&display=swap')",
    mood: 'editorial luxury, spa, medspa, lawfirm',
    displayStack: "'Cormorant Garamond', serif",
    bodyStack: "'Lato', sans-serif",
    headingWeight: 'font-600',
  },
  {
    name: 'Playfair Display + Source Sans 3',
    displayFont: 'Playfair Display',
    bodyFont: 'Source Sans 3',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Source+Sans+3:wght@300;400;600;700&display=swap')",
    mood: 'authority, lawfirm, remodeling, luxury',
    displayStack: "'Playfair Display', serif",
    bodyStack: "'Source Sans 3', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Montserrat + Inter',
    displayFont: 'Montserrat',
    bodyFont: 'Inter',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Inter:wght@400;500;600&display=swap')",
    mood: 'professional, roofing, hvac, bold',
    displayStack: "'Montserrat', sans-serif",
    bodyStack: "'Inter', sans-serif",
    headingWeight: 'font-800',
  },
  {
    name: 'Oswald + Open Sans',
    displayFont: 'Oswald',
    bodyFont: 'Open Sans',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Open+Sans:wght@400;600;700&display=swap')",
    mood: 'industrial, bold, hvac, junk-removal, roofing',
    displayStack: "'Oswald', sans-serif",
    bodyStack: "'Open Sans', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Fraunces + Jost',
    displayFont: 'Fraunces',
    bodyFont: 'Jost',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;1,9..144,400&family=Jost:wght@300;400;500;600&display=swap')",
    mood: 'editorial, wellness, unique, warm artisan',
    displayStack: "'Fraunces', serif",
    bodyStack: "'Jost', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'DM Serif Display + DM Sans',
    displayFont: 'DM Serif Display',
    bodyFont: 'DM Sans',
    googleImport: "url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;700&display=swap')",
    mood: 'modern editorial, remodeling, premium service',
    displayStack: "'DM Serif Display', serif",
    bodyStack: "'DM Sans', sans-serif",
    headingWeight: 'font-400',
  },
  {
    name: 'Barlow Condensed + Barlow',
    displayFont: 'Barlow Condensed',
    bodyFont: 'Barlow',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap')",
    mood: 'industrial, condensed, bold, junk-removal, roofing',
    displayStack: "'Barlow Condensed', sans-serif",
    bodyStack: "'Barlow', sans-serif",
    headingWeight: 'font-800',
  },
  {
    name: 'Plus Jakarta Sans + Inter',
    displayFont: 'Plus Jakarta Sans',
    bodyFont: 'Inter',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap')",
    mood: 'modern, clean, tech-forward, dentist',
    displayStack: "'Plus Jakarta Sans', sans-serif",
    bodyStack: "'Inter', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Nunito + Nunito Sans',
    displayFont: 'Nunito',
    bodyFont: 'Nunito Sans',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap')",
    mood: 'friendly, warm, daycare, cleaning',
    displayStack: "'Nunito', sans-serif",
    bodyStack: "'Nunito Sans', sans-serif",
    headingWeight: 'font-800',
  },
  {
    name: 'Rajdhani + Inter',
    displayFont: 'Rajdhani',
    bodyFont: 'Inter',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap')",
    mood: 'precision, auto, technical, bold',
    displayStack: "'Rajdhani', sans-serif",
    bodyStack: "'Inter', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Libre Baskerville + Source Sans 3',
    displayFont: 'Libre Baskerville',
    bodyFont: 'Source Sans 3',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;600;700&display=swap')",
    mood: 'trustworthy, classic, lawfirm, consulting',
    displayStack: "'Libre Baskerville', serif",
    bodyStack: "'Source Sans 3', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Syne + DM Sans',
    displayFont: 'Syne',
    bodyFont: 'DM Sans',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;700&display=swap')",
    mood: 'contemporary, creative agency, bold editorial',
    displayStack: "'Syne', sans-serif",
    bodyStack: "'DM Sans', sans-serif",
    headingWeight: 'font-800',
  },
  {
    name: 'Lexend + Nunito Sans',
    displayFont: 'Lexend',
    bodyFont: 'Nunito Sans',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&family=Nunito+Sans:wght@400;600;700&display=swap')",
    mood: 'friendly authority, healthcare, dental, daycare',
    displayStack: "'Lexend', sans-serif",
    bodyStack: "'Nunito Sans', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Cardo + Jost',
    displayFont: 'Cardo',
    bodyFont: 'Jost',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;0,700;1,400&family=Jost:wght@300;400;500;600;700&display=swap')",
    mood: 'refined, luxury, medspa, high-end service',
    displayStack: "'Cardo', serif",
    bodyStack: "'Jost', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Bebas Neue + Open Sans',
    displayFont: 'Bebas Neue',
    bodyFont: 'Open Sans',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Open+Sans:wght@400;600;700&display=swap')",
    mood: 'bold, sports, gym, trades, hvac, roofing',
    displayStack: "'Bebas Neue', sans-serif",
    bodyStack: "'Open Sans', sans-serif",
    headingWeight: 'font-400',
  },
  {
    name: 'Crimson Pro + Lato',
    displayFont: 'Crimson Pro',
    bodyFont: 'Lato',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;700&display=swap')",
    mood: 'elegant editorial, lawfirm, remodeling, premium',
    displayStack: "'Crimson Pro', serif",
    bodyStack: "'Lato', sans-serif",
    headingWeight: 'font-600',
  },
  {
    name: 'Geologica + DM Sans',
    displayFont: 'Geologica',
    bodyFont: 'DM Sans',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Geologica:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;700&display=swap')",
    mood: 'modern variable, professional services, tech-forward',
    displayStack: "'Geologica', sans-serif",
    bodyStack: "'DM Sans', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Abril Fatface + Lato',
    displayFont: 'Abril Fatface',
    bodyFont: 'Lato',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Lato:wght@300;400;700&display=swap')",
    mood: 'bold, expressive, fresh-vibrant, bold headlines',
    displayStack: "'Abril Fatface', serif",
    bodyStack: "'Lato', sans-serif",
    headingWeight: 'font-400',
  },
  {
    name: 'Work Sans + Source Serif 4',
    displayFont: 'Work Sans',
    bodyFont: 'Source Serif 4',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700;800&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap')",
    mood: 'professional, warm editorial, remodeling, cleaning',
    displayStack: "'Work Sans', sans-serif",
    bodyStack: "'Source Serif 4', serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Urbanist + Figtree',
    displayFont: 'Urbanist',
    bodyFont: 'Figtree',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700;800&family=Figtree:wght@400;500;600;700&display=swap')",
    mood: 'modern, clean, fresh, dentist, medspa, service',
    displayStack: "'Urbanist', sans-serif",
    bodyStack: "'Figtree', sans-serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Manrope + Merriweather',
    displayFont: 'Manrope',
    bodyFont: 'Merriweather',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap')",
    mood: 'authoritative, professional services, lawfirm, consulting',
    displayStack: "'Manrope', sans-serif",
    bodyStack: "'Merriweather', serif",
    headingWeight: 'font-700',
  },
  {
    name: 'Chivo + Lora',
    displayFont: 'Chivo',
    bodyFont: 'Lora',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Chivo:wght@300;400;700;900&family=Lora:ital,wght@0,400;0,600;1,400&display=swap')",
    mood: 'editorial-warm, artisan, local service, organic',
    displayStack: "'Chivo', sans-serif",
    bodyStack: "'Lora', serif",
    headingWeight: 'font-900',
  },
  {
    name: 'Instrument Serif + Instrument Sans',
    displayFont: 'Instrument Serif',
    bodyFont: 'Instrument Sans',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600;700&display=swap')",
    mood: 'refined, minimal, premium, medspa, lawfirm',
    displayStack: "'Instrument Serif', serif",
    bodyStack: "'Instrument Sans', sans-serif",
    headingWeight: 'font-400',
  },
  {
    name: 'Schibsted Grotesk + Domine',
    displayFont: 'Schibsted Grotesk',
    bodyFont: 'Domine',
    googleImport: "url('https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700;800&family=Domine:wght@400;500;600;700&display=swap')",
    mood: 'editorial, Scandinavian, clean authority, unique character',
    displayStack: "'Schibsted Grotesk', sans-serif",
    bodyStack: "'Domine', serif",
    headingWeight: 'font-700',
  },
]

// ─── 8 Hero Layout Variants ───────────────────────────────────────────────────

const HERO_LAYOUTS: HeroLayout[] = [
  {
    id: 'video-fullbleed',
    name: 'Cinematic Video Hero',
    description: 'Full-viewport Kling-generated video background. Text overlaid. Most cinematic.',
    component: 'Hero',
    copyStyle: 'Bold, confident tagline. Short. Action word first. Trust badge strip below CTA.',
    bestFor: ['hvac', 'roofing', 'junk-removal', 'remodeling', 'auto-detailing'],
    avoidFor: ['daycare', 'dentist'],
  },
  {
    id: 'photo-grid-asymmetric',
    name: 'Asymmetric Photo Grid',
    description: '2×2 asymmetric photo grid right side. Editorial left column. Real photos from Google.',
    component: 'HeroPhotoGrid',
    copyStyle: 'Warm, human headline. Emphasize results and people. Add a stat callout.',
    bestFor: ['cleaning', 'dentist', 'medspa', 'daycare'],
    avoidFor: ['hvac', 'roofing'],
  },
  {
    id: 'scroll-pinned',
    name: 'Scroll-Scrubbed Premium',
    description: 'ScrollHero — premium scroll-driven parallax. Video scrubs with scroll.',
    component: 'ScrollHero',
    copyStyle: 'Cinematic, single strong idea. Headline builds as user scrolls.',
    bestFor: ['medspa', 'lawfirm', 'remodeling'],
    avoidFor: ['daycare', 'junk-removal', 'cleaning'],
  },
  {
    id: 'split-horizontal',
    name: 'Horizontal Split',
    description: 'Left: headline, CTA, trust. Right: full-bleed image or video. Clean divide.',
    component: 'Hero',
    copyStyle: 'Direct value prop on left. Image tells the story on right. No fluff.',
    bestFor: ['lawfirm', 'dentist', 'auto-detailing', 'remodeling'],
    avoidFor: [],
  },
  {
    id: 'centered-editorial',
    name: 'Centered Editorial',
    description: 'Centered type at massive scale. Minimal. Refined. Background texture or gradient.',
    component: 'HeroCentered',
    copyStyle: 'Short, poetic headline. One clear CTA. Let the type breathe.',
    bestFor: ['medspa', 'lawfirm', 'luxury-realestate'],
    avoidFor: ['junk-removal', 'hvac', 'roofing'],
  },
  {
    id: 'diagonal-split',
    name: 'Diagonal Split',
    description: 'Angled SVG divider between dark text zone and image zone. Energetic.',
    component: 'Hero',
    copyStyle: 'Bold, direct. Energy in the diagonal. Fast reads. Strong CTA.',
    bestFor: ['roofing', 'hvac', 'auto-detailing', 'junk-removal'],
    avoidFor: ['medspa', 'lawfirm'],
  },
  {
    id: 'bento-hero',
    name: 'Bento Grid Hero',
    description: 'Apple-style bento. Headline in large cell. Stats, trust, photo in smaller cells.',
    component: 'HeroBento',
    copyStyle: 'Scannable. Bold headline + data-forward. Show the numbers.',
    bestFor: ['remodeling', 'cleaning', 'auto-detailing', 'daycare'],
    avoidFor: ['lawfirm'],
  },
  {
    id: 'fullscreen-overlay',
    name: 'Fullscreen Overlay',
    description: 'Full-screen real business photo with dark overlay. Text centered over image.',
    component: 'Hero',
    copyStyle: 'Atmosphere-first. Let the photo say it. Copy supports, not replaces.',
    bestFor: ['medspa', 'restaurant', 'daycare', 'cleaning'],
    avoidFor: [],
  },
]

// ─── 6 Section Orders ─────────────────────────────────────────────────────────
// Mix up section sequence to avoid cookie-cutter pattern

const SECTION_ORDERS: SectionOrder[] = [
  { id: 'order-a', sections: ['hero', 'niche', 'whyus', 'reviews', 'services', 'contact'] },
  { id: 'order-b', sections: ['hero', 'services', 'niche', 'stats', 'reviews', 'contact'] },
  { id: 'order-c', sections: ['hero', 'whyus', 'niche', 'reviews', 'serviceAreas', 'contact'] },
  { id: 'order-d', sections: ['hero', 'stats', 'niche', 'services', 'reviews', 'contact'] },
  { id: 'order-e', sections: ['hero', 'niche', 'stats', 'whyus', 'reviews', 'contact'] },
  { id: 'order-f', sections: ['hero', 'reviews', 'niche', 'whyus', 'services', 'contact'] },
]

// ─── Niche-specific color palettes (from colors.csv) ─────────────────────────

const NICHE_PALETTES: Record<string, ColorPalette[]> = {
  hvac: [
    {
      name: 'HVAC Sky Trust',
      primary: '#0EA5E9', secondary: '#38BDF8', accent: '#F97316',
      bg: '#F0F9FF', bgSection: '#E0F2FE', text: '#0C4A6E', textMuted: '#164E63',
      tokens: { '--brand-accent': '#0EA5E9', '--brand-accent-light': '#38BDF8', '--brand-accent-glow': 'rgba(14,165,233,0.25)', '--brand-grad-from': '#38BDF8', '--brand-grad-to': '#0EA5E9', '--shadow-cta': '0 8px 32px -4px rgba(14,165,233,0.35)' },
    },
    {
      name: 'HVAC Navy Pro',
      primary: '#1E40AF', secondary: '#3B82F6', accent: '#F97316',
      bg: '#EFF6FF', bgSection: '#DBEAFE', text: '#1E3A8A', textMuted: '#1E40AF',
      tokens: { '--brand-accent': '#1E40AF', '--brand-accent-light': '#3B82F6', '--brand-accent-glow': 'rgba(30,64,175,0.25)', '--brand-grad-from': '#3B82F6', '--brand-grad-to': '#1E40AF', '--shadow-cta': '0 8px 32px -4px rgba(30,64,175,0.35)' },
    },
  ],
  roofing: [
    {
      name: 'Roofing Industrial Grey',
      primary: '#64748B', secondary: '#94A3B8', accent: '#F97316',
      bg: '#F8FAFC', bgSection: '#F1F5F9', text: '#334155', textMuted: '#475569',
      tokens: { '--brand-accent': '#F97316', '--brand-accent-light': '#FB923C', '--brand-accent-glow': 'rgba(249,115,22,0.25)', '--brand-grad-from': '#FB923C', '--brand-grad-to': '#F97316', '--shadow-cta': '0 8px 32px -4px rgba(249,115,22,0.35)' },
    },
    {
      name: 'Roofing Storm Dark',
      primary: '#1E293B', secondary: '#334155', accent: '#DC2626',
      bg: '#F8FAFC', bgSection: '#E2E8F0', text: '#0F172A', textMuted: '#334155',
      tokens: { '--brand-accent': '#DC2626', '--brand-accent-light': '#EF4444', '--brand-accent-glow': 'rgba(220,38,38,0.25)', '--brand-grad-from': '#EF4444', '--brand-grad-to': '#DC2626', '--shadow-cta': '0 8px 32px -4px rgba(220,38,38,0.35)' },
    },
  ],
  medspa: [
    {
      name: 'MedSpa Rose Gold',
      primary: '#EC4899', secondary: '#F9A8D4', accent: '#8B5CF6',
      bg: '#FDF2F8', bgSection: '#FCE7F3', text: '#831843', textMuted: '#9D174D',
      tokens: { '--brand-accent': '#8B5CF6', '--brand-accent-light': '#A78BFA', '--brand-accent-glow': 'rgba(139,92,246,0.25)', '--brand-grad-from': '#EC4899', '--brand-grad-to': '#8B5CF6', '--shadow-cta': '0 8px 32px -4px rgba(139,92,246,0.30)' },
    },
    {
      name: 'MedSpa Noir Violet',
      primary: '#09090F', secondary: '#1A1A2E', accent: '#8B5CF6',
      bg: '#09090F', bgSection: '#131325', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.55)',
      tokens: { '--brand-accent': '#8B5CF6', '--brand-accent-light': '#A78BFA', '--brand-accent-glow': 'rgba(139,92,246,0.45)', '--brand-bg': '#09090F', '--brand-bg-section': '#131325', '--brand-grad-from': '#A78BFA', '--brand-grad-to': '#8B5CF6', '--shadow-cta': '0 8px 32px -4px rgba(139,92,246,0.45)' },
    },
  ],
  lawfirm: [
    {
      name: 'Law Authority Navy',
      primary: '#1E3A8A', secondary: '#1E40AF', accent: '#B45309',
      bg: '#F8FAFC', bgSection: '#EFF6FF', text: '#0F172A', textMuted: '#334155',
      tokens: { '--brand-accent': '#1E3A8A', '--brand-accent-light': '#1E40AF', '--brand-accent-glow': 'rgba(30,58,138,0.20)', '--brand-grad-from': '#1E40AF', '--brand-grad-to': '#1E3A8A', '--brand-rule': '#B45309', '--shadow-cta': '0 8px 32px -4px rgba(30,58,138,0.30)' },
    },
    {
      name: 'Law Premium Gold',
      primary: '#0F172A', secondary: '#334155', accent: '#CA8A04',
      bg: '#F8FAFC', bgSection: '#F1F5F9', text: '#020617', textMuted: '#334155',
      tokens: { '--brand-accent': '#CA8A04', '--brand-accent-light': '#EAB308', '--brand-accent-glow': 'rgba(202,138,4,0.20)', '--brand-grad-from': '#EAB308', '--brand-grad-to': '#CA8A04', '--shadow-cta': '0 8px 32px -4px rgba(202,138,4,0.25)' },
    },
  ],
  dentist: [
    {
      name: 'Dental Fresh Sky',
      primary: '#0EA5E9', secondary: '#38BDF8', accent: '#FBBF24',
      bg: '#F0F9FF', bgSection: '#E0F2FE', text: '#0C4A6E', textMuted: '#164E63',
      tokens: { '--brand-accent': '#0EA5E9', '--brand-accent-light': '#38BDF8', '--brand-accent-glow': 'rgba(14,165,233,0.20)', '--brand-grad-from': '#38BDF8', '--brand-grad-to': '#0EA5E9', '--shadow-cta': '0 8px 32px -4px rgba(14,165,233,0.30)' },
    },
    {
      name: 'Dental Clinical Teal',
      primary: '#0891B2', secondary: '#22D3EE', accent: '#22C55E',
      bg: '#ECFEFF', bgSection: '#CFFAFE', text: '#164E63', textMuted: '#0E7490',
      tokens: { '--brand-accent': '#0891B2', '--brand-accent-light': '#22D3EE', '--brand-accent-glow': 'rgba(8,145,178,0.20)', '--brand-grad-from': '#22D3EE', '--brand-grad-to': '#0891B2', '--shadow-cta': '0 8px 32px -4px rgba(8,145,178,0.30)' },
    },
  ],
  cleaning: [
    {
      name: 'Cleaning Fresh Cyan',
      primary: '#0891B2', secondary: '#22D3EE', accent: '#22C55E',
      bg: '#ECFEFF', bgSection: '#CFFAFE', text: '#164E63', textMuted: '#0E7490',
      tokens: { '--brand-accent': '#0891B2', '--brand-accent-light': '#22D3EE', '--brand-accent-glow': 'rgba(8,145,178,0.20)', '--brand-grad-from': '#22D3EE', '--brand-grad-to': '#0891B2', '--shadow-cta': '0 8px 32px -4px rgba(8,145,178,0.25)' },
    },
    {
      name: 'Cleaning Trust Green',
      primary: '#059669', secondary: '#10B981', accent: '#0EA5E9',
      bg: '#ECFDF5', bgSection: '#D1FAE5', text: '#064E3B', textMuted: '#065F46',
      tokens: { '--brand-accent': '#059669', '--brand-accent-light': '#10B981', '--brand-accent-glow': 'rgba(5,150,105,0.20)', '--brand-grad-from': '#10B981', '--brand-grad-to': '#059669', '--shadow-cta': '0 8px 32px -4px rgba(5,150,105,0.25)' },
    },
  ],
  'junk-removal': [
    {
      name: 'Junk Bold Orange',
      primary: '#F97316', secondary: '#FB923C', accent: '#1E293B',
      bg: '#FFF7ED', bgSection: '#FFEDD5', text: '#9A3412', textMuted: '#C2410C',
      tokens: { '--brand-accent': '#F97316', '--brand-accent-light': '#FB923C', '--brand-accent-glow': 'rgba(249,115,22,0.30)', '--brand-grad-from': '#FB923C', '--brand-grad-to': '#F97316', '--shadow-cta': '0 8px 32px -4px rgba(249,115,22,0.40)' },
    },
    {
      name: 'Junk Industrial',
      primary: '#1E293B', secondary: '#334155', accent: '#F59E0B',
      bg: '#F8FAFC', bgSection: '#F1F5F9', text: '#0F172A', textMuted: '#334155',
      tokens: { '--brand-accent': '#F59E0B', '--brand-accent-light': '#FBBF24', '--brand-accent-glow': 'rgba(245,158,11,0.25)', '--brand-grad-from': '#FBBF24', '--brand-grad-to': '#F59E0B', '--shadow-cta': '0 8px 32px -4px rgba(245,158,11,0.35)' },
    },
  ],
  daycare: [
    {
      name: 'Daycare Soft Pink',
      primary: '#EC4899', secondary: '#F9A8D4', accent: '#22C55E',
      bg: '#FDF2F8', bgSection: '#FCE7F3', text: '#9D174D', textMuted: '#BE185D',
      tokens: { '--brand-accent': '#EC4899', '--brand-accent-light': '#F9A8D4', '--brand-accent-glow': 'rgba(236,72,153,0.20)', '--brand-grad-from': '#F9A8D4', '--brand-grad-to': '#EC4899', '--shadow-cta': '0 8px 32px -4px rgba(236,72,153,0.25)' },
    },
    {
      name: 'Daycare Sunshine',
      primary: '#F59E0B', secondary: '#FBBF24', accent: '#22C55E',
      bg: '#FFFBEB', bgSection: '#FEF3C7', text: '#78350F', textMuted: '#92400E',
      tokens: { '--brand-accent': '#F59E0B', '--brand-accent-light': '#FBBF24', '--brand-accent-glow': 'rgba(245,158,11,0.25)', '--brand-grad-from': '#FBBF24', '--brand-grad-to': '#F59E0B', '--shadow-cta': '0 8px 32px -4px rgba(245,158,11,0.30)' },
    },
  ],
  'auto-detailing': [
    {
      name: 'Auto Dark Precision',
      primary: '#1E293B', secondary: '#334155', accent: '#DC2626',
      bg: '#F8FAFC', bgSection: '#E2E8F0', text: '#0F172A', textMuted: '#334155',
      tokens: { '--brand-accent': '#DC2626', '--brand-accent-light': '#EF4444', '--brand-accent-glow': 'rgba(220,38,38,0.25)', '--brand-grad-from': '#EF4444', '--brand-grad-to': '#DC2626', '--shadow-cta': '0 8px 32px -4px rgba(220,38,38,0.35)' },
    },
    {
      name: 'Auto Chrome Blue',
      primary: '#2563EB', secondary: '#3B82F6', accent: '#F59E0B',
      bg: '#EFF6FF', bgSection: '#DBEAFE', text: '#1E3A8A', textMuted: '#1E40AF',
      tokens: { '--brand-accent': '#2563EB', '--brand-accent-light': '#3B82F6', '--brand-accent-glow': 'rgba(37,99,235,0.25)', '--brand-grad-from': '#3B82F6', '--brand-grad-to': '#2563EB', '--shadow-cta': '0 8px 32px -4px rgba(37,99,235,0.35)' },
    },
  ],
  remodeling: [
    {
      name: 'Remodeling Earth',
      primary: '#78350F', secondary: '#92400E', accent: '#0891B2',
      bg: '#FEF3C7', bgSection: '#FDE68A', text: '#451A03', textMuted: '#78350F',
      tokens: { '--brand-accent': '#92400E', '--brand-accent-light': '#B45309', '--brand-accent-glow': 'rgba(146,64,14,0.20)', '--brand-grad-from': '#B45309', '--brand-grad-to': '#92400E', '--shadow-cta': '0 8px 32px -4px rgba(146,64,14,0.25)' },
    },
    {
      name: 'Remodeling Slate',
      primary: '#475569', secondary: '#64748B', accent: '#F97316',
      bg: '#F8FAFC', bgSection: '#F1F5F9', text: '#334155', textMuted: '#475569',
      tokens: { '--brand-accent': '#F97316', '--brand-accent-light': '#FB923C', '--brand-accent-glow': 'rgba(249,115,22,0.20)', '--brand-grad-from': '#FB923C', '--brand-grad-to': '#F97316', '--shadow-cta': '0 8px 32px -4px rgba(249,115,22,0.25)' },
    },
  ],
  restaurant: [
    {
      name: 'Restaurant Deep Red',
      primary: '#DC2626', secondary: '#EF4444', accent: '#CA8A04',
      bg: '#FEF2F2', bgSection: '#FEE2E2', text: '#450A0A', textMuted: '#7F1D1D',
      tokens: { '--brand-accent': '#DC2626', '--brand-accent-light': '#EF4444', '--brand-accent-glow': 'rgba(220,38,38,0.30)', '--brand-grad-from': '#EF4444', '--brand-grad-to': '#DC2626', '--shadow-cta': '0 8px 32px -4px rgba(220,38,38,0.40)' },
    },
  ],
  'luxury-realestate': [
    {
      name: 'Luxury Dubai Gold',
      primary: '#050505', secondary: '#0A0A0A', accent: '#C9A96E',
      bg: '#050505', bgSection: '#111111', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.55)',
      tokens: { '--brand-accent': '#C9A96E', '--brand-accent-light': '#E8D4A8', '--brand-accent-glow': 'rgba(201,169,110,0.35)', '--brand-bg': '#050505', '--brand-bg-section': '#111111', '--brand-grad-from': '#E8D4A8', '--brand-grad-to': '#C9A96E', '--shadow-cta': '0 8px 32px -4px rgba(201,169,110,0.30)' },
    },
  ],
  plumbing: [
    {
      name: 'Plumbing Deep Navy',
      primary: '#1E3A8A', secondary: '#1E40AF', accent: '#F97316',
      bg: '#F0F4FF', bgSection: '#E0E7FF', text: '#0F172A', textMuted: '#1E3A8A',
      tokens: { '--brand-accent': '#F97316', '--brand-accent-light': '#FB923C', '--brand-accent-glow': 'rgba(249,115,22,0.25)', '--brand-grad-from': '#FB923C', '--brand-grad-to': '#F97316', '--shadow-cta': '0 8px 32px -4px rgba(249,115,22,0.35)' },
    },
    {
      name: 'Plumbing Charcoal Copper',
      primary: '#292524', secondary: '#44403C', accent: '#D97706',
      bg: '#FAFAF9', bgSection: '#F5F5F4', text: '#1C1917', textMuted: '#44403C',
      tokens: { '--brand-accent': '#D97706', '--brand-accent-light': '#F59E0B', '--brand-accent-glow': 'rgba(217,119,6,0.25)', '--brand-grad-from': '#F59E0B', '--brand-grad-to': '#D97706', '--shadow-cta': '0 8px 32px -4px rgba(217,119,6,0.35)' },
    },
  ],
  landscaping: [
    {
      name: 'Landscaping Forest Deep',
      primary: '#14532D', secondary: '#166534', accent: '#CA8A04',
      bg: '#F0FDF4', bgSection: '#DCFCE7', text: '#052E16', textMuted: '#14532D',
      tokens: { '--brand-accent': '#16A34A', '--brand-accent-light': '#22C55E', '--brand-accent-glow': 'rgba(22,163,74,0.20)', '--brand-grad-from': '#22C55E', '--brand-grad-to': '#16A34A', '--shadow-cta': '0 8px 32px -4px rgba(22,163,74,0.30)' },
    },
    {
      name: 'Landscaping Terracotta Sun',
      primary: '#9A3412', secondary: '#C2410C', accent: '#16A34A',
      bg: '#FFF7ED', bgSection: '#FFEDD5', text: '#431407', textMuted: '#9A3412',
      tokens: { '--brand-accent': '#C2410C', '--brand-accent-light': '#EA580C', '--brand-accent-glow': 'rgba(194,65,12,0.20)', '--brand-grad-from': '#EA580C', '--brand-grad-to': '#C2410C', '--shadow-cta': '0 8px 32px -4px rgba(194,65,12,0.30)' },
    },
  ],
  'pressure-washing': [
    {
      name: 'PW Electric Blue',
      primary: '#0369A1', secondary: '#0284C7', accent: '#FBBF24',
      bg: '#F0F9FF', bgSection: '#E0F2FE', text: '#0C4A6E', textMuted: '#075985',
      tokens: { '--brand-accent': '#0284C7', '--brand-accent-light': '#38BDF8', '--brand-accent-glow': 'rgba(2,132,199,0.25)', '--brand-grad-from': '#38BDF8', '--brand-grad-to': '#0284C7', '--shadow-cta': '0 8px 32px -4px rgba(2,132,199,0.35)' },
    },
    {
      name: 'PW Clean White',
      primary: '#0F172A', secondary: '#1E293B', accent: '#06B6D4',
      bg: '#F8FAFC', bgSection: '#F1F5F9', text: '#020617', textMuted: '#334155',
      tokens: { '--brand-accent': '#06B6D4', '--brand-accent-light': '#22D3EE', '--brand-accent-glow': 'rgba(6,182,212,0.25)', '--brand-grad-from': '#22D3EE', '--brand-grad-to': '#06B6D4', '--shadow-cta': '0 8px 32px -4px rgba(6,182,212,0.35)' },
    },
  ],
  'epoxy-flooring': [
    {
      name: 'Epoxy Carbon Volt',
      primary: '#111827', secondary: '#1F2937', accent: '#7C3AED',
      bg: '#F9FAFB', bgSection: '#F3F4F6', text: '#030712', textMuted: '#374151',
      tokens: { '--brand-accent': '#7C3AED', '--brand-accent-light': '#8B5CF6', '--brand-accent-glow': 'rgba(124,58,237,0.30)', '--brand-grad-from': '#8B5CF6', '--brand-grad-to': '#7C3AED', '--shadow-cta': '0 8px 32px -4px rgba(124,58,237,0.40)' },
    },
    {
      name: 'Epoxy Metallic Silver',
      primary: '#374151', secondary: '#4B5563', accent: '#F59E0B',
      bg: '#FAFAFA', bgSection: '#F4F4F5', text: '#111827', textMuted: '#374151',
      tokens: { '--brand-accent': '#F59E0B', '--brand-accent-light': '#FBBF24', '--brand-accent-glow': 'rgba(245,158,11,0.25)', '--brand-grad-from': '#FBBF24', '--brand-grad-to': '#F59E0B', '--shadow-cta': '0 8px 32px -4px rgba(245,158,11,0.35)' },
    },
  ],
  'basement-waterproofing': [
    {
      name: 'Basement Trust Blue',
      primary: '#1D4ED8', secondary: '#2563EB', accent: '#059669',
      bg: '#EFF6FF', bgSection: '#DBEAFE', text: '#1E3A8A', textMuted: '#1D4ED8',
      tokens: { '--brand-accent': '#1D4ED8', '--brand-accent-light': '#3B82F6', '--brand-accent-glow': 'rgba(29,78,216,0.20)', '--brand-grad-from': '#3B82F6', '--brand-grad-to': '#1D4ED8', '--shadow-cta': '0 8px 32px -4px rgba(29,78,216,0.30)' },
    },
    {
      name: 'Basement Shield Grey',
      primary: '#374151', secondary: '#4B5563', accent: '#0891B2',
      bg: '#F9FAFB', bgSection: '#F3F4F6', text: '#111827', textMuted: '#374151',
      tokens: { '--brand-accent': '#0891B2', '--brand-accent-light': '#22D3EE', '--brand-accent-glow': 'rgba(8,145,178,0.20)', '--brand-grad-from': '#22D3EE', '--brand-grad-to': '#0891B2', '--shadow-cta': '0 8px 32px -4px rgba(8,145,178,0.30)' },
    },
  ],
  'foundation-repair': [
    {
      name: 'Foundation Stone Strong',
      primary: '#44403C', secondary: '#57534E', accent: '#DC2626',
      bg: '#FAFAF9', bgSection: '#F5F5F4', text: '#1C1917', textMuted: '#44403C',
      tokens: { '--brand-accent': '#DC2626', '--brand-accent-light': '#EF4444', '--brand-accent-glow': 'rgba(220,38,38,0.25)', '--brand-grad-from': '#EF4444', '--brand-grad-to': '#DC2626', '--shadow-cta': '0 8px 32px -4px rgba(220,38,38,0.35)' },
    },
    {
      name: 'Foundation Safety Orange',
      primary: '#7C2D12', secondary: '#9A3412', accent: '#EA580C',
      bg: '#FFF7ED', bgSection: '#FFEDD5', text: '#431407', textMuted: '#7C2D12',
      tokens: { '--brand-accent': '#EA580C', '--brand-accent-light': '#F97316', '--brand-accent-glow': 'rgba(234,88,12,0.25)', '--brand-grad-from': '#F97316', '--brand-grad-to': '#EA580C', '--shadow-cta': '0 8px 32px -4px rgba(234,88,12,0.35)' },
    },
  ],
  'septic-services': [
    {
      name: 'Septic Environmental Green',
      primary: '#065F46', secondary: '#047857', accent: '#0891B2',
      bg: '#ECFDF5', bgSection: '#D1FAE5', text: '#022C22', textMuted: '#065F46',
      tokens: { '--brand-accent': '#047857', '--brand-accent-light': '#10B981', '--brand-accent-glow': 'rgba(4,120,87,0.20)', '--brand-grad-from': '#10B981', '--brand-grad-to': '#047857', '--shadow-cta': '0 8px 32px -4px rgba(4,120,87,0.30)' },
    },
    {
      name: 'Septic Pro Dark',
      primary: '#1E293B', secondary: '#334155', accent: '#16A34A',
      bg: '#F8FAFC', bgSection: '#F1F5F9', text: '#0F172A', textMuted: '#334155',
      tokens: { '--brand-accent': '#16A34A', '--brand-accent-light': '#22C55E', '--brand-accent-glow': 'rgba(22,163,74,0.20)', '--brand-grad-from': '#22C55E', '--brand-grad-to': '#16A34A', '--shadow-cta': '0 8px 32px -4px rgba(22,163,74,0.30)' },
    },
  ],
  'tree-services': [
    {
      name: 'Tree Canopy Deep',
      primary: '#14532D', secondary: '#15803D', accent: '#CA8A04',
      bg: '#F0FDF4', bgSection: '#DCFCE7', text: '#052E16', textMuted: '#14532D',
      tokens: { '--brand-accent': '#15803D', '--brand-accent-light': '#16A34A', '--brand-accent-glow': 'rgba(21,128,61,0.20)', '--brand-grad-from': '#16A34A', '--brand-grad-to': '#15803D', '--shadow-cta': '0 8px 32px -4px rgba(21,128,61,0.30)' },
    },
    {
      name: 'Tree Arborist Bold',
      primary: '#431407', secondary: '#7C2D12', accent: '#15803D',
      bg: '#FFF7ED', bgSection: '#FFEDD5', text: '#1C0A00', textMuted: '#7C2D12',
      tokens: { '--brand-accent': '#7C2D12', '--brand-accent-light': '#9A3412', '--brand-accent-glow': 'rgba(124,45,18,0.20)', '--brand-grad-from': '#9A3412', '--brand-grad-to': '#7C2D12', '--shadow-cta': '0 8px 32px -4px rgba(124,45,18,0.30)' },
    },
  ],
  salon: [
    {
      name: 'Salon Rose Glam',
      primary: '#BE185D', secondary: '#DB2777', accent: '#7C3AED',
      bg: '#FDF2F8', bgSection: '#FCE7F3', text: '#500724', textMuted: '#9D174D',
      tokens: { '--brand-accent': '#DB2777', '--brand-accent-light': '#EC4899', '--brand-accent-glow': 'rgba(219,39,119,0.25)', '--brand-grad-from': '#EC4899', '--brand-grad-to': '#DB2777', '--shadow-cta': '0 8px 32px -4px rgba(219,39,119,0.35)' },
    },
    {
      name: 'Salon Noir Blush',
      primary: '#09090B', secondary: '#18181B', accent: '#F43F5E',
      bg: '#09090B', bgSection: '#18181B', text: '#FAFAFA', textMuted: 'rgba(250,250,250,0.55)',
      tokens: { '--brand-accent': '#F43F5E', '--brand-accent-light': '#FB7185', '--brand-accent-glow': 'rgba(244,63,94,0.35)', '--brand-bg': '#09090B', '--brand-bg-section': '#18181B', '--brand-grad-from': '#FB7185', '--brand-grad-to': '#F43F5E', '--shadow-cta': '0 8px 32px -4px rgba(244,63,94,0.40)' },
    },
  ],
  barbershop: [
    {
      name: 'Barbershop Noir Crimson',
      primary: '#0A0A0A', secondary: '#171717', accent: '#DC2626',
      bg: '#0A0A0A', bgSection: '#171717', text: '#FAFAFA', textMuted: 'rgba(250,250,250,0.55)',
      tokens: { '--brand-accent': '#DC2626', '--brand-accent-light': '#EF4444', '--brand-accent-glow': 'rgba(220,38,38,0.40)', '--brand-bg': '#0A0A0A', '--brand-bg-section': '#171717', '--brand-grad-from': '#EF4444', '--brand-grad-to': '#DC2626', '--shadow-cta': '0 8px 32px -4px rgba(220,38,38,0.45)' },
    },
    {
      name: 'Barbershop Vintage Ink',
      primary: '#1C1917', secondary: '#292524', accent: '#B45309',
      bg: '#FAFAF9', bgSection: '#F5F5F4', text: '#0C0A09', textMuted: '#44403C',
      tokens: { '--brand-accent': '#B45309', '--brand-accent-light': '#D97706', '--brand-accent-glow': 'rgba(180,83,9,0.25)', '--brand-grad-from': '#D97706', '--brand-grad-to': '#B45309', '--shadow-cta': '0 8px 32px -4px rgba(180,83,9,0.35)' },
    },
  ],
}

// ─── Hash function — deterministic, fast ──────────────────────────────────────

function djb2Hash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // 32-bit int
  }
  return Math.abs(hash)
}

function pickIndex<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length]
}

// ─── Main export: getDesignProfile ───────────────────────────────────────────

export function getDesignProfile(businessName: string, niche: string): DesignProfile {
  const seed = djb2Hash(`${businessName}::${niche}`)

  // Pick personality (avoid same on adjacent businesses by also using niche in seed)
  const personality = pickIndex(PERSONALITIES, seed, 0)

  // Pick font — prefer niche-relevant pairings if mood matches
  const allFonts = FONT_PAIRINGS
  const fonts = pickIndex(allFonts, seed, 1)

  // Pick hero layout — filter to niche-compatible, then pick from that subset
  const compatible = HERO_LAYOUTS.filter(h => !h.avoidFor.includes(niche))
  const hero = compatible.length > 0
    ? compatible[(seed + 2) % compatible.length]
    : HERO_LAYOUTS[(seed + 2) % HERO_LAYOUTS.length]

  // Section order
  const sectionOrder = pickIndex(SECTION_ORDERS, seed, 3)

  // Colors — niche-specific palette pool
  const palettesForNiche = NICHE_PALETTES[niche] ?? NICHE_PALETTES['hvac']
  const colors = pickIndex(palettesForNiche, seed, 4)

  // Build Gemini brief
  const geminiBrief = buildGeminiBrief({ personality, fonts, hero, sectionOrder, colors, businessName, niche })

  return {
    personality,
    fonts,
    hero,
    sectionOrder,
    colors,
    geminiBrief,
    googleFontsUrl: fonts.googleImport,
  }
}

function buildGeminiBrief(p: {
  personality: DesignPersonality
  fonts: FontPairing
  hero: HeroLayout
  sectionOrder: SectionOrder
  colors: ColorPalette
  businessName: string
  niche: string
}): string {
  return `
## DESIGN PROFILE for ${p.businessName} (${p.niche})

**Visual Personality**: ${p.personality.name}
${p.personality.description}

**What makes this UNIQUE (avoid generic AI slop)**:
${p.personality.differentiation}

**Typography System**:
- Display font: ${p.fonts.displayFont} (${p.fonts.displayStack})
- Body font: ${p.fonts.bodyFont} (${p.fonts.bodyStack})
- Mood: ${p.fonts.mood}

**Color System** (${p.colors.name}):
- Primary: ${p.colors.primary} | Secondary: ${p.colors.secondary} | Accent: ${p.colors.accent}
- Background: ${p.colors.bg} | Text: ${p.colors.text}

**Hero Layout**: ${p.hero.name}
${p.hero.description}
Copy style: ${p.hero.copyStyle}

**Section Order**: ${p.sectionOrder.sections.join(' → ')}

**Visual Mood for AI image prompts**:
${p.personality.visualMood}

**CSS/Design Keywords to use**:
${p.personality.cssKeywords.join(', ')}

**Component Styles**:
- Background: ${p.personality.bgTreatment}
- Cards: ${p.personality.cardStyle}
- Headings: ${p.personality.headingTreatment}
- Buttons: ${p.personality.buttonStyle}

**CRITICAL RULES** (non-negotiable):
1. NO generic purple gradients on white
2. NO Space Grotesk as display font
3. NO identical card grid layout for every section
4. Every section must feel architecturally distinct from the previous
5. Typography must do heavy lifting — not just color
6. The design should feel like a real studio made this, not a template engine
`.trim()
}

// ─── CSS token injection helper ───────────────────────────────────────────────

export function generateDesignTokensCSS(profile: DesignProfile): string {
  const { colors, fonts } = profile
  const tokenOverrides = Object.entries(colors.tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')

  return `
/* ── Design Profile: ${profile.personality.name} ── */
/* ── Fonts: ${profile.fonts.name} ── */
:root {
  --font-display: ${fonts.displayStack};
  --font-body: ${fonts.bodyStack};
${tokenOverrides}
}`.trim()
}
