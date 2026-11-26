#!/usr/bin/env bash
# Installed as /usr/local/bin/geogrind-deploy: the forced command of the deploy SSH key and the
# rollback tool (design 013). Accepts exactly one of
#   deploy <40-hex-sha>   stdin = release tarball; unpack, check env, switch, health check, prune
#   rollback              switch back to `previous`, health check
# and refuses anything else. Prints progress lines only, never a configuration value.
set -euo pipefail

# Overridable only for deploy/host/dry-run.sh; neither sshd nor sudo passes these variables on.
ROOT="${GEOGRIND_ROOT:-/srv/geogrind}"
HEALTH_URL="${GEOGRIND_HEALTH_URL:-http://127.0.0.1:3000/cs}"

ENV_CHECK=/usr/local/bin/geogrind-env-check
SERVICE_USER=geogrind
HEALTH_TIMEOUT_SECONDS=60
KEEP_RELEASES=3
RELEASES="$ROOT/releases"

log() {
  echo "[deploy] $*"
  if command -v logger >/dev/null; then
    logger -t geogrind-deploy -- "$*" || true
  fi
}

die() {
  log "error: $*" >&2
  exit 1
}

# The deploy user goes through sudo (see deploy/host/sudoers); the owner runs it as root.
as_root() {
  if ((EUID == 0)); then "$@"; else sudo -n "$@"; fi
}

service() {
  as_root /usr/bin/systemctl "$1" geogrind
}

check_env() {
  if ((EUID == 0)); then
    "$ENV_CHECK"
  else
    sudo -n -u "$SERVICE_USER" "$ENV_CHECK"
  fi
}

# Link targets are relative ("releases/<sha>"), so the tree can be moved as a whole.
target_of() {
  readlink "$ROOT/$1" 2>/dev/null || true
}

# Replaces a link in one rename, so it never points nowhere.
point() {
  local name="$1" target="$2"
  ln -sfn "$target" "$ROOT/.$name.new"
  mv -Tf "$ROOT/.$name.new" "$ROOT/$name"
}

healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  while ((SECONDS < deadline)); do
    if curl -fs -o /dev/null --max-time 5 "$HEALTH_URL"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Stop first, so two processes never share the state file (design 013, D-5). Callers test the
# result, which switches off `set -e` in here, hence the explicit check of the stop.
activate() {
  local target="$1"
  service stop || die "could not stop the service; nothing was switched"
  point current "$target"
  service start || true
  healthy
}

prune() {
  local keep_current keep_previous count=0 name
  keep_current="$(target_of current)"
  keep_previous="$(target_of previous)"
  while IFS= read -r name; do
    count=$((count + 1))
    if ((count <= KEEP_RELEASES)); then continue; fi
    if [[ "releases/$name" == "$keep_current" || "releases/$name" == "$keep_previous" ]]; then
      continue
    fi
    rm -rf "${RELEASES:?}/$name"
    log "pruned release $name"
  done < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended \
    -regex '.*/[0-9a-f]{40}' -printf '%T@ %f\n' | sort -rn | cut -d' ' -f2)
}

# Global, because the exit trap runs after deploy() has returned.
INCOMING=""
remove_incoming() {
  if [[ -n "$INCOMING" ]]; then rm -rf "$INCOMING"; fi
}

deploy() {
  local sha="$1" incoming="$RELEASES/.incoming-$1" old_current
  old_current="$(target_of current)"

  # The running files cannot be replaced, and a mere restart must not look like a deployment.
  if [[ "$old_current" == "releases/$sha" ]]; then
    die "refused: release $sha is already running; nothing was changed (to restart it: sudo systemctl restart geogrind)"
  fi

  mkdir -p "$RELEASES"
  rm -rf "$incoming"
  mkdir "$incoming"
  INCOMING="$incoming"
  trap remove_incoming EXIT
  tar -xzf - -C "$incoming" --no-same-owner || die "could not unpack the release"
  [[ -f "$incoming/server.js" ]] || die "the release has no server.js"
  check_env || die "environment check failed; release $sha was not switched on"

  rm -rf "${RELEASES:?}/$sha"
  mv "$incoming" "$RELEASES/$sha"
  touch "$RELEASES/$sha"

  log "switching to release $sha"
  if activate "releases/$sha"; then
    if [[ -n "$old_current" ]]; then
      point previous "$old_current"
    fi
    prune
    log "release $sha is live"
    return
  fi

  [[ -n "$old_current" ]] || die "release $sha is not healthy and there is no release to fall back to"
  log "release $sha is not healthy; falling back to ${old_current#releases/}"
  if activate "$old_current"; then
    # A broken release is of no use for a later rollback and would only count against the kept ones.
    rm -rf "${RELEASES:?}/$sha"
    die "release $sha was not healthy and was removed; ${old_current#releases/} runs again"
  fi
  die "release $sha was not healthy and the fallback ${old_current#releases/} is not healthy either"
}

rollback() {
  local current previous
  current="$(target_of current)"
  previous="$(target_of previous)"
  [[ -n "$previous" && -d "$ROOT/$previous" ]] || die "there is no previous release"

  log "rolling back from ${current#releases/} to ${previous#releases/}"
  if activate "$previous"; then
    # Swapped, so a second rollback returns to the release that ran before.
    if [[ -n "$current" ]]; then
      point previous "$current"
    fi
    log "release ${previous#releases/} is live"
    return
  fi

  # The links are as before the rollback again (activate switched only `current`).
  [[ -n "$current" ]] || die "release ${previous#releases/} is not healthy and there is no release to fall back to"
  log "release ${previous#releases/} is not healthy; falling back to ${current#releases/}"
  if activate "$current"; then
    die "release ${previous#releases/} was not healthy; ${current#releases/} runs again"
  fi
  die "release ${previous#releases/} was not healthy and the fallback ${current#releases/} is not healthy either"
}

lock() {
  exec 9>"$ROOT/.lock"
  flock -n 9 || die "another deploy or rollback is running"
}

main() {
  # sshd passes the client's command in SSH_ORIGINAL_COMMAND; geogrind-rollback passes arguments.
  local -a words
  read -r -a words <<<"${*:-${SSH_ORIGINAL_COMMAND:-}}"

  case "${words[0]:-}" in
  deploy)
    [[ ${#words[@]} -eq 2 && "${words[1]}" =~ ^[0-9a-f]{40}$ ]] || die "usage: deploy <40-hex-sha>"
    lock
    deploy "${words[1]}"
    ;;
  rollback)
    [[ ${#words[@]} -eq 1 ]] || die "usage: rollback"
    lock
    rollback
    ;;
  *)
    die "refused: only 'deploy <sha>' and 'rollback' are allowed"
    ;;
  esac
}

main "$@"
