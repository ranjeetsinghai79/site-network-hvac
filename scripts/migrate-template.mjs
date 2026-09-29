#!/usr/bin/env node
/**
 * Migrate a service-business template to consume @core/web.
 * Usage: node scripts/migrate-template.mjs <niche> <theme>
 * e.g.   node scripts/migrate-template.mjs roofing ember
 *
 * Operates only on "service" templates with the shared 7-component shape:
 *   nav, hero, services, why-us, reviews, service-areas, contact, footer
 * Skips luxury-realestate, restaurant, hvac (handled separately).
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, rmSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

const [niche, theme] = process.argv.slice(2)
if (!niche || !theme) {
  console.error("Usage: node migrate-template.mjs <niche> <theme>")
  process.exit(1)
}

const TEMPLATE_DIR = resolve(ROOT, "templates", niche)
if (!existsSync(TEMPLATE_DIR)) {
  console.error(`Template ${niche} not found at ${TEMPLATE_DIR}`)
  process.exit(1)
}

// ── Read current config.ts to extract fields ───────────────────
const configPath = resolve(TEMPLATE_DIR, "src/lib/config.ts")
const configSrc = readFileSync(configPath, "utf-8")

function extractObject(src, name) {
  const re = new RegExp(`export const ${name}\\s*=\\s*({[\\s\\S]*?\\n})`)
  const arrRe = new RegExp(`export const ${name}\\s*=\\s*(\\[[\\s\\S]*?\\n\\])`)
  return src.match(re)?.[1] ?? src.match(arrRe)?.[1] ?? null
}

const businessRaw = extractObject(configSrc, "BUSINESS")
const servicesRaw = extractObject(configSrc, "SERVICES")
const testimonialsRaw = extractObject(configSrc, "TESTIMONIALS")
const trustBadgesRaw = extractObject(configSrc, "TRUST_BADGES")

if (!businessRaw || !servicesRaw || !testimonialsRaw || !trustBadgesRaw) {
  console.error(`Failed to extract one of BUSINESS/SERVICES/TESTIMONIALS/TRUST_BADGES from ${configPath}`)
  process.exit(1)
}

// Extract city from address (first comma-separated piece)
const addressMatch = businessRaw.match(/address:\s*"([^"]+)"/)
const address = addressMatch?.[1] ?? ""
const city = address.split(",")[0].trim()

// Service titles for formServiceOptions
const serviceTitles = []
const titleRe = /title:\s*"([^"]+)"/g
let m
while ((m = titleRe.exec(servicesRaw)) !== null) serviceTitles.push(m[1])

// Generic reasons (used as fallback — niche can override if config-gen produces specific ones)
const genericReasons = [
  { icon: "clock",       title: "Fast Response",          desc: "Same-day service when you need it. We don't keep customers waiting." },
  { icon: "dollar-sign", title: "Upfront Pricing",        desc: "Quote before work starts. The number we say is the number you pay." },
  { icon: "award",       title: "Certified Professionals", desc: "Licensed, insured, and trained. Real expertise on every job." },
  { icon: "thumbs-up",   title: "Satisfaction Guarantee", desc: "100% happy or we come back and make it right. No questions asked." },
  { icon: "phone",       title: "Real Humans Answer",     desc: "No phone trees. A real person picks up — day and night." },
  { icon: "truck",       title: "Fully Equipped",         desc: "Trucks stocked with everything needed. First-visit completion rate above 90%." },
]

// Stats from existing business fields
const ratingMatch = businessRaw.match(/google_rating:\s*"([^"]+)"/)
const reviewMatch = businessRaw.match(/review_count:\s*"([^"]+)"/)
const sinceMatch = businessRaw.match(/since:\s*"([^"]+)"/)
const rating = ratingMatch?.[1] ?? "4.9"
const reviews = reviewMatch?.[1] ?? "100"
const since = sinceMatch?.[1] ?? "2010"
const yearsActive = Math.max(1, new Date().getFullYear() - parseInt(since))

const stats = [
  { value: parseFloat(rating),                   label: "Google Rating",  suffix: "★", decimals: 1 },
  { value: parseInt(reviews.replace(/\D/g, "")) * 5, label: "Jobs Done",  suffix: "+", decimals: 0 },
  { value: yearsActive,                          label: "Yrs Experience", suffix: "+", decimals: 0 },
]

// ── Build new config.ts ────────────────────────────────────────
// Inject city/theme/niche into the existing BUSINESS literal
const businessWithExtras = businessRaw
  .replace(/^{/, `{\n  city: "${city}",\n  theme: "${theme}",\n  niche: "${niche}",`)

const newConfig = `import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: ${businessWithExtras},

  services: ${servicesRaw},

  testimonials: ${testimonialsRaw},

  trustBadges: ${trustBadgesRaw},

  stats: ${JSON.stringify(stats, null, 2)},

  reasons: ${JSON.stringify(genericReasons, null, 2)},

  formServiceOptions: ${JSON.stringify(serviceTitles, null, 2)},
}

// Backward compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!
`

writeFileSync(configPath, newConfig)
console.log(`  ✓ Rewrote config.ts`)

// ── package.json ───────────────────────────────────────────────
const pkgPath = resolve(TEMPLATE_DIR, "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
pkg.dependencies = pkg.dependencies || {}
pkg.dependencies["@core/web"] = "*"
delete pkg.dependencies["framer-motion"]
// Ensure required deps for @core/web peer
if (!pkg.dependencies.gsap) pkg.dependencies.gsap = "^3.12.7"
if (!pkg.dependencies.lenis) pkg.dependencies.lenis = "^1.3.4"
if (!pkg.dependencies["@gsap/react"]) pkg.dependencies["@gsap/react"] = "^2.1.2"
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
console.log(`  ✓ Patched package.json`)

// ── tsconfig.json ──────────────────────────────────────────────
const tsPath = resolve(TEMPLATE_DIR, "tsconfig.json")
let tsSrc = readFileSync(tsPath, "utf-8")
if (!tsSrc.includes('"@core/web"')) {
  tsSrc = tsSrc.replace(
    /"paths":\s*{\s*"@\/\*":\s*\["\.\/src\/\*"\]\s*}/,
    `"paths": {
      "@/*": ["./src/*"],
      "@core/web": ["../../packages/core/src"],
      "@core/web/*": ["../../packages/core/src/*"]
    }`
  )
  writeFileSync(tsPath, tsSrc)
}
console.log(`  ✓ Patched tsconfig.json`)

// ── next.config.ts ─────────────────────────────────────────────
const nextPath = resolve(TEMPLATE_DIR, "next.config.ts")
let nextSrc = readFileSync(nextPath, "utf-8")
if (!nextSrc.includes("transpilePackages")) {
  nextSrc = nextSrc.replace(
    /(images:\s*{\s*unoptimized:\s*true\s*},)/,
    `$1\n  transpilePackages: ["@core/web"],`
  )
  writeFileSync(nextPath, nextSrc)
}
console.log(`  ✓ Patched next.config.ts`)

// ── postcss.config.mjs ─────────────────────────────────────────
const postcssPath = resolve(TEMPLATE_DIR, "postcss.config.mjs")
if (!existsSync(postcssPath)) {
  writeFileSync(postcssPath, `const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}

export default config
`)
  console.log(`  ✓ Created postcss.config.mjs`)
}

// ── layout.tsx ────────────────────────────────────────────────
const layoutPath = resolve(TEMPLATE_DIR, "src/app/layout.tsx")
writeFileSync(layoutPath, `import type { Metadata } from "next"
import "./globals.css"
import { config } from "@/lib/config"
import {
  SmoothScroll,
  MagneticCursor,
  LoadingScreen,
  ScrollProgress,
} from "@core/web"

const { business } = config

export const metadata: Metadata = {
  title: \`\${business.name} | \${business.address}\`,
  description: \`\${business.name} — \${business.tagline} Serving \${business.serviceAreas.join(", ")}. Call \${business.phone}.\`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className="min-h-full flex flex-col antialiased"
        data-theme={business.theme}
      >
        <LoadingScreen name={business.name} tagline={\`\${business.serviceAreas[0]} · Licensed & Insured\`} />
        <ScrollProgress />
        <MagneticCursor />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  )
}
`)
console.log(`  ✓ Rewrote layout.tsx`)

// ── page.tsx ──────────────────────────────────────────────────
const pagePath = resolve(TEMPLATE_DIR, "src/app/page.tsx")
writeFileSync(pagePath, `import { Nav, Hero, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import { config } from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="light" />
      <main>
        <Hero config={config} posterSrc="/hero-1.jpg" />
        <Services config={config} layout="horizontal" />
        <WhyUs config={config} />
        <Reviews
          config={config}
          ctaText={\`Join \${config.business.review_count}+ Happy Customers — Call Now\`}
        />
        <ServiceAreas config={config} />
        <Contact config={config} />
      </main>
      <Footer config={config} />
    </>
  )
}
`)
console.log(`  ✓ Rewrote page.tsx`)

// ── globals.css ───────────────────────────────────────────────
// Preserve any custom font import line from existing file; fall back to default
const globalsPath = resolve(TEMPLATE_DIR, "src/app/globals.css")
const existingGlobals = existsSync(globalsPath) ? readFileSync(globalsPath, "utf-8") : ""
const fontImport = existingGlobals.split("\n").find(l => l.startsWith("@import url(")) ??
  `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`

writeFileSync(globalsPath, `${fontImport}
@import "tailwindcss";
@source "../../../../packages/core/src";
@import "@core/web/styles";

/* ═══════════════════════════════════════════════════════════════
   ${niche} · niche overrides (data-theme="${theme}")
   ═══════════════════════════════════════════════════════════════ */
