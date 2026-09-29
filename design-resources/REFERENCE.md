# Design Resources — Reference Library

Distilled 2026-07-19 from 4 sites + 3 repos. Full clones (react-bits, lenis) live in this dir but are gitignored — re-clone if missing:

```bash
cd design-resources
git clone --depth 1 https://github.com/DavidHDev/react-bits.git
git clone --depth 1 https://github.com/darkroomengineering/lenis.git
```

`composio` repo was cloned then dropped — it's an AI-agent tool-integration SDK (1000+ app toolkits for agents), zero overlap with frontend/web-design work in this monorepo. Not referenced below.

Already in our stack (`packages/core/package.json`, root `package.json`): `gsap` 3.12, `@gsap/react` 2.1, `lenis` 1.3, `three` 0.184. **Not installed**: `ogl` (lightweight WebGL lib react-bits' Backgrounds use — smaller than three.js for shader-only effects).

---

## 1. react-bits (github.com/DavidHDev/react-bits)

"Animated UI Components for React." ~100+ components, each shipped in 4 variants: `ts-default`, `ts-tailwind`, `js-default`, `tailwind` (plain JS). We want **ts-tailwind** — matches house rules (Tailwind v4, CSS vars, TypeScript).

Install methods: jsrepo CLI, manual copy-paste, or their own CLI. For this monorepo: **copy-paste only** — pull the one file you need into `packages/core/src/components/` or template-local `components/`, strip Chakra/shadcn deps, swap hardcoded colors for `var(--color-*)` per CLAUDE.md rule. Already did this once for `magic-treatment-menu.tsx` / `magic-testimonials.tsx` via 21st.dev — same pattern applies here.

Deps used across the library (see `design-resources/react-bits/package.json`): `gsap`, `ogl`, `three`, `@react-three/fiber`, `@react-three/drei`, `matter-js`, `motion` (framer-motion — **skip any component using this**, house rule is GSAP-only), `lenis`.

### Component catalog (source: `src/ts-tailwind/`)

**Backgrounds** (WebGL/canvas, full-bleed hero use) — `Aurora`, `Balatro`, `Ballpit`, `Beams`, `ColorBends`, `DarkVeil`, `Dither`, `DotField`, `DotGrid`, `EvilEye`, `FaultyTerminal`, `Ferrofluid`, `FloatingLines`, `Galaxy`, `GradientBlinds`, `Grainient`, `GridDistortion`, `GridMotion`, `GridScan`, `Hyperspeed`, `Iridescence`, `LetterGlitch`, `LightPillar`, `LightRays`, `Lightfall`, `Lightning`, `LineWaves`, `LiquidChrome`, `LiquidEther`, `Orb`, `Particles`, `PixelBlast`, `PixelSnow`, `Plasma`, `PlasmaWave`, `Prism`, `PrismaticBurst`, `Radar`, `RippleGrid`, `ShapeGrid`, `SideRays`, `Silk`, `SoftAurora`, `Threads`, `Waves`.
- Relevant to us: `Aurora` (already pattern-matches our aurora-blob requirement in loading-screen/hero — this is a real WebGL shader version vs our CSS blur-blob), `Waves`, `LiquidChrome`, `Silk` — luxury/medspa hero candidates.

**TextAnimations** — `ASCIIText`, `BlurText`, `CircularText`, `CountUp`, `CurvedLoop`, `DecryptedText`, `FallingText`, `FuzzyText`, `GlitchText`, `GradientText`, `RotatingText`, `ScrambledText`, `ScrollFloat`, `ScrollReveal`, `ScrollVelocity`, `ShinyText`, `Shuffle`, `SplitText`, `TextCursor`, `TextPressure`, `TextType`, `TrueFocus`, `VariableProximity`.
- `SplitText` here **is GSAP's own SplitText plugin wrapped** (`gsap/SplitText` + `@gsap/react` `useGSAP`) — exact same pattern as our `useTextReveal` hook. Worth diffing against `packages/core/src/hooks/use-text-reveal.ts` for missing features (fontsLoaded gate, per-char `onLetterAnimationComplete` callback, ScrollTrigger threshold/rootMargin props).
- `CountUp` — compare against our stats-counter GSAP pattern (`gsap.to({val:0},{val:target,onUpdate...})`).

**Components** (interactive UI) — `AnimatedList`, `BorderGlow`, `BounceCards`, `BubbleMenu`, `CardNav`, `CardSwap`, `Carousel`, `ChromaGrid`, `CircularGallery`, `Counter`, `CurvedInput`, `DecayCard`, `Dock`, `DomeGallery`, `ElasticSlider`, `FlowingMenu`, `FluidGlass`, `FlyingPosters`, `Folder`, `GlassIcons`, `GlassSurface`, `GooeyNav`, `InfiniteMenu`, `Lanyard`, `LineSidebar`, `MagicBento`, `Masonry`, `ModelViewer`, `OptionWheel`, `PillNav`, `PixelCard`, `ProfileCard`, `ReflectiveCard`, `ScrollStack`, `SpecularButton`, `SpotlightCard`, `Stack`, `StaggeredMenu`, `Stepper`, `TiltedCard`.
- `TiltedCard`/`SpotlightCard` — compare against our GSAP `quickTo` 3D tilt spec (rule #8 in CLAUDE.md).
- `CircularGallery`/`Masonry`/`CardSwap` — good for gallery-heavy niches (dentist smile-gallery, remodeling project-gallery).
- `PillNav`/`StaggeredMenu` — mobile nav upgrade candidates.

**Animations** (micro-interactions/cursor/FX) — `AnimatedContent`, `Antigravity`, `BlobCursor`, `ClickSpark`, `Crosshair`, `Cubes`, `CursorGrid`, `ElectricBorder`, `FadeContent`, `GhostCursor`, `GlareHover`, `GradualBlur`, `ImageTrail`, `LaserFlow`, `LogoLoop`, `MagicRings`, `Magnet`, `MagnetLines`, `MetaBalls`, `MetallicPaint`, `Noise`, `OrbitImages`, `PixelTrail`, `PixelTransition`, `Ribbons`, `ShapeBlur`, `SplashCursor`, `StarBorder`, `StickerPeel`, `Strands`, `TargetCursor`.
- `Magnet`/`TargetCursor`/`BlobCursor` — upgrade candidates for our `cursor.tsx` magnetic cursor (rule #12).
- `LogoLoop` — trust-badge marquee, useful for TRUST_BADGES section.
- `Noise` — grain overlay texture, cheap luxury-feel add.

**Workflow when pulling a component:** copy the `.tsx` from `design-resources/react-bits/src/ts-tailwind/<Category>/<Name>/`, strip any `motion`/framer-motion or Chakra imports, replace hardcoded hex colors with `var(--color-*)` tokens, replace `next/link`/`<Link>` with plain `<a>` if present, wire into `packages/core/src/sections/` (if reusable across niches) or template-local `components/` (if niche-specific), add to barrel export if shared.

---

## 2. Lenis (github.com/darkroomengineering/lenis) — already wired, this is upgrade reference

Already in `packages/core` as `smooth-scroll.tsx` (rule #3, `lerp: 0.1`, `smoothWheel: true`, `ScrollTrigger.update` on tick — don't remove).

New from repo worth knowing:
- **Packages**: `lenis` (core), `lenis/react` (adapter — `<ReactLenis>` provider + `useLenis()` hook, may simplify our manual wiring), `lenis/vue`, `lenis/framer`, `lenis/snap` (scroll-snap plugin — useful for a future full-bleed section-snap template, e.g. luxury-realestate listing pager).
- **No-code usage** section exists in README for drop-in HTML attribute-driven setup — n/a for us (all Next.js).
- Showcase site (lenis.dev/showcase) is itself a good inspiration source for scroll-driven sites, same spirit as seesaw.

---

## 3. Vanta.js (vantajs.com)

WebGL/p5 background effect library, ~120kb gzipped, "Waves" showcased on homepage plus a fuller effect grid ("More Effects" — site nav-gated, not fully scraped by fetch but known effects from the library: `WAVES`, `CLOUDS`, `CLOUDS2`, `FOG`, `NET`, `CELLS`, `TRUNK`, `TOPOLOGY`, `RINGS`, `RIPPLE`, `HALO`, `DOTS`, `GLOBE`, `BIRDS`).
- Deps: Three.js **r134** (older pinned version — not our current `three@0.184`, so don't mix a Vanta CDN script into our React tree without isolating it; version conflicts likely) or p5.js for some effects.
- Verdict for this repo: **skip Vanta, prefer react-bits' `ogl`-based Backgrounds** — same visual territory (Waves, Fog-like Silk/LiquidChrome), no Three.js version collision, and already TSX/React-native instead of imperative `VANTA.WAVES({el: ...})` global-script pattern. Only reach for Vanta if a client explicitly wants a specific named effect react-bits doesn't have (e.g. `BIRDS`, `GLOBE`, `TRUNK`).

---

## 4. GSAP (gsap.com) — confirms current stack, notes plugin surface

Now 100% free including what used to be Club GSAP-only plugins (SplitText, MorphSVG, DrawSVG, etc. — Webflow acquired GSAP in 2024 and open-sourced the paid tier). Full plugin surface by category:

- **Scroll**: `ScrollTrigger`, `ScrollSmoother`, `ScrollTo` — we use ScrollTrigger heavily; ScrollSmoother is a Lenis alternative, **don't add, redundant with Lenis**.
- **SVG**: `DrawSVG`, `MorphSVG`, `MotionPath`, `MotionPathHelper` — none in current templates; `MotionPath` worth checking for the hvac thermostat dial or any icon-follows-curve animation.
- **UI**: `Flip`, `Draggable`, `Inertia`, `Observer` — `Flip` is relevant for future filterable-gallery/before-after-slider work (smile-gallery, epoxy finish-showcase); `Draggable`+`Inertia` for a carousel/slider without a dependency.
- **Text**: `SplitText` (already used per house rule #5), `ScrambleText`, `Text Replace`.
- **Other**: `Physics2D`, `PhysicsProps`, `GSDevTools` (visual scrubber for debugging timelines — dev-only, useful while tuning entrance sequences).

npm: `gsap` (already installed 3.12 — current is fine, no urgent bump needed since paid-plugin unlock already applies to any 3.12+ install now that they're free).

---

## 5. Seesaw (seesaw.website) — inspiration gallery, not a library

Curated "best of the internet" design gallery, categories: Agency, AI, Crypto, Design, Design Tools, Developer Tools, E-Commerce, Fintech, Hardware, Marketing, Portfolios, Productivity, Social. Notable named sites: Cursor, Linear, Stripe, Midday, Vercel Ship, Cash App, plus designer portfolios (Frank Chimero, Jackie Zhang, Ryo Lu).

Use case for us: reference for **award-tier layout/motion inspiration** before starting a new niche template or hero redesign — same role as browsing Awwwards/Lapa Ninja, just a sharper curated set. Not a code source. Check before big design decisions per `/cinematic-build` skill's "any design decision" trigger.

---

## Quick decision table

| Need | Reach for |
|---|---|
| New hero WebGL background | react-bits `Backgrounds/*` (ogl) — not Vanta (Three version conflict) |
| Upgrade text reveal / split-text | Diff react-bits `TextAnimations/SplitText` vs `use-text-reveal.ts` |
| Upgrade cursor | react-bits `Animations/{Magnet,TargetCursor,BlobCursor}` |
| Filterable gallery / before-after | GSAP `Flip` plugin |
| Draggable carousel, no extra dep | GSAP `Draggable` + `Inertia` |
| Scroll-snap sections | `lenis/snap` |
| Simplify Lenis wiring | `lenis/react` (`<ReactLenis>` / `useLenis()`) |
| Design inspiration before new niche | seesaw.website |
| Agent/tool integration (not web design) | composio — **not relevant to this repo, skip** |
| Admin dashboard forms/tables/dialogs | shadcn CLI (`packages/shadcn`) |
| Anime.js vs GSAP for new animation | **stick with GSAP** — house rule, don't add anime.js |
| Small UI candy (buttons/toggles/loaders) | uiverse-io/galaxy raw CSS, adapt to CSS vars |
| Tailwind component framework (daisyUI) | **skip** — conflicts with our CSS-var theme system |
| SEO tooling reference | open-seo (self-hosted, DataForSEO-backed) — architecture reference only |

---

## Batch 2 — scraped 2026-07-20

Same rule: full clones live in `design-resources/` (gitignored), re-clone commands below. Distilled findings only in this file.

```bash
cd design-resources
git clone --depth 1 https://github.com/every-app/open-seo.git
git clone --depth 1 https://github.com/saadeghi/daisyui.git
git clone --depth 1 https://github.com/uiverse-io/galaxy.git
git clone --depth 1 https://github.com/shadcn-ui/ui.git
```

### 6. shadcn/ui (github.com/shadcn-ui/ui)

The canonical source for the `shadcn-ui` MCP server already listed as active in this file's header (CLAUDE.md "MCP Servers (active now)"). Repo is a monorepo: `packages/shadcn` (the CLI itself — `npx shadcn add <component>`), `packages/react`, `apps/v4` (the docs/registry site), plus framework starter `templates/` (next-app, vite-app, astro-app, react-router-app, etc — not needed, we already have our own Next.js template scaffolding).

Confirmed: **admin/ has zero shadcn/Radix/Chakra deps today** — just plain Tailwind v4 + `@tailwindcss/postcss`, hand-built components. This is exactly the gap the shadcn MCP is meant to fill per existing CLAUDE.md guidance ("Use for Contact section forms and admin components"). Use the CLI (`npx shadcn@latest add dialog table form`) or the MCP directly next time `admin/` needs a data table, dialog, or complex form — don't hand-roll those from scratch.

**Do not use shadcn in `templates/*/` niche sites** — those are governed by the CLAUDE.md rules (CSS vars only, GSAP-only, no Radix) and shadcn's default output uses its own CSS-var-per-component convention (`--primary`, `--radius`, etc, from `components.json` theme) that would need heavy adaptation to match `tokens.css`. Fine for admin (internal tool, less precious about aesthetic purity), avoid for client-facing template output.

### 7. daisyUI (github.com/saadeghi/daisyui, daisyui.com/blueprint)

Tailwind CSS v5-targeting component library — "most popular free component library for Tailwind." Uses its own CSS-variable theming (`--color-primary`, `--color-base-100`, oklch-based, defined in `packages/daisyui/src/themes/`) plus its own utility classes (`btn`, `card`, `drawer`, `dock`, `glass`, etc, in `packages/daisyui/src/components/`).

**Verdict: skip as a dependency.** Two reasons:
1. Its theming system duplicates ours — we already define all colors as `var(--color-*)` in `packages/core/src/styles/tokens.css` per niche theme (clean/slate/dubai/noir/ocean/forest/ember). Installing daisyUI means two parallel CSS-var theme systems fighting for the same namespace prefix.
2. Its component classes (`btn-primary`, `card`) collide conceptually with our own hand-rolled `.btn-primary`/`.hover-lift` classes (rule #13) — same names, different implementations, guaranteed confusion.

Its `blueprint` product (daisyui.com/blueprint) is a **paid MCP server** ($ license required) for AI-assisted daisyUI code gen (image-to-code, Figma-to-code, Bootstrap migration) — not free, not evaluated further, not needed since we don't use daisyUI itself.

If ever building something fully outside this monorepo's niche-template system (e.g. a quick internal tool with no brand requirements), daisyUI is a legitimate fast option — just not here.

### 8. Uiverse.io / galaxy (github.com/uiverse-io/galaxy)

Archive mirror of uiverse.io — 3000+ community-submitted UI elements as raw HTML/CSS (no framework, no JS dependency), MIT licensed. Categories in repo: `Buttons`, `Cards`, `Checkboxes`, `Forms`, `Inputs`, `Notifications`, `Patterns`, `Radio-buttons`, `Toggle-switches`, `Tooltips`, `loaders`.

Good grab-bag for **small interactive candy** — a single button hover effect, a toggle switch, a loading spinner — the kind of micro-detail that's tedious to hand-write but has outsized "premium feel" payoff (matches CLAUDE.md rule #13, "Premium Hover on ALL Interactive Elements"). Not component-library-shaped (no props/variants), each is a standalone copy-paste HTML+CSS snippet.

**Workflow:** browse the category folder locally or on uiverse.io, copy the raw CSS, strip hardcoded hex colors → `var(--color-*)`, strip any inline HTML structure into a proper React component if reused across niches. Best used for: toggle switches (booking widgets), loader/spinner (form submit states), button micro-interactions (secondary CTAs).

### 9. particles.casberry.in

Not a library or config generator — it's a **standalone WebGL creative tool** (AI Particle Simulator by Casberry India): Three.js + MediaPipe hand-tracking for "neural navigation" of particle swarms, webcam-driven. Full app, not a reusable snippet source. View-source shows a single-page app pulling `@mediapipe/*` CDN scripts + custom `js/export-manager.js`/`drawing-pad.js`.

**Verdict: inspiration only, not a code source.** If a client wants a genuinely novel interactive particle hero (rare, high-budget ask), this demonstrates hand-tracking-driven WebGL is viable — otherwise react-bits' `Backgrounds/Particles` (ogl-based, no MediaPipe/webcam complexity) covers the standard particle-background need already listed in CLAUDE.md rule #10.

### 10. Anime.js (animejs.com)

v4.0.0, `npm i animejs`, 24.5KB modular. Core API: `animate()`, `Timeline`, `Stagger`, plus newer additions — Scroll Observer (scroll-triggered anim, competes with our ScrollTrigger usage), Draggable API with spring physics, Scope API (responsive/media-query-bound animation contexts).

**Verdict: don't add.** CLAUDE.md is explicit — "GSAP only — no Framer Motion" — and the same reasoning extends to Anime.js: we already have full scroll/drag/stagger/timeline coverage via GSAP + ScrollTrigger + Draggable (see Batch 1 GSAP section, all plugins free now), and running two animation engines in one template bloats bundle size for zero capability gain. Noted here only so it's not "discovered" and reached for later out of novelty.

### 11. OpenSEO (github.com/every-app/open-seo, openseo.so)

Self-hosted, open-source Semrush/Ahrefs alternative — Cloudflare Workers + Drizzle ORM + DataForSEO API pass-through (pay-as-you-go, no subscription), ships an MCP server + Claude Agent Skills for keyword research, rank tracking, competitor insights, backlinks, site audits, AI-visibility checks.

**Relevance:** this monorepo's `retention.ts` `seo-agent` and the loaded `seo-*` skill family (seo-audit, seo-technical, seo-dataforseo, etc — see this session's available-skills list) already cover equivalent ground using DataForSEO directly, no OpenSEO dependency needed. Not installing — it's a full separate product (own DB schema, own Cloudflare Worker, own billing model), not a library to import.

**Worth stealing as a pattern**, not as code: its "bring your own DataForSEO key, pay only for what you use, 28% markup on hosted" pricing model is a clean reference if MedSpaOS ever productizes a client-facing SEO-audit upsell beyond the current free `/audit` report flow (`api/src/index.ts`) — self-hosting docs at `design-resources/open-seo/docs/` if that comes up later.
