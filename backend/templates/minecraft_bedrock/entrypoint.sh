#!/bin/bash
set -e
cd /server/data

install_bedrock() {
  local download_url
  download_url=$(curl -fsSL https://net-secondary.web.minecraft-services.net/api/v1.0/download/links | jq -r '.result.links[] | select(.downloadType=="serverBedrockLinux") | .downloadUrl')
  curl -fsSL -o bedrock-server.zip "$download_url"
  unzip -o bedrock-server.zip -d /tmp/bedrock-extract
  cp -rn /tmp/bedrock-extract/* /server/data/ 2>/dev/null || true
  rm -rf bedrock-server.zip /tmp/bedrock-extract
  chmod +x bedrock_server
  chown -R "${HOST_UID:-1000}:${HOST_GID:-1000}" /server/data 2>/dev/null || true
}

if [ "$1" = "--install-only" ] || [ ! -f bedrock_server ]; then
  install_bedrock
  [ "$1" = "--install-only" ] && exit 0
fi

export LD_LIBRARY_PATH=.
exec ./bedrock_server
