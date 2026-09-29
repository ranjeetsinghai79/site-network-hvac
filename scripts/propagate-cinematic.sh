#!/usr/bin/env bash
# Propagates GSAP + Lenis cinematic upgrades from hvac template to all others.
# Copies: globals.css additions, gsap-init.ts, smooth-scroll.tsx, layout.tsx
# Updates: package.json deps in each template
# Does NOT copy hero/services/why-us (niche-specific content differs)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/templates/hvac"
NICHES=(roofing dentist medspa lawfirm remodeling cleaning junk-removal daycare auto-detailing restaurant)

for niche in "${NICHES[@]}"; do
  DEST="$ROOT/templates/$niche"
  if [[ ! -d "$DEST" ]]; then
    echo "  [skip] $niche — directory not found"
    continue
  fi

  echo "→ $niche"

  # Copy shared cinematic files
  cp "$SRC/src/lib/gsap-init.ts"              "$DEST/src/lib/gsap-init.ts"
  cp "$SRC/src/components/smooth-scroll.tsx"  "$DEST/src/components/smooth-scroll.tsx"

  # Copy globals.css (preserves existing @theme block — assumes same structure)
  cp "$SRC/src/app/globals.css" "$DEST/src/app/globals.css"

  # Update layout.tsx to add SmoothScroll wrapper
  cp "$SRC/src/app/layout.tsx" "$DEST/src/app/layout.tsx"

  # Inject gsap + lenis into package.json dependencies
  node - <<'EOF'
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(process.env.DEST, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

pkg.dependencies['gsap']  = '^3.12.7'
pkg.dependencies['lenis'] = '^1.3.4'

// Sort keys for cleanliness
pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort())

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('  Updated package.json')
EOF

  # Install in this template
  (cd "$DEST" && npm install --silent)
  echo "  Done ✓"
done

echo ""
echo "All templates upgraded. Hero/services/why-us still need manual GSAP migration per niche."
echo "Run: npm run dev:<niche> to verify each one."
