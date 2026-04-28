#!/usr/bin/env bash
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case $ARCH in
  x86_64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
esac

curl -L https://github.com/kittendevv/blindspot/releases/latest/download/blindspot-$OS-$ARCH -o blindspot
chmod +x blindspot
sudo mv blindspot /usr/local/bin/blindspot
echo "Blindspot installed! You might need to restart your shell."
