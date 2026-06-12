import { motion } from 'motion/react';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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

interface CrossfadeLayers {
  base: string;
  incoming: string | null;
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
 * Nu wordt elke laag per theme één keer gerasterd en fade't de nieuwe laag
 * met `opacity` (GPU-composited, geen repaint) over de oude heen.
 *
 * Wachtrij-semantiek: er is altijd precies één volledig dekkende basislaag
 * en maximaal één invadende laag. Wisselt het thema terwijl er al een fade
 * loopt, dan wordt de nieuwste wens onthouden en gestart zodra de lopende
 * fade klaar is. Daardoor wordt er nooit een laag mid-fade weggegooid en is
 * élke zichtbare verandering een vloeiende animatie — geen knippers of
 * sprongen, hoe snel het thema ook wisselt.
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
  const [layers, setLayers] = useState<CrossfadeLayers>(() => ({ base: themeKey, incoming: null }));
  const pendingRef = useRef<string | null>(null);

  const activeTarget = layers.incoming ?? layers.base;
  if (themeKey === activeTarget) {
    // De nieuwste wens is al (bijna) zichtbaar — eventuele oudere wens vervalt.
    pendingRef.current = null;
  } else if (!layers.incoming) {
    // Render-phase update: fade direct starten zodat er geen frame met
    // verouderde kleuren commit.
    setLayers({ base: layers.base, incoming: themeKey });
  } else {
    // Er loopt al een fade — onthoud alleen de nieuwste wens.
    pendingRef.current = themeKey;
  }

