import { motion } from 'motion/react';
import { memo, useCallback, useId, useMemo, useRef, useState } from 'react';
import { ease } from '../motion/easing';

interface KurzgesagtBackdropProps {
  theme: string;
  surface: 'table' | 'kiosk';
  centralPlanetColor?: string;
  showCentralPlanet?: boolean;
}

/**
 * Kurzgesagt-stijl palette, nu opgebouwd rondom geometrische elementen
 * (ringen, rounded bars, circles) in plaats van organische blobs.
 *
 * Design-referenties:
 *  - `zooi/Image.png`  — galactisch schijf van concentrische tilted ringen
 *  - `zooi/kurzgesagt-h8qhvdk77skc9t17.webp` — planeten met rounded bar-stripes
 *  - YouTube: Kurzgesagt black-hole video (ZL4yYHdDSWs) — solid + dotted rings mix
 *
 * Elke kleur-sleutel wordt in `motion.animate` props ingevuld zodat thema-
 * overgangen soepel crossfaden (~1.8s ease.soft).
 */
interface VectorPalette {
  background: string;
  backgroundDeep: string;
  ink: string;
  cream: string;
  // Galactic disk ringen
  ringSolid: string;
  ringDotted: string;
  ringAccent: string;
  ringGlow: string;
  // Cloud nebulae
  capsuleBase: string;
  capsuleAccent: string;
  capsuleHighlight: string;
  capsuleCore: string;
  // Moons + central planet
  moonPrimary: string;
  moonSecondary: string;
  moonAccent: string;
  planet: string;
  planetRing: string;
  planetBandCool: string;
  planetBandWarm: string;
  planetBandPink: string;
  // Sterren
  starWhite: string;
  starWarm: string;
  starCool: string;
}

const palettes: Record<string, VectorPalette> = {
  main: {
    background: '#1A0D4A',
    backgroundDeep: '#07032A',
    ink: '#05021A',
    cream: '#FFF2B8',
    ringSolid: '#5A2BE0',
    ringDotted: '#B8A0FF',
    ringAccent: '#E033A8',
    ringGlow: '#5BE0FF',
    capsuleBase: '#5A2BE0',
    capsuleAccent: '#E033A8',
    capsuleHighlight: '#5BE0FF',
    capsuleCore: '#FFF0FA',
    moonPrimary: '#FFF2B8',
    moonSecondary: '#25F4D0',
    moonAccent: '#FF5A1F',
    planet: '#8B4DFF',
    planetRing: '#FFF2B8',
    planetBandCool: '#00C9FF',
    planetBandWarm: '#FFB000',
    planetBandPink: '#FF3B9D',
    starWhite: '#FFFFFF',
    starWarm: '#FFE58A',
    starCool: '#6FE8FF',
  },
  ai: {
    background: '#3A0A22',
    backgroundDeep: '#15021A',
    ink: '#180308',
    cream: '#FFF2B8',
    ringSolid: '#D92141',
    ringDotted: '#FFB85A',
    ringAccent: '#FF7A00',
    ringGlow: '#FFD000',
    capsuleBase: '#D92141',
    capsuleAccent: '#FF7A00',
    capsuleHighlight: '#FFD000',
    capsuleCore: '#FFF4C2',
    moonPrimary: '#FFD480',
    moonSecondary: '#2BFFB6',
    moonAccent: '#FF2D2D',
    planet: '#FF3B2F',
    planetRing: '#FFF2B8',
    planetBandCool: '#00D9FF',
    planetBandWarm: '#FFB000',
    planetBandPink: '#FF3B9D',
    starWhite: '#FFF6DA',
    starWarm: '#FFB26B',
    starCool: '#FF8AE0',
  },
  xr: {
    background: '#2A0E4A',
    backgroundDeep: '#120322',
    ink: '#0E0220',
    cream: '#FFF2B8',
    ringSolid: '#8E3BC9',
    ringDotted: '#D9B8FF',
    ringAccent: '#C24BFF',
    ringGlow: '#B96BFF',
    capsuleBase: '#8E3BC9',
    capsuleAccent: '#C24BFF',
    capsuleHighlight: '#D9A8FF',
    capsuleCore: '#F4E6FF',
    moonPrimary: '#FFE27A',
    moonSecondary: '#B36AFF',
    moonAccent: '#FF6A00',
    planet: '#8E44C9',
    planetRing: '#FFF2B8',
    planetBandCool: '#00D9FF',
    planetBandWarm: '#FFD400',
    planetBandPink: '#D84CFF',
    starWhite: '#FFFFFF',
    starWarm: '#FFE27A',
    starCool: '#B98CFF',
  },
  twin: {
    background: '#0A1044',
    backgroundDeep: '#02062A',
    ink: '#01051F',
    cream: '#FFF2B8',
    ringSolid: '#2A6AE6',
    ringDotted: '#B8D4FF',
    ringAccent: '#58B4FF',
    ringGlow: '#B8E6FF',
    capsuleBase: '#2A6AE6',
    capsuleAccent: '#58B4FF',
    capsuleHighlight: '#B8E6FF',
    capsuleCore: '#F0FAFF',
    moonPrimary: '#FFF2B8',
    moonSecondary: '#7DE2FF',
    moonAccent: '#FF6B2C',
    planet: '#15B8FF',
    planetRing: '#FFF2B8',
    planetBandCool: '#00D9FF',
    planetBandWarm: '#FFD000',
    planetBandPink: '#FF3BCE',
    starWhite: '#FFFFFF',
    starWarm: '#FFF0B0',
    starCool: '#7DE2FF',
  },
  rapid: {
    background: '#2A0A66',
    backgroundDeep: '#0E0430',
    ink: '#100438',
    cream: '#FFF2B8',
    ringSolid: '#7B3BFF',
    ringDotted: '#FFD280',
    ringAccent: '#FFC41A',
    ringGlow: '#FF6BCB',
    capsuleBase: '#7B3BFF',
    capsuleAccent: '#FFC41A',
    capsuleHighlight: '#FF6BCB',
    capsuleCore: '#FFF2C2',
    moonPrimary: '#FFE58A',
    moonSecondary: '#32FFBE',
    moonAccent: '#FF8A00',
    planet: '#FFD400',
    planetRing: '#FFF2B8',
    planetBandCool: '#00D9FF',
    planetBandWarm: '#FF8A00',
    planetBandPink: '#FF4BB8',
    starWhite: '#FFFFFF',
    starWarm: '#FFDA7B',
    starCool: '#D48CFF',
  },
  robotics: {
    background: '#240036',
    backgroundDeep: '#070014',
    ink: '#090018',
    cream: '#FFF2B8',
    ringSolid: '#FF2AD4',
    ringDotted: '#B8FFF6',
    ringAccent: '#00F5FF',
    ringGlow: '#C7FF2E',
    capsuleBase: '#FF2AD4',
    capsuleAccent: '#00F5FF',
    capsuleHighlight: '#9D4DFF',
    capsuleCore: '#F3FFF8',
    moonPrimary: '#B8FFF6',
    moonSecondary: '#FF2AD4',
    moonAccent: '#C7FF2E',
    planet: '#FF2AD4',
    planetRing: '#FFF2B8',
    planetBandCool: '#00F5FF',
    planetBandWarm: '#C7FF2E',
    planetBandPink: '#9D4DFF',
    starWhite: '#FFFFFF',
    starWarm: '#C7FF2E',
    starCool: '#69F7FF',
  },
};

