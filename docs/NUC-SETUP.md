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

> Voor de NUC-kiosk is er een kant-en-klaar startup-script:
> `scripts/nuc-start.sh` (dev-servers + Chromium-kiosk met GPU-vlaggen +
> poort-check + herstart-loop). Laat de autostart/systemd-unit dát script
> aanroepen i.p.v. een eigen kopie. Staat het pad van de repo ergens anders
> dan `/home/kiosk/iXperium-planet-concept`, pas dan `REPO=` bovenin aan.

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

## Tweede pc: het etalage-scherm (index2.html)

De etalage-pc (user `ixperium-etalage`) draait **geen servers**. Hij laadt
alleen `index2.html` van de tafel-pc; die pagina legt zelf de
websocket-verbinding aan naar poort **3001 van dezelfde host** waarvan hij is
geladen.

`scripts/etalage-start.sh` is één zelfstandig bestand: kopieer het naar de
etalage-pc, maak het uitvoerbaar en start het. De repo hoeft daar niet te
staan en er is niets te configureren — het script zoekt de tafel-pc zelf op
het netwerk.

```bash
# Vanaf de Mac (of via een USB-stick):
scp scripts/etalage-start.sh ixperium-etalage@<etalage-ip>:/home/ixperium-etalage/

# Op de etalage-pc:
chmod +x ~/etalage-start.sh
~/etalage-start.sh
```

Weet je het IP van de tafel-pc en wil je niet laten zoeken:

```bash
~/etalage-start.sh 192.168.1.50        # of: TABLE_HOST=192.168.1.50 ~/etalage-start.sh
```

Poorten zijn te overriden met `HTTP_PORT`/`SOCKET_PORT`.

Wat het script doet:

- zoekt de tafel-pc in deze volgorde: expliciet opgegeven host → laatst
  gebruikte host (gecached in `~/.cache/ixperium-etalage-host`) → bekende
  hostnamen → parallelle scan van het eigen `/24`-subnet (~5s). Een gevonden
  host wordt gecontroleerd op de `<title>` van `index2.html`, dus een andere
  webserver op poort 3000 wordt niet per ongeluk gebruikt;
- blijft **onbeperkt** zoeken/wachten, zodat de etalage-pc gewoon eerder mag
  opstarten dan de tafel;
- wacht daarna maximaal ~30s op poort 3001 en start anders alsnog — socket.io
  in de pagina blijft zelf oneindig opnieuw verbinden;
- start Chromium in kiosk-modus met dezelfde GPU-vlaggen als
  `scripts/nuc-chromium.sh` (het script is self-contained);
- zet schermbeveiliging/DPMS uit (X11; op Wayland doe je dat via
  Instellingen → Energie) en verbergt de cursor als `unclutter` is
  geïnstalleerd;
- herstart Chromium automatisch als het proces afsluit of crasht, en zoekt dan
  opnieuw — een gewijzigd IP van de tafel-pc wordt dus zelf opgelost.

Autostart als user `ixperium-etalage`:

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/ixperium-etalage.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=iXperium etalage kiosk
Exec=/home/ixperium-etalage/etalage-start.sh
X-GNOME-Autostart-enabled=true
EOF
```

Werkt het scherm niet? Test eerst vanaf de etalage-pc of de tafel bereikbaar
is: `curl -I http://<tafel-ip>:3000/index2.html`. Faalt dat, dan blokkeert de
firewall of het netwerk de verbinding (de tafel bindt op `0.0.0.0`, dus dat is
niet de beperking).

## Overig

- Snap-Chromium (Ubuntu-standaard) accepteert deze vlaggen gewoon via de CLI.
- Voor een autostart/kiosk-unit: roep `scripts/nuc-chromium.sh` aan vanuit de
  bestaande systemd-service of autostart-entry i.p.v. `chromium` direct.
