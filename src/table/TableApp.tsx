import { startTransition, useState, useCallback, useMemo, memo, useRef, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw } from 'lucide-react';
import { contentData, type ContentNode } from '../shared/content';
import type { ConnectionHealth } from '../shared/protocol';
import { DEFAULT_VISUAL_STYLE } from '../shared/visualStyle';
import { useNavigationSocket } from '../shared/useNavigationSocket';
import { Planet } from '../app/components/Planet';
import { OrbitRing } from '../app/components/OrbitRing';
import { ContentView } from '../app/components/ContentView';
import { NavigationButton } from '../app/components/NavigationButton';
import { SpaceCanvas } from '../app/components/scene/SpaceCanvas';
import { PerfStats } from '../app/components/scene/PerfStats';

const TABLE_SCENE_SCALE = 0.88;
const TABLE_MAIN_ORBIT = {
  radiusX: 430 * TABLE_SCENE_SCALE,
  radiusY: 225 * TABLE_SCENE_SCALE,
  centerMaskRadius: 194 * TABLE_SCENE_SCALE,
};
const TABLE_SUBMENU_ORBIT = {
  radiusX: 395 * TABLE_SCENE_SCALE,
  radiusY: 190 * TABLE_SCENE_SCALE,
  centerMaskRadius: 174 * TABLE_SCENE_SCALE,
};

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized, 16);

  if (Number.isNaN(value)) return { r: 139, g: 92, b: 246 };

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixHex(hex: string, target: string, amount: number) {
  const sourceRgb = hexToRgb(hex);
  const targetRgb = hexToRgb(target);
  const t = Math.min(1, Math.max(0, amount));
  const r = Math.round(sourceRgb.r + (targetRgb.r - sourceRgb.r) * t);
  const g = Math.round(sourceRgb.g + (targetRgb.g - sourceRgb.g) * t);
  const b = Math.round(sourceRgb.b + (targetRgb.b - sourceRgb.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbaHex(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Centrale planeet — DOM laag.
 *
 * De 3D sphere wordt gerenderd in SpaceCanvas (WebGL). Deze DOM component levert alleen
 * nog de tekst overlay (iXperium / Smart Industry) bovenop de 3D sphere. De tekst blijft
 * crisp op elke DPI; zou we tekst in de 3D scene renderen dan wordt het blurry.
 *
 * Geen bg-gradient / geen blur rings meer: shader + bloom doen dat straks allemaal.
 */
const CentralPlanet = memo(function CentralPlanet({ accentColor = '#8B5CF6' }: { accentColor?: string }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{ zIndex: 60 }}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <motion.div
        className="relative flex h-[21rem] w-[21rem] items-center justify-center"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
      >
        <div
          className="central-planet-label ixperium-core-mark relative z-10 w-[min(17.5rem,38vw)] text-center"
          style={{
            '--central-accent': accentColor,
            '--central-glow': rgbaHex(accentColor, 0.72),
          } as CSSProperties & {
            '--central-accent': string;
            '--central-glow': string;
          }}
        >
          <svg
            className="ixperium-core-mark__logo"
            viewBox="0 0 520 156"
            role="img"
            aria-labelledby="ixperium-core-logo-title"
          >
            <title id="ixperium-core-logo-title">iXPERIUM Centre of Expertise</title>
            <rect className="ixperium-core-mark__logo-panel" x="2" y="2" width="516" height="152" rx="4" />
            <g className="ixperium-core-mark__wordmark" aria-hidden="true">
              <circle cx="31" cy="29" r="13" />
              <path d="M18 53H44V124H18Z" />
              <text x="55" y="124">XPERIUM</text>
            </g>
            <text className="ixperium-core-mark__descriptor" x="310" y="149" textAnchor="middle" aria-hidden="true">
              CENTRE OF EXPERTISE
            </text>
          </svg>
        </div>
      </motion.div>
    </motion.div>
  );
});

type NavigationLevel = 'main' | 'submenu' | 'detail';

interface NavigationState {
  level: NavigationLevel;
  selectedMain: ContentNode | null;
  selectedSub: ContentNode | null;
}

const ConnectionPill = memo(function ConnectionPill({ connected, health }: { connected: boolean; health: ConnectionHealth }) {
  return (
    <div className="connection-pill fixed right-8 top-8 z-[220] flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a121a]/80 px-4 py-3 text-sm font-semibold text-white/75 shadow-[0_18px_60px_rgba(0,0,0,0.26)]">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: connected ? '#46B469' : '#FF3344' }}
      />
      <span>{connected ? 'Live sync' : health}</span>
    </div>
  );
});

