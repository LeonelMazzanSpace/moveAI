#!/usr/bin/env bash
# Builds the API and packages it for Elastic Beanstalk: artifacts/move-api-<short sha>.zip
# The zip holds only Procfile, package.json, dist/ and production node_modules. It never reads or copies a .env file.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

sha="$(git rev-parse --short HEAD)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

pnpm --filter @move/api build

# Native pnpm command (not the package's own `deploy` script): installs the API's production dependencies into $work/deploy.
# pnpm 10 only deploys a workspace package that injects workspace packages; the API has none, so the flag is passed per call.
pnpm --config.inject-workspace-packages=true --filter @move/api deploy --prod "$work/deploy"

# Whitelist what ships. `pnpm deploy` also copies src/, test/ and any local .env from the package folder.
stage="$work/stage"
mkdir -p "$stage"
mv "$work/deploy/node_modules" "$stage/node_modules"
cp "$work/deploy/package.json" "$stage/package.json"
cp apps/api/Procfile "$stage/Procfile"
cp -R apps/api/dist "$stage/dist"

mkdir -p artifacts
out="$root/artifacts/move-api-$sha.zip"
rm -f "$out"
# -y keeps pnpm's symlinks inside node_modules as symlinks.
(cd "$stage" && zip -qry "$out" .)

echo "Created artifacts/move-api-$sha.zip"
