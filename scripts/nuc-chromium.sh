#!/usr/bin/env bash
# Start Chromium op de Ubuntu NUC met geforceerde GPU-versnelling.
#
# Waarom: zonder hardware-acceleratie rendert Chromium deze app op de CPU
# (software rasterization). Gemeten met identieke code: GPU aan = vloeiend,
# GPU uit = 6-10 fps met glitchen/knipperen bij kleurwissels. Chromium op
# Linux/Intel valt vaak stilletjes terug op software-rendering door een
# conservatieve GPU-blocklist (bv. een Mesa-versie die net niet "vertrouwd"
# is). Deze vlaggen forceren het GPU-pad weer aan.
#
# Gebruik:
#   ./scripts/nuc-chromium.sh                     # opent http://localhost:3000
#   ./scripts/nuc-chromium.sh http://host:3000    # eigen URL
#   KIOSK=1 ./scripts/nuc-chromium.sh             # fullscreen kiosk-modus
#
# Verificatie na het starten: open chrome://gpu in een tweede tab.
# "Rasterization", "Canvas" en "Compositing" moeten "Hardware accelerated"
# tonen. Staat er nog "Software only" -> zie docs/NUC-SETUP.md.

set -euo pipefail

URL="${1:-http://localhost:3000}"

BIN="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"
if [[ -z "$BIN" ]]; then
  echo "Geen chromium/chromium-browser/google-chrome gevonden in PATH." >&2
  exit 1
fi

FLAGS=(
  # Negeer de driver-blocklist die op Linux/Intel vaak onterecht
  # hardware-acceleratie uitschakelt.
  --ignore-gpu-blocklist
  # Raster pagina-inhoud op de GPU i.p.v. de CPU.
  --enable-gpu-rasterization
  # Laat de GPU direct in eigen buffers schrijven (geen CPU-kopie ertussen).
  --enable-zero-copy
  --enable-native-gpu-memory-buffers
  # Native Wayland wanneer de sessie dat is (voorkomt XWayland
  # vsync/frame-pacing haperingen); valt zelf terug op X11.
  --ozone-platform-hint=auto
)

if [[ "${KIOSK:-0}" == "1" ]]; then
  FLAGS+=(--kiosk --noerrdialogs --disable-session-crashed-bubble)
fi

exec "$BIN" "${FLAGS[@]}" "$URL"