const routeDescription: Record<string, string> = {
  ai: 'Data, algoritmes, praktijkcases',
  xr: 'Immersive media, werkplekinterfaces',
  twin: 'Simulaties en sensordata',
  rapid: 'Van idee naar prototype',
  robotics: 'ROS, cobots, autonome systemen',
};

function getCompactTitle(title: string) {
  return title
    .replace('Artificial Intelligence', 'AI')
    .replace('XR & Human Machine Interaction', 'XR & HMI')
    .replace('Rapid Prototyping & Additive Manufacturing', 'Rapid Prototyping');
}

const RouteCommandPanel = memo(function RouteCommandPanel({
  activeNode,
  onSelectNode,
}: {
  activeNode: ContentNode | null;
  onSelectNode: (node: ContentNode) => void;
}) {
  return (
    <aside className="pointer-events-auto fixed left-8 top-[18vh] z-[90] flex w-[min(24vw,21rem)] max-w-[21rem] flex-col gap-4 rounded-[1.875rem] border border-white/15 bg-[#0a121a]/85 p-5 text-white shadow-[0_24px_90px_rgba(0,0,0,0.30)] max-[1120px]:hidden">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">Routebord</p>
        <h2 className="text-[2.35rem] font-black leading-[0.98] tracking-normal text-white">
          Kies een kennisroute.
        </h2>
        <p className="text-[0.96rem] leading-6 text-white/65">
          Draai de planeten rond de kern en tik op een domein om verdieping naar het kiosk-scherm te sturen.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {contentData.map((node) => {
          const selected = node.id === activeNode?.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode(node)}
              className="group flex min-h-[4.25rem] items-center gap-3 rounded-[1.125rem] border px-3 py-2.5 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              style={{
                backgroundColor: selected ? `${node.color}26` : 'rgba(255,255,255,0.055)',
                borderColor: selected ? `${node.color}70` : 'rgba(255,255,255,0.08)',
              }}
            >
              <span
                className="h-11 w-11 flex-shrink-0 rounded-[0.875rem] shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
                style={{ backgroundColor: node.color }}
              />
              <span className="min-w-0">
                <span className="block text-[0.98rem] font-extrabold leading-5 text-white">
                  {getCompactTitle(node.title)}
                </span>
                <span className="mt-1 block text-xs font-medium leading-4 text-white/55">
                  {routeDescription[node.theme] ?? 'Labs, toolkits en cases'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
});

const FocusPreviewPanel = memo(function FocusPreviewPanel({
  focusNode,
  level,
}: {
  focusNode: ContentNode;
  level: NavigationLevel;
}) {
  const children = focusNode.children ?? [];
  const related = focusNode.content?.relatedItems ?? children.map((node) => node.title);
  const metricLabel = level === 'detail' ? 'Gerelateerd' : 'Onderwerpen';
  const metricValue = related.length || children.length || 1;

  // Theme-aware kleurenpalet voor de planet-preview. Alles afgeleid van
  // focusNode.color zodat de planeet meekleurt met de actieve route.
  const planet = useMemo(() => ({
    bodyLight: mixHex(focusNode.color, '#FFFFFF', 0.5),
    bodyMid: focusNode.color,
    bodyDeep: mixHex(focusNode.color, '#040818', 0.62),
    bodyShadow: mixHex(focusNode.color, '#02030A', 0.78),
    cloudLight: mixHex(focusNode.color, '#FFFFFF', 0.32),
    cloudDeep: mixHex(focusNode.color, '#060914', 0.54),
    halo: rgbaHex(focusNode.color, 0.55),
    haloSoft: rgbaHex(focusNode.color, 0.22),
    ringStroke: rgbaHex(focusNode.color, 0.42),
    spaceDeep: mixHex(focusNode.color, '#03050E', 0.86),
    spaceMid: mixHex(focusNode.color, '#070A1A', 0.7),
  }), [focusNode.color]);

  return (
    <aside className="pointer-events-none fixed right-8 top-[18vh] z-[90] flex h-[40.25rem] w-[min(24vw,21rem)] max-w-[21rem] flex-col justify-between gap-4 rounded-[1.875rem] border border-white/15 bg-[#0a121a]/85 p-5 text-white shadow-[0_24px_90px_rgba(0,0,0,0.30)] max-[1120px]:hidden">
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">Focus</p>
        <h2 className="text-[1.85rem] font-black leading-[1.02] tracking-normal text-white">
          {focusNode.title}
        </h2>
      </div>

      {/* Theme-aware planet visualization — vervangt de oude flat circle.
          Gelaagd: deep space backdrop → starfield → orbit ring → atmospheric
          halo → planet body met surface clouds + specular highlight → kleine
          maan rechtsboven. Alle kleuren leiden af van focusNode.color. */}
      <div
        className="relative h-44 overflow-hidden rounded-[1.5rem]"
        style={{
          background: `
            radial-gradient(ellipse at 78% 22%, ${planet.haloSoft}, transparent 55%),
            radial-gradient(ellipse at 22% 80%, ${rgbaHex(focusNode.color, 0.15)}, transparent 60%),
            linear-gradient(135deg, ${planet.spaceMid} 0%, ${planet.spaceDeep} 78%)
          `,
        }}
      >
        {/* Star scatter — vaste posities zodat het stabiel oogt */}
        <div
          className="absolute inset-0 opacity-65"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 14% 22%, rgba(255,255,255,0.9), transparent 60%),
              radial-gradient(1px 1px at 68% 14%, rgba(255,255,255,0.7), transparent 60%),
              radial-gradient(1.5px 1.5px at 88% 38%, rgba(255,255,255,0.85), transparent 60%),
              radial-gradient(1px 1px at 34% 86%, rgba(255,255,255,0.6), transparent 60%),
              radial-gradient(1px 1px at 92% 72%, rgba(255,255,255,0.7), transparent 60%),
              radial-gradient(1px 1px at 6% 60%, rgba(255,255,255,0.55), transparent 60%),
              radial-gradient(1px 1px at 48% 8%, rgba(255,255,255,0.65), transparent 60%)
            `,
          }}
        />

        {/* Orbit ring achter de planeet, schuin gekanteld */}
        <div
          className="absolute left-1/2 top-[58%] h-[150px] w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            border: `1px solid ${planet.ringStroke}`,
            transform: 'translate(-50%, -50%) rotate(-22deg)',
            boxShadow: `inset 0 0 18px ${rgbaHex(focusNode.color, 0.18)}`,
          }}
        />
        <div
          className="absolute left-1/2 top-[58%] h-[168px] w-[188px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            border: `1px dashed ${rgbaHex(focusNode.color, 0.18)}`,
            transform: 'translate(-50%, -50%) rotate(-22deg)',
          }}
        />

        {/* Atmospheric halo — wijde zachte gloed rond de planet */}
        <div
          className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${planet.halo} 28%, transparent 70%)`,
            filter: 'blur(16px)',
          }}
        />

        {/* Planet body */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-[108px] w-[108px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
          style={{
            background: `
              radial-gradient(circle at 32% 26%, ${planet.bodyLight} 0%, transparent 48%),
              radial-gradient(circle at 78% 82%, ${planet.bodyShadow} 0%, transparent 58%),
              linear-gradient(140deg, ${planet.bodyMid} 0%, ${planet.bodyDeep} 100%)
            `,
            boxShadow: `
              inset -10px -12px 22px ${planet.bodyShadow}cc,
              inset 5px 5px 14px ${rgbaHex(focusNode.color, 0.4)},
              0 0 28px ${planet.halo},
              0 8px 22px rgba(0,0,0,0.45)
            `,
          }}
          animate={{ scale: [1, 1.025, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        >
          {/* Surface "continenten" — zachte organische vlekken */}
          <div
            className="absolute"
            style={{
              left: '14%',
              top: '28%',
              width: '44%',
              height: '24%',
              background: planet.cloudDeep,
              opacity: 0.42,
              borderRadius: '52% 60% 38% 70% / 60% 42% 60% 40%',
              filter: 'blur(2.5px)',
            }}
          />
          <div
            className="absolute"
            style={{
              right: '10%',
              top: '50%',
              width: '38%',
              height: '20%',
              background: planet.cloudDeep,
              opacity: 0.34,
              borderRadius: '70% 30% 60% 40% / 50% 70% 30% 50%',
              filter: 'blur(2.5px)',
            }}
          />
          <div
            className="absolute"
            style={{
              left: '32%',
              bottom: '12%',
              width: '28%',
              height: '14%',
              background: planet.cloudLight,
              opacity: 0.38,
              borderRadius: '60% 40% 70% 30% / 40% 60% 40% 60%',
              filter: 'blur(2px)',
            }}
          />

          {/* Specular highlight linksboven — geeft glossy bol-feel */}
          <div
            className="absolute"
            style={{
              left: '18%',
              top: '14%',
              width: '28%',
              height: '14%',
              background: 'rgba(255,255,255,0.55)',
              borderRadius: '50%',
              filter: 'blur(5px)',
            }}
          />

          {/* Terminator — donkere rand rechts/onder voor 3D-depth */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 30% 30%, transparent 38%, ${planet.bodyShadow}40 80%)`,
              mixBlendMode: 'multiply',
            }}
          />
        </motion.div>

        {/* Kleine maan rechtsboven */}
        <div
          className="absolute right-5 top-5 h-3.5 w-3.5 rounded-full"
          style={{
            background: `radial-gradient(circle at 32% 28%, ${planet.bodyLight}, ${planet.bodyDeep} 90%)`,
            boxShadow: `0 0 8px ${planet.haloSoft}, inset -1px -1px 2px ${planet.bodyShadow}`,
          }}
        />

        {/* Tweede verder verwijderde "ster-cluster" — accent voor diepte */}
        <div
          className="absolute bottom-4 left-5 flex gap-1.5"
          style={{ opacity: 0.7 }}
        >
          <span
            className="block h-1 w-1 rounded-full"
            style={{ background: rgbaHex(focusNode.color, 0.9), boxShadow: `0 0 4px ${planet.halo}` }}
          />
          <span className="block h-[3px] w-[3px] rounded-full bg-white/70" />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between text-sm font-semibold text-white/60">
          <span>{metricLabel}</span>
          <span>{metricValue}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(92, Math.max(34, metricValue * 16))}%`,
              backgroundColor: focusNode.color,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {related.slice(0, 3).map((item) => (
          <div key={item} className="rounded-2xl bg-white/[0.08] px-3.5 py-3 text-sm font-semibold leading-4 text-white/75">
            {item}
          </div>
        ))}
      </div>
    </aside>
  );
});

const TouchInstructionDock = memo(function TouchInstructionDock({
  level,
  onHome,
}: {
  level: NavigationLevel;
  onHome: () => void;
}) {
  return (
    <div className="pointer-events-auto fixed bottom-24 left-1/2 z-[95] flex w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-4 rounded-[1.65rem] border border-white/15 bg-[#0a121a]/85 p-3 text-white shadow-[0_22px_74px_rgba(0,0,0,0.34)] sm:bottom-8">
      <div className="flex min-w-0 items-center gap-3 px-2">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.06]">
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-4 text-white">Draai om te verkennen</p>
          <p className="mt-1 text-xs font-medium leading-4 text-white/50">
            {level === 'main' ? 'Tik op een planeet voor de route' : 'Tik op een onderwerp voor detail'}
          </p>
        </div>
      </div>

      <div className="hidden h-11 w-px bg-white/10 sm:block" />

      <div className="flex flex-shrink-0 gap-2">
        <button
          type="button"
          onClick={onHome}
          className="rounded-[1.125rem] bg-white/[0.10] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Home
        </button>
        <div className="rounded-[1.125rem] bg-white px-5 py-3 text-sm font-extrabold text-[#071016]">
          {level === 'detail' ? 'Detail open' : 'Open route'}
        </div>
      </div>
    </div>
  );
});

export function TableApp() {
  const { connected, health, publishNavigation, resetNavigation } = useNavigationSocket('table');
  const [navState, setNavState] = useState<NavigationState>({
    level: 'main',
    selectedMain: null,
    selectedSub: null
  });

  const [currentTheme, setCurrentTheme] = useState('main');
  const [nearestPlanet, setNearestPlanet] = useState<ContentNode | null>(null);
  const visualStyle = DEFAULT_VISUAL_STYLE;

  const handleSelectMain = useCallback((node: ContentNode) => {
    setNavState({
      level: 'submenu',
      selectedMain: node,
      selectedSub: null
    });
    setCurrentTheme(node.theme);
    publishNavigation({
      level: 'submenu',
      mainId: node.id,
      theme: node.theme,
      visualStyle: DEFAULT_VISUAL_STYLE,
    });
  }, [publishNavigation]);

  const handleSelectSub = useCallback((node: ContentNode) => {
    if (!navState.selectedMain) return;

    setNavState(prev => ({
      level: 'detail',
      selectedMain: prev.selectedMain,
      selectedSub: node
    }));
    publishNavigation({
      level: 'detail',
      mainId: navState.selectedMain.id,
      subId: node.id,
      theme: node.theme,
      visualStyle: DEFAULT_VISUAL_STYLE,
    });
  }, [navState.selectedMain, publishNavigation]);

  const focusThrottleRef = useRef(0);

  const handleFocusChange = useCallback((node: ContentNode) => {
    const now = performance.now();
    // Throttle theme changes to avoid excessive re-renders during fast spinning
    if (now - focusThrottleRef.current < 50) return;
    focusThrottleRef.current = now;

    startTransition(() => {
      setCurrentTheme(node.theme);
      setNearestPlanet(node);
    });
    publishNavigation({
      level: 'main',
      theme: node.theme,
      visualStyle: DEFAULT_VISUAL_STYLE,
    });
  }, [publishNavigation]);

  const handleHome = useCallback(() => {
    setNavState({
      level: 'main',
      selectedMain: null,
      selectedSub: null
    });
    setCurrentTheme('main');
    setNearestPlanet(null);
    resetNavigation();
  }, [resetNavigation]);

  const handleBack = useCallback(() => {
    if (navState.level === 'detail' && navState.selectedMain) {
      setNavState({
        level: 'submenu',
        selectedMain: navState.selectedMain,
        selectedSub: null
      });
      setCurrentTheme(navState.selectedMain.theme);
      publishNavigation({
        level: 'submenu',
        mainId: navState.selectedMain.id,
        theme: navState.selectedMain.theme,
        visualStyle: DEFAULT_VISUAL_STYLE,
      });
      return;
    }

    if (navState.level === 'submenu') {
      handleHome();
    }
  }, [handleHome, navState, publishNavigation]);

  const relatedNodes = useMemo(() => {
    if (navState.level === 'detail' && navState.selectedMain && navState.selectedSub) {
      return navState.selectedMain.children?.filter(n => n.id !== navState.selectedSub?.id) || [];
    }
    return [];
  }, [navState]);

  const activeRouteNode = navState.selectedMain ?? nearestPlanet ?? contentData[1] ?? contentData[0];
  const focusNode = navState.selectedSub ?? navState.selectedMain ?? nearestPlanet ?? contentData[1] ?? contentData[0];

  return (
    <div
      className="relative isolate size-full min-h-screen overflow-hidden bg-[#071016] text-white select-none"
      data-visual-style={visualStyle}
    >
      {/* Vector scene layer. Pointer-events zijn uitgeschakeld. */}
      <SpaceCanvas
        theme={currentTheme}
        surface="table"
        centralPlanetColor={navState.level === 'submenu'
          ? navState.selectedMain?.color ?? nearestPlanet?.color
          : nearestPlanet?.color}
        showCentralPlanet={navState.level !== 'detail'}
      />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_43%,rgba(70,180,105,0.18),transparent_24%),radial-gradient(circle_at_18%_82%,rgba(255,51,68,0.18),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(30,144,255,0.18),transparent_24%),linear-gradient(135deg,rgba(7,16,22,0.54),rgba(17,19,28,0.38))]" />
      <div className="pointer-events-none absolute inset-0 z-[1] opacity-[0.10] [background-image:linear-gradient(115deg,rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.20)_1px,transparent_1px)] [background-size:88px_88px,144px_144px]" />

      {/* Dev FPS overlay — alleen in development build */}
      <PerfStats />

      <ConnectionPill connected={connected} health={health} />
      <RouteCommandPanel activeNode={activeRouteNode} onSelectNode={handleSelectMain} />
      <FocusPreviewPanel focusNode={focusNode} level={navState.level} />
      <TouchInstructionDock level={navState.level} onHome={handleHome} />

      {/* iXperium branding */}
      <motion.div
        className="app-branding fixed left-8 top-8 z-[200] flex items-center gap-4 text-left"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="app-branding__mark h-11 w-11 rounded-[0.9rem] bg-gradient-to-br from-[#46B469] to-[#1E90FF] shadow-[0_16px_42px_rgba(70,180,105,0.24)]" />
        <div>
          <h1 className="text-2xl font-black leading-7 tracking-normal text-white drop-shadow-lg">
            iXperium
          </h1>
          <p className="mt-1 text-xs font-semibold text-white/55">Smart Industry touchtafel</p>
        </div>
      </motion.div>

      {/* Navigation buttons */}
      <AnimatePresence>
        {navState.level !== 'main' && (
          <NavigationButton
            onClick={navState.level === 'submenu' ? handleBack : handleHome}
            type={navState.level === 'submenu' ? 'back' : 'home'}
          />
        )}
      </AnimatePresence>

      {/* Main navigation view */}
      <AnimatePresence mode="wait">
        {navState.level === 'main' && (
          <motion.div
            key="main"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {/* Title */}
            <motion.div
              className="absolute left-1/2 top-[7.5rem] z-10 w-[min(78vw,28rem)] -translate-x-1/2 text-center"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              <p className="table-help text-base font-semibold text-white/60 sm:text-lg">
                Draai om te verkennen · Tik om te verdiepen
              </p>
            </motion.div>

            {/* Central planet — WebGL doet de bol, DOM doet alleen het label */}
            <CentralPlanet accentColor={nearestPlanet?.color ?? '#8B5CF6'} />

            <OrbitRing
              nodes={contentData}
              onSelectNode={handleSelectMain}
              onFocusChange={navState.level === 'main' ? handleFocusChange : undefined}
              radiusX={TABLE_MAIN_ORBIT.radiusX}
              radiusY={TABLE_MAIN_ORBIT.radiusY}
              centerOffsetX={20}
              centerMaskRadius={TABLE_MAIN_ORBIT.centerMaskRadius}
              visualStyle={visualStyle}
            />
          </motion.div>
        )}

        {/* Submenu view */}
        {navState.level === 'submenu' && navState.selectedMain && (
          <motion.div
            key="submenu"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {/* Breadcrumb */}
            <motion.div
              className="absolute left-1/2 top-[7.5rem] -translate-x-1/2 text-center z-10"
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="table-eyebrow mb-2 text-base font-semibold text-white/50">Geselecteerde route</p>
              <h2 className="table-title text-4xl font-bold text-white drop-shadow-lg">
                {navState.selectedMain.title}
              </h2>
            </motion.div>

            {/* Center planet */}
            <Planet
              node={navState.selectedMain}
              angle={0}
              isCenter
              visualStyle={visualStyle}
            />

            {/* Submenu orbit */}
            {navState.selectedMain.children && navState.selectedMain.children.length > 0 && (
              <OrbitRing
                nodes={navState.selectedMain.children}
                onSelectNode={handleSelectSub}
                radiusX={TABLE_SUBMENU_ORBIT.radiusX}
                radiusY={TABLE_SUBMENU_ORBIT.radiusY}
                centerOffsetX={20}
                centerMaskRadius={TABLE_SUBMENU_ORBIT.centerMaskRadius}
                visualStyle={visualStyle}
              />
            )}
          </motion.div>
        )}

        {/* Detail view */}
        {navState.level === 'detail' && navState.selectedSub && navState.selectedMain && (
          <motion.div
            key="detail"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <ContentView
              node={navState.selectedSub}
              relatedNodes={relatedNodes}
              onSelectRelated={handleSelectSub}
              visualStyle={visualStyle}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TableApp;
