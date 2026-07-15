# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Host

- Forge host: `emanuele@192.168.1.251`, SSH key auth (no password). All build/deploy work happens on forge via SSH — this is not a local dev environment.
- Install root on forge: `/home/emanuele/forgepanel/` (`backend/`, `frontend/`, `servers/`, `backups/`, `steamcmd_cache/`)
- `emanuele` has passwordless sudo (`/etc/sudoers.d/emanuele-forgepanel`) — required for `apt-get`, `systemctl`, and reading Pterodactyl's root-owned volumes.

## Ports

- Panel (Express + static frontend + socket.io): **3001**
- SFTP: **2223** — NOT 2022. Pterodactyl's `wings` daemon already owns 2022 on this host; ForgePanel's SFTP was moved to 2223 during initial setup to avoid the conflict. If deploying on a host without Pterodactyl, 2022 would be fine, but the default in this repo's `.env.example`/`install.sh` prompt should stay 2223-first-choice since that's what's actually running.
- Per-server game ports: assigned dynamically per server (`servers.port` / `servers.query_port`), checked against `dockerService.portInUse()` before every container start.

## Coexistence with Pterodactyl — critical

This host already runs a Pterodactyl panel (`pterodactyl-panel-1`, `pterodactyl-database-1`, `pterodactyl-cache-1` containers) plus a live Satisfactory server under Pterodactyl (container UUID `4590be33-6577-4abf-96d3-ce0ccf7c5966`, volume `/var/lib/pterodactyl/volumes/4590be33-.../`). ForgePanel must never:
- touch a Docker container without the `forgepanel=true` label
- touch `pterodactyl_default` / `pterodactyl_nw` networks
- write to `/var/lib/pterodactyl/` without explicit user confirmation

ForgePanel's own containers are always named `fp-<server-uuid>`, labeled `forgepanel=true` / `forgepanel.server_id=<uuid>` / `forgepanel.game=<game_id>`, and attached to the `forgepanel-net` bridge network (auto-created on backend startup via `dockerService.ensureNetwork()`).

## Key paths / binaries on forge

- steamcmd: `/usr/games/steamcmd` (Debian package `steamcmd:i386` — requires `contrib non-free` apt components enabled, not present by default on a stock Debian `bookworm` install; `install.sh` adds them)
- SQLite DB: `backend/forgepanel.db` (WAL mode)
- playit systemd unit: `playit.service` (installed via `deb [signed-by=...] https://playit-cloud.github.io/ppa/data`)

## Architecture decisions worth knowing

