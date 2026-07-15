#!/bin/bash
set -e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "--- Pulling latest changes ---"
(cd "$INSTALL_DIR" && git pull origin main)

echo "--- Installing dependencies ---"
(cd "$INSTALL_DIR/backend" && npm install)
(cd "$INSTALL_DIR/frontend" && npm install)

echo "--- Building frontend ---"
(cd "$INSTALL_DIR/frontend" && npm run build)

echo "--- Deploying frontend build ---"
rm -rf "$INSTALL_DIR/backend/public"
cp -r "$INSTALL_DIR/frontend/dist" "$INSTALL_DIR/backend/public"

echo "--- Restarting ForgePanel ---"
sudo systemctl restart forgepanel

echo "ForgePanel updated and restarted"
