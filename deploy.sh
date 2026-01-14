#!/bin/bash
# Deploy script for oCIS Photo Add-on
# This script builds and deploys the extension to the oCIS server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_PATH="/data/owncloud/ocis/web/assets/apps/photo-addon"

echo "=== oCIS Photo Add-on Deploy Script ==="

# Build the extension
echo "Building extension..."
cd "$SCRIPT_DIR"
pnpm build

# Create deploy directory if it doesn't exist
if [ ! -d "$DEPLOY_PATH" ]; then
    echo "Creating deploy directory..."
    mkdir -p "$DEPLOY_PATH"
fi

# Copy files
echo "Copying files to $DEPLOY_PATH..."
cp "$SCRIPT_DIR/dist/index.amd.js" "$DEPLOY_PATH/index.js"
# Copy all chunk files (for dynamic imports)
for chunk in "$SCRIPT_DIR/dist/"*.js; do
    if [ -f "$chunk" ] && [ "$(basename "$chunk")" != "index.amd.js" ]; then
        cp "$chunk" "$DEPLOY_PATH/"
    fi
done
# Copy style.css if it exists
if [ -f "$SCRIPT_DIR/dist/style.css" ]; then
    cp "$SCRIPT_DIR/dist/style.css" "$DEPLOY_PATH/"
fi
cp "$SCRIPT_DIR/public/manifest.json" "$DEPLOY_PATH/"

# Restart oCIS
echo "Restarting oCIS service..."
systemctl restart ocis

echo "=== Deployment complete ==="
echo "Please hard refresh (Ctrl+Shift+R) your browser to see changes."
