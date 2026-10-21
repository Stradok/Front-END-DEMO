#!/usr/bin/env bash
# Rebuilds this folder: the Gyraq site at the root, plus static, sample-data copies of the
# HVAC CRM (/products/crm/hvac) and the ERP (/products/erp/distribution).
# The source repos are never touched: each app is copied to a temp dir and patched there.
set -euo pipefail
OUT="$(cd "$(dirname "$0")" && pwd)"
DESK="$(dirname "$OUT")"
WORK="${TMPDIR:-/tmp}/gyraq-demo-build"
rm -rf "$WORK" && mkdir -p "$WORK"

# Exports one Next app. $1 source dir, $2 base path, $3 name, $4 optional patch function run on the copy.
export_app() {
  local src="$1" base="$2" dir="$WORK/$3"
  rsync -a --exclude /node_modules --exclude /.next --exclude /out --exclude /mobile --exclude /tests \
    --exclude '.env*' --exclude '*.tsbuildinfo' "$src/" "$dir/"
  ln -s "$src/node_modules" "$dir/node_modules"
  # No server on a static host: drop the API routes (the AI features then report they are offline).
  rm -rf "$dir/src/app/api" "$dir/src/app/runtime-config.js"
  # Each record page is exported once as "record"; vercel.json rewrites every id to it and the page reads the id from the URL.
  find "$dir/src/app" -type d -name '\[id\]' | while read -r d; do
    printf "export function generateStaticParams() { return [{ id: 'record' }] }\nexport default function L({ children }: { children: React.ReactNode }) { return children }\n" > "$d/layout.tsx"
    echo "$base${d#"$dir/src/app"}" | sed -E 's#/\([^)]*\)##g; s#\[id\]#:id#' >> "$WORK/routes"
  done
  mv "$dir/next.config.ts" "$dir/next.base.ts"
  cat > "$dir/next.config.ts" <<'EOF'
import base from './next.base'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { headers, ...rest } = base as Record<string, unknown>
export default { ...rest, output: 'export', images: { unoptimized: true }, turbopack: { root: '/' } }
EOF
  [ -n "${4:-}" ] && "$4" "$dir"
  (cd "$dir" && NEXT_PUBLIC_BASE_PATH="$base" node_modules/.bin/next build)
  rm -rf "${OUT:?}$base" && mkdir -p "$OUT$base" && cp -r "$dir/out/." "$OUT$base/"
}

# HVAC pages read the id with useParams, which would say "record": swap in one that reads the address bar.
hvac_patch() {
  cat > "$1/src/lib/static-params.ts" <<'EOF'
'use client'
import { useParams as useNextParams } from 'next/navigation'
import { useSyncExternalStore } from 'react'
export function useParams<T extends { id: string }>(): T {
  const p = useNextParams<T>()
  const id = useSyncExternalStore(() => () => undefined, () => decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() ?? p.id), () => p.id)
  return { ...p, id } as T
}
EOF
  grep -rl "import { useParams } from 'next/navigation'" "$1/src/app" | xargs sed -i "s#import { useParams } from 'next/navigation'#import { useParams } from '@/lib/static-params'#"
}

# 1. The two apps on their sample data (first, so a failed build leaves the site files alone).
NEXT_PUBLIC_DATA_SOURCE=mock NEXT_PUBLIC_DEMO_MODE=true NEXT_PUBLIC_CTA_URL='mailto:services@gyraq.com?subject=Book%20a%20meeting' \
  export_app "$DESK/HVAC-AI/Front-End" /products/crm/hvac hvac hvac_patch
export_app "$DESK/ERP/frontend" /products/erp/distribution erp

# 2. Gyraq site: an allow-list of the public files only (no .env, credentials, notes, dev folders or serverless functions).
#    --delete drops files removed from Gyraq; the P rules keep this script, vercel.json and the app exports.
rsync -a --delete --filter 'P /build.sh' --filter 'P /vercel.json' --filter 'P /products/crm/' --filter 'P /products/erp/' \
  --exclude '.env*' --exclude '*.md' --exclude '*.pem' --exclude '*.key' --exclude '*credential*' --exclude '*secret*' \
  --include '/css/***' --include '/js/***' --include '/assets/***' --include '/services/***' --include '/products/***' \
  --include '/*.html' --include '/robots.txt' --include '/sitemap.xml' --exclude '*' "$DESK/Gyraq/" "$OUT/"

# 3. vercel.json: the site's clean URLs plus one rewrite per record page; fails if a rewrite target is missing.
node -e '
const fs = require("fs"), [routesFile, siteFile, out] = process.argv.slice(1)
const rewrites = fs.readFileSync(routesFile, "utf8").trim().split("\n").map(r => ({ source: r, destination: r.replace(":id", "record.html") }))
for (const r of rewrites) if (!fs.existsSync(out + r.destination)) throw new Error("missing " + r.destination)
const site = require(siteFile)
fs.writeFileSync(out + "/vercel.json", JSON.stringify({ cleanUrls: true, trailingSlash: false, redirects: site.redirects, rewrites }, null, 2) + "\n")
// The same rules for running it on a laptop with `npx serve` (see README.md).
fs.writeFileSync(out + "/serve.json", JSON.stringify({ cleanUrls: true, trailingSlash: false, rewrites }, null, 2) + "\n")
' "$WORK/routes" "$DESK/Gyraq/vercel.json" "$OUT"

rm -rf "$WORK"
echo "Built into $OUT"
