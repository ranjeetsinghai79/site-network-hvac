/**
 * RE Walkthrough CLI — listing photos → cinematic walkthrough video.
 *
 * Usage:
 *   npx tsx src/scripts/walkthrough.ts <images-dir> [slug]
 *   DRY_RUN=true npx tsx src/scripts/walkthrough.ts ./photos "142-maple-ave"
 *
 * Room type is inferred from filenames (e.g. 01-exterior.jpg, kitchen.png).
 * Name photos with room keywords for correct camera moves and walk order.
 * Output: listing-walkthroughs/<slug>/{scenes/, final/walkthrough-16x9.mp4}
 */
import { existsSync } from 'node:fs'
import { join, basename, resolve } from 'node:path'
import { buildWalkthrough } from '../walkthrough/builder.js'

async function main() {
  const imagesDir = process.argv[2]
  if (!imagesDir || !existsSync(imagesDir)) {
    console.error('Usage: npx tsx src/scripts/walkthrough.ts <images-dir> [slug]')
    process.exit(1)
  }

  const slug = (process.argv[3] ?? basename(resolve(imagesDir)))
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const outDir = join(process.cwd(), 'listing-walkthroughs', slug)
  const dryRun = process.env.DRY_RUN === 'true'

  await buildWalkthrough({ imagesDir, outDir, slug, dryRun })
}

main().catch((e) => { console.error(e); process.exit(1) })
