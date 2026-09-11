#!/bin/bash
# Kiosk-startscript voor de Ubuntu NUC.
#
# Start de dev-servers (Vite :3000 + socket-server :3001) en Chromium in
# kiosk-modus MET geforceerde GPU-versnelling (via scripts/nuc-chromium.sh —
# zie docs/NUC-SETUP.md waarom dat cruciaal is). Sluit Chromium af, dan wordt
# alles opgeruimd en opnieuw gestart.
#
# REPO is de map van de repo zelf: standaard één niveau boven dit script. Zo
# blijft het werken als de map wordt hernoemd of verplaatst. Een ander pad
# forceren kan met: REPO=/pad/naar/repo ./scripts/nuc-start.sh

REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
URL="http://localhost:3000/"
LOCK_FILE="/tmp/ixperium-nuc-start.lock"

# Maar één instantie tegelijk. Draaien er twee (bv. twee autostart-entries),
# dan schiet de ene loop de Chromium van de andere af met de pkill hieronder,
# waarop die herstart: het scherm blijft dan openen en sluiten. Het slot wordt
# vastgehouden zolang dit proces leeft en gaat bij afsluiten automatisch weg.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    echo "nuc-start.sh draait al (slot: $LOCK_FILE); deze instantie stopt." >&2
    exit 0
  fi
fi

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
