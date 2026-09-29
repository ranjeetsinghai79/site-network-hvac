# Website Developer — Claude Code Instructions

## Stack

| Tool | Version | Notes |
|------|---------|-------|
| Next.js | 16.2.4 | App Router, `src/app/` layout |
| React | 19.2.4 | Server Components by default |
| TypeScript | 5.x | Strict mode |
| Tailwind CSS | 4.x | No `tailwind.config.js` — config via CSS |
| Framer Motion | 12.x | For animations; must be client components |
| Node | 25.x | npm 11 |

## Commands

```bash
npm run dev      # dev server → http://localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
```

## Project Structure

```
src/
  app/
    layout.tsx        # root layout (Server Component)
    page.tsx          # home page
    globals.css       # Tailwind base + global styles
  components/         # shared UI components
  hooks/              # custom React hooks
  lib/                # utilities, helpers
public/               # static assets
.claude/skills/       # UI/UX Pro Max skill (auto-loaded)
.mcp.json             # MCP servers: Magic (21st.dev) + Playwright
```

---

## Website Generation Modes

### Mode 1: Brand New Website

When user provides requirements (or ask these questions first):

1. **Business type** — what is this website for?
2. **Target audience** — who visits it?
3. **Key pages** — home, about, services, portfolio, contact, etc.
4. **Brand feel** — (examples: luxury, playful, minimal, bold, techy)
5. **Reference sites** — any existing sites they like?
6. **Color preferences** — specific colors or "you choose"?

Then:
- Use UI/UX Pro Max skill to generate design system
- Use Magic MCP (21st.dev) to scaffold polished components
- Apply Framer Motion animations throughout
- Preview in browser via Playwright MCP

### Mode 2: Redesign Existing Website

When user provides a URL:

1. Navigate to URL with Playwright MCP → take screenshot
2. Analyze: layout structure, content, navigation, brand colors
3. Ask user: keep branding or full rebrand?
4. Generate new design system via UI/UX Pro Max
5. Rebuild page by page with rich animations, modern layout
6. Screenshot each rebuilt page → compare with original

---

## AI Tools Available

### UI/UX Pro Max Skill (`/ui-ux-pro-max`)
Installed at `.claude/skills/ui-ux-pro-max/`. Provides:
- 67 UI styles (Glassmorphism, Neomorphism, Brutalism, etc.)
- 96 color palettes
- 57 font pairings
- Design system generator
- Animation guidelines per style

### Firecrawl MCP (self-hosted)
Running at `http://localhost:3002` via Docker Compose at `~/Documents/firecrawl/`.
Start: `cd ~/Documents/firecrawl && docker compose up -d`
Stop: `cd ~/Documents/firecrawl && docker compose down`
API key: `local` (no auth, self-hosted)
Use for: deep content extraction from existing websites before redesign (all text, nav, copy, page structure).
MCP server: `firecrawl-mcp` (via npx) — configured in `.mcp.json`.

### Magic MCP (21st.dev)
API key in `.env` as `TWENTYFIRST_API_KEY`. Generates production-ready React components.
> "Use Magic to create a hero section with animated gradient"

### Playwright MCP
Browser automation for:
- Screenshotting existing websites before redesign
- Live-testing generated pages at localhost:3000
- Verifying animations and interactions work correctly

---

## Framer Motion Rules

All Framer Motion components require `"use client"` directive.

```tsx
"use client"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
}
```

- `variants` + `initial/animate/exit` — standard pattern
- `AnimatePresence` — wrap conditional renders
- `useScroll` + `useTransform` — parallax / scroll-driven
- `whileHover` / `whileTap` — micro-interactions
- `layoutId` — shared element transitions between routes

## Animation Standards

- Entrance: `opacity 0→1` + `y 20→0`, duration `0.5–0.8s`
- Stagger children: `0.08–0.15s` delay between items
- Hover: `scale(1.02–1.05)`, duration `0.2s`
- Page transitions: `AnimatePresence` with slide or fade
- Scroll parallax: hero background moves at `0.3–0.5x` scroll speed

---

## Tailwind v4 Differences

Config via `@theme` in `globals.css` — no `tailwind.config.js`:

```css
@theme {
  --color-primary: #6366f1;
  --color-surface: #0f0f11;
  --font-display: "Inter", sans-serif;
  --radius-card: 1rem;
}
```

---

## Code Conventions

- Server Components by default; `"use client"` only for interactivity/hooks/animations
- File names: `kebab-case` for routes, `PascalCase` for components
- No comments unless WHY is non-obvious
- TypeScript strict — no `any`
- No CSS modules — Tailwind utilities only

---

## Next.js 16 App Router

- `layout.tsx` — wraps child routes
- `page.tsx` — route segment
- `loading.tsx` — Suspense fallback
- `error.tsx` — error boundary
- Data: `async` Server Components + `fetch()`, NOT `useEffect`
- Nav: `useRouter` from `next/navigation`
- Images: `next/image` always (width/height or fill+sizes)
- Fonts: `next/font` (zero layout shift)

## Do Not

- No `pages/` directory — App Router only
- No `getServerSideProps` / `getStaticProps` / `getStaticPaths`
- No `import from 'next/router'` → use `next/navigation`
- No inline styles — Tailwind only
- No comments explaining WHAT code does — only WHY if non-obvious
