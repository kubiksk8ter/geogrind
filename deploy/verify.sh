#!/usr/bin/env bash
# Checks a deployed GeoGrind from the outside (design 013). Needs curl. Prints one line per check
# and never a configuration value; exits 1 when a check fails. Uses one AI call of the daily cap.
# Usage: deploy/verify.sh <origin> <commit>, e.g. deploy/verify.sh https://geogrind.cz "$(git rev-parse HEAD)"
set -uo pipefail

origin="${1:-}"
commit="${2:-}"
if [[ ! $origin =~ ^https?://[^/]+$ || ! $commit =~ ^[0-9a-f]{40}$ ]]; then
  echo "usage: deploy/verify.sh <origin, e.g. https://geogrind.cz> <40-hex-commit>" >&2
  exit 2
fi
host="${origin#*://}"

# Documentation addresses (RFC 5737); behind the proxy both are replaced by the real address.
FIRST_CLIENT=203.0.113.1
SECOND_CLIENT=203.0.113.2
FOREIGN_ORIGIN=https://verify.invalid
COMMAND='{"text":"Zoom to Prague","locale":"en"}'

failures=0
pass() { echo "ok   $*"; }
fail() {
  echo "FAIL $*"
  failures=$((failures + 1))
}
skip() { echo "skip $*"; }

fetch() { curl -s --max-time 30 "$@"; }
status_of() { fetch -o /dev/null -w '%{http_code}' "$@"; }
redirect_of() { fetch -o /dev/null -w '%{redirect_url}' "$@"; }
final_url_of() { fetch -L -o /dev/null -w '%{url_effective}' "$@"; }

expect_status() {
  local expected="$1" description="$2" actual
  shift 2
  actual="$(status_of "$@")"
  if [[ $actual == "$expected" ]]; then
    pass "$description ($actual)"
  else
    fail "$description: expected $expected, got $actual"
  fi
}

# Sends a command; prints "<status> <result>" where result is "ok" or the error code.
command_result() {
  local client="$1" origin_header="$2" body="$3" response status code
  response="$(fetch -w '\n%{http_code}' -X POST "$origin/api/command" \
    -H "Origin: $origin_header" -H "X-Real-IP: $client" \
    -H 'Content-Type: application/json' --data "$body")"
  status="${response##*$'\n'}"
  if [[ $response =~ \"ok\":true ]]; then
    code=ok
  elif [[ $response =~ \"code\":\"([a-z_]+)\" ]]; then
    code="${BASH_REMATCH[1]}"
  else
    code=none
  fi
  echo "$status $code"
}

check_https_redirect() {
  if [[ $origin != https://* ]]; then
    skip "http -> https redirect (the origin is not https)"
    return
  fi
  local location
  location="$(redirect_of "http://$host/")"
  if [[ $location == "$origin/"* ]]; then
    pass "AC-2: http://$host redirects to https"
  else
    fail "AC-2: http://$host should redirect to $origin/, got '${location:-no redirect}'"
  fi
}

check_www_redirect() {
  if [[ $origin != https://* || $host == www.* ]]; then
    skip "www redirect (not an https apex origin)"
    return
  fi
  fetch -o /dev/null "https://www.$host/"
  if (($? == 6)); then
    skip "www.$host does not resolve"
    return
  fi
  local scheme final
  for scheme in http https; do
    final="$(final_url_of "$scheme://www.$host/")"
    if [[ $final == "$origin/"* ]]; then
      pass "AC-2: $scheme://www.$host ends at $origin"
    else
      fail "AC-2: $scheme://www.$host should end at $origin, got '${final:-no answer}'"
    fi
  done
}

check_locale_redirect() {
  local location
  location="$(redirect_of "$origin/")"
  if [[ $location == "$origin/cs" || $location == "$origin/en" ]]; then
    pass "AC-3: / redirects to ${location#"$origin"}"
  else
    fail "AC-3: / should redirect to /cs or /en, got '${location:-no redirect}'"
  fi
  expect_status 200 "AC-3: /cs answers" "$origin/cs"
  expect_status 200 "AC-3: /en answers" "$origin/en"
}

check_release() {
  local body
  body="$(fetch "$origin/release.json")"
  if [[ $body =~ \"commit\":[[:space:]]*\"([0-9a-f]{40})\" ]]; then
    if [[ ${BASH_REMATCH[1]} == "$commit" ]]; then
      pass "AC-15: /release.json reports commit $commit"
    else
      fail "AC-15: /release.json reports commit ${BASH_REMATCH[1]}, expected $commit"
    fi
  else
    fail "AC-15: /release.json is missing or has no commit"
  fi
}

check_hidden_paths() {
  local path
  for path in /state.json /.data/state.json /api/verify-unknown; do
    expect_status 404 "AC-12: $path is not served" "$origin$path"
  done
}

check_origin_rules() {
  expect_status 200 "AC-10: /api/metrics answers its own pages" \
    -H 'Sec-Fetch-Site: same-origin' "$origin/api/metrics"
  expect_status 403 "AC-10: /api/metrics rejects a foreign origin" \
    -H 'Sec-Fetch-Site: same-origin' -H "Origin: $FOREIGN_ORIGIN" "$origin/api/metrics"

  local result
  result="$(command_result "$FIRST_CLIENT" "$FOREIGN_ORIGIN" '{}')"
  if [[ $result == 403* ]]; then
    pass "AC-10: /api/command rejects a foreign origin"
  else
    fail "AC-10: /api/command should reject a foreign origin with 403, got $result"
  fi
  # An empty body passes the origin check and is refused afterwards, so no AI call is made.
  result="$(command_result "$FIRST_CLIENT" "$origin" '{}')"
  if [[ $result == "400 invalid_request" ]]; then
    pass "AC-10: /api/command accepts its own origin"
  else
    fail "AC-10: /api/command should accept its own origin (400 invalid_request), got $result"
  fi
}

check_real_command() {
  local result
  result="$(command_result "$FIRST_CLIENT" "$origin" "$COMMAND")"
  if [[ $result == "200 ok" ]]; then
    pass "AC-14: 'Zoom to Prague' reached the AI and the geocoder and found a place"
  else
    fail "AC-14: 'Zoom to Prague' should find a place (200 ok), got $result"
  fi
  # Only a processed command starts the pause the next check relies on.
  if [[ $result == 429* || $result == 503* ]]; then
    fail "AC-8: not checked, the first command was not processed; run the script again in a minute"
    return
  fi

  # Behind the proxy both commands come from this machine, so the second one must wait.
  result="$(command_result "$SECOND_CLIENT" "$origin" "$COMMAND")"
  if [[ $result == "429 wait" ]]; then
    pass "AC-8: the proxy replaces X-Real-IP (the second command has to wait)"
  else
    fail "AC-8: the second command should be told to wait (429 wait), got $result; is X-Real-IP overwritten by the proxy?"
  fi
}

echo "verifying $origin, expecting commit $commit"
check_https_redirect
check_www_redirect
check_locale_redirect
check_release
check_hidden_paths
check_origin_rules
check_real_command

if ((failures > 0)); then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
