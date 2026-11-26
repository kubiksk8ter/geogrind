# GeoGrind – production runbook

One Wedos VPS (Ubuntu Server 24.04, 1 vCPU, 1 GB RAM, 10 GB SSD) runs the app as the systemd
service `geogrind` (Node 26, `127.0.0.1:3000`) behind Caddy (HTTPS for `geogrind.cz` with HSTS,
`www` redirect, sets `X-Real-IP`, no access log). Releases are standalone Next builds made by
GitHub Actions and streamed over SSH to a `deploy` user that can only run the deploy command. Why
it is built this way: [design 013](../docs/design/013-production-deployment-and-hosting.md).

All commands below use paths relative to the repository root.

```
/srv/geogrind/releases/<sha>   up to 3 unpacked releases (owner deploy)
/srv/geogrind/current          link to the running release; previous = the one before
/var/lib/geogrind              STATE_DIR (0700, service user geogrind), never inside a release
/etc/geogrind/geogrind.env     environment file (0640 root:geogrind), the only place of the Groq key
```

- [`package-release.sh`](package-release.sh): builds `release.tgz` (standalone server, static
  files, `release.json`).
- [`verify.sh`](verify.sh): checks the public address after a deploy.
- [`host/`](host/): systemd unit, Caddyfile, journald, sudoers and env templates; deploy,
  rollback and env-check scripts; `dry-run.sh`.

## Prerequisites (owner)

- The VPS and the domain `geogrind.cz`, both at Wedos. Note the expiry of both and set a
  reminder (and automatic renewal, if Wedos offers it); an expired domain takes the app offline.
  A higher renewal price needs a new decision.
- DNS records in the Wedos panel, set **before the first deploy** (otherwise Caddy cannot get the
  certificate): `A geogrind.cz -> <VPS IPv4>`, `AAAA geogrind.cz -> <VPS IPv6>` if the VPS has one,
  and `CNAME www.geogrind.cz -> geogrind.cz.` (the Caddyfile redirects `www` to the apex). Apply
  the changes in the panel. Check from outside with `nslookup geogrind.cz` and
  `nslookup www.geogrind.cz`.

## Host setup (once)

Run as root on the VPS, from a checkout of this repository (`git clone <repository URL> ~/geogrind`
and `cd ~/geogrind`).

1. Updates, swap and software:

   ```bash
   apt update && apt full-upgrade -y
   fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   curl -fsSL https://deb.nodesource.com/setup_26.x -o /tmp/nodesource_setup.sh
   bash /tmp/nodesource_setup.sh && apt install -y nodejs
   apt install -y debian-keyring debian-archive-keyring apt-transport-https curl ufw unattended-upgrades
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
   chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
   apt update && apt install -y caddy
   dpkg-reconfigure -plow unattended-upgrades   # answer "Yes"
   ```

2. Users, folders and the environment file:

   ```bash
   useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin geogrind
   useradd --create-home --shell /bin/bash deploy
   install -d -o deploy -g deploy -m 0755 /srv/geogrind /srv/geogrind/releases
   install -d -o root -g geogrind -m 0750 /etc/geogrind
   install -o root -g geogrind -m 0640 deploy/host/geogrind.env.example /etc/geogrind/geogrind.env
   nano /etc/geogrind/geogrind.env   # real Groq key and operator e-mail
   ```

3. Templates and scripts from [`host/`](host/):

   ```bash
   install -m 0755 deploy/host/geogrind-deploy.sh /usr/local/bin/geogrind-deploy
   install -m 0755 deploy/host/geogrind-rollback.sh /usr/local/bin/geogrind-rollback
   install -m 0755 deploy/host/geogrind-env-check.sh /usr/local/bin/geogrind-env-check
   install -m 0644 deploy/host/geogrind.service /etc/systemd/system/geogrind.service
   install -m 0644 deploy/host/Caddyfile /etc/caddy/Caddyfile
   install -D -m 0644 deploy/host/journald.conf /etc/systemd/journald.conf.d/geogrind.conf
   visudo -cf deploy/host/sudoers && install -m 0440 deploy/host/sudoers /etc/sudoers.d/geogrind-deploy
   systemctl daemon-reload && systemctl enable geogrind
   systemctl restart systemd-journald && systemctl reload caddy
   ```

   Before installing, `bash deploy/host/dry-run.sh release.tgz` (as a normal user, with a
   `release.tgz` from `deploy/package-release.sh`) tries the deploy, fall-back, rollback and
   pruning logic with fake `sudo` and `systemctl`.

