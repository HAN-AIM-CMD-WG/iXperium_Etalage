# Performance — Harde Regels

## Frame budget (niet onderhandelbaar)
- **Target minimum**: 16.67 ms per frame = 60 fps
- **Streven**: 8.33 ms per frame = 120 fps
- **Dev check**: Stats.js overlay altijd zichtbaar in dev, Chrome Performance tab gebruikt voor profiling van verdachte componenten
- Bij elke nieuwe feature: kort frametime-budget opschrijven in de PR omschrijving ("kost ~0.8ms in worst case")

## Verboden patronen
- ❌ `filter: blur()` op méér dan 4 gelijktijdig gemonteerde DOM elementen
- ❌ `mix-blend-mode` in combinatie met looped motion animaties op veel nodes (compositor-tax)
- ❌ Inline style objects die elke render opnieuw worden gecreëerd in `motion.*` componenten zonder `useMemo`
- ❌ `setInterval` / `setTimeout` voor animaties — altijd `requestAnimationFrame` of `useFrame` (R3F) of `gsap.ticker`
- ❌ `document.querySelector` / direct DOM manipulatie binnen React renders
- ❌ Nieuwe `Date.now()` calls in render-hot paths — gebruik `delta` uit useFrame of `performance.now()` met caching
- ❌ Niet-disposede Three.js geometries / materials / textures (geheugenlek!)
- ❌ Re-rendering van hele scene bij state verandering die alleen één child raakt (controleer met React DevTools Profiler)

## Verplichte patronen
- ✅ Shader uniforms via `useFrame((_, delta) => { ref.current.uniforms.u_time.value += delta })`
- ✅ `InstancedMesh` voor > 20 identieke meshes (bijv. veel sterren of planets)
- ✅ `useMemo` rond geometries / materials, of module-scope constants als ze nooit veranderen
- ✅ Cleanup in `useEffect` return: `geometry.dispose(); material.dispose(); texture.dispose()`
- ✅ `React.memo` met custom comparator voor componenten die in lijsten worden gerenderd (zie bestaande `Planet.tsx`)
- ✅ `will-change: transform` alleen op daadwerkelijk animerende elementen (niet op alles)
- ✅ Throttle network sync events (Socket.IO) — stuur maximaal 60 Hz, niet per pointermove

## DOM vs WebGL beslisboom
Gebruik **WebGL (R3F)** voor:
- Alles wat visueel is en > 3 instanties heeft (sterren, particles, orbit-planets)
- Shader-gedreven effecten (nebula, glow, distortion)
- Bewegende content op full-screen schaal
- Hoog-frequente animaties (> 2 fps visuele update)

Gebruik **DOM (React + motion)** voor:
- UI chrome (navigation, content sheets, buttons)
- Tekst-zware content views
- Formulieren en interactieve controls
- Overlay dialogs / tooltips

## Bundle & load
- Lazy-load zware scenes via `React.lazy` + `Suspense`
- Code-split per surface (table vs kiosk) — al geconfigureerd in `vite.config.ts`
- Check bundle-size na elke nieuwe dep: `npx vite-bundle-visualizer`
- Textures comprimeren (KTX2 via `basis_universal` indien meer dan 2MB aan texture data)

## Device targets
- **Primair**: moderne integrated GPU (Intel Iris Xe / Apple M-series)
- **Secundair**: dedicated GPU (NVIDIA RTX 3060 niveau)
- **Test altijd** op de kiosk-hardware voor een PR merged wordt (niet alleen op dev laptop)
