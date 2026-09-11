#!/bin/bash
# Hernoem de projectmap op de touchtafel-NUC en zet alles mee wat daarvan
# afhangt. Bedoeld om één keer te draaien, op de NUC zelf, als user `kiosk`.
#
# Gebruik (vanuit de projectmap):
#   ./rename-project-folder.sh                 # -> iXperium_Etalage
#   ./rename-project-folder.sh MijnNieuweNaam  # -> eigen naam
#   ./rename-project-folder.sh --dry-run       # alleen tonen wat er zou gebeuren
#
# Wat het doet:
#   1. kiosk stoppen (nuc-start.sh, npm run dev, Chromium)
#   2. de map hernoemen
#   3. `git pull` in de nieuwe map (git werkt op de remote-URL, niet op de
#      mapnaam, dus dat blijft werken)
#   4. node_modules/.vite weggooien — die dev-cache bevat absolute paden
#   5. autostart-/systemd-bestanden die nog het oude pad bevatten bijwerken
#
# node_modules zelf kan gewoon mee: npm gebruikt relatieve symlinks.
# `npm install` is dus niet nodig.

set -uo pipefail

# Alles staat in een functie zodat bash het hele script inleest vóór de map
# wordt hernoemd. Anders zou hij halverwege nog uit het originele pad willen
# lezen.
main() {
  local default_name='iXperium_Etalage'
  local dry_run=0
  local new_name=''

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run|-n) dry_run=1 ;;
      -h|--help)
        sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
        return 0
        ;;
      -*)
        echo "Onbekende optie: $1" >&2
        return 1
        ;;
      *) new_name="$1" ;;
    esac
    shift
  done
  new_name="${new_name:-$default_name}"

  # --- Waar staan we? -----------------------------------------------------
  local repo_dir parent_dir old_name new_dir
  repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  parent_dir="$(dirname "$repo_dir")"
  old_name="$(basename "$repo_dir")"
  new_dir="${parent_dir}/${new_name}"

  say() { echo "[rename] $*"; }
  run() {
    if [[ "$dry_run" == 1 ]]; then
      # %q zodat de getoonde regel ook echt kopieerbaar is.
      printf '[dry-run]'; printf ' %q' "$@"; printf '\n'
    else
      "$@"
    fi
  }
  # Pad in een bestand vervangen zonder het bestand te vervangen: de inhoud
  # gaat via een tijdelijk bestand terug in het origineel, zodat rechten en
  # eigendom behouden blijven. Werkt ook zonder GNU-sed (`sed -i`).
  patch_path() {
    local target="$1" tmp
    tmp="$(mktemp)" || return 1
    if ! sed "s|/${old_name}|/${new_name}|g" "$target" > "$tmp"; then
      rm -f "$tmp"
      return 1
    fi
    cat "$tmp" > "$target"
    rm -f "$tmp"
  }

  # --- Controles vooraf ----------------------------------------------------
  if [[ ! -f "$repo_dir/package.json" || ! -f "$repo_dir/scripts/nuc-start.sh" ]]; then
    echo "Dit lijkt niet de iXperium-projectmap: $repo_dir" >&2
    return 1
  fi

  if [[ "$EUID" -eq 0 ]]; then
    echo "Draai dit NIET met sudo/als root: git en npm maken dan bestanden" >&2
    echo "aan die de kiosk-user niet meer kan schrijven." >&2
    return 1
  fi

  if [[ "$old_name" == "$new_name" ]]; then
    say "De map heet al '$new_name'; alleen de rest van de stappen volgt."
  elif [[ -e "$new_dir" ]]; then
    echo "Doel bestaat al: $new_dir — hernoem of verwijder dat eerst." >&2
    return 1
  fi

  say "Van : $repo_dir"
  say "Naar: $new_dir"
  [[ "$dry_run" == 1 ]] && say "DRY-RUN: er wordt niets gewijzigd."

  # --- 1. Kiosk stoppen ----------------------------------------------------
  say "Kiosk stoppen ..."
  # Eerst de herstart-loop, anders start die Chromium meteen weer op.
  run pkill -f nuc-start.sh
  run pkill -f "npm run dev"
  run pkill -f "vite.*3000"
  run pkill -f "chromium.*localhost:3000"
  sleep 1

  # --- 2. Map hernoemen ----------------------------------------------------
  if [[ "$old_name" != "$new_name" ]]; then
    say "Map hernoemen ..."
    if ! run mv "$repo_dir" "$new_dir"; then
      echo "Hernoemen mislukt." >&2
      return 1
    fi
  fi
  # In dry-run bestaat de nieuwe map niet; blijf dan in de oude werken.
  local work_dir="$new_dir"
  [[ ! -d "$work_dir" ]] && work_dir="$repo_dir"

  # --- 3. Laatste versie ophalen -------------------------------------------
  # `npm install` op de NUC herschrijft package-lock.json (andere npm-versie
  # voegt `peer`-markeringen toe en laat `libc`-velden weg). Dat zijn geen
  # echte wijzigingen en ze blokkeren wél de pull, dus die gooien we weg. De
  # lockfile uit git is dezelfde die hier gebruikt is; node_modules blijft
  # ongemoeid.
  local dirty lock_only=0
  dirty="$(git -C "$work_dir" status --porcelain 2>/dev/null)"
  if [[ "$dirty" == ' M package-lock.json' || "$dirty" == 'M  package-lock.json' ]]; then
    lock_only=1
    say "package-lock.json is lokaal gewijzigd door npm; terugzetten ..."
    run git -C "$work_dir" checkout -- package-lock.json
    dirty=''
  fi

  if [[ -n "$dirty" && "$lock_only" == 0 ]]; then
    say "LET OP: er staan lokale wijzigingen in de map; 'git pull' overgeslagen."
    say "        Handmatig: cd '$work_dir' && git status"
  elif ! git -C "$work_dir" remote get-url origin >/dev/null 2>&1; then
    say "Geen 'origin' remote gevonden; 'git pull' overgeslagen."
  else
    say "git pull ..."
    run git -C "$work_dir" pull --ff-only
  fi

  # --- 4. Vite-cache met absolute paden weggooien ---------------------------
  if [[ -d "$work_dir/node_modules/.vite" ]]; then
    say "node_modules/.vite verwijderen ..."
    run rm -rf "$work_dir/node_modules/.vite"
  fi

  # --- 5. Autostart / systemd bijwerken ------------------------------------
  say "Autostart- en systemd-bestanden nakijken ..."
  local search_dirs=(
    "$HOME/.config/autostart"
    "$HOME/.config/systemd/user"
    "$HOME/.local/share/applications"
    /etc/xdg/autostart
    /etc/systemd/system
  )
  local existing_dirs=()
  local dir
  for dir in "${search_dirs[@]}"; do
    [[ -d "$dir" ]] && existing_dirs+=("$dir")
  done

  local hits=() file
  if [[ ${#existing_dirs[@]} -gt 0 ]]; then
    while IFS= read -r file; do
      [[ -n "$file" ]] && hits+=("$file")
    done < <(grep -rl --fixed-strings "/${old_name}" "${existing_dirs[@]}" 2>/dev/null)
  fi

  local user_reload=0 root_reload=0 manual=()
  if [[ ${#hits[@]} -eq 0 ]]; then
    say "Geen verwijzingen naar '/${old_name}' gevonden."
    say "Controleer zelf of de autostart naar het script verwijst:"
    say "  ${work_dir}/scripts/nuc-start.sh"
  else
    for file in "${hits[@]}"; do
      if [[ -w "$file" ]]; then
        say "Bijwerken: $file (backup: ${file}.bak)"
        run cp "$file" "${file}.bak"
        run patch_path "$file"
        [[ "$file" == "$HOME/.config/systemd/user/"* ]] && user_reload=1
      else
        manual+=("$file")
        [[ "$file" == /etc/systemd/system/* ]] && root_reload=1
      fi
    done
  fi

  if [[ "$user_reload" == 1 ]]; then
    say "systemctl --user daemon-reload ..."
    run systemctl --user daemon-reload
  fi

  # --- Samenvatting --------------------------------------------------------
  echo
  say "Klaar."
  if [[ ${#manual[@]} -gt 0 ]]; then
    echo
    say "Deze bestanden zijn niet van jou; pas ze met sudo aan:"
    for file in "${manual[@]}"; do
      echo "  sudo sed -i 's|/${old_name}|/${new_name}|g' '$file'"
    done
    [[ "$root_reload" == 1 ]] && echo "  sudo systemctl daemon-reload"
  fi
  echo
  say "Testen:"
  echo "  ${work_dir}/scripts/nuc-start.sh"
  say "Werkt dat, reboot dan om de autostart te controleren."
  if [[ "$old_name" != "$new_name" && "$dry_run" != 1 ]]; then
    echo
    say "Je staat nu in een map die niet meer bestaat. Doe eerst:"
    echo "  cd '$work_dir'"
  fi
}

main "$@"
