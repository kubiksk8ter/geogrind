#!/usr/bin/env bash
# Dry run of geogrind-deploy and geogrind-env-check on any Linux machine (or the VPS before its
# set-up) without root, systemd or sudo: a temporary root, and fake `sudo` and `systemctl` that
# run the release with node in the background on port 3900.
# Usage: deploy/host/dry-run.sh release.tgz   (from deploy/package-release.sh; needs node, curl, flock)
set -euo pipefail

if ((EUID == 0)); then
  echo "run the dry run as a normal user; as root the scripts would call the real systemctl" >&2
  exit 2
fi

tarball="$(realpath "${1:?usage: deploy/host/dry-run.sh <release.tgz>}")"
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
port=3900

export GEOGRIND_ROOT="$work/srv"
export GEOGRIND_ENV_FILE="$work/geogrind.env"
export GEOGRIND_HEALTH_URL="http://127.0.0.1:$port/cs"
mkdir -p "$GEOGRIND_ROOT" "$work/bin" "$work/state"

cat >"$work/bin/systemctl" <<EOF
#!/usr/bin/env bash
# Fake systemctl: "start|stop geogrind" runs or ends the current release in the background.
set -euo pipefail
pidfile="$work/service.pid"
case "\$1" in
stop)
  if [[ -f \$pidfile ]]; then
    kill "\$(cat "\$pidfile")" 2>/dev/null || true
    while kill -0 "\$(cat "\$pidfile")" 2>/dev/null; do sleep 0.2; done
    rm -f "\$pidfile"
  fi
  ;;
start)
  (
    cd "$GEOGRIND_ROOT/current"
    set -a
    # shellcheck disable=SC1091
    . "$GEOGRIND_ENV_FILE"
    set +a
    NODE_ENV=production HOSTNAME=127.0.0.1 PORT=$port exec node server.js
  ) </dev/null >>"$work/service.log" 2>&1 9>&- &
  echo \$! >"\$pidfile"
  ;;
esac
EOF

cat >"$work/bin/sudo" <<EOF
#!/usr/bin/env bash
# Fake sudo: allows exactly what deploy/host/sudoers allows.
set -euo pipefail
while [[ "\${1:-}" == -* ]]; do
  if [[ \$1 == -u ]]; then shift 2; else shift; fi
done
case "\$*" in
"/usr/bin/systemctl stop geogrind" | "/usr/bin/systemctl start geogrind")
  exec "$work/bin/systemctl" "\$2" ;;
/usr/local/bin/geogrind-env-check)
  exec bash "$here/geogrind-env-check.sh" ;;
*)
  echo "fake sudo: not allowed: \$*" >&2
  exit 1 ;;
esac
EOF

printf '#!/usr/bin/env bash\n' >"$work/bin/logger"
chmod +x "$work/bin/systemctl" "$work/bin/sudo" "$work/bin/logger"
export PATH="$work/bin:$PATH"

cleanup() {
  "$work/bin/systemctl" stop geogrind || true
  rm -rf "$work"
}
trap cleanup EXIT

failures=0
check() {
  local description="$1"
  shift
  if "$@"; then
    echo "ok   $description"
  else
    echo "FAIL $description"
    failures=$((failures + 1))
  fi
}

A=$(printf 'a%.0s' {1..40})
B=$(printf 'b%.0s' {1..40})
C=$(printf 'c%.0s' {1..40})
D=$(printf 'd%.0s' {1..40})
E=$(printf 'e%.0s' {1..40})

quietly() { "$@" >>"$work/deploy.log" 2>&1; }
run_deploy() { quietly bash "$here/geogrind-deploy.sh" deploy "$1" <"${2:-$tarball}"; }
run_rollback() { quietly bash "$here/geogrind-deploy.sh" rollback; }
fails() { ! "$@"; }
exists() { [[ -e "$GEOGRIND_ROOT/$1" ]]; }
link_is() { [[ "$(readlink "$GEOGRIND_ROOT/$1" 2>/dev/null)" == "releases/$2" ]]; }
no_link() { [[ ! -e "$GEOGRIND_ROOT/$1" && ! -L "$GEOGRIND_ROOT/$1" ]]; }
serves() { curl -fs -o /dev/null --max-time 5 "$GEOGRIND_HEALTH_URL"; }
release_count_is() { [[ "$(find "$GEOGRIND_ROOT/releases" -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq "$1" ]]; }

broken="$work/broken.tgz"
mkdir "$work/broken"
echo 'process.exit(1);' >"$work/broken/server.js"
tar -czf "$broken" -C "$work/broken" .

cat >"$GEOGRIND_ENV_FILE" <<EOF
GEOCODER_CONTACT=dry-run-contact@example.invalid
CLIENT_IP_HEADER=x-real-ip
APP_ORIGIN=http://127.0.0.1:$port
STATE_DIR=$work/state
EOF

output="$(bash "$here/geogrind-env-check.sh" 2>&1 || true)"
check "AC-6: the env check names the missing variable" grep -q GROQ_API_KEY <<<"$output"
check "AC-6: the env check prints no value" fails grep -q dry-run-contact <<<"$output"
check "a deploy without GROQ_API_KEY fails" fails run_deploy "$A"
check "and switches nothing on" no_link current

echo 'GROQ_API_KEY="dry-run-key"' >>"$GEOGRIND_ENV_FILE"
check "AC-6: the env check passes with all variables" quietly bash "$here/geogrind-env-check.sh"
check "the first deploy succeeds" run_deploy "$A"
check "and makes it current" link_is current "$A"
check "and the release serves /cs" serves

check "a second deploy succeeds" run_deploy "$B"
check "current is the new release" link_is current "$B"
check "previous is the old one" link_is previous "$A"

check "FR-11: a broken release fails the deploy" fails run_deploy "$C" "$broken"
check "FR-11: the old release is current again" link_is current "$B"
check "FR-11: previous is unchanged" link_is previous "$A"
check "FR-11: the broken release is removed" fails exists "releases/$C"
check "FR-11: the old release serves again" serves

check "AC-18: rollback succeeds" run_rollback
check "AC-18: the previous release is current" link_is current "$A"
check "AC-18: a second rollback can return" link_is previous "$B"
check "AC-18: the rolled-back release serves" serves
check "a second rollback succeeds" run_rollback
check "and returns to the newer release" link_is current "$B"

check "a third deploy succeeds" run_deploy "$D"
check "a fourth deploy succeeds" run_deploy "$E"
check "AC-27: three releases are kept" release_count_is 3
check "AC-27: the newest is current" link_is current "$E"
check "AC-27: the one before is previous" link_is previous "$D"
check "redeploying the running release is refused" fails run_deploy "$E"
check "and changes nothing" link_is current "$E"
check "and says why" grep -q "is already running; nothing was changed" "$work/deploy.log"

echo 'process.exit(1);' >"$GEOGRIND_ROOT/releases/$D/server.js"
check "FR-11: a rollback to a broken release fails" fails run_rollback
check "FR-11: the release before the rollback is current again" link_is current "$E"
check "FR-11: previous is unchanged after the failed rollback" link_is previous "$D"
check "FR-11: the release before the rollback serves again" serves

check "D-4: other commands are refused" \
  fails quietly env SSH_ORIGINAL_COMMAND="cat /etc/passwd" bash "$here/geogrind-deploy.sh"
check "D-4: a malformed commit is refused" fails run_deploy "not-a-commit"

if ((failures > 0)); then
  echo "--- deploy log"
  cat "$work/deploy.log"
  echo "--- service log"
  cat "$work/service.log" 2>/dev/null || true
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
