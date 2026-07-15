#!/bin/bash
set -e
cd /server/data

MC_VERSION="${MC_VERSION:-latest}"

download_paper() {
  local version="$1"
  if [ "$version" = "latest" ]; then
    version=$(curl -fsSL https://api.papermc.io/v2/projects/paper | jq -r '.versions[-1]')
  fi
  local build
  build=$(curl -fsSL "https://api.papermc.io/v2/projects/paper/versions/${version}" | jq -r '.builds[-1]')
  curl -fsSL -o server.jar "https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${build}/downloads/paper-${version}-${build}.jar"
}

download_vanilla() {
  local version="$1"
  local manifest_url
  manifest_url=$(curl -fsSL https://launchermeta.mojang.com/mc/game/version_manifest.json | jq -r --arg v "$version" '
    if $v == "latest" then .latest.release else $v end as $target |
    .versions[] | select(.id == $target) | .url' | head -n1)
  local jar_url
  jar_url=$(curl -fsSL "$manifest_url" | jq -r '.downloads.server.url')
  curl -fsSL -o server.jar "$jar_url"
}

download_fabric() {
  local version="$1"
  if [ "$version" = "latest" ]; then
    version=$(curl -fsSL https://meta.fabricmc.net/v2/versions/game | jq -r '[.[] | select(.stable==true)][0].version')
  fi
  local loader
  loader=$(curl -fsSL https://meta.fabricmc.net/v2/versions/loader | jq -r '[.[] | select(.stable==true)][0].version')
  local installer
  installer=$(curl -fsSL https://meta.fabricmc.net/v2/versions/installer | jq -r '[.[] | select(.stable==true)][0].version')
  curl -fsSL -o server.jar "https://meta.fabricmc.net/v2/versions/loader/${version}/${loader}/${installer}/server/jar"
}

if [ "$1" = "--install-only" ] || [ ! -f server.jar ]; then
  case "${SERVER_JAR:-paper}" in
    vanilla) download_vanilla "$MC_VERSION" ;;
    fabric) download_fabric "$MC_VERSION" ;;
    *) download_paper "$MC_VERSION" ;;
  esac
  chown -R "${HOST_UID:-1000}:${HOST_GID:-1000}" /server/data 2>/dev/null || true
  [ "$1" = "--install-only" ] && exit 0
fi

echo "eula=true" > eula.txt

HALF_MEMORY=$((MEMORY_MB / 2))

exec java \
  -Xms${HALF_MEMORY}m -Xmx${MEMORY_MB}m \
  -XX:+UseG1GC -XX:+ParallelRefProcEnabled \
  -XX:MaxGCPauseMillis=200 \
  -jar server.jar nogui