- **Config rendering happens in Node, not in-container shell scripts.** Despite the original spec text suggesting entrypoint.sh writes config from env vars, actual config file rendering (ini/properties/json/xml/yaml/cfg) is done panel-side by `backend/services/configService.js` writing directly onto the server's data volume before/between container starts. `entrypoint.sh` scripts are intentionally thin: steamcmd install-if-missing (`--install-only` arg contract) + launch the binary. This avoids reimplementing format parsers in bash 30 times.
- **Container-internal ports are always the template's fixed numbers.** Docker's `HostConfig.PortBindings` handles host↔container port remapping; `server.port` in the DB is the *host* port only. Never pass `server.port` into an entrypoint's launch command — the process inside the container binds its own fixed port from `template.ports[]`.
- **`template.ports` is `[{ port, protocol, primary? }]`, not a flat array.** Only the `primary` entry gets remapped to `server.port`; an entry matching `template.queryPort` gets remapped to `server.query_port`; everything else binds 1:1 (a real limitation — two instances of a multi-port game can't coexist without a host port conflict on those extra ports; the DB schema only tracks `port`/`query_port`, not an arbitrary port list).
- **playit has no local tunnel-creation API.** The CLI (`playit claim generate` → `claim url` → `claim exchange`) only handles claiming the agent; per-server tunnel-to-port mappings are configured on the playit.gg web dashboard afterward. `playitService.js` polls `playit status` output to detect the resulting public address rather than creating tunnels programmatically.
- **SFTP auth reuses panel credentials** via `username.<serverId-prefix>` login (same pattern as Pterodactyl), rooted at that server's `data/` volume, permission-gated on `file_read`/`file_write`.
- **`steamcmd` must run as the image's `steam` user, not root.** `cm2network/steamcmd:latest`'s steamcmd install is owned by and expects the `steam` user. Templates' `entrypoint.sh` drop to `steam` for the actual steamcmd invocation via `su -s /bin/bash steam -c "..."` (the container itself still starts as root by default — needed so `su` can switch users at all).
- **steamcmd anonymous login needs a "warm-up" call.** The *first* `app_update` in a fresh steamcmd session intermittently fails with `ERROR! Failed to install app 'X' (Missing configuration)` even after a fully successful anonymous login — this is unrelated to permissions or the target path. Fix: run a throwaway `+login anonymous +quit` immediately before the real `+app_update` command (see `run_steamcmd()` in every steamcmd-based `entrypoint.sh`). Don't mistake this error for a permissions problem — it happens as both root and the `steam` user.
- **Never set `Cmd` to `[<entrypoint-path>, ...args]` when the image already has that same path as its Dockerfile `ENTRYPOINT`.** Docker appends `Cmd` to `ENTRYPOINT` rather than replacing it, so `Cmd: ['/entrypoint.sh', '--install-only']` against an image with `ENTRYPOINT ["/entrypoint.sh"]` actually runs `/entrypoint.sh /entrypoint.sh --install-only` — `$1` inside the script becomes `/entrypoint.sh`, not `--install-only`, silently falling through to the launch branch and failing (exit 127, "no such file" for a binary that hasn't been installed yet). `installService.js`'s install container correctly uses `Cmd: ['--install-only']` alone — don't reintroduce the entrypoint path into `Cmd`.
- **Docker's raw events stream uses `Action` (and `Actor.ID` for the container ID), not the legacy `status`/`id` fields**, on this Docker version (29.x). `stateWatcher.js`'s `watchDockerEvents` checks `event.Action || event.status` and `event.Actor?.ID || event.id` for this reason — if state transitions (`starting → running`, crash detection) silently stop working after a Docker upgrade, check this first.
- **Bind-mounted server data must be owned by the host UID running the panel, not root.** The runtime game container runs with `User: '<uid>:<gid>'` (matching `process.getuid()`/`getgid()` of the Node backend) in `dockerService.createServerContainer`, so gameplay-created files are host-manageable. The *install* container still runs as root (steamcmd needs `su` to `steam`), so every steamcmd-based `entrypoint.sh` chowns `/server/data` back to `${HOST_UID:-1000}:${HOST_GID:-1000}` after a successful install (env vars set by `installService.js`) — otherwise the panel's own File Manager/config renderer gets `EACCES` trying to touch root-owned files. **Known gap:** because the runtime container now runs as a non-root UID, `AUTO_UPDATE=1` (which calls `run_steamcmd`, which calls `su`) will fail at container start since `su` needs root — auto-update on boot doesn't currently work; only the one-time install-time update path is exercised end-to-end.

- **`configService.js` must `mkdir -p` the config file's parent directory before writing.** Nested config paths (e.g. Zomboid's `.cache/Zomboid/Server/servertest.ini`) don't exist until the game has actually run once — `renderConfig()` is called during install, before first launch, so it creates the parent directory itself rather than assuming it exists.
- **Steam Web API: `IPublishedFileService/QueryFiles/v1` requires GET, not POST** (confirmed via live "Method Not Allowed" response) — `steamApi.js`'s `searchWorkshop` uses `getRequest()`. `GetPublishedFileDetails`/`GetCollectionDetails` are the opposite (POST-only per Valve's docs) and use `postForm()`. Don't unify these without re-verifying both against a real API key.
- **Sessions don't survive a panel restart** (`express-session` uses the default in-memory `MemoryStore`, matching the spec's stated tech stack — no Redis/DB session store specified). Acceptable for a single always-on systemd service; just means every `update.sh` run / service restart logs everyone out.

## Operational note

The forge instance was installed for real (not a throwaway test dir) during initial development to validate `install.sh` end-to-end. The admin account it created (`username: admin`) still has the password set at that time — change it via the panel's user settings, or delete `backend/forgepanel.db` and re-run `install.sh` for a fresh admin credential before real use.

## Tiers (free vs Pro)

Gated via `settings.license_tier` (`resourceService.getTier()`). Pro-only behavior: resource history retention (24h free / 30d pro), mod update checker (`modUpdateChecker.js` no-ops entirely on free), S3-compatible backup storage. No payment processing is implemented — `license_tier` is just a settings flag flipped by entering a key in Settings → License (key validation itself is not implemented in v0.1).

## Game templates

`backend/templates/<id>/{template.json,Dockerfile,entrypoint.sh}`, loaded by `backend/templates/registry.js` (scans the directory tree at first `getTemplate()`/`listTemplates()` call, cached — call `reload()` after adding a template without restarting). 30 templates as of v0.1; several (space_engineers, sons_of_forest, enshrouded) run via `xvfb-run wine64` since they have no native Linux server binary — these are marked `wineRequired: true` and are experimental. See each template's `installNotes` for per-game caveats (GSLT requirements, CurseForge/Thunderstore mods not yet wired up, etc.) — several field-to-config-key mappings (Rust `server.cfg`, DayZ `serverDZ.cfg`, 7 Days to Die `serverconfig.xml`) use the generic per-format renderer rather than each game's exact native schema and may need tuning after live testing against real server binaries.
