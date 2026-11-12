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

sudo -v

if sudo -u postgres psql -X --tuples-only --no-align --dbname=postgres \
  --command="SELECT 1 FROM pg_roles WHERE rolname = 'msm'" | grep -qx '1'; then
  printf 'ALTER ROLE "msm" WITH LOGIN PASSWORD '\''%s'\'';\n' "$escaped_password" |
    sudo -u postgres psql -X --set=ON_ERROR_STOP=1 --dbname=postgres
  echo "Updated the existing local PostgreSQL msm role."
else
  printf 'CREATE ROLE "msm" WITH LOGIN PASSWORD '\''%s'\'';\n' "$escaped_password" |
    sudo -u postgres psql -X --set=ON_ERROR_STOP=1 --dbname=postgres
  echo "Created the local PostgreSQL msm role."
fi

if sudo -u postgres psql -X --tuples-only --no-align --dbname=postgres \
  --command="SELECT 1 FROM pg_database WHERE datname = 'msm'" | grep -qx '1'; then
  sudo -u postgres psql -X --set=ON_ERROR_STOP=1 --dbname=postgres \
    --command='ALTER DATABASE "msm" OWNER TO "msm";'
  echo "Confirmed the existing local PostgreSQL msm database."
else
  sudo -u postgres createdb --owner=msm msm
  echo "Created the local PostgreSQL msm database."
fi

sudo -u postgres psql -X --set=ON_ERROR_STOP=1 --dbname=msm \
  --command='ALTER SCHEMA public OWNER TO "msm"; GRANT ALL ON SCHEMA public TO "msm";'

(
  cd "$project_root/backend"
  MSM_DATABASE_URL="$database_url" node <<'NODE'
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.MSM_DATABASE_URL });

client.connect()
  .then(() => client.query('SELECT current_database() AS database_name, current_user AS role_name'))
  .then((result) => {
    const row = result.rows[0];
    if (row?.database_name !== 'msm' || row?.role_name !== 'msm') {
      throw new Error('Unexpected PostgreSQL database or role');
    }
  })
  .finally(() => client.end());
NODE
)

unset database_url db_password escaped_password MSM_DATABASE_URL
echo "The local PostgreSQL msm role and database now match backend/.env."
echo "Run ./scripts/deploy-pm2.sh to build and reload MSM."