function getPalette(theme: string) {
  return palettes[theme] ?? palettes.main;
}

// Kant-en-klare motion transition voor elke palette crossfade.
// Lang genoeg dat het zichtbaar is, kort genoeg om snel te voelen.
const COLOR_TRANSITION = { duration: 1.8, ease: ease.soft } as const;
const ORBIT_RING_ROTATION_DEG = -20;

/* ---------------- Theme crossfade stack ---------------- */

interface CrossfadeEntry {
  theme: string;
  serial: number;
}

/**
 * Crossfade tussen statische, per-theme gerenderde lagen.
 *
 * Voorheen animeerden grote vlakken (full-screen gradients, de 1800px
 * disk-SVG, nebula-fills) hun kleur per frame via motion/CSS-transitions.
 * Elke geanimeerde kleurstap = style recalc + volledige repaint van die laag,
 * 60×/s gedurende de hele 1.8s transitie — en omdat het thema tijdens het
 * draaien continu wisselt was dit een quasi-permanente paint-belasting.
 *
 * Nu wordt elke laag per theme één keer gerasterd en faden we de nieuwe laag
 * met `opacity` (GPU-composited, geen repaint) over de oude heen. Eindbeeld is
 * identiek; halverwege is het een crossfade i.p.v. kleur-interpolatie — bij
 * exact overlappende geometrie visueel gelijkwaardig.
 *
 * Bij snelle opeenvolgende wissels stapelen maximaal 3 lagen; zodra de
 * bovenste volledig dekt worden onderliggende lagen opgeruimd.
 */
