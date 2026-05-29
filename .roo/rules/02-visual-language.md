# Visual Language

## Altijd-beweging principe (hard vereist)
Geen enkele pixel mag langer dan 2 seconden volledig statisch zijn. Implementeer dit via:
- **Shader `u_time` uniform** op elke fragment shader, geüpdatet in `useFrame((_, delta) => { ref.current.uniforms.u_time.value += delta })`
- **Idle camera drift** — langzame noise-based orbit van de perspective camera (amplitude ~0.05 op x/y, duration 20–40 s)
- **Breathing scale** op idle UI elementen (amplitude 1–2%, cyclus 4–6 s, linear easing)
- **Parallax layers** — achtergrondsterren bewegen trager dan voorgrond planets (factor 0.2–0.5)

## Kleurprincipes
- Themes uit `src/app/components/AnimatedBackground.tsx` (`main`, `ai`, `xr`, `twin`, `rapid`) zijn de bron van waarheid voor palettes
- Kleuren die naar bloom post-fx gaan mogen **HDR** zijn (RGB componenten > 1.0) — dat is waar de gloed écht vandaan komt
- Gradients via shader `mix()` functie, niet via CSS `linear-gradient` (CSS gradients zijn een compositor-tax)
- Nooit platte `#000000` backgrounds — altijd een zeer donkere base-color (`#050208` stijl) met subtiele ruis/nebula

## Motion / easing palette
Alle easings uit één centrale file. Geen inline magic numbers. Voorbeeld contract:

```ts
// src/app/motion/easing.ts
export const ease = {
  flashy: [0.34, 1.56, 0.64, 1] as const,  // overshoot entry
  snap:   [0.22, 1, 0.36, 1] as const,     // crisp quick exit
  soft:   [0.4, 0, 0.2, 1] as const,       // material-style
  linear: [0, 0, 1, 1] as const,           // continue loops
} as const
```

### Wanneer welke easing
- **Entry animaties**: `ease.flashy` — overshoot geeft speelse, aandacht-grijpende feel
- **Exit animaties**: `ease.snap` — snelle afronding, blokkeer UI niet
- **Hover / tap feedback**: `ease.soft` — natuurlijke terugveer
- **Continue loops** (float, orbit, shader time): `ease.linear` — nooit easeInOut op continue animatie want dat pulseert vermoeiend

## Typografie
- Headings en planet-labels altijd op een `motion.div` of `Html drei` met subtiele float (±2px y, 4s cyclus)
- Geen platte text-shadow; gebruik `drop-shadow` filter met kleur-matched glow uit het active theme
- Tekst in 3D scene gaat via `<Html transform>` van drei — nooit textures-as-text renderen (blurry op verschillende DPIs)

## Scene compositie
- Elk scherm heeft minstens **drie bewegende lagen**: achtergrond (parallax sterren/nebula), midground (planets), foreground (particles/sparkles/post-fx grain)
- **Depth of field** optioneel maar krachtig: focus ligt op geselecteerde planet, achtergrond wazig
- **Vignet** is altijd aan (subtiel, alpha ~0.3) — trekt het oog naar het midden

## UI chrome
- Shadcn UI componenten mogen hun default esthetiek behouden voor niet-spectaculaire onderdelen (forms, tables)
- Navigatie-elementen (planet-select, back-button) krijgen ALTIJD:
  - Idle breathing animation
  - Glow matched aan huidig theme kleur
  - Touch feedback met scale + glow-puls
