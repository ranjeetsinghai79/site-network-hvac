# Agent Rules — Website Developer

## Stack (read before writing code)

- **Next.js 16.2.4** — App Router (`src/app/`). NOT Pages Router. Breaking changes vs older versions.
- **React 19.2.4** — Server Components default. `"use client"` only when required.
- **Tailwind CSS v4** — CSS-native config (`@theme` in globals.css). No `tailwind.config.js`.
- **Framer Motion 12.x** — Client-only. All animated components need `"use client"`.
- **TypeScript 5** — Strict. No `any`.

## File Structure

```
src/app/          ← App Router routes
src/components/   ← Shared UI components
src/hooks/        ← Custom React hooks
src/lib/          ← Utilities, helpers
public/           ← Static assets
```

## Critical Rules

### Next.js App Router
- Routes = `src/app/**/page.tsx`
- Shared layout = `layout.tsx`
- Loading state = `loading.tsx`
- Error boundary = `error.tsx`
- **NEVER** use `getServerSideProps`, `getStaticProps`, `getStaticPaths` — Pages Router only
- **NEVER** import from `next/router` → use `next/navigation`
- Data fetching: `async` Server Components with native `fetch()`, not `useEffect`

### Components
- Default: Server Component (no directive)
- Add `"use client"` only for: event handlers, useState/useEffect, Framer Motion, browser APIs
- Images: `next/image` always, with explicit `width`/`height` or `fill` + `sizes`
- Links: `next/link` always

### Framer Motion
- Every file using Framer Motion must start with `"use client"`
- Use `variants` pattern — define animation objects outside component
- Wrap conditional renders with `AnimatePresence`

### Tailwind v4
- Custom tokens in `src/app/globals.css` under `@theme {}`
- No separate config file
- Responsive: `sm:` `md:` `lg:` `xl:` prefixes

### TypeScript
- Strict mode — no `any` or `@ts-ignore` without comment
- Props: explicit interface/type, no implicit `{}` props
- Async Server Components: `async function Page()` pattern

## Commands

```bash
npm run dev      # start dev server
npm run build    # type-check + build
npm run lint     # lint
```

## What NOT to Do

- No `pages/` directory
- No CSS Modules or styled-components — Tailwind only
- No `useEffect` for data fetching — use Server Components
- No `any` type
- No `console.log` left in production code
