#!/usr/bin/env bash

set -euo pipefail

umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="$(cd "${script_dir}/.." && pwd)"
env_file="${MSM_ENV_FILE:-${backend_dir}/.env}"
example_file="${backend_dir}/.env.example"

if [[ ! -f "${env_file}" ]]; then
  cp -- "${example_file}" "${env_file}"
fi

chmod 600 "${env_file}"

read -r -p "SteamaCo username: " steama_username
read -r -s -p "SteamaCo password: " steama_password
printf '\n'

if [[ -z "${steama_username}" || -z "${steama_password}" ]]; then
  unset steama_username steama_password
  printf 'Both values are required. No changes were saved.\n' >&2
  exit 1
fi

temporary_file="$(mktemp "${env_file}.tmp.XXXXXX")"
cleanup() {
  rm -f -- "${temporary_file}"
}
trap cleanup EXIT

enabled_written=false
username_written=false
password_written=false

while IFS= read -r line || [[ -n "${line}" ]]; do
  case "${line}" in
    STEAMA_ENABLED=*)
      printf 'STEAMA_ENABLED=true\n' >> "${temporary_file}"
      enabled_written=true
      ;;
    STEAMA_SERVICE_USERNAME=*)
      printf 'STEAMA_SERVICE_USERNAME=%s\n' "${steama_username}" >> "${temporary_file}"
      username_written=true
      ;;
    STEAMA_SERVICE_PASSWORD=*)
      printf 'STEAMA_SERVICE_PASSWORD=%s\n' "${steama_password}" >> "${temporary_file}"
      password_written=true
      ;;
    *)
      printf '%s\n' "${line}" >> "${temporary_file}"
      ;;
  esac
done < "${env_file}"

if [[ "${enabled_written}" != true ]]; then
  printf 'STEAMA_ENABLED=true\n' >> "${temporary_file}"
fi
if [[ "${username_written}" != true ]]; then
  printf 'STEAMA_SERVICE_USERNAME=%s\n' "${steama_username}" >> "${temporary_file}"
fi
if [[ "${password_written}" != true ]]; then
  printf 'STEAMA_SERVICE_PASSWORD=%s\n' "${steama_password}" >> "${temporary_file}"
fi

chmod 600 "${temporary_file}"
mv -- "${temporary_file}" "${env_file}"
trap - EXIT
unset steama_username steama_password

printf 'SteamaCo service credentials were saved to %s with mode 600.\n' "${env_file}"
