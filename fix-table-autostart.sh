#!/bin/bash
# Repareer de autostart van de touchtafel-kiosk.
#
# Draai dit op de touchtafel-NUC, als user `kiosk`, vanuit de projectmap:
#   ./fix-table-autostart.sh              # repareren
#   ./fix-table-autostart.sh --dry-run    # alleen tonen wat er zou gebeuren
#
# Nodig na het hernoemen/verplaatsen van de projectmap: iets verwees nog naar
# het oude pad en daardoor start de kiosk niet meer op.
#
# Wat het doet:
#   1. `scripts/*.sh` uitvoerbaar maken
#   2. breed zoeken naar verwijzingen naar een nuc-start.sh die niet meer
#      bestaat: autostart-entries, systemd-units, sessiebestanden, losse
#      scriptjes in je home, symlinks en crontab
#   3. die paden bijwerken naar de huidige locatie (met .bak-backup)
#   4. is er daarna nog geen werkende autostart, dan er zelf een aanmaken
#      (~/.config/autostart/ixperium-kiosk.desktop)
#   5. laten zien wat het resultaat is en hoe je het test

set -uo pipefail

main() {
  local dry_run=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run|-n) dry_run=1 ;;
      -h|--help)
        sed -n '2,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
        return 0
        ;;
      *) echo "Onbekende optie: $1" >&2; return 1 ;;
    esac
    shift
  done

  local repo_dir start_script desktop_file
  repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  start_script="${repo_dir}/scripts/nuc-start.sh"
  desktop_file="${HOME}/.config/autostart/ixperium-kiosk.desktop"

  say() { echo "[autostart] $*"; }
  run() {
    if [[ "$dry_run" == 1 ]]; then
      printf '[dry-run]'; printf ' %q' "$@"; printf '\n'
    else
      "$@"
    fi
  }

  # --- Controles vooraf ----------------------------------------------------
  if [[ ! -f "$start_script" ]]; then
    echo "Niet gevonden: $start_script" >&2
    echo "Draai dit script vanuit de projectmap van iXperium Etalage." >&2
    return 1
  fi

  if [[ "$EUID" -eq 0 ]]; then
    echo "Draai dit NIET met sudo/als root: de autostart hoort bij je eigen" >&2
    echo "gebruiker, en root-eigendom maakt het juist stuk." >&2
    return 1
  fi

  say "Projectmap    : $repo_dir"
  say "Startscript   : $start_script"
  [[ "$dry_run" == 1 ]] && say "DRY-RUN: er wordt niets gewijzigd."

  # --- 1. Scripts uitvoerbaar --------------------------------------------
  if [[ ! -x "$start_script" ]]; then
    say "Startscript was niet uitvoerbaar; chmod +x ..."
    run chmod +x "$repo_dir"/scripts/*.sh
  fi

  # --- 2. Zoeken naar verouderde verwijzingen -----------------------------
  # Alles wat 'nuc-start.sh' noemt maar niet naar het huidige pad wijst.
  local search_paths=(
    "$HOME/.config/autostart"
    "$HOME/.config/systemd/user"
    "$HOME/.local/share/applications"
    "$HOME/.config/openbox"
    "$HOME/.config/lxsession"
    "$HOME/.profile"
    "$HOME/.bash_profile"
    "$HOME/.bashrc"
    "$HOME/.xsessionrc"
    "$HOME/.xinitrc"
    "$HOME/.xprofile"
    /etc/xdg/autostart
    /etc/systemd/system
  )
  # Losse scriptjes direct in de home (een veelgebruikte wrapper-plek).
  local extra
  while IFS= read -r extra; do
    [[ -n "$extra" ]] && search_paths+=("$extra")
  done < <(find "$HOME" -maxdepth 1 -type f -name '*.sh' 2>/dev/null)

  local existing=() path
  for path in "${search_paths[@]}"; do
    [[ -e "$path" ]] && existing+=("$path")
  done

  say "Zoeken naar verwijzingen naar nuc-start.sh ..."
  local hits=() file
  if [[ ${#existing[@]} -gt 0 ]]; then
    while IFS= read -r file; do
      [[ -n "$file" ]] && hits+=("$file")
    done < <(grep -rIl --fixed-strings 'nuc-start.sh' "${existing[@]}" 2>/dev/null)
  fi

  local patched=0 manual=() user_reload=0 root_reload=0 ok_refs=0
  # `${hits[@]+...}` omdat een leeg array met `set -u` een fout geeft in
  # oudere bash-versies.
  for file in ${hits[@]+"${hits[@]}"}; do
    # Welke paden naar nuc-start.sh staan erin, en bestaan die nog?
    local stale=() ref
    while IFS= read -r ref; do
      [[ -z "$ref" ]] && continue
      if [[ "$ref" == "$start_script" ]]; then
        ok_refs=$((ok_refs + 1))
      elif [[ ! -f "$ref" ]]; then
        stale+=("$ref")
      fi
    done < <(grep -ohE '/[^"'"'"' ]*nuc-start\.sh' "$file" 2>/dev/null | sort -u)

    if [[ ${#stale[@]} -eq 0 ]]; then
      continue
    fi

    if [[ -w "$file" ]]; then
      say "Bijwerken: $file"
      for ref in "${stale[@]}"; do
        say "   $ref  ->  $start_script"
      done
      run cp "$file" "${file}.bak"
      run replace_refs "$file" "$start_script" "${stale[@]}"
      patched=$((patched + 1))
      [[ "$file" == "$HOME/.config/systemd/user/"* ]] && user_reload=1
    else
      manual+=("$file")
      [[ "$file" == /etc/systemd/system/* ]] && root_reload=1
    fi
  done

  # Kapotte symlinks in de home die naar het oude pad wijzen. Bewust
  # `-type l` + een bestaanscheck i.p.v. `-xtype l`: dat laatste kent niet
  # elke find-versie.
  local link target
  while IFS= read -r link; do
    [[ -z "$link" ]] && continue
    [[ -e "$link" ]] && continue
    target="$(readlink "$link")"
    if [[ "$target" == *nuc-start.sh ]]; then
      say "Kapotte symlink herstellen: $link -> $start_script"
      run ln -sfn "$start_script" "$link"
      patched=$((patched + 1))
    fi
  done < <(find "$HOME" -maxdepth 2 -type l 2>/dev/null)

  # Crontab (@reboot-regels).
  if command -v crontab >/dev/null 2>&1 && crontab -l 2>/dev/null | grep -q 'nuc-start.sh'; then
    if ! crontab -l 2>/dev/null | grep -q -- "$start_script"; then
      say "Crontab verwijst naar een ander pad; bijwerken ..."
      if [[ "$dry_run" == 1 ]]; then
        echo "[dry-run] crontab -l | sed 's|/[^ ]*nuc-start.sh|$start_script|g' | crontab -"
      else
        crontab -l 2>/dev/null > "$HOME/crontab.bak"
        crontab -l 2>/dev/null |
          sed "s|/[^ ]*nuc-start\.sh|${start_script}|g" |
          crontab -
        say "Oude crontab bewaard in ~/crontab.bak"
      fi
      patched=$((patched + 1))
    else
      ok_refs=$((ok_refs + 1))
    fi
  fi

  if [[ "$user_reload" == 1 ]]; then
    say "systemctl --user daemon-reload ..."
    run systemctl --user daemon-reload
  fi

  say "Verwijzingen: ${patched} bijgewerkt, ${ok_refs} al correct."

  # --- 3. Is er nu een werkende autostart? --------------------------------
  # Bewust niet "er is iets gerepareerd, dus het werkt": een wrapper-script of
  # symlink in je home zegt nog niets over de autostart. We kijken alleen naar
  # echte autostart-mechanismen.
  if autostart_present; then
    say "Er is een autostart-mechanisme dat de kiosk start."
  else
    say "Geen autostart gevonden die de kiosk start; er wordt een nieuwe aangemaakt."
    if [[ "$repo_dir" == *" "* ]]; then
      say "LET OP: het pad bevat een spatie; log-omleiding wordt overgeslagen."
      run write_desktop "$desktop_file" "$start_script" ''
    else
      run write_desktop "$desktop_file" "$start_script" "${HOME}/kiosk-tafel.log"
    fi
  fi

  # --- 4. Resultaat --------------------------------------------------------
  echo
  if command -v desktop-file-validate >/dev/null 2>&1 && [[ -f "$desktop_file" ]]; then
    if desktop-file-validate "$desktop_file" 2>&1 | grep -q .; then
      say "desktop-file-validate meldt iets over $desktop_file:"
      desktop-file-validate "$desktop_file"
    fi
  fi

  if [[ -f "$desktop_file" ]]; then
    say "Autostart-entry ($desktop_file):"
    sed 's/^/    /' "$desktop_file"
  fi

  if [[ ${#manual[@]} -gt 0 ]]; then
    echo
    say "Deze bestanden zijn niet van jou; pas ze met sudo aan (pad ->"
    say "${start_script}):"
    for file in "${manual[@]}"; do
      echo "  sudo nano '$file'"
    done
    [[ "$root_reload" == 1 ]] && echo "  sudo systemctl daemon-reload"
  fi

  echo
  say "Nu testen zonder herstarten:"
  echo "  $start_script"
  say "Daarna rebooten om de autostart zelf te controleren."
  say "Blijft het scherm leeg na een reboot, kijk dan in: ${HOME}/kiosk-tafel.log"
}

# Is er een autostart-mechanisme dat (direct of via een wrapper) nuc-start.sh
# aanroept? Alleen echte autostart-plekken tellen: .desktop-entries,
# systemd-units en crontab.
autostart_present() {
  local dir file path

  for dir in "$HOME/.config/autostart" /etc/xdg/autostart; do
    [[ -d "$dir" ]] || continue
    for file in "$dir"/*.desktop; do
      [[ -f "$file" ]] || continue
      # Alle absolute paden uit de Exec-regel; één niveau indirectie is
      # genoeg (autostart -> wrapper-script -> nuc-start.sh).
      while IFS= read -r path; do
        [[ -n "$path" && -f "$path" ]] || continue
        [[ "$path" == *nuc-start.sh ]] && return 0
        grep -qI --fixed-strings 'nuc-start.sh' "$path" 2>/dev/null && return 0
      done < <(grep -h '^Exec=' "$file" 2>/dev/null |
        grep -ohE '/[^"'"'"' ]+' | sort -u)
    done
  done

  for dir in "$HOME/.config/systemd/user" /etc/systemd/system; do
    [[ -d "$dir" ]] || continue
    grep -rIlq --fixed-strings 'nuc-start.sh' "$dir" 2>/dev/null && return 0
  done

  if command -v crontab >/dev/null 2>&1; then
    crontab -l 2>/dev/null | grep -q 'nuc-start.sh' && return 0
  fi

  return 1
}

# via een tijdelijk bestand terug in het origineel, zodat rechten en eigendom
# behouden blijven (werkt ook zonder GNU-sed).
replace_refs() {
  local target="$1" correct="$2"
  shift 2
  local tmp stale
  tmp="$(mktemp)" || return 1
  cp "$target" "$tmp" || { rm -f "$tmp"; return 1; }
  for stale in "$@"; do
    local inner
    inner="$(mktemp)" || { rm -f "$tmp"; return 1; }
    sed "s|${stale//|/\\|}|${correct//|/\\|}|g" "$tmp" > "$inner"
    mv "$inner" "$tmp"
  done
  cat "$tmp" > "$target"
  rm -f "$tmp"
}

# Schrijf een autostart-entry voor de kiosk.
write_desktop() {
  local file="$1" script="$2" logfile="$3"
  local exec_line="$script"
  [[ -n "$logfile" ]] && exec_line="/bin/bash -c \"${script} >> ${logfile} 2>&1\""

  mkdir -p "$(dirname "$file")" || return 1
  cat > "$file" <<EOF
[Desktop Entry]
Type=Application
Name=iXperium touchtafel kiosk
Comment=Start de dev-servers en Chromium in kiosk-modus
Exec=${exec_line}
Terminal=false
X-GNOME-Autostart-enabled=true
NoDisplay=true
EOF
}

main "$@"
