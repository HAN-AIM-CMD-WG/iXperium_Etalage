#!/bin/bash
# Kiosk-startscript voor de Ubuntu NUC.
#
# Start de dev-servers (Vite :3000 + socket-server :3001) en Chromium in
# kiosk-modus MET geforceerde GPU-versnelling (via scripts/nuc-chromium.sh —
# zie docs/NUC-SETUP.md waarom dat cruciaal is). Sluit Chromium af, dan wordt
# alles opgeruimd en opnieuw gestart.

REPO="/home/kiosk/iXperium-planet-concept"
URL="http://localhost:3000/"

while true; do
  pkill -f "npm run dev" 2>/dev/null
  pkill -f "vite.*3000" 2>/dev/null
  pkill -f "chromium.*localhost:3000" 2>/dev/null

  cd "$REPO" || exit 1

  npm run dev -- --host 0.0.0.0 &
  DEV_PID=$!

  # Wacht tot Vite écht bereikbaar is (max 60s) i.p.v. blind 5s slapen.
  # Voorkomt dat de kiosk na een trage start (npm/koude boot) in een
  # foutpagina blijft hangen waar je zonder toetsenbord niet uit komt.
  for _ in $(seq 1 60); do
    if (echo -n > /dev/tcp/localhost/3000) 2>/dev/null; then
      break
    fi
    sleep 1
  done

  # Chromium in kiosk-modus met GPU-vlaggen; blokkeert tot afsluiten.
  KIOSK=1 "$REPO/scripts/nuc-chromium.sh" "$URL"

  kill "$DEV_PID" 2>/dev/null
  pkill -f "npm run dev" 2>/dev/null
  pkill -f "vite.*3000" 2>/dev/null

  sleep 2
done
