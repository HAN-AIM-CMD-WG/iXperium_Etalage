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

Open op de NUC in Chromium: `chrome://gpu`

Kijk bovenaan bij **Graphics Feature Status**. Staat bij *Rasterization*,
*Canvas* of *Compositing* iets anders dan "Hardware accelerated"
(bv. "Software only. Hardware acceleration disabled") → dat is het probleem.

## Stap 2 — start Chromium via het meegeleverde script

```bash
./scripts/nuc-chromium.sh                  # dev, opent localhost:3000
KIOSK=1 ./scripts/nuc-chromium.sh <url>    # productie/kiosk fullscreen
```

Controleer daarna `chrome://gpu` opnieuw — nu hoort er overal
"Hardware accelerated" te staan. Test de tafel: het glitchen/knipperen bij
kleurwissels en terug-naar-overzicht hoort weg te zijn.

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
