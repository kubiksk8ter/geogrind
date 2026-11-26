#!/usr/bin/env bash
# Installed as /usr/local/bin/geogrind-rollback; the owner runs `sudo geogrind-rollback`.
# Switches back to the previous release and health-checks it; the state is never touched.
set -euo pipefail

exec /usr/local/bin/geogrind-deploy rollback