  const handleIncomingSettled = useCallback(() => {
    setLayers((current) => {
      if (!current.incoming) return current;
      const settled = current.incoming;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next && next !== settled) {
        return { base: settled, incoming: next };
      }
      return { base: settled, incoming: null };
    });
  }, []);

  return (
    <div className={className} style={style}>
      <div className="absolute inset-0">{renderLayer(layers.base)}</div>
      {layers.incoming && (
        <motion.div
          key={layers.incoming}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={COLOR_TRANSITION}
          onAnimationComplete={handleIncomingSettled}
        >
          {renderLayer(layers.incoming)}
        </motion.div>
      )}
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

/* ---------------- Nebulae ---------------- */

/** 4-puntige ster (zelfde vorm als de twinkle-sterren in de backdrop). */
function sparklePath(x: number, y: number, s: number) {
  const w = s * 0.26;
  return `M ${x} ${y - s} L ${x + w} ${y - w} L ${x + s} ${y} L ${x + w} ${y + w} L ${x} ${y + s} L ${x - w} ${y + w} L ${x - s} ${y} L ${x - w} ${y - w} Z`;
}

/**
 * Organische blob-vorm: punten rond een ellips met seeded radius-jitter,
 * verbonden via een gesloten Catmull-Rom spline (omgezet naar cubic beziers).
 * Deterministisch per seed → zelfde vorm elke render.
 */
function nebulaBlobPath(
  seed: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  pointCount = 10,
  jitter = 0.34,
): string {
  const rand = seededRandom(seed);
  const points: Array<[number, number]> = [];
  for (let i = 0; i < pointCount; i += 1) {
    const angle = (i / pointCount) * Math.PI * 2;
    const radial = 1 - jitter * 0.5 + rand() * jitter;
    points.push([
      cx + Math.cos(angle) * rx * radial,
      cy + Math.sin(angle) * ry * radial,
    ]);
  }

  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < pointCount; i += 1) {
    const p0 = points[(i - 1 + pointCount) % pointCount];
    const p1 = points[i];
    const p2 = points[(i + 1) % pointCount];
    const p3 = points[(i + 2) % pointCount];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

interface NebulaSpec {
  /** Paden voor de drie gaslagen, van buiten naar binnen. */
  outerPath: string;
  midPath: string;
  corePath: string;
  heartPath: string;
  /** Sterretjes die ín het gas zweven. */
  stars: Array<{ x: number; y: number; r: number }>;
  sparkle: { x: number; y: number; s: number };
}

function buildNebulaSpec(
  seed: number,
  outer: [number, number, number, number],
  mid: [number, number, number, number],
  core: [number, number, number, number],
  stars: Array<{ x: number; y: number; r: number }>,
  sparkle: { x: number; y: number; s: number },
): NebulaSpec {
  const [ox, oy, orx, ory] = outer;
  const [mx, my, mrx, mry] = mid;
  const [kx, ky, krx, kry] = core;
  return {
    outerPath: nebulaBlobPath(seed, ox, oy, orx, ory, 11, 0.38),
    midPath: nebulaBlobPath(seed + 17, mx, my, mrx, mry, 9, 0.34),
    corePath: nebulaBlobPath(seed + 41, kx, ky, krx, kry, 8, 0.3),
    heartPath: nebulaBlobPath(seed + 73, kx + krx * 0.12, ky - kry * 0.15, krx * 0.42, kry * 0.42, 7, 0.26),
    stars,
    sparkle,
  };
}

/**
 * Vier nebula-varianten in een 320×180 viewBox: gelaagde gaswolken (diepe
 * buitenlaag → accent-middenlaag → lichte kern → bijna-witte "heart") met
 * sterretjes in het gas. Geen outline — nebula's zijn gas, geen objecten;
 * de Kurzgesagt-look komt van de vlakke, crisp gelaagde tinten.
 */
const NEBULA_VARIANTS: NebulaSpec[] = [
  // Variant A — breed, licht hellend.
  buildNebulaSpec(
    101,
    [160, 92, 142, 58],
    [148, 88, 98, 42],
    [176, 82, 54, 26],
    [
      { x: 86, y: 78, r: 2.4 },
      { x: 124, y: 112, r: 1.7 },
      { x: 206, y: 64, r: 2.1 },
      { x: 238, y: 102, r: 1.5 },
    ],
    { x: 284, y: 52, s: 6 },
  ),
  // Variant B — compacter en ronder.
  buildNebulaSpec(
    211,
    [156, 94, 118, 66],
    [168, 90, 84, 48],
    [148, 84, 48, 30],
    [
      { x: 100, y: 70, r: 2.2 },
      { x: 196, y: 120, r: 1.8 },
      { x: 214, y: 70, r: 1.5 },
    ],
    { x: 56, y: 44, s: 5 },
  ),
  // Variant C — lange sliert.
  buildNebulaSpec(
    307,
    [160, 96, 150, 48],
    [140, 92, 104, 36],
    [188, 90, 60, 24],
    [
      { x: 70, y: 92, r: 1.9 },
      { x: 142, y: 70, r: 2.3 },
      { x: 232, y: 110, r: 1.6 },
      { x: 268, y: 78, r: 1.9 },
    ],
    { x: 30, y: 130, s: 5 },
  ),
  // Variant D — gekanteld, kern rechtsboven.
  buildNebulaSpec(
    419,
    [158, 90, 132, 62],
    [172, 84, 92, 44],
    [190, 74, 50, 26],
    [
      { x: 96, y: 110, r: 2.2 },
      { x: 142, y: 60, r: 1.6 },
      { x: 236, y: 96, r: 2 },
    ],
    { x: 44, y: 60, s: 6 },
  ),
];

/**
 * Rendert één nebula als statische SVG. Kleurwissels lopen via de
 * ThemeCrossfadeStack van het cluster (zie CapsuleStrip), dus binnen één
 * laag verandert hier nooit iets — geen per-frame raster, geen knippers.
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
  const spec = NEBULA_VARIANTS[variant % NEBULA_VARIANTS.length];
  const height = (size / 320) * 180;

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
      {/* Gaslagen: diep → accent → licht → heart. */}
      <path d={spec.outerPath} fill={palette.capsuleBase} opacity="0.5" />
      <path d={spec.midPath} fill={palette.capsuleAccent} opacity="0.55" />
      <path d={spec.corePath} fill={palette.capsuleHighlight} opacity="0.7" />
      <path d={spec.heartPath} fill={palette.capsuleCore} opacity="0.85" />

      {/* Sterretjes in het gas + één sparkle ernaast. */}
      {spec.stars.map((star, idx) => (
        <circle key={idx} cx={star.x} cy={star.y} r={star.r} fill={palette.starWhite} opacity="0.85" />
      ))}
      <path d={sparklePath(spec.sparkle.x, spec.sparkle.y, spec.sparkle.s)} fill={palette.capsuleCore} opacity="0.9" />
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
 *
 * Draait op de Web Animations API i.p.v. een framer-motion JS-loop: de
 * transform/opacity keyframes lopen daarmee op de compositor-thread, zodat de
 * main thread in rust geen animatiewerk meer doet. De "wachttijd" tussen twee
 * spawns (repeatDelay) is in de keyframes ingebakken als dood segment.
 * Kleuren crossfaden via CSS-transitions op de trail/head (zie theme.css).
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
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof element.animate !== 'function') return;

    const cycle = duration + repeatDelay;
    const active = duration / cycle;
    const startTransform = `translate(-15vw, ${startY}vh) rotate(${angle}deg)`;
    const endTransform = `translate(115vw, ${endY}vh) rotate(${angle}deg)`;

    // Zelfde traject + timing als de oude framer-versie:
    // x -15vw→115vw en y start→end lineair over `duration`,
    // opacity [0,1,1,0] op times [0,0.1,0.85,1], daarna repeatDelay stilte.
    const animation = element.animate(
      [
        { offset: 0, transform: startTransform, opacity: 0 },
        { offset: active * 0.1, opacity: 1 },
        { offset: active * 0.85, opacity: 1 },
        { offset: active, transform: endTransform, opacity: 0 },
        { offset: 1, transform: endTransform, opacity: 0 },
      ],
      {
        duration: cycle * 1000,
        delay: delay * 1000,
        iterations: Infinity,
        easing: 'linear',
        fill: 'backwards',
      },
    );

    return () => animation.cancel();
  }, [delay, repeatDelay, startY, endY, duration, angle]);

  return (
    <div
      ref={elementRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: tailLength,
        height: 2,
        transformOrigin: 'right center',
        willChange: 'transform, opacity',
        pointerEvents: 'none',
        // Onzichtbaar tot de WAAPI-animatie start (en als fallback wanneer
        // element.animate niet beschikbaar is).
        opacity: 0,
        transform: `translate(-15vw, ${startY}vh) rotate(${angle}deg)`,
      }}
    >
      <div
        className="kurzgesagt-shooting-star__tail"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 2,
          background: `linear-gradient(90deg, ${color}00 0%, ${color}40 55%, ${color}ff 92%, #FFFFFFff 100%)`,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <div
        className="kurzgesagt-shooting-star__head"
        style={{
          position: 'absolute',
          right: -3,
          top: -3,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: `0 0 12px ${color}, 0 0 24px ${color}`,
        }}
      />
    </div>
  );
}

