#!/bin/bash
set -e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORGE_HOME="${FORGE_HOME:-$HOME/forgepanel}"

echo "=== ForgePanel Installer ==="

# 1. Detect Debian/Ubuntu
if [ ! -f /etc/os-release ]; then
  echo "Cannot detect OS -- /etc/os-release not found. ForgePanel supports Debian and Ubuntu only." >&2
  exit 1
fi
. /etc/os-release
if [ "$ID" != "debian" ] && [ "$ID" != "ubuntu" ] && [ "$ID_LIKE" != "debian" ]; then
  echo "Unsupported OS: $PRETTY_NAME. ForgePanel supports Debian and Ubuntu only." >&2
  exit 1
fi
echo "Detected: $PRETTY_NAME"

port_free() {
  ! ss -tln 2>/dev/null | awk '{print $4}' | grep -q ":$1\$"
}

prompt_port() {
  local label="$1" default="$2"
  local port="$default"
  while ! port_free "$port"; do
    read -rp "Port $port ($label) is already in use. Enter a different port: " port
  done
  echo "$port"
}

# 2. Node.js 20+
if ! command -v node >/dev/null || [ "$(node --version | sed 's/v//;s/\..*//')" -lt 20 ]; then
  echo "--- Installing Node.js 20 ---"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "Node.js already installed: $(node --version)"
fi

# 3. steamcmd
if ! command -v steamcmd >/dev/null; then
  echo "--- Installing steamcmd ---"
  sudo dpkg --add-architecture i386
  # steamcmd lives in Debian's contrib+non-free components; Ubuntu needs multiverse.
  if [ "$ID" = "debian" ]; then
    sudo sed -i 's/^deb \(.*\) \(bookworm\|bullseye\|trixie\)\( main\)\( non-free-firmware\)\?$/deb \1 \2\3 contrib non-free non-free-firmware/' /etc/apt/sources.list
  elif [ "$ID" = "ubuntu" ]; then
    sudo add-apt-repository -y multiverse
  fi
  sudo apt-get update -qq
  echo "steam steam/question select I AGREE" | sudo debconf-set-selections
  echo "steam steam/license note" | sudo debconf-set-selections
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y steamcmd
else
  echo "steamcmd already installed"
fi
STEAMCMD_PATH="$(command -v steamcmd || echo /usr/games/steamcmd)"

# 4. playit
if ! command -v playit >/dev/null; then
  echo "--- Installing playit ---"
  curl -SsL https://playit-cloud.github.io/ppa/key.gpg | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/playit.gpg >/dev/null
  echo "deb [signed-by=/etc/apt/trusted.gpg.d/playit.gpg] https://playit-cloud.github.io/ppa/data ./" | sudo tee /etc/apt/sources.list.d/playit-cloud.list
  sudo apt update -qq
  sudo apt install -y playit
else
  echo "playit already installed"
fi

# 5. Docker
if ! command -v docker >/dev/null || ! sudo docker info >/dev/null 2>&1; then
  echo "Docker is not installed or not running. Install and start Docker before running this installer." >&2
  exit 1
fi
echo "Docker OK: $(docker --version)"

# 6. Directory structure
echo "--- Creating directory structure at $FORGE_HOME ---"
mkdir -p "$FORGE_HOME"/{servers,backups,steamcmd_cache}

# 7-8. Install + build
echo "--- Installing backend dependencies ---"
(cd "$INSTALL_DIR/backend" && npm install)
echo "--- Installing frontend dependencies and building ---"
(cd "$INSTALL_DIR/frontend" && npm install && npm run build)

# 9. Prompts
echo
echo "--- Configuration ---"
read -rsp "Set an admin password: " ADMIN_PASSWORD
echo
read -rp "Steam Web API key (optional, can set later in Settings): " STEAM_API_KEY
PANEL_PORT=$(prompt_port "panel" 3001)
SFTP_PORT=$(prompt_port "SFTP" 2022)
read -rp "Enable FORGEPANEL_OWNER mode? (y/N): " OWNER_ANSWER
FORGEPANEL_OWNER="false"
[[ "$OWNER_ANSWER" =~ ^[Yy]$ ]] && FORGEPANEL_OWNER="true"

# 10. Session secret
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Admin password hash (needs bcrypt, installed above)
ADMIN_PASSWORD_HASH=$(cd "$INSTALL_DIR/backend" && node -e "console.log(require('bcrypt').hashSync(process.argv[1], 12))" "$ADMIN_PASSWORD")

# 11. Write backend/.env
cat > "$INSTALL_DIR/backend/.env" <<EOF
PORT=$PANEL_PORT
SFTP_PORT=$SFTP_PORT
SESSION_SECRET=$SESSION_SECRET
ADMIN_PASSWORD_HASH=$ADMIN_PASSWORD_HASH
STEAM_API_KEY=$STEAM_API_KEY
STEAMCMD_PATH=$STEAMCMD_PATH
DB_PATH=$INSTALL_DIR/backend/forgepanel.db
FORGEPANEL_OWNER=$FORGEPANEL_OWNER
DOCKER_SOCKET=/var/run/docker.sock
FORGE_DATA_PATH=$FORGE_HOME/servers
FORGE_BACKUP_PATH=$FORGE_HOME/backups
FORGE_STEAMCMD_CACHE=$FORGE_HOME/steamcmd_cache
GITHUB_REPO=https://github.com/InfoSecRaz/ForgePanel.git
NODE_ENV=production
EOF

# 12. Copy frontend build
rm -rf "$INSTALL_DIR/backend/public"
cp -r "$INSTALL_DIR/frontend/dist" "$INSTALL_DIR/backend/public"

# 13. Docker network
sudo docker network inspect forgepanel-net >/dev/null 2>&1 || sudo docker network create forgepanel-net

# 14. systemd service
echo "--- Installing systemd service ---"
sudo tee /etc/systemd/system/forgepanel.service >/dev/null <<EOF
[Unit]
Description=ForgePanel game server management panel
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$(command -v node) $INSTALL_DIR/backend/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 15. Enable + start
sudo systemctl daemon-reload
sudo systemctl enable forgepanel
sudo systemctl restart forgepanel

sleep 2
HOST_IP=$(hostname -I | awk '{print $1}')

# 16-17. Done
echo
echo "=== ForgePanel installed ==="
echo "ForgePanel running at http://${HOST_IP}:${PANEL_PORT}"
echo "Log in as 'admin' with the password you just set."
echo "Visit Settings to complete playit.gg and Discord setup."
