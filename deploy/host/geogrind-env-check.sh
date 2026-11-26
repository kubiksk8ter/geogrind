#!/usr/bin/env bash
# Installed as /usr/local/bin/geogrind-env-check. Checks that the production environment file
# sets every required variable to a non-empty value. Prints the names of missing variables only,
# never a value; exits 1 when one is missing (spec 013, AC-6).
set -euo pipefail

# Overridable only for deploy/host/dry-run.sh; sudo does not pass this variable on.
ENV_FILE="${GEOGRIND_ENV_FILE:-/etc/geogrind/geogrind.env}"
REQUIRED=(GROQ_API_KEY GEOCODER_CONTACT CLIENT_IP_HEADER APP_ORIGIN STATE_DIR)

trim() {
  local text="$1"
  text="${text#"${text%%[![:space:]]*}"}"
  printf '%s' "${text%"${text##*[![:space:]]}"}"
}

# Same reading as systemd's EnvironmentFile for plain NAME=value lines: comments and blank lines
# are skipped, surrounding quotes do not count, a later line wins.
unquote() {
  local value="$1"
  if [[ $value =~ ^\"(.*)\"$ || $value =~ ^\'(.*)\'$ ]]; then
    value="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$value"
}

if [[ ! -r $ENV_FILE ]]; then
  echo "[env-check] cannot read the environment file $ENV_FILE" >&2
  exit 1
fi

declare -A filled=()
while IFS= read -r line || [[ -n $line ]]; do
  line="$(trim "$line")"
  [[ -z $line || $line == \#* || $line == \;* || $line != *=* ]] && continue
  name="$(trim "${line%%=*}")"
  value="$(trim "$(unquote "$(trim "${line#*=}")")")"
  if [[ -n $value ]]; then
    filled[$name]=1
  else
    unset "filled[$name]"
  fi
done <"$ENV_FILE"

missing=()
for name in "${REQUIRED[@]}"; do
  [[ -n ${filled[$name]:-} ]] || missing+=("$name")
done

if ((${#missing[@]} > 0)); then
  echo "[env-check] missing or empty: ${missing[*]}" >&2
  exit 1
fi
echo "[env-check] all required variables are set"
