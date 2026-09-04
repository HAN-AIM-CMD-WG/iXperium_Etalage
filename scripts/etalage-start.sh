#!/bin/bash
# iXperium etalage-scherm — één zelfstandig startscript voor de tweede pc.
#
# Zet dit bestand ergens op de etalage-pc (bv. /home/ixperium-etalage/), maak
# het uitvoerbaar en start het. De repo hoeft daar NIET te staan.
#
#   chmod +x etalage-start.sh
#   ./etalage-start.sh
#
# Wat het doet: het zoekt zelf de tafel-pc op het netwerk, wacht tot die aan
# staat en opent index2.html (het kiosk-scherm) in Chromium kiosk-modus. De
# pagina legt daarna zelf de websocket-verbinding aan naar poort 3001 van
# diezelfde host — er is dus niets te configureren.
#
# Weet je het IP van de tafel-pc en wil je niet laten zoeken:
#   ./etalage-start.sh 192.168.1.50
#   TABLE_HOST=192.168.1.50 ./etalage-start.sh
#
# Autostart als user ixperium-etalage:
#   mkdir -p ~/.config/autostart
#   cat > ~/.config/autostart/ixperium-etalage.desktop <<'EOF'
#   [Desktop Entry]
#   Type=Application
#   Name=iXperium etalage kiosk
#   Exec=/home/ixperium-etalage/etalage-start.sh
#   X-GNOME-Autostart-enabled=true
#   EOF

# Geen `set -e`: pkill/xset/curl geven een niet-nul exitcode als er niets te
# doen is, en dat mag de herstart-loop niet afbreken.
set -uo pipefail

HTTP_PORT="${HTTP_PORT:-3000}"
SOCKET_PORT="${SOCKET_PORT:-3001}"
# Leeg = zelf zoeken op het netwerk.
TABLE_HOST="${1:-${TABLE_HOST:-}}"
# Hostnamen die we altijd eerst proberen voordat het subnet gescand wordt.
KNOWN_HOSTS=(ixperium-tafel.local ixperium-tafel kiosk.local)
# Laatst gevonden tafel-pc; bij de volgende boot is dat meteen een hit.
CACHE_FILE="${XDG_CACHE_HOME:-$HOME/.cache}/ixperium-etalage-host"

BIN="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"
if [[ -z "$BIN" ]]; then
  echo "Geen chromium/chromium-browser/google-chrome gevonden in PATH." >&2
  echo "Installeer met: sudo apt install -y chromium-browser" >&2
  exit 1
fi

FLAGS=(
  # --- GPU. Zonder deze vlaggen valt Chromium op Linux/Intel vaak terug op
  # software-rendering (6-10 fps, knipperen bij kleurwissels).
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

log() {
  echo "[etalage] $*" >&2
}

# Antwoordt er iets op deze host+poort?
port_open() {
  timeout 2 bash -c "echo -n > /dev/tcp/$1/$2" 2>/dev/null
}

# Draait op deze host écht ons kiosk-scherm (en niet een willekeurige andere
# webserver op poort 3000)? We checken de <title> van index2.html.
is_table_host() {
  local host="$1"

  port_open "$host" "$HTTP_PORT" || return 1

  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 3 "http://${host}:${HTTP_PORT}/index2.html" 2>/dev/null |
      grep -qi "iXperium Kiosk"
    return $?
  fi

  # Zonder curl kunnen we de pagina niet verifiëren; open poort is dan genoeg.
  return 0
}

# Eerste drie octetten van het eigen IPv4-adres, bv. "192.168.1".
local_subnet_prefix() {
  local ip=""

  if command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)"
  fi
  if [[ -z "$ip" ]] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  [[ -z "$ip" ]] && return 1
  echo "${ip%.*}"
}

# Scan het eigen /24-subnet op een open poort 3000 en geef de eerste host terug
# waarop ons kiosk-scherm draait. De checks lopen parallel (blokken van 64), dus
# een volledige scan duurt enkele seconden.
scan_subnet_for_table() {
  local prefix
  prefix="$(local_subnet_prefix)" || return 1

  local hits_file
  hits_file="$(mktemp)" || return 1

  log "Zoeken naar de tafel-pc op ${prefix}.0/24 ..."
  local octet
  for octet in $(seq 1 254); do
    (
      if timeout 1 bash -c "echo -n > /dev/tcp/${prefix}.${octet}/${HTTP_PORT}" 2>/dev/null; then
        echo "${prefix}.${octet}" >> "$hits_file"
      fi
    ) &
    if (( octet % 64 == 0 )); then wait; fi
  done
  wait

  local host
  while read -r host; do
    if is_table_host "$host"; then
      rm -f "$hits_file"
      echo "$host"
      return 0
    fi
  done < "$hits_file"

  rm -f "$hits_file"
  return 1
}

# Blijft proberen tot de tafel-pc gevonden is; geeft de host terug op stdout.
resolve_table_host() {
  local attempt=0

  while true; do
    attempt=$((attempt + 1))

    # 1) Handmatig opgegeven host: nooit gaan zoeken, alleen wachten.
    if [[ -n "$TABLE_HOST" ]]; then
      if is_table_host "$TABLE_HOST"; then
        echo "$TABLE_HOST"
        return 0
      fi
      [[ $((attempt % 15)) -eq 1 ]] && log "Wacht op ${TABLE_HOST}:${HTTP_PORT} ..."
      sleep 2
      continue
    fi

    # 2) Laatst gebruikte host + bekende hostnamen (snelle paden).
    local candidate
    for candidate in "$(cat "$CACHE_FILE" 2>/dev/null)" "${KNOWN_HOSTS[@]}"; do
      [[ -z "$candidate" ]] && continue
      if is_table_host "$candidate"; then
        echo "$candidate"
        return 0
      fi
    done

    # 3) Netwerkscan.
    local found
    found="$(scan_subnet_for_table)"
    if [[ -n "$found" ]]; then
      echo "$found"
      return 0
    fi

    log "Tafel-pc nog niet gevonden; opnieuw proberen over 5s."
    sleep 5
  done
}

# Schermbeveiliging/energiebeheer uit — een etalage-scherm mag nooit uitvallen.
# Werkt op een X11-sessie; op Wayland faalt xset stil en regel je dit via
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

  host="$(resolve_table_host)"
  mkdir -p "$(dirname "$CACHE_FILE")" 2>/dev/null
  echo "$host" > "$CACHE_FILE" 2>/dev/null
  log "Tafel-pc: ${host}"

  # De socket-server komt normaal gelijk op met de webserver. Is hij er nog
  # niet, dan laden we de pagina toch: socket.io blijft zelf oneindig opnieuw
  # verbinden, dus het scherm herstelt zodra de tafel er is.
  socket_attempt=0
  while ! port_open "$host" "$SOCKET_PORT"; do
    socket_attempt=$((socket_attempt + 1))
    if (( socket_attempt >= 15 )); then
      log "Socket-server ${host}:${SOCKET_PORT} nog niet bereikbaar; pagina wordt toch geladen."
      break
    fi
    sleep 2
  done

  # Blokkeert tot Chromium afsluit (crash, stroomdip, Alt+F4). Daarna opnieuw:
  # zo wordt ook een gewijzigd IP van de tafel-pc automatisch opnieuw gevonden.
  "$BIN" "${FLAGS[@]}" "http://${host}:${HTTP_PORT}/index2.html"

  sleep 2
done
