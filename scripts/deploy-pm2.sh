#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$project_root/backend/.env" ]]; then
  echo "backend/.env is required before starting MSM."
  exit 1
fi

npm ci --prefix "$project_root/backend"
npm run build --prefix "$project_root/backend"
npm ci --prefix "$project_root/web"
npm run check --prefix "$project_root/web"
npm run build --prefix "$project_root/web"

pm2 startOrReload "$project_root/ecosystem.config.cjs" --only msm-backend,msm-web --update-env
pm2 save

pm2 describe msm-backend
pm2 describe msm-web
