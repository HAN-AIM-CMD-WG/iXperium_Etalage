# NUC-setup: glitchende/knipperende animaties oplossen

De tafel-animaties glitchen, knipperen en stotteren op de Ubuntu NUC maar niet
op de Mac. De oorzaak is (vrijwel zeker) dat Chromium op de NUC **zonder
GPU-versnelling** draait en alles op de CPU rastert.

**Bewijs (gemeten met identieke code op dezelfde machine):**

| | GPU-versnelling aan | GPU-versnelling uit |
|---|---|---|
| Idle hoofdscherm | vloeiend (~60+ fps) | **6–10 fps** |
| Route kiezen / terug | ~2 gedropte frames | frames tot 160 ms, knipperen |

Geen enkele code-optimalisatie lost een 6 fps-vloer op — de GPU moet aan.

## Stap 1 — controleer de huidige status

Kiosk-modus heeft geen adresbalk; open `chrome://gpu` zo:

1. Toetsenbord aan de NUC → terminal openen met `Ctrl+Alt+T`
   (wisselen tussen kiosk en terminal: `Alt+Tab`).
2. Terwijl de kiosk draait:

   ```bash
   chromium chrome://gpu
   ```

   Dit opent een venster **in het al draaiende kiosk-proces** en toont dus de
   echte, live status van de kiosk zelf. Sluiten na afloop: `Alt+F4`/`Ctrl+W`.

   > Let op: nieuwe vlaggen meegeven aan een tweede `chromium`-aanroep heeft
   > géén effect zolang het proces al draait — voor een test mét vlaggen heb
   > je een apart profiel nodig (zie stap 2) of herstart je de kiosk.

   Plan B zonder terminal: zet in het startup-script tijdelijk de URL op
   `chrome://gpu`, herstart, lees af, zet terug.

Kijk bovenaan bij **Graphics Feature Status**. Staat bij *Rasterization*,
*Canvas* of *Compositing* iets anders dan "Hardware accelerated"
(bv. "Software only. Hardware acceleration disabled") → dat is het probleem.
Rapport delen: knop "Copy Report to Clipboard" bovenaan de pagina.

## Stap 2 — start Chromium via het meegeleverde script

```bash
./scripts/nuc-chromium.sh                  # dev, opent localhost:3000
KIOSK=1 ./scripts/nuc-chromium.sh <url>    # productie/kiosk fullscreen
```

> In het bestaande startup-script: vervang de kale `chromium ... --kiosk <url>`
> aanroep door `KIOSK=1 /pad/naar/repo/scripts/nuc-chromium.sh <url>`.

Eerst los testen of de vlaggen effect hebben, zónder de kiosk te stoppen
(apart profiel, want vlaggen op een al draaiend proces worden genegeerd;
gebruik `$HOME`, niet `/tmp` — snap-Chromium mag niet in `/tmp` schrijven):

```bash
chromium --user-data-dir="$HOME/gpu-check" \
  --ignore-gpu-blocklist --enable-gpu-rasterization \
  --enable-zero-copy --enable-native-gpu-memory-buffers \
  --ozone-platform-hint=auto chrome://gpu
```

Controleer `chrome://gpu` — nu hoort er overal "Hardware accelerated" te
staan. Test daarna de tafel: het glitchen/knipperen bij kleurwissels en
terug-naar-overzicht hoort weg te zijn.

## Stap 3 — staat er nog steeds "Software only"?

Dan blokkeert het OS-niveau de GPU (niet Chromium). Controleer:

```bash
sudo apt install -y mesa-utils
glxinfo -B | grep -i "renderer"
```

- Toont dit `llvmpipe` → de Intel-driver (i915) is niet actief; Mesa/kernel
  updaten: `sudo apt update && sudo apt upgrade`, daarna herstarten.
- Toont dit wel een Intel-GPU maar blijft Chromium op software staan →
  probeer een X11-sessie i.p.v. Wayland (of andersom) via het
  tandwiel-icoon op het Ubuntu-loginscherm.

## Overig

- Snap-Chromium (Ubuntu-standaard) accepteert deze vlaggen gewoon via de CLI.
- Voor een autostart/kiosk-unit: roep `scripts/nuc-chromium.sh` aan vanuit de
  bestaande systemd-service of autostart-entry i.p.v. `chromium` direct.