/* ---------------- Mini-planeten ---------------- */

/**
 * Linker mini-planeet: maan met ring (Saturnus-stijl), terminator-schaduw,
 * kraters en een klein maantje op de ring. Volledig statische SVG; kleuren
 * wisselen via de ThemeCrossfadeStack van de wrapper.
 */
function MiniPlanetRinged({ palette }: { palette: VectorPalette }) {
  const id = useId().replace(/:/g, '');
  const clipId = `mini-ringed-${id}`;
  const inkRgb = hexToRgb(palette.ink);
  const body = palette.moonPrimary;
  const shade = mixColor(body, inkRgb, 0.3, 1);
  const craterFill = mixColor(body, inkRgb, 0.45, 1);
  const capFill = mixColor(body, { r: 255, g: 255, b: 255 }, 0.45, 1);

  return (
    <svg viewBox="0 0 220 220" width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <circle cx="110" cy="110" r="76" />
        </clipPath>
      </defs>

      {/* Offset-schaduw (vervangt de oude box-shadow 0 8px 0) */}
      <circle cx="110" cy="118" r="76" fill="rgba(2, 8, 30, 0.32)" />

      {/* Ring — achterste helft (bovenlangs) */}
      <g transform="rotate(-16 110 110)">
        <path d="M 8 110 A 102 30 0 0 1 212 110" fill="none" stroke={palette.moonSecondary} strokeWidth="9" strokeLinecap="round" />
      </g>

      {/* Body */}
      <circle cx="110" cy="110" r="76" fill={capFill} />
      <g clipPath={`url(#${clipId})`}>
        {/* Basistoon + terminator-schaduw rechtsonder */}
        <circle cx="96" cy="96" r="88" fill={body} />
        <circle cx="158" cy="150" r="86" fill={shade} />
        {/* Kraters */}
        <circle cx="84" cy="86" r="15" fill={craterFill} />
        <circle cx="128" cy="62" r="9" fill={craterFill} />
        <circle cx="68" cy="134" r="11" fill={craterFill} />
        <circle cx="138" cy="122" r="7" fill={shade} />
      </g>

      {/* Ring — voorste helft (onderlangs), met klein maantje */}
      <g transform="rotate(-16 110 110)">
        <path d="M 8 110 A 102 30 0 0 0 212 110" fill="none" stroke={palette.moonSecondary} strokeWidth="9" strokeLinecap="round" />
        <circle cx="194" cy="124" r="10" fill={palette.moonAccent} />
      </g>
    </svg>
  );
}

/**
 * Rechter mini-planeet: gasreus met wikkel-banden, lichtkap, oppervlakte-spot
 * en een los maantje. Statische SVG; kleuren via ThemeCrossfadeStack.
 */
