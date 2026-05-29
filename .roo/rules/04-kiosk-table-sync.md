# Kiosk ↔ Table Sync

## Architectuur
- **Server** (`server/index.ts`) draait als Socket.IO hub op poort 3001 (configureerbaar via `VITE_SOCKET_URL`)
- **Table** surface publiceert navigatie-intenties (`navigation:set`, `navigation:reset`)
- **Kiosk** surface consumeert snapshots en rendert contextueel
- Beide surfaces kunnen publishen; de server bepaalt de canonical state met een `serverSeq` counter

## Protocol bron
Alle event types in [`src/shared/protocol.ts`](src/shared/protocol.ts:1). Hook voor React in [`src/shared/useNavigationSocket.ts`](src/shared/useNavigationSocket.ts:32).

## Huidige events (versie 1)
| Event | Richting | Payload |
|-------|----------|---------|
| `client:hello` | C → S | `{ role, displayName?, version }` |
| `navigation:set` | C → S → C | `{ level, mainId?, subId?, theme?, seq, sentAt }` |
| `navigation:reset` | C → S → C | `{ seq, sentAt }` |
| `state:snapshot` | S → C | `{ state, serverSeq, updatedAt, clients }` |
| `connection:status` | S → C | `{ connected, health, clients, serverTime }` |

## Regels voor uitbreiding protocol
- **Versie bump** (`PROTOCOL_VERSION`) bij elke breaking change — oude clients moeten gracefully degraderen
- **Backwards compatible velden** toevoegen altijd als `optional` (`field?: type`)
- **Type guards** voor elk nieuw event (zie `isNavigationSetEvent` als voorbeeld)
- **Seq counter** semantiek behouden: hogere seq = nieuwer, ties breaken op `sentAt`

## Throttling regels
- Frequente events (mousemove, camera pose, shader state) **moeten** throttled: max 30 Hz over de wire
- Gebruik `requestAnimationFrame` gecombineerd met een dirty flag, niet `setInterval`
- Per-frame sync (60+ Hz) is **niet** toegestaan — alleen lokaal via `useFrame`

## Graphics state sync (toekomstig)
Voor geplande `cameraState` / `selectedPlanetId` sync:
- Server houdt alleen de **intent** bij (welke planet is geselecteerd), niet per-frame camera matrix
- Kiosk en table interpoleren zelf lokaal naar de target (via maath `damp` of gsap) — dat voorkomt jitter
- Nieuw event: `scene:focus { planetId, mode: 'zoom'|'reset', serverSeq, updatedAt }`

## Offline / fallback gedrag
- Zonder serververbinding draaien beide surfaces standalone met `INITIAL_NAVIGATION_STATE`
- Visuele feedback bij `health: 'reconnecting'` (subtiele UI indicator, geen full-screen error)
- Animaties blijven draaien ongeacht connection status — de visuele layer mag NOOIT bevriezen door socket issues
