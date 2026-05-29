# Tech Stack Regels

## Kern stack (te behouden)
- **Vite 6** als build tool
- **React 18** als UI shell (géén Next.js, géén Remix)
- **TypeScript strict** — alle nieuwe code heeft expliciete types, geen `any`
- **Tailwind 4** via `@tailwindcss/vite`
- **shadcn/ui** componenten in `src/app/components/ui/` (op basis van Radix)
- **Motion** (Framer Motion) voor UI-chrome transitions
- **Socket.IO** voor kiosk↔table sync

## Graphics stack (in te voeren)
- **three** + **@react-three/fiber** — primaire WebGL laag
- **@react-three/drei** — helpers (Stars, Sparkles, Html, Float, Trail, shaderMaterial)
- **@react-three/postprocessing** — Bloom, Vignette, ChromaticAberration, Noise, DepthOfField
- **maath** — math helpers voor particle distributions
- **leva** — dev-only GUI voor shader uniforms (`import { Leva, useControls } from 'leva'`)
- **stats.js** — fps overlay in dev
- **gsap** — voor complexe timeline-gedreven UI sequenties (naast Motion, niet als vervanging)

## Libraries die NIET gebruikt mogen worden voor nieuwe code
- `@mui/material` + `@mui/icons-material` — conflict met shadcn, gepland voor verwijdering
- `@emotion/react` + `@emotion/styled` — niet nodig zonder MUI
- `@popperjs/core` + `react-popper` — vervangen door Radix Popover
- `react-slick` — vervangen door embla-carousel
- Geen nieuwe CSS-in-JS libs; gebruik Tailwind utility classes of `src/styles/` CSS modules

## Import conventies
- Pad-alias `@/` verwijst naar `src/` (zie `vite.config.ts`)
- Absolute imports met `@/` de voorkeur boven diepe relatieve paden (`../../..`)
- Three.js imports altijd expliciet: `import { Mesh, ShaderMaterial } from 'three'` — nooit `import * as THREE`

## File conventies
- Componenten in `src/app/components/` (shared tussen surfaces)
- Scene componenten (R3F) in `src/app/components/scene/`
- Shaders los in `src/app/shaders/` met `.glsl`, `.vert`, `.frag` extensies
- Hooks in `src/app/hooks/` (bijv. `useMomentum.ts`)
- Data in `src/app/data/` (bijv. `content.ts`)

## Toegestane extensies voor Vite raw imports
Alleen uitbreiden in `vite.config.ts` onder `assetsInclude`. Momenteel: `.svg`, `.csv`.
Toevoegen bij shader werk: `.glsl`, `.vert`, `.frag` (gebruik `vite-plugin-glsl` indien nodig).

## Dependency principes
- Voor elke nieuwe lib: weegt het visuele/functionele voordeel op tegen bundle-impact?
- Bij twijfel: eerst POC, dan pas afhankelijkheid toevoegen
- Bundle-analyze periodiek met `vite-bundle-visualizer`
