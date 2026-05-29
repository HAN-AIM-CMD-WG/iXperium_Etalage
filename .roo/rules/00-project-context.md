# Project Context — iXperium Planet Concept

## Wat is dit?
Een dual-surface interactieve installatie voor het iXperium (HAN). Bezoekers verkennen een "universum" van iXperium-thema's via een **touch-table** (horizontaal) en een **kiosk-scherm** (verticaal). Beide schermen draaien hetzelfde React project, maar tonen verschillende views die realtime gesynchroniseerd zijn via een Node/Socket.IO server.

## Kernconcept
Elk thema is een "planet" in een solar-system metafoor. De centrale planeet is het huidige thema; eromheen cirkelen sub-topics. Gebruikers navigeren door planeten te selecteren waarna de scene transitiest naar de volgende laag.

## Surfaces
- **Table** (`src/table/`, `index.html`) — horizontale touch-table, primaire interactie
- **Kiosk** (`src/kiosk/`, `index2.html`) — verticaal scherm, toont contextueel content gekoppeld aan de huidige tableselectie
- **Server** (`server/index.ts`) — Socket.IO hub die state tussen de surfaces sync't
- **Shared** (`src/shared/`) — protocol, types, hooks die beide surfaces delen

## Visie (niet onderhandelbaar)
**Graphics zijn een kernfeature, geen decoratie.** De applicatie moet altijd:
- Smooth draaien (60 fps minimum, 120 fps streven)
- Visueel indrukwekkend zijn (shader-driven, post-processed)
- Continu in beweging zijn (geen statische schermen)

## Doelgroep context
Publieke installatie — moet op first sight de aandacht grijpen. Bezoekers blijven kort staan; het visuele effect moet dus direct landen, niet pas na 10 seconden opbouwen.

## Huidige staat (snapshot)
- React 18 + Vite 6 + TypeScript shell ✅
- Tailwind 4 + shadcn/ui voor UI chrome ✅
- Motion (Framer Motion) voor DOM animaties ✅ (wordt aangevuld, niet vervangen)
- Socket.IO sync tussen surfaces ✅
- DOM-gebaseerde achtergrond animaties in `AnimatedBackground.tsx` ⚠️ wordt vervangen door WebGL
- Geen WebGL/3D nog — wordt toegevoegd via React Three Fiber