function ThemeCrossfadeStack({
  themeKey,
  className,
  style,
  renderLayer,
}: {
  themeKey: string;
  className?: string;
  style?: React.CSSProperties;
  renderLayer: (theme: string) => React.ReactNode;
}) {
  const [stack, setStack] = useState<CrossfadeEntry[]>(() => [{ theme: themeKey, serial: 0 }]);
  const serialRef = useRef(0);

  // Render-phase update: nieuwe theme-laag direct in deze render meenemen
  // zodat er geen frame met verouderde kleuren commit.
  let layers = stack;
  if (stack[stack.length - 1].theme !== themeKey) {
    serialRef.current += 1;
    layers = [...stack.slice(-2), { theme: themeKey, serial: serialRef.current }];
    setStack(layers);
  }

  const handleLayerSettled = useCallback((serial: number) => {
    // Laag `serial` dekt nu volledig — alles eronder is onzichtbaar en mag weg.
    setStack((current) => {
      const index = current.findIndex((entry) => entry.serial === serial);
      return index > 0 ? current.slice(index) : current;
    });
  }, []);

  return (
    <div className={className} style={style}>
      {layers.map((entry) => (
        <motion.div
          key={entry.serial}
          className="absolute inset-0"
          initial={entry.serial === 0 ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={COLOR_TRANSITION}
          onAnimationComplete={() => handleLayerSettled(entry.serial)}
        >
          {renderLayer(entry.theme)}
        </motion.div>
      ))}
    </div>
  );
}

/* ---------------- Galactic Disk ---------------- */

/**
 * Ring-configuratie: elk item rendert één concentrische ellipse.
 * `rBase` is de basis-radius factor (verhoudingsgewijs t.o.v. disk-grootte).
 * `ratio` is de y/x ratio (bepaalt hoe plat de ellips is — kantelperspectief).
 * `style` bepaalt stroke-dasharray.
 */
interface DiskRingConfig {
  rBase: number;
  ratio: number;
  width: number;
  style: 'solid' | 'dotted' | 'dashed' | 'fine-dotted';
  colorKey: 'ringSolid' | 'ringDotted' | 'ringAccent' | 'ringGlow';
  opacity: number;
}

const DISK_RINGS: DiskRingConfig[] = [
  { rBase: 0.22, ratio: 0.28, width: 14, style: 'solid', colorKey: 'ringSolid', opacity: 0.55 },
  { rBase: 0.34, ratio: 0.3, width: 6, style: 'fine-dotted', colorKey: 'ringGlow', opacity: 0.85 },
  { rBase: 0.48, ratio: 0.32, width: 22, style: 'solid', colorKey: 'ringAccent', opacity: 0.4 },
  { rBase: 0.6, ratio: 0.33, width: 4, style: 'dashed', colorKey: 'ringDotted', opacity: 0.55 },
  { rBase: 0.74, ratio: 0.34, width: 16, style: 'solid', colorKey: 'ringSolid', opacity: 0.3 },
  { rBase: 0.88, ratio: 0.35, width: 8, style: 'fine-dotted', colorKey: 'ringGlow', opacity: 0.5 },
  { rBase: 1.04, ratio: 0.36, width: 3, style: 'dashed', colorKey: 'ringDotted', opacity: 0.35 },
];

function dashFor(style: DiskRingConfig['style'], width: number): string | undefined {
  switch (style) {
    case 'solid':
      return undefined;
    case 'dotted':
      return `${width * 0.4} ${width * 2.2}`;
    case 'fine-dotted':
      return `${width * 0.25} ${width * 2.8}`;
    case 'dashed':
      return `${width * 5} ${width * 4}`;
  }
}

/**
 * Pre-berekende dot-posities voor "ster-bezaaide" ringen.
 * Per ring plaatsen we N dots op willekeurige hoeken langs de ellipse.
 * Seeded zodat posities stabiel zijn over renders.
 */
function generateRingDots(seed: number, rings: DiskRingConfig[]) {
  const dots: Array<{ angle: number; rBase: number; ratio: number; size: number; colorKind: 'white' | 'warm' | 'cool' | 'glow'; delay: number; duration: number }> = [];
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  rings.forEach((ring, ringIdx) => {
    const dotCount = 18 + Math.floor(rand() * 10);
    for (let i = 0; i < dotCount; i++) {
      dots.push({
        angle: rand() * Math.PI * 2,
        rBase: ring.rBase + (rand() - 0.5) * 0.02,
        ratio: ring.ratio,
        size: 2 + rand() * 3.5,
        colorKind: rand() > 0.7 ? (rand() > 0.5 ? 'warm' : 'cool') : rand() > 0.4 ? 'white' : 'glow',
        delay: rand() * 4,
        duration: 2 + rand() * 3,
      });
      // prevent unused var warning
      void ringIdx;
    }
  });
  return dots;
}

function diskDotColor(palette: VectorPalette, kind: 'white' | 'warm' | 'cool' | 'glow') {
  switch (kind) {
    case 'white': return palette.starWhite;
    case 'warm': return palette.starWarm;
    case 'cool': return palette.starCool;
    case 'glow': return palette.ringGlow;
  }
}

/**
 * Galactic disk — grote, vaste concentrische ringstructuur achter de planeet.
 * Elke ring is een tilted ellipse via dezelfde -20° orientatie als de orbit ring
 * (matcht ORBIT_ROTATION uit OrbitRing.tsx).
 *
 * Perf-opzet:
 * - Ringen + statische dots zitten in één SVG die per theme statisch is en via
 *   ThemeCrossfadeStack opacity-crossfade't. Geen per-frame stroke/fill
 *   animaties meer op de grote (1800px) SVG.
 * - De pulserende dots zijn losse DOM-divs: CSS transform/opacity animaties op
 *   HTML-elementen draaien op de compositor-thread, terwijl dezelfde animatie
 *   op SVG-children elke frame een re-raster van de hele SVG forceerde.
 */
function GalacticDisk({ themeKey, palette, diskSize, diskDots }: {
  themeKey: string;
  palette: VectorPalette;
  diskSize: number;
  diskDots: ReturnType<typeof generateRingDots>;
}) {
  const tiltRad = (ORBIT_RING_ROTATION_DEG * Math.PI) / 180;
  const tiltCos = Math.cos(tiltRad);
  const tiltSin = Math.sin(tiltRad);

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: '50%',
        top: '50%',
        width: diskSize,
        height: diskSize,
        marginLeft: -diskSize / 2,
        marginTop: -diskSize / 2,
      }}
    >
      <ThemeCrossfadeStack
        themeKey={themeKey}
        className="absolute inset-0"
        renderLayer={(layerTheme) => {
          const layerPalette = getPalette(layerTheme);
          return (
            <svg
              viewBox={`${-diskSize / 2} ${-diskSize / 2} ${diskSize} ${diskSize}`}
              width="100%"
              height="100%"
              style={{ overflow: 'visible' }}
            >
              {/* Kantelperspectief via g-transform — matcht orbit ring tilt */}
              <g transform={`rotate(${ORBIT_RING_ROTATION_DEG} 0 0)`}>
                {DISK_RINGS.map((ring, idx) => {
                  const rx = (diskSize / 2) * ring.rBase;
                  const ry = rx * ring.ratio;
                  const dash = dashFor(ring.style, ring.width);
                  return (
                    <ellipse
                      key={`ring-${idx}`}
                      cx={0}
                      cy={0}
                      rx={rx}
                      ry={ry}
                      fill="none"
                      strokeLinecap="round"
                      strokeWidth={ring.width}
                      strokeDasharray={dash}
                      stroke={layerPalette[ring.colorKey]}
                      opacity={ring.opacity}
                    />
                  );
                })}

                {/* Statische dots langs de ringen — "sterren in de disk".
                    Vaste mid-opacity ≈ gemiddelde van de pulse-keyframe zodat
                    het sterrenveld even dicht oogt als de pulserende subset. */}
                {diskDots.map((dot, idx) => {
                  if (idx % 3 === 0) return null;
                  const rx = (diskSize / 2) * dot.rBase;
                  const ry = rx * dot.ratio;
                  return (
                    <circle
                      key={`dot-${idx}`}
                      cx={rx * Math.cos(dot.angle)}
                      cy={ry * Math.sin(dot.angle)}
                      r={dot.size}
                      fill={diskDotColor(layerPalette, dot.colorKind)}
                      className="kurzgesagt-disk-dot--static"
                    />
                  );
                })}
              </g>
            </svg>
          );
        }}
      />

      {/* Pulserende dots — zelfde posities/dichtheid als voorheen (1/3 van het
          veld), maar als composited divs buiten de SVG. De -20° kanteling van
          de disk is in de positie verrekend. */}
      {diskDots.map((dot, idx) => {
        if (idx % 3 !== 0) return null;
        const rx = (diskSize / 2) * dot.rBase;
        const ry = rx * dot.ratio;
        const cx = rx * Math.cos(dot.angle);
        const cy = ry * Math.sin(dot.angle);
        const x = cx * tiltCos - cy * tiltSin;
        const y = cx * tiltSin + cy * tiltCos;
        return (
          <div
            key={`dot-${idx}`}
            className="kurzgesagt-disk-dot"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: dot.size * 2,
              height: dot.size * 2,
              marginLeft: x - dot.size,
              marginTop: y - dot.size,
              backgroundColor: diskDotColor(palette, dot.colorKind),
              animationDuration: `${dot.duration * 4}s`,
              animationDelay: `${dot.delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------------- Cloud Cluster Nebulae ---------------- */

type CapsuleColorKey = 'capsuleBase' | 'capsuleAccent' | 'capsuleHighlight' | 'capsuleCore';

type NebulaGradient = 'main' | 'cool';

type NebulaCloudShapeBase = {
  colorKey: CapsuleColorKey;
  opacity?: number;
  outline?: boolean;
  strokeWidth?: number;
  gradient?: NebulaGradient;
};

type NebulaCloudShape = NebulaCloudShapeBase &
  (
    | { type: 'path'; d: string }
    | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotate?: number }
    | { type: 'circle'; cx: number; cy: number; r: number }
    | { type: 'pill'; x: number; y: number; w: number; h: number; rotate?: number }
  );

/**
 * Geometrische wolk-nebulae opgebouwd uit overlappende puffs en vloeiende
 * vector-vlakken. Elke variant past in een 320x180 viewBox zodat ze
 * consistent schaalbaar blijven tijdens het doorlopende strippen.
 *
 * De variant per positie blijft bewust stabiel. Daardoor veranderen de vormen
 * niet abrupt wanneer het actieve thema wisselt en kan de browser de kleuren
 * zichtbaar animeren.
 */
const NEBULA_CLOUD_VARIANTS: NebulaCloudShape[][] = [
  // Variant A — brede, zachte wolk met heldere stream door het midden.
  [
    {
      type: 'path',
      d: 'M22 106 C25 78 52 57 82 58 C93 34 125 25 154 37 C170 18 205 18 224 43 C258 42 292 62 299 93 C309 135 269 155 224 146 C207 166 166 164 145 146 C115 158 75 150 66 126 C42 127 26 121 22 106 Z',
      colorKey: 'capsuleBase',
      gradient: 'main',
      outline: true,
    },
    { type: 'ellipse', cx: 96, cy: 86, rx: 57, ry: 40, colorKey: 'capsuleAccent', opacity: 0.68 },
    { type: 'ellipse', cx: 170, cy: 72, rx: 54, ry: 42, colorKey: 'capsuleHighlight', opacity: 0.52, rotate: -10 },
    { type: 'ellipse', cx: 230, cy: 103, rx: 52, ry: 34, colorKey: 'capsuleCore', opacity: 0.42, rotate: 14 },
    {
      type: 'path',
      d: 'M55 98 C88 80 133 77 178 86 C211 92 244 90 276 77 C262 104 229 119 185 119 C136 119 91 113 55 98 Z',
      colorKey: 'capsuleHighlight',
      opacity: 0.72,
    },
    { type: 'circle', cx: 122, cy: 55, r: 12, colorKey: 'capsuleCore', opacity: 0.58 },
    { type: 'circle', cx: 253, cy: 72, r: 9, colorKey: 'capsuleAccent', opacity: 0.72 },
    { type: 'pill', x: 86, y: 130, w: 74, h: 13, rotate: 2, colorKey: 'capsuleCore', opacity: 0.82 },
  ],
  // Variant B — compacte bubble-cloud met open voorrand.
  [
    {
      type: 'path',
      d: 'M58 126 C33 110 34 76 60 62 C63 34 94 20 121 34 C142 11 184 18 197 50 C230 44 259 61 266 91 C275 129 243 153 205 146 C186 164 148 161 132 137 C103 151 76 142 58 126 Z',
      colorKey: 'capsuleBase',
      gradient: 'cool',
      outline: true,
    },
    { type: 'ellipse', cx: 107, cy: 87, rx: 52, ry: 48, colorKey: 'capsuleAccent', opacity: 0.62 },
    { type: 'ellipse', cx: 170, cy: 74, rx: 39, ry: 46, colorKey: 'capsuleHighlight', opacity: 0.7, rotate: 18 },
    { type: 'circle', cx: 213, cy: 109, r: 29, colorKey: 'capsuleCore', opacity: 0.48 },
    { type: 'circle', cx: 86, cy: 108, r: 18, colorKey: 'capsuleHighlight', opacity: 0.58 },
    { type: 'pill', x: 137, y: 31, w: 58, h: 12, rotate: 7, colorKey: 'capsuleCore', opacity: 0.78 },
    { type: 'pill', x: 196, y: 134, w: 48, h: 11, rotate: -8, colorKey: 'capsuleAccent', opacity: 0.66 },
  ],
  // Variant C — gestroomlijnde komeetwolk.
  [
    {
      type: 'path',
      d: 'M17 102 C56 55 116 43 173 54 C208 61 238 50 292 31 C266 68 245 96 258 127 C206 118 177 132 139 147 C92 164 37 146 17 102 Z',
      colorKey: 'capsuleBase',
      gradient: 'main',
      outline: true,
    },
    { type: 'ellipse', cx: 104, cy: 98, rx: 68, ry: 40, colorKey: 'capsuleAccent', opacity: 0.58, rotate: -9 },
    { type: 'ellipse', cx: 179, cy: 90, rx: 58, ry: 34, colorKey: 'capsuleHighlight', opacity: 0.63, rotate: -13 },
    {
      type: 'path',
      d: 'M49 116 C98 88 150 82 211 92 C191 112 150 131 103 133 C80 134 61 128 49 116 Z',
      colorKey: 'capsuleCore',
      opacity: 0.62,
    },
    { type: 'circle', cx: 133, cy: 58, r: 13, colorKey: 'capsuleCore', opacity: 0.64 },
    { type: 'circle', cx: 228, cy: 56, r: 9, colorKey: 'capsuleAccent', opacity: 0.72 },
    { type: 'pill', x: 64, y: 48, w: 68, h: 12, rotate: -6, colorKey: 'capsuleHighlight', opacity: 0.82 },
  ],
  // Variant D — hoge poederwolk met meerdere puffs.
  [
    {
      type: 'path',
      d: 'M72 139 C40 126 39 92 65 74 C58 42 87 21 118 32 C133 10 171 10 187 35 C218 22 251 44 249 78 C279 93 275 134 245 145 C219 154 194 147 178 128 C151 153 108 156 89 132 C84 138 78 140 72 139 Z',
      colorKey: 'capsuleBase',
      gradient: 'cool',
      outline: true,
    },
    { type: 'ellipse', cx: 120, cy: 83, rx: 46, ry: 50, colorKey: 'capsuleAccent', opacity: 0.66, rotate: -15 },
    { type: 'ellipse', cx: 178, cy: 82, rx: 45, ry: 55, colorKey: 'capsuleHighlight', opacity: 0.62, rotate: 14 },
    { type: 'circle', cx: 213, cy: 111, r: 27, colorKey: 'capsuleCore', opacity: 0.44 },
    { type: 'circle', cx: 91, cy: 112, r: 20, colorKey: 'capsuleHighlight', opacity: 0.52 },
    { type: 'pill', x: 92, y: 145, w: 86, h: 12, rotate: -2, colorKey: 'capsuleCore', opacity: 0.78 },
    { type: 'pill', x: 177, y: 35, w: 52, h: 12, rotate: 8, colorKey: 'capsuleAccent', opacity: 0.62 },
  ],
];

/**
 * Rendert één cloud cluster als SVG. Vormen blijven stabiel; alleen fill,
 * stroke en gradient-stops wisselen met CSS-transitions mee met het palette.
 */
function NebulaCloud({
  variant,
  palette,
  size,
  flipX = false,
  rotate = 0,
  opacity = 1,
}: {
  variant: number;
  palette: VectorPalette;
  size: number;
  flipX?: boolean;
  rotate?: number;
  opacity?: number;
}) {
  const id = useId().replace(/:/g, '');
  const mainGradientId = `nebula-main-${id}`;
  const coolGradientId = `nebula-cool-${id}`;
  const shapes = NEBULA_CLOUD_VARIANTS[variant % NEBULA_CLOUD_VARIANTS.length];
  const height = (size / 320) * 180;

  const fillForShape = (shape: NebulaCloudShape) => {
    if (shape.gradient === 'main') return `url(#${mainGradientId})`;
    if (shape.gradient === 'cool') return `url(#${coolGradientId})`;
    return palette[shape.colorKey];
  };

  const strokeForShape = (shape: NebulaCloudShape) => (shape.outline ? palette.ink : 'transparent');

  return (
    <svg
      className="kurzgesagt-cloud-nebula"
      viewBox="0 0 320 180"
      width={size}
      height={height}
      style={{
        overflow: 'visible',
        transform: `${flipX ? 'scaleX(-1)' : ''} rotate(${rotate}deg)`,
        opacity,
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id={mainGradientId} x1="0" y1="0" x2="1" y2="0">
          <stop className="kurzgesagt-cloud-nebula__stop" offset="0%" stopColor={palette.capsuleBase} />
          <stop className="kurzgesagt-cloud-nebula__stop" offset="46%" stopColor={palette.capsuleAccent} />
          <stop className="kurzgesagt-cloud-nebula__stop" offset="100%" stopColor={palette.capsuleHighlight} />
        </linearGradient>
        <linearGradient id={coolGradientId} x1="0.12" y1="0.08" x2="0.88" y2="0.94">
          <stop className="kurzgesagt-cloud-nebula__stop" offset="0%" stopColor={palette.capsuleHighlight} />
          <stop className="kurzgesagt-cloud-nebula__stop" offset="54%" stopColor={palette.capsuleBase} />
          <stop className="kurzgesagt-cloud-nebula__stop" offset="100%" stopColor={palette.capsuleAccent} />
        </linearGradient>
      </defs>
      {shapes.map((shape, idx) => {
        const shapeOpacity = shape.opacity ?? 1;
        const strokeWidth = shape.outline ? shape.strokeWidth ?? 5 : 0;
        const stroke = strokeForShape(shape);
        const fill = fillForShape(shape);

        if (shape.type === 'path') {
          return (
            <path
              key={idx}
              className="kurzgesagt-cloud-nebula__shape"
              d={shape.d}
              fill={fill}
              opacity={shapeOpacity}
              stroke={stroke}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth={strokeWidth}
            />
          );
        }

        if (shape.type === 'ellipse') {
          return (
            <ellipse
              key={idx}
              className="kurzgesagt-cloud-nebula__shape"
              cx={shape.cx}
              cy={shape.cy}
              rx={shape.rx}
              ry={shape.ry}
              fill={fill}
              opacity={shapeOpacity}
              stroke={stroke}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              transform={shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : undefined}
            />
          );
        }

        if (shape.type === 'pill') {
          const originX = shape.x + shape.w / 2;
          const originY = shape.y + shape.h / 2;

          return (
            <rect
              key={idx}
              className="kurzgesagt-cloud-nebula__shape"
              x={shape.x}
              y={shape.y}
              width={shape.w}
              height={shape.h}
              rx={shape.h / 2}
              ry={shape.h / 2}
              fill={fill}
              opacity={shapeOpacity}
              stroke={stroke}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              transform={shape.rotate ? `rotate(${shape.rotate} ${originX} ${originY})` : undefined}
            />
          );
        }

        return (
          <circle
            key={idx}
            className="kurzgesagt-cloud-nebula__shape"
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            fill={fill}
            opacity={shapeOpacity}
            stroke={stroke}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        );
      })}
    </svg>
  );
}

/**
 * Horizontale sliding strip met cloud clusters. Twee identieke "pagina's"
 * schuiven doorlopend zodat er altijd een cluster op z'n plek staat.
 *
 * De cyclus is afgestemd op de orbit auto-rotate (~16s) zodat het universum
 * meeademt met de ring rotatie.
 */
function CapsuleStrip({
  themeKey,
  clusters,
  direction,
  durationSec,
  containerStyle,
}: {
  themeKey: string;
  clusters: Array<{ variant: number; xPct: number; yPct: number; size: number; rotate: number; flipX?: boolean; opacity?: number }>;
  direction: 1 | -1;
  durationSec: number;
  containerStyle: React.CSSProperties;
}) {
  const start = direction < 0 ? '0%' : '-50%';
  const end = direction < 0 ? '-50%' : '0%';

  return (
    <div
      className="kurzgesagt-nebula-strip"
      style={{
        position: 'absolute',
        display: 'flex',
        pointerEvents: 'none',
        ...containerStyle,
      }}
    >
      <div
        className="kurzgesagt-nebula-strip__track"
        style={{
          display: 'flex',
          width: '200%',
          height: '100%',
          '--strip-start': start,
          '--strip-end': end,
          '--strip-duration': `${durationSec}s`,
        } as React.CSSProperties & {
          '--strip-start': string;
          '--strip-end': string;
          '--strip-duration': string;
        }}
      >
        {[0, 1].map((copyIndex) => (
          <div
            key={copyIndex}
            style={{
              width: '50%',
              height: '100%',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {clusters.map((cluster, i) => (
              <div
                key={i}
                className="kurzgesagt-nebula-strip__cluster"
                style={{
                  position: 'absolute',
                  left: `${cluster.xPct}%`,
                  top: `${cluster.yPct}%`,
                  '--cluster-rotate': `${cluster.rotate}deg`,
                  '--cluster-rotate-pos': `${cluster.rotate + 1.5}deg`,
                  '--cluster-rotate-neg': `${cluster.rotate - 1.5}deg`,
                  '--cluster-duration': `${10 + i * 1.4}s`,
                  '--cluster-delay': `${i * 0.5}s`,
                } as React.CSSProperties & {
                  '--cluster-rotate': string;
                  '--cluster-rotate-pos': string;
                  '--cluster-rotate-neg': string;
                  '--cluster-duration': string;
                  '--cluster-delay': string;
                }}
              >
                {/* Per theme een statisch gerasterde wolk; kleurwissel als
                    opacity-crossfade i.p.v. per-frame fill/stroke transitions
                    (die de hele nebula-SVG elke frame opnieuw rasterden). */}
                <ThemeCrossfadeStack
                  themeKey={themeKey}
                  style={{
                    position: 'relative',
                    width: cluster.size,
                    height: (cluster.size / 320) * 180,
                  }}
                  renderLayer={(layerTheme) => (
                    <NebulaCloud
                      variant={cluster.variant}
                      palette={getPalette(layerTheme)}
                      size={cluster.size}
                      flipX={cluster.flipX}
                      rotate={0}
                      opacity={cluster.opacity ?? 1}
                    />
                  )}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Stars & Sparkles ---------------- */

/**
 * 4-point sparkle ster — zoals in Image.png scattered tussen de ringen.
 * Pulseert opacity+scale. Glow komt van drop-shadow filter.
 *
 * `color` animeert mee met thema — geeft subtiele smooth kleurswitch.
 */
function TwinkleStar({
  x,
  y,
  size,
  color,
  duration,
  delay,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
}) {
  return (
    <div
      className="kurzgesagt-twinkle-star"
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        pointerEvents: 'none',
        animationDuration: `${duration * 4}s`,
        animationDelay: `${delay}s`,
      }}
    >
      <div
        className="kurzgesagt-twinkle-star__glow"
        style={{
          position: 'absolute',
          inset: 0,
          background: color,
          clipPath:
            'polygon(50% 0%, 55% 45%, 100% 50%, 55% 55%, 50% 100%, 45% 55%, 0% 50%, 45% 45%)',
        }}
      />
      <div
        className="kurzgesagt-twinkle-star__shape"
        style={{
          position: 'absolute',
          inset: 0,
          background: color,
          clipPath:
            'polygon(50% 0%, 55% 45%, 100% 50%, 55% 55%, 50% 100%, 45% 55%, 0% 50%, 45% 45%)',
        }}
      />
    </div>
  );
}

/**
 * Kleine ronde pulserende ster. Minder CPU dan TwinkleStar.
 * Kleur animeert mee voor soepele thema-transitie.
 */
function PulseDot({
  x,
  y,
  size,
  color,
  duration,
  delay,
  baseOpacity,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  baseOpacity: number;
}) {
  return (
    <div
      className="kurzgesagt-pulse-dot"
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 ${size * 2.4}px ${color}`,
        animationDuration: `${duration * 4}s`,
        animationDelay: `${delay}s`,
        '--pulse-opacity': baseOpacity,
      } as React.CSSProperties & { '--pulse-opacity': number }}
    />
  );
}

/**
 * Vallende ster met trail. Random spawn via `repeatDelay`.
 */
function ShootingStar({
  delay,
  repeatDelay,
  startY,
  endY,
  duration,
  tailLength,
  color,
  angle,
}: {
  delay: number;
  repeatDelay: number;
  startY: number;
  endY: number;
  duration: number;
  tailLength: number;
  color: string;
  angle: number;
}) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: tailLength,
        height: 2,
        transformOrigin: 'right center',
        willChange: 'transform, opacity',
        pointerEvents: 'none',
      }}
      initial={{
        x: '-15vw',
        y: `${startY}vh`,
        opacity: 0,
        rotate: angle,
      }}
      animate={{
        x: ['-15vw', '115vw'],
        y: [`${startY}vh`, `${endY}vh`],
        opacity: [0, 1, 1, 0],
        rotate: angle,
      }}
      transition={{
        duration,
        times: [0, 0.1, 0.85, 1],
        ease: ease.linear,
        repeat: Infinity,
        repeatDelay,
        delay,
      }}
    >
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 2,
        }}
        animate={{
          background: `linear-gradient(90deg, ${color}00 0%, ${color}40 55%, ${color}ff 92%, #FFFFFFff 100%)`,
          boxShadow: `0 0 6px ${color}`,
        }}
        transition={COLOR_TRANSITION}
      />
      <motion.div
        style={{
          position: 'absolute',
          right: -3,
          top: -3,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#FFFFFF',
        }}
        animate={{ boxShadow: `0 0 12px ${color}, 0 0 24px ${color}` }}
        transition={COLOR_TRANSITION}
      />
    </motion.div>
  );
}

/* ---------------- Moon & Planet ---------------- */

/**
 * Moon met gekleurde stripe-patches. Kleuren crossfaden met thema.
 */
function MoonWithStripes({
  className,
  palette,
  base,
  stripeA,
  stripeB,
  driftPhase,
  driftDuration,
}: {
  className: string;
  palette: VectorPalette;
  base: string;
  stripeA: string;
  stripeB: string;
  driftPhase: number;
  driftDuration: number;
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: base,
        borderColor: palette.ink,
        '--moon-y-pos': `${driftPhase * 10}px`,
        '--moon-y-neg': `${-driftPhase * 6}px`,
        '--moon-rotate-pos': `${driftPhase * 2.5}deg`,
        '--moon-rotate-neg': `${-driftPhase * 2}deg`,
        '--moon-duration': `${driftDuration}s`,
      } as React.CSSProperties & {
        '--moon-y-pos': string;
        '--moon-y-neg': string;
        '--moon-rotate-pos': string;
        '--moon-rotate-neg': string;
        '--moon-duration': string;
      }}
    >
      <span
        style={{
          backgroundColor: stripeA,
          borderColor: palette.ink,
        }}
      />
      <span
        style={{
          backgroundColor: stripeB,
          borderColor: palette.ink,
        }}
      />
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized, 16);

  if (Number.isNaN(value)) return { r: 139, g: 77, b: 255 };

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixColor(hex: string, target: { r: number; g: number; b: number }, mix: number, alpha = 1) {
  const source = hexToRgb(hex);
  const t = Math.min(1, Math.max(0, mix));
  const r = Math.round(source.r + (target.r - source.r) * t);
  const g = Math.round(source.g + (target.g - source.g) * t);
  const b = Math.round(source.b + (target.b - source.b) * t);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------------- Main Component ---------------- */

export const KurzgesagtBackdrop = memo(function KurzgesagtBackdrop({
  theme,
  surface,
  centralPlanetColor,
  showCentralPlanet = true,
}: KurzgesagtBackdropProps) {
  const palette = useMemo(() => getPalette(theme), [theme]);
  // Genormaliseerde key: onbekende themes vallen terug op 'main', zodat een
  // crossfade tussen twee identieke palettes nooit getriggerd wordt.
  const themeKey = palettes[theme] ? theme : 'main';
  const planetColor = centralPlanetColor ?? palette.planet;
  const centralPlanetPaint = useMemo(() => ({
    body: `linear-gradient(100deg, ${mixColor(planetColor, { r: 72, g: 0, b: 170 }, 0.28)} 0%, ${mixColor(planetColor, { r: 255, g: 26, b: 176 }, 0.42)} 38%, ${mixColor(planetColor, { r: 255, g: 120, b: 0 }, 0.54)} 68%, ${mixColor(planetColor, { r: 255, g: 244, b: 34 }, 0.72)} 100%)`,
    glow: mixColor(planetColor, { r: 91, g: 224, b: 255 }, 0.28, 0.78),
    fieldDark: mixColor(planetColor, { r: 38, g: 0, b: 112 }, 0.48, 0.74),
    fieldMid: mixColor(planetColor, { r: 255, g: 26, b: 176 }, 0.46, 0.68),
    fieldLight: mixColor(planetColor, { r: 255, g: 236, b: 44 }, 0.7, 0.66),
    craterDark: mixColor(planetColor, { r: 36, g: 0, b: 104 }, 0.68, 0.62),
    craterWarm: mixColor(planetColor, { r: 255, g: 82, b: 0 }, 0.54, 0.58),
    atmosphere: mixColor(planetColor, { r: 255, g: 255, b: 255 }, 0.82, 0.42),
  }), [planetColor]);
  const isKiosk = surface === 'kiosk';

  // Stars & dots blijven stabiel over theme-wissels heen. Alleen de kleuren
  // crossfaden mee, zodat lopende pulse/twinkle animaties niet opnieuw mounten.
  const { twinkles, pulses, staticField, diskDots } = useMemo(() => {
    const seed = 73;
    const rand = seededRandom(seed);

    const twinkleList = Array.from({ length: 12 }, (_, i) => ({
      id: `tw-${i}`,
      x: rand() * 100,
      y: rand() * 100,
      size: 12 + rand() * 22,
      colorKind: (i % 3 === 0 ? 'warm' : i % 3 === 1 ? 'cool' : 'white') as 'warm' | 'cool' | 'white',
      duration: 2.4 + rand() * 3.6,
      delay: rand() * 4,
    }));

    const pulseList = Array.from({ length: 28 }, (_, i) => ({
      id: `pu-${i}`,
      x: rand() * 100,
      y: rand() * 100,
      size: 2 + rand() * 4,
      colorKind: (i % 4 === 0 ? 'cool' : i % 4 === 1 ? 'warm' : 'white') as 'warm' | 'cool' | 'white',
      duration: 1.8 + rand() * 3,
      delay: rand() * 3,
      baseOpacity: 0.55 + rand() * 0.45,
    }));

    const staticDots = Array.from({ length: 180 }, () => {
      const sx = (rand() * 1000).toFixed(1);
      const sy = (rand() * 1000).toFixed(1);
      const r = (rand() * 1.2 + 0.35).toFixed(2);
      const op = (rand() * 0.5 + 0.25).toFixed(2);
      return `<circle cx="${sx}" cy="${sy}" r="${r}" fill="white" opacity="${op}" />`;
    }).join('');
    const staticSvg = `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">${staticDots}</svg>`;
    const staticField = `url("data:image/svg+xml,${encodeURIComponent(staticSvg)}")`;

    // Disk dots: langs elke ring een constellatie, onafhankelijk van theme
    // (alleen de kleur wisselt via palette).
    const diskDots = generateRingDots(42, DISK_RINGS);

    return { twinkles: twinkleList, pulses: pulseList, staticField, diskDots };
  }, []);

  const starColor = (kind: 'warm' | 'cool' | 'white') =>
    kind === 'warm' ? palette.starWarm : kind === 'cool' ? palette.starCool : palette.starWhite;

  // Twee sliding strips: top (links-naar-rechts drift) en bottom (tegengesteld).
  // De varianten blijven stabiel per positie zodat themawissels echt als
  // kleurtransities voelen in plaats van als hard vorm-sprongen.
  const topClusters = useMemo(
    () => [
      { variant: 0, xPct: 9, yPct: 26, size: 275, rotate: -6, opacity: 0.95 },
      { variant: 2, xPct: 31, yPct: 10, size: 235, rotate: 8, flipX: true, opacity: 0.9 },
      { variant: 1, xPct: 49, yPct: 32, size: 292, rotate: -3 },
    ],
    [],
  );

  const bottomClusters = useMemo(
    () => [
      { variant: 3, xPct: 7, yPct: 54, size: 252, rotate: 4, flipX: true, opacity: 0.9 },
      { variant: 1, xPct: 28, yPct: 70, size: 222, rotate: -10 },
      { variant: 0, xPct: 51, yPct: 48, size: 296, rotate: 12, opacity: 0.92 },
    ],
    [],
  );

  // Disk size: groter op table (landscape) zodat ringen ver de rand in duwen
  const diskSize = isKiosk ? 1200 : 1800;

  // Orbit auto-rotate cyclus (16s) → cloud strip cyclus voor meebeweeg-effect
  const ringCycleSec = 34;

  return (
    <div
      className="kurzgesagt-backdrop fixed inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* 0+1. Basiskleur + radial halo — per theme één statische laag die via
            opacity crossfade't. Voorheen animeerden backgroundColor en de
            gradient-string per frame → full-screen repaint, 1.8s lang bij
            elke themawissel. Nu één raster per wissel, GPU-blend ertussen. */}
      <ThemeCrossfadeStack
        themeKey={themeKey}
        className="absolute inset-0"
        renderLayer={(layerTheme) => {
          const layerPalette = getPalette(layerTheme);
          return (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: layerPalette.backgroundDeep,
                background: `radial-gradient(ellipse at 50% 52%, ${layerPalette.background} 0%, ${layerPalette.background}00 60%) ${layerPalette.backgroundDeep}`,
              }}
            />
          );
        }}
      />

      {/* 2. Statisch ster-veld (geen animatie, zit ingebakken in SVG). */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: staticField,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          opacity: 0.7,
        }}
      />

      {/* 3. Galactic disk — grote tilted ring-structuur als hoofd-feature */}
      <GalacticDisk themeKey={themeKey} palette={palette} diskSize={diskSize} diskDots={diskDots} />

      {/* 4. Pulserende kleine dots (achtergrond sterren) */}
      {pulses.map((p) => (
        <PulseDot
          key={p.id}
          x={p.x}
          y={p.y}
          size={p.size}
          color={starColor(p.colorKind)}
          duration={p.duration}
          delay={p.delay}
          baseOpacity={p.baseOpacity}
        />
      ))}

      {/* 5. 4-point sparkle sterren (grote iconische sterren) */}
      {twinkles.map((t) => (
        <TwinkleStar
          key={t.id}
          x={t.x}
          y={t.y}
          size={t.size}
          color={starColor(t.colorKind)}
          duration={t.duration}
          delay={t.delay}
        />
      ))}

      {/* 6. Vallende sterren — random spawn via repeatDelay */}
      <ShootingStar
        delay={3}
        repeatDelay={11}
        startY={18}
        endY={38}
        duration={1.4}
        tailLength={220}
        color={palette.starCool}
        angle={10}
      />
      <ShootingStar
        delay={8.5}
        repeatDelay={16}
        startY={58}
        endY={76}
        duration={1.1}
        tailLength={180}
        color={palette.starWarm}
        angle={8}
      />
      <ShootingStar
        delay={14}
        repeatDelay={22}
        startY={28}
        endY={52}
        duration={1.6}
        tailLength={260}
        color={palette.starWhite}
        angle={14}
      />

      {/* 7. Cloud nebula strips — sliding top + bottom */}
      <CapsuleStrip
        themeKey={themeKey}
        clusters={topClusters}
        direction={-1}
        durationSec={ringCycleSec}
        containerStyle={{
          top: '-4vh',
          left: 0,
          width: '100%',
          height: '40vh',
        }}
      />
      <CapsuleStrip
        themeKey={themeKey}
        clusters={bottomClusters}
        direction={1}
        durationSec={ringCycleSec * 1.18}
        containerStyle={{
          bottom: '-4vh',
          left: 0,
          width: '100%',
          height: '40vh',
        }}
      />

      {/* 8. Moons links en rechts — met gekleurde stripe-accenten */}
      <MoonWithStripes
        className="kurzgesagt-moon kurzgesagt-moon--left"
        palette={palette}
        base={palette.moonPrimary}
        stripeA={palette.moonSecondary}
        stripeB={palette.moonAccent}
        driftPhase={1}
        driftDuration={12}
      />
      <MoonWithStripes
        className="kurzgesagt-moon kurzgesagt-moon--right"
        palette={palette}
        base={palette.moonAccent}
        stripeA={palette.moonSecondary}
        stripeB={palette.moonPrimary}
        driftPhase={-1}
        driftDuration={10}
      />

      {/* 9. Central planet — alleen op table. Alle kleuren crossfaden */}
      {showCentralPlanet && !isKiosk && (
        <div
          className="kurzgesagt-central-planet"
          style={{
            background: centralPlanetPaint.body,
            borderColor: palette.ink,
            boxShadow: `0 14px 0 rgba(0,0,0,0.42), 0 0 64px ${centralPlanetPaint.glow}, 0 0 22px ${centralPlanetPaint.atmosphere}, inset -34px -12px 0 rgba(0,0,0,0.1)`,
          }}
        >
          <div
            className="kurzgesagt-central-planet__field kurzgesagt-central-planet__field--dark"
            style={{ backgroundColor: centralPlanetPaint.fieldDark }}
          />
          <div
            className="kurzgesagt-central-planet__field kurzgesagt-central-planet__field--mid"
            style={{ backgroundColor: centralPlanetPaint.fieldMid }}
          />
          <div
            className="kurzgesagt-central-planet__field kurzgesagt-central-planet__field--light"
            style={{ backgroundColor: centralPlanetPaint.fieldLight }}
          />
          <div
            className="kurzgesagt-central-planet__crater kurzgesagt-central-planet__crater--one"
            style={{ backgroundColor: centralPlanetPaint.craterDark }}
          />
          <div
            className="kurzgesagt-central-planet__crater kurzgesagt-central-planet__crater--two"
            style={{ backgroundColor: centralPlanetPaint.craterWarm }}
          />
          <div
            className="kurzgesagt-central-planet__crater kurzgesagt-central-planet__crater--three"
            style={{ backgroundColor: centralPlanetPaint.craterDark }}
          />
          <div
            className="kurzgesagt-central-planet__atmosphere"
            style={{
              background: `radial-gradient(ellipse at 72% 28%, ${centralPlanetPaint.atmosphere} 0%, transparent 58%)`,
            }}
          />
          <div
            className="kurzgesagt-central-planet__rim"
          />
          <div
            className="kurzgesagt-central-planet__spark kurzgesagt-central-planet__spark--one"
          />
          <div
            className="kurzgesagt-central-planet__spark kurzgesagt-central-planet__spark--two"
          />
          <div
            className="kurzgesagt-central-planet__ring"
            style={{ borderColor: palette.planetRing }}
          />
        </div>
      )}

      {/* 10. Subtiele dot-grid texture overlay. `cream` is in elk palette
            identiek (#FFF2B8), dus dit is gewoon een statische laag — de oude
            backgroundImage-animatie kon per definitie niets veranderen. */}
      <div
        className="kurzgesagt-dot-field"
        style={{
          backgroundImage: `radial-gradient(${palette.cream} 1.2px, transparent 1.2px)`,
        }}
      />

      {/* 11. Vignette die het oog naar centrum trekt.
            Voorheen mix-blend-mode: multiply — een full-screen, niet-geïsoleerde
            composite-pass elke frame. Op de toch al donkere scène geeft een
            gewone (source-over) radial-gradient met voor-gedonkerde rgba's
            vrijwel hetzelfde beeld, zónder de blend-pass.
            Per theme statisch; kleurwissel via opacity-crossfade. */}
      <ThemeCrossfadeStack
        themeKey={themeKey}
        className="absolute inset-0"
        renderLayer={(layerTheme) => {
          const layerPalette = getPalette(layerTheme);
          return (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at center, transparent 42%, ${mixColor(layerPalette.backgroundDeep, { r: 0, g: 0, b: 0 }, 0.12, 0.9)} 94%, rgba(0, 0, 0, 0.96) 100%)`,
              }}
            />
          );
        }}
      />
    </div>
  );
});
