#!/bin/bash
set -e
cd /server/data

STEAMCMD="${STEAMCMD_PATH:-/home/steam/steamcmd/steamcmd.sh}"
[ -x "$STEAMCMD" ] || STEAMCMD="/usr/games/steamcmd"
run_steamcmd() {
  mkdir -p /server/data /steamcmd_cache
  chown -R steam:steam /server/data /steamcmd_cache 2>/dev/null || true
  # First anonymous login of a fresh steamcmd session intermittently fails app_update with
  # "Missing configuration" until a session/config cache is warmed up; a throwaway login+quit fixes it.
  su -s /bin/bash steam -c "$STEAMCMD +login anonymous +quit" >/dev/null 2>&1 || true
  su -s /bin/bash steam -c "$STEAMCMD $*"
  chown -R "${HOST_UID:-1000}:${HOST_GID:-1000}" /server/data /server/mods 2>/dev/null || true
}


if [ "$1" = "--install-only" ]; then
  run_steamcmd +force_install_dir /server/data +login anonymous +app_update "${STEAMCMD_APPID:-258550}" validate +quit
  exit 0
fi

if [ "${AUTO_UPDATE:-0}" = "1" ]; then
  run_steamcmd +force_install_dir /server/data +login anonymous +app_update "${STEAMCMD_APPID:-258550}" validate +quit
fi

exec ./RustDedicated \
  -batchmode \
  +server.hostname "$HOSTNAME" \
  +server.port 28015 \
  +server.queryport 28017 \
  +server.maxplayers "$MAXPLAYERS" \
  +server.worldsize "$WORLDSIZE" \
  +server.seed "$SEED" \
  +server.level "$LEVEL" \
  +rcon.port 28016 \
  +rcon.password "$RCON_PASSWORD" \
  +rcon.web 1
