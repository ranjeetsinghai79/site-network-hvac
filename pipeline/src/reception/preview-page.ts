import type { ReceptionConfig } from './types.js'
import type { PreviewDisplayConfig } from './db.js'

// Landing-page "paste your URL" preview: a single hand-built HTML page (no
// build step, no framework) served directly by this Node server — same
// precedent as server.ts's GET /crm/contacted route. Deliberately NOT a
// pixel-accurate clone of a real @core/web niche template (that capability
// doesn't exist for a runtime JSON config — see the plan's constraint #3);
// this is a fast, honest "we understood your business" teaser with the real
// live AI widget embedded and actually working.

const THEME_ACCENTS: Record<string, { accent: string; accentLight: string; bg: string; text: string }> = {
  clean:  { accent: '#6366F1', accentLight: '#818CF8', bg: '#FAFAFA', text: '#18181B' },
  slate:  { accent: '#8B5CF6', accentLight: '#A78BFA', bg: '#FAFAFA', text: '#18181B' },
  dubai:  { accent: '#C9A96E', accentLight: '#DEC08F', bg: '#0B0B0C', text: '#F5F5F4' },
  noir:   { accent: '#E5E5E5', accentLight: '#FFFFFF', bg: '#0A0A0A', text: '#FAFAFA' },
  ocean:  { accent: '#06B6D4', accentLight: '#22D3EE', bg: '#FAFAFA', text: '#18181B' },
  forest: { accent: '#10B981', accentLight: '#34D399', bg: '#FAFAFA', text: '#18181B' },
  ember:  { accent: '#F59E0B', accentLight: '#FBBF24', bg: '#FAFAFA', text: '#18181B' },
}

function esc(s: string | undefined | null): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderPreviewHtml(
  config: ReceptionConfig,
  displayConfig: PreviewDisplayConfig | null,
  widgetHost: string,
): string {
  const brain = config.brain
  const theme = THEME_ACCENTS[displayConfig?.theme ?? 'clean'] ?? THEME_ACCENTS.clean
  const tagline = displayConfig?.tagline ?? `${brain.name} — now answered 24/7`
  const hero = brain.heroImage

  const servicesHtml = (brain.services ?? []).slice(0, 6).map(s => `
    <div class="wp-service">
      <h3>${esc(s.name)}</h3>
      ${s.description ? `<p>${esc(s.description)}</p>` : ''}
      ${s.price ? `<span class="wp-price">${esc(s.price)}</span>` : ''}
    </div>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(brain.name)} — AI SalesPerson Preview</title>
<style>
  :root {
    --accent: ${theme.accent}; --accent-light: ${theme.accentLight};
    --bg: ${theme.bg}; --text: ${theme.text};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    background: var(--bg); color: var(--text);
  }
  .wp-hero {
    position: relative; min-height: 52vh; display: flex; flex-direction: column;
    justify-content: flex-end; padding: 32px 24px; overflow: hidden;
    background: linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.65)), var(--accent);
  }
  .wp-hero img {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; opacity: 0.55;
  }
  .wp-badge {
    display: inline-block; background: rgba(255,255,255,0.15); color: #fff; font-size: 12px;
    letter-spacing: 0.05em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; margin-bottom: 12px; width: fit-content;
  }
  .wp-hero h1 { color: #fff; font-size: clamp(28px, 5vw, 44px); margin: 0 0 8px; font-weight: 800; max-width: 720px; }
  .wp-hero p { color: rgba(255,255,255,0.9); font-size: 18px; margin: 0; max-width: 560px; }
  .wp-section { max-width: 880px; margin: 0 auto; padding: 40px 24px; }
  .wp-section h2 { font-size: 22px; margin: 0 0 20px; }
  .wp-services { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .wp-service { border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; padding: 16px; }
  .wp-service h3 { margin: 0 0 6px; font-size: 16px; }
  .wp-service p { margin: 0 0 6px; font-size: 14px; opacity: 0.75; }
  .wp-price { font-weight: 700; color: var(--accent); font-size: 14px; }
  .wp-nudge {
    position: sticky; bottom: 0; background: var(--accent); color: #fff; padding: 14px 20px;
    display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px; text-align: center;
  }
  .wp-nudge strong { font-weight: 700; }
</style>
</head>
<body>
  <div class="wp-hero">
    ${hero ? `<img src="${esc(hero)}" alt="">` : ''}
    <span class="wp-badge">AI SalesPerson Preview</span>
    <h1>${esc(brain.name)}</h1>
    <p>${esc(tagline)}</p>
  </div>

  ${servicesHtml ? `<div class="wp-section"><h2>What we offer</h2><div class="wp-services">${servicesHtml}</div></div>` : ''}

  <div class="wp-nudge">👋 Try the chat bubble in the corner — it's <strong>${esc(brain.name)}'s</strong> new AI SalesPerson, live right now.</div>

  <script src="${esc(widgetHost)}/widget.js" data-config="${esc(config.id)}" data-name="${esc(brain.name)}" async></script>
</body>
</html>`
}
