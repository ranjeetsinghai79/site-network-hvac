import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js"

// Files named page.local.tsx / route.local.ts (sheet-leads dashboard) exist only under
// `next dev`. They use node:sqlite + the local filesystem, so the Cloudflare Pages build
// (`next build`) must never see them — pageExtensions is what keeps them out of the cloud.
export default (phase) => ({
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  pageExtensions:
    phase === PHASE_DEVELOPMENT_SERVER
      ? ["tsx", "ts", "jsx", "js", "local.tsx", "local.ts"]
      : ["tsx", "ts", "jsx", "js"],
})
