# HVAC Editorial template

Reusable HVAC style derived from the visual language of the Husky Air Mountain House and Network HVAC reference sites: condensed editorial typography, dark photographic hero, warm paper sections, bordered service grids, and direct response CTAs.

```bash
npm run dev:hvac-editorial
HVAC_TEMPLATE_STYLE=editorial npm run pipeline
```

Client-specific content remains isolated in `src/lib/config.ts`. Pipeline media overwrites `/hero-1.jpg`, `/hero-2.jpg`, and service images during a build.