4. Firewall and SSH. Create your own sudo user with your SSH key first and check that you can log
   in with it; then switch off password and root login:

   ```bash
   ufw limit 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable   # IPv6 is on (IPV6=yes)
   printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' \
     > /etc/ssh/sshd_config.d/10-geogrind.conf
   sshd -t && systemctl restart ssh
   ```

5. Deploy key. On your own computer run
   `ssh-keygen -t ed25519 -f geogrind-deploy -C geogrind-github-deploy -N ""`. On the host create
   `/home/deploy/.ssh` (`install -d -o deploy -g deploy -m 0700 /home/deploy/.ssh`) and put the
   public half into `/home/deploy/.ssh/authorized_keys` (0600, owner `deploy`) as one line, as in
   [`host/authorized_keys.example`](host/authorized_keys.example). Get the host key with
   `ssh-keyscan -t ed25519 geogrind.cz` and compare its fingerprint with
   `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the host.
   `ssh -i geogrind-deploy deploy@geogrind.cz rollback` must answer "there is no previous
   release": the key works and can only run the deploy command.

6. GitHub: Settings → Environments → `production`, deployment branches limited to `main` (add a
   required reviewer if every release should wait for your approval). Secrets: `DEPLOY_SSH_KEY`
   (private half of the deploy key), `DEPLOY_KNOWN_HOST` (the `ssh-keyscan` line). Variables:
   `DEPLOY_HOST=geogrind.cz`, `PUBLIC_ORIGIN=https://geogrind.cz`. Protect `main` with the `checks`
   and `smoke` status checks. Delete the private key file from your computer afterwards.

## Release

Merge `develop` into `main` through a pull request. When CI passes for the push to `main`, the
**Deploy** workflow ([`deploy.yml`](../.github/workflows/deploy.yml)) builds `release.tgz`
(`deploy/package-release.sh <commit>`), streams it to the host and runs the verification. On the
host `geogrind-deploy` unpacks it, runs `geogrind-env-check` (names missing variables, never
values; the old release keeps running), stops the service, switches `current`, starts it and
polls `/cs` for 60 s. An unhealthy release is removed and the old one started again; the deploy
then fails. Three releases are kept.

GitHub runs the workflow only from the copy on `main`, so it starts working with the first
release. **Run workflow** on `main` redeploys `main` (for example after a rollback). This manual
run is a deliberate bypass of the CI gate: it neither waits for nor checks CI, so use it only for
a commit whose CI passed. A deploy of the commit that is already running is refused and changes
nothing; to restart it, run `sudo systemctl restart geogrind` on the host. The running release is
shown at [https://geogrind.cz/release.json](https://geogrind.cz/release.json) (`version`,
`commit`, `builtAt`).

## Verify

`bash deploy/verify.sh https://geogrind.cz <commit>` (needs only `curl`, runs at the end of every
deploy) prints one line per check: https and `www` redirects, `/` to `/cs` or `/en`, the commit in
`/release.json`, no state file over the web, same-origin rules of `/api/command` and
`/api/metrics`, one real "Zoom to Prague" (one AI call) and that the proxy replaces `X-Real-IP`
(the next command must wait). Run it again only after a minute.

## Rollback

`sudo geogrind-rollback` on the host (or `ssh -i <deploy key> deploy@geogrind.cz rollback`)
switches back to `previous` and health-checks it; running it again returns to the newer release.
If the previous release is not healthy, the release that ran before is started again and the
rollback fails. The state in `/var/lib/geogrind` is never touched. If the release notes of a
release say so, delete `/var/lib/geogrind/state.json` before the rollback (it holds only
counters).

## Logs, updates and disk

- `systemctl status geogrind`: is it running; `journalctl -u geogrind --since "7 days ago"`: the
  app's `[command]`, `[metrics]` and `[privacy]` lines; `journalctl -t geogrind-deploy`: deploy
  and rollback messages. The journal keeps 14 days, at most 200 MB; no secrets and no visitor IP
  addresses are logged.
- Caddy's own log is discarded (global `log { output discard }` in the
  [Caddyfile](host/Caddyfile)), because its error messages would name client addresses.
  `journalctl -u caddy` therefore shows only start and stop. To debug a certificate problem,
  comment the block out for a while (`sudo systemctl reload caddy`), read `journalctl -u caddy`
  and restore it afterwards.
- Security updates of Ubuntu install themselves (unattended-upgrades). Once a month run
  `sudo apt update && sudo apt upgrade` for Node.js and Caddy (their repositories are not covered),
  then `sudo systemctl restart geogrind caddy`.
- Check `df -h /` and `free -m` now and then; above 70 % disk look at `du -sh /srv/geogrind/releases
  /var/log/journal /var/lib/geogrind`.
