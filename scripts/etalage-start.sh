#!/bin/bash
# Kiosk-startscript voor de tweede Ubuntu-pc: het etalage-scherm (index2.html).
#
# Deze pc draait zelf GEEN servers. Vite (:3000) en de socket-server (:3001)
# staan op de tafel-pc en worden daar gestart met scripts/nuc-start.sh. Dit
# script wacht tot de tafel-pc bereikbaar is en opent daarna index2.html in
# Chromium kiosk-modus. De pagina legt zelf de websocket-verbinding aan naar
# poort 3001 van dezelfde host waarvan hij is geladen — dus TABLE_HOST goed
# zetten is genoeg, er hoeft niets extra geconfigureerd te worden.
#
# Het script is bewust self-contained (inclusief de GPU-vlaggen uit
# scripts/nuc-chromium.sh) zodat je alleen dit bestand naar de etalage-pc hoeft
# te copiëren; de repo is daar niet nodig.
#
# Instellen — hostnaam of IP van de tafel-pc:
#   ./etalage-start.sh 192.168.1.50
#   TABLE_HOST=192.168.1.50 ./etalage-start.sh
# of pas de standaardwaarde van TABLE_HOST hieronder aan.
#
# Autostart (als user ixperium-etalage), zie ook docs/NUC-SETUP.md:
#   mkdir -p ~/.config/autostart
#   cat > ~/.config/autostart/ixperium-etalage.desktop <<'EOF'
#   [Desktop Entry]
#   Type=Application
#   Name=iXperium etalage kiosk
#   Exec=/home/ixperium-etalage/etalage-start.sh
#   X-GNOME-Autostart-enabled=true
#   EOF

# Geen `set -e`: pkill/xset geven een niet-nul exitcode als er niets te doen
# is, en dat mag de herstart-loop niet afbreken.
set -uo pipefail

TABLE_HOST="${1:-${TABLE_HOST:-ixperium-tafel.local}}"
HTTP_PORT="${HTTP_PORT:-3000}"
SOCKET_PORT="${SOCKET_PORT:-3001}"
URL="http://${TABLE_HOST}:${HTTP_PORT}/index2.html"

BIN="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"
if [[ -z "$BIN" ]]; then
  echo "Geen chromium/chromium-browser/google-chrome gevonden in PATH." >&2
  exit 1
fi

FLAGS=(
  # --- GPU: identiek aan scripts/nuc-chromium.sh. Zonder deze vlaggen valt
  # Chromium op Linux/Intel vaak terug op software-rendering (6-10 fps,
  # knipperen bij kleurwissels). Zie docs/NUC-SETUP.md.
  --ignore-gpu-blocklist
  --enable-gpu-rasterization
  --enable-zero-copy
  --enable-native-gpu-memory-buffers
  --ozone-platform-hint=auto
  # --- Kiosk: fullscreen, geen dialogen, geen "Chromium is niet correct
  # afgesloten"-ballon na een stroomstoring.
  --kiosk
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --hide-crash-restore-bubble
  # Voorkomt dat de gnome-keyring om een wachtwoord vraagt op een pc zonder
  # toetsenbord.
  --password-store=basic
)

# Wacht tot een TCP-poort op de tafel-pc antwoordt. `timeout` beschermt tegen
# een DNS/route die blijft hangen; retries zijn oneindig zodat de etalage-pc
# gewoon mag booten voordat de tafel aan staat.
wait_for_port() {
  local port="$1"
  local max_attempts="$2"
  local attempt=0

  while true; do
    if timeout 2 bash -c "echo -n > /dev/tcp/${TABLE_HOST}/${port}" 2>/dev/null; then
      return 0
    fi

    attempt=$((attempt + 1))
    if [[ "$max_attempts" -gt 0 && "$attempt" -ge "$max_attempts" ]]; then
      return 1
    fi

    if [[ $((attempt % 15)) -eq 1 ]]; then
      echo "Wacht op ${TABLE_HOST}:${port} (poging ${attempt})..." >&2
    fi
    sleep 2
  done
}

# Schermbeveiliging/energiebeheer uit — een etalage-scherm mag nooit uitvallen.
# Werkt alleen op een X11-sessie; op Wayland faalt xset stil en regel je dit via
# Instellingen > Energie ("Nooit uitschakelen").
if command -v xset >/dev/null 2>&1; then
  xset s off 2>/dev/null
  xset s noblank 2>/dev/null
  xset -dpms 2>/dev/null
fi

# Muisaanwijzer verbergen als unclutter beschikbaar is
# (sudo apt install unclutter).
if command -v unclutter >/dev/null 2>&1 && ! pgrep -x unclutter >/dev/null 2>&1; then
  unclutter -idle 1 -root >/dev/null 2>&1 &
fi

while true; do
  pkill -f "chromium.*index2.html" 2>/dev/null

  # De pagina zelf is hard nodig: hierop wachten we onbeperkt.
  wait_for_port "$HTTP_PORT" 0

  # De socket-server komt normaal gelijk op met Vite. Lukt dat niet binnen
  # ~30s, dan starten we alsnog: socket.io in de pagina blijft zelf oneindig
  # opnieuw verbinden, dus het scherm herstelt automatisch zodra de tafel er is.
  wait_for_port "$SOCKET_PORT" 15 ||
    echo "Socket-server ${TABLE_HOST}:${SOCKET_PORT} nog niet bereikbaar; pagina wordt toch geladen." >&2

  # Blokkeert tot Chromium afsluit (crash, stroomdip, Alt+F4). Daarna opnieuw.
  "$BIN" "${FLAGS[@]}" "$URL"

  sleep 2
done