.loading-screen { background: var(--brand-bg); }
.loading-screen .aurora-blob { background: var(--brand-blob-1); }
`)
console.log(`  ✓ Rewrote globals.css`)

// ── Delete duplicated component files ─────────────────────────
const componentsDir = resolve(TEMPLATE_DIR, "src/components")
const dupComponents = [
  "nav.tsx", "hero.tsx", "services.tsx", "why-us.tsx",
  "reviews.tsx", "service-areas.tsx", "contact.tsx", "footer.tsx",
  "smooth-scroll.tsx", "cursor.tsx", "loading-screen.tsx", "scroll-progress.tsx",
  "brand-story.tsx", "hero-thermostat.tsx",
]
for (const file of dupComponents) {
  const p = resolve(componentsDir, file)
  if (existsSync(p)) {
    unlinkSync(p)
    console.log(`  ✓ Deleted ${file}`)
  }
}

// Delete hooks/ and lib/gsap-init.ts if present
const hooksDir = resolve(TEMPLATE_DIR, "src/hooks")
if (existsSync(hooksDir)) {
  rmSync(hooksDir, { recursive: true })
  console.log(`  ✓ Deleted src/hooks/`)
}
const gsapInitPath = resolve(TEMPLATE_DIR, "src/lib/gsap-init.ts")
if (existsSync(gsapInitPath)) {
  unlinkSync(gsapInitPath)
  console.log(`  ✓ Deleted src/lib/gsap-init.ts`)
}
const typesPath = resolve(TEMPLATE_DIR, "src/lib/types.ts")
if (existsSync(typesPath)) {
  unlinkSync(typesPath)
  console.log(`  ✓ Deleted src/lib/types.ts`)
}

console.log(`\n✅ Migrated ${niche} → @core/web (theme: ${theme})`)