function MiniPlanetBanded({ palette }: { palette: VectorPalette }) {
  const id = useId().replace(/:/g, '');
  const clipId = `mini-banded-${id}`;
  const inkRgb = hexToRgb(palette.ink);
  const body = palette.moonAccent;
  const capFill = mixColor(body, { r: 255, g: 255, b: 255 }, 0.3, 1);
  const lowBand = mixColor(body, inkRgb, 0.34, 1);
  const spotFill = mixColor(palette.moonSecondary, inkRgb, 0.18, 1);

  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <circle cx="100" cy="104" r="72" />
        </clipPath>
      </defs>

      {/* Offset-schaduw */}
      <circle cx="100" cy="112" r="72" fill="rgba(2, 8, 30, 0.32)" />

      {/* Body met lichtkap linksboven */}
      <circle cx="100" cy="104" r="72" fill={body} />
      <g clipPath={`url(#${clipId})`}>
        <circle cx="76" cy="76" r="74" fill={capFill} />
        {/* Wikkel-banden — randen lopen netjes tegen de bolrand dood */}
        <rect x="6" y="62" width="188" height="24" rx="12" fill={palette.moonSecondary} />
        <rect x="14" y="100" width="180" height="18" rx="9" fill={palette.moonPrimary} />
        <rect x="2" y="132" width="196" height="15" rx="7.5" fill={lowBand} />
        {/* Oppervlakte-spot */}
        <circle cx="132" cy="92" r="9" fill={spotFill} />
      </g>

      {/* Los maantje rechtsboven */}
      <circle cx="172" cy="36" r="11" fill={palette.moonPrimary} />
      <circle cx="169" cy="34" r="3.5" fill={mixColor(palette.moonPrimary, inkRgb, 0.4, 1)} />
    </svg>
  );
}

/**
 * Wrapper voor de mini-planeten: behoudt de bestaande drift-animatie en
 * positionering, en crossfade't de SVG per theme (zelfde patroon als de rest
 * van de backdrop).
 */
function KurzgesagtMoon({
  side,
  themeKey,
  driftPhase,
  driftDuration,
}: {
  side: 'left' | 'right';
  themeKey: string;
  driftPhase: number;
  driftDuration: number;
}) {
  return (
    <div
      className={`kurzgesagt-moon kurzgesagt-moon--${side}`}
      style={{
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
      <ThemeCrossfadeStack
        themeKey={themeKey}
        className="absolute inset-0"
        renderLayer={(layerTheme) => {
          const layerPalette = getPalette(layerTheme);
          return side === 'left'
            ? <MiniPlanetRinged palette={layerPalette} />
            : <MiniPlanetBanded palette={layerPalette} />;
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
  //
  // De clusters zijn gelijkmatig over de volledige pagina-breedte verdeeld
  // (centers 5–85%) zodat de naadloze loop (twee identieke pagina's die
  // doorschuiven) nooit een "leeg" stuk toont — de stroom wolken is daardoor
  // visueel ononderbroken.
  const topClusters = useMemo(
    () => [
      { variant: 0, xPct: 6, yPct: 28, size: 268, rotate: -4, opacity: 0.95 },
      { variant: 2, xPct: 30, yPct: 12, size: 228, rotate: 5, flipX: true, opacity: 0.9 },
      { variant: 1, xPct: 55, yPct: 34, size: 285, rotate: -2 },
      { variant: 3, xPct: 80, yPct: 16, size: 238, rotate: 6, opacity: 0.92 },
    ],
    [],
  );

  const bottomClusters = useMemo(
    () => [
      { variant: 3, xPct: 10, yPct: 56, size: 248, rotate: 3, flipX: true, opacity: 0.92 },
      { variant: 1, xPct: 34, yPct: 72, size: 218, rotate: -6 },
      { variant: 0, xPct: 58, yPct: 50, size: 288, rotate: 8, opacity: 0.95 },
      { variant: 2, xPct: 84, yPct: 68, size: 230, rotate: -3, flipX: true, opacity: 0.9 },
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

      {/* 8. Mini-planeten links en rechts — ringplaneet + gasreus met banden */}
      <KurzgesagtMoon side="left" themeKey={themeKey} driftPhase={1} driftDuration={12} />
      <KurzgesagtMoon side="right" themeKey={themeKey} driftPhase={-1} driftDuration={10} />

      {/* 9. Central planet — alleen op table. Alle kleuren crossfaden */}
      {showCentralPlanet && !isKiosk && (
        <div
          className="kurzgesagt-central-planet"
          style={{
            background: centralPlanetPaint.body,
            boxShadow: `0 0 64px ${centralPlanetPaint.glow}, 0 0 22px ${centralPlanetPaint.atmosphere}, inset -34px -12px 0 rgba(0,0,0,0.1)`,
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
