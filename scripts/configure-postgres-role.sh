#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$project_root/backend/.env"

if [[ ! -f "$env_file" ]]; then
  echo "backend/.env is required."
  exit 1
fi

database_url="$(awk -F= '$1 == "DATABASE_URL" { sub(/^[^=]*=/, ""); print; exit }' "$env_file")"
if [[ -z "$database_url" ]]; then
  echo "DATABASE_URL is missing from backend/.env."
  exit 1
fi

mapfile -t encoded_parts < <(
  MSM_DATABASE_URL="$database_url" node <<'NODE'
const value = process.env.MSM_DATABASE_URL;
const url = new URL(value);
for (const part of [url.username, url.password, url.hostname, url.pathname.replace(/^\//, '')]) {
  process.stdout.write(`${Buffer.from(decodeURIComponent(part)).toString('base64')}\n`);
}
NODE
)

db_user="$(printf '%s' "${encoded_parts[0]}" | base64 --decode)"
db_password="$(printf '%s' "${encoded_parts[1]}" | base64 --decode)"
db_host="$(printf '%s' "${encoded_parts[2]}" | base64 --decode)"
db_name="$(printf '%s' "${encoded_parts[3]}" | base64 --decode)"

if [[ "$db_user" != "msm" || "$db_name" != "msm" || ( "$db_host" != "localhost" && "$db_host" != "127.0.0.1" ) ]]; then
  echo "Refusing to alter PostgreSQL: DATABASE_URL must target the local msm role and msm database."
  exit 1
fi

escaped_password="${db_password//\'/\'\'}"
printf 'ALTER ROLE "msm" PASSWORD '\''%s'\'';\n' "$escaped_password" |
  sudo -u postgres psql -X --set=ON_ERROR_STOP=1 --dbname=postgres

unset database_url db_password escaped_password MSM_DATABASE_URL
echo "The local PostgreSQL msm role now matches backend/.env."
echo "Run ./scripts/deploy-pm2.sh to build and reload MSM."
