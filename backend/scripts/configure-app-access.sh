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

read -r -p "MSM staff username: " msm_staff_username
read -r -s -p "MSM staff password (minimum 16 characters): " msm_staff_password
printf '\n'
read -r -s -p "Confirm MSM staff password: " msm_staff_password_confirmation
printf '\n'

if [[ ! "${msm_staff_username}" =~ ^[A-Za-z0-9._@-]+$ ]]; then
  unset msm_staff_username msm_staff_password msm_staff_password_confirmation
  printf 'Use only letters, numbers, dot, underscore, @ or hyphen in the username. No changes were saved.\n' >&2
  exit 1
fi

if (( ${#msm_staff_password} < 16 )); then
  unset msm_staff_username msm_staff_password msm_staff_password_confirmation
  printf 'The password must contain at least 16 characters. No changes were saved.\n' >&2
  exit 1
fi

if [[ ! "${msm_staff_password}" =~ ^[A-Za-z0-9@%_+=:,\.\!\-]+$ ]]; then
  unset msm_staff_username msm_staff_password msm_staff_password_confirmation
  printf 'Use letters, numbers, or these symbols in the password: @ %% _ + = : , . ! -\nNo changes were saved.\n' >&2
  exit 1
fi

if [[ "${msm_staff_password}" != "${msm_staff_password_confirmation}" ]]; then
  unset msm_staff_username msm_staff_password msm_staff_password_confirmation
  printf 'The passwords did not match. No changes were saved.\n' >&2
  exit 1
fi

msm_jwt_secret="$(openssl rand -hex 32)"
msm_callback_secret="$(openssl rand -hex 32)"
temporary_file="$(mktemp "${env_file}.tmp.XXXXXX")"

cleanup() {
  rm -f -- "${temporary_file}"
}
trap cleanup EXIT

app_user_written=false
app_password_written=false
jwt_secret_written=false
callback_secret_written=false

while IFS= read -r line || [[ -n "${line}" ]]; do
  case "${line}" in
    APP_USER=*)
      printf 'APP_USER=%s\n' "${msm_staff_username}" >> "${temporary_file}"
      app_user_written=true
      ;;
    APP_PASSWORD=*)
      printf 'APP_PASSWORD=%s\n' "${msm_staff_password}" >> "${temporary_file}"
      app_password_written=true
      ;;
    JWT_SECRET=*)
      printf 'JWT_SECRET=%s\n' "${msm_jwt_secret}" >> "${temporary_file}"
      jwt_secret_written=true
      ;;
    CALLBACK_SECRET=*)
      printf 'CALLBACK_SECRET=%s\n' "${msm_callback_secret}" >> "${temporary_file}"
      callback_secret_written=true
      ;;
    *)
      printf '%s\n' "${line}" >> "${temporary_file}"
      ;;
  esac
done < "${env_file}"

if [[ "${app_user_written}" != true ]]; then
  printf 'APP_USER=%s\n' "${msm_staff_username}" >> "${temporary_file}"
fi
if [[ "${app_password_written}" != true ]]; then
  printf 'APP_PASSWORD=%s\n' "${msm_staff_password}" >> "${temporary_file}"
fi
if [[ "${jwt_secret_written}" != true ]]; then
  printf 'JWT_SECRET=%s\n' "${msm_jwt_secret}" >> "${temporary_file}"
fi
if [[ "${callback_secret_written}" != true ]]; then
  printf 'CALLBACK_SECRET=%s\n' "${msm_callback_secret}" >> "${temporary_file}"
fi

chmod 600 "${temporary_file}"
mv -- "${temporary_file}" "${env_file}"
trap - EXIT

unset \
  msm_staff_username \
  msm_staff_password \
  msm_staff_password_confirmation \
  msm_jwt_secret \
  msm_callback_secret

printf 'MSM staff access and application secrets were saved to %s with mode 600.\n' "${env_file}"
printf 'Restart the backend before using the new staff login.\n'
