#!/usr/bin/env bash
# Builds the production release: the standalone Next server with its static files and
# public/release.json, packed as release.tgz in the repository root.
# Usage: deploy/package-release.sh <40-hex-commit>   (run after `npm ci`)
set -euo pipefail

commit="${1:-}"
if [[ ! $commit =~ ^[0-9a-f]{40}$ ]]; then
  echo "usage: deploy/package-release.sh <40-hex-commit>" >&2
  exit 2
fi

cd "$(dirname "$0")/.."
release=.next/standalone
tarball=release.tgz

rm -rf "$release" "$tarball"
GEOGRIND_STANDALONE=1 npm run build

# The standalone server serves public/ and .next/static only when they sit next to it.
cp -r .next/static "$release/.next/"
mkdir -p "$release/public"
if [[ -d public ]]; then
  cp -r public/. "$release/public/"
fi

node -e '
  const [commit, builtAt] = process.argv.slice(1);
  const { version } = require("./package.json");
  process.stdout.write(JSON.stringify({ version, commit, builtAt }, null, 2) + "\n");
' "$commit" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$release/public/release.json"

# Configuration comes only from the host's environment file; local env files never ship.
find "$release" -maxdepth 1 -name '.env*' -print -exec rm -f {} +

tar -czf "$tarball" -C "$release" .

echo "release $(du -sh "$release" | cut -f1) unpacked, $(du -h "$tarball" | cut -f1) packed: $tarball"
