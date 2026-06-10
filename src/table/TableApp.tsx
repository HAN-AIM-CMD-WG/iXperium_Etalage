import { startTransition, useState, useCallback, useMemo, memo, useRef, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { contentData, type ContentNode } from '../shared/content';
import type { ConnectionHealth } from '../shared/protocol';
import { DEFAULT_VISUAL_STYLE } from '../shared/visualStyle';
import { useNavigationSocket } from '../shared/useNavigationSocket';
import { Planet } from '../app/components/Planet';
import { OrbitRing, type PlanetSelectOrigin } from '../app/components/OrbitRing';
import { ContentView } from '../app/components/ContentView';
import { FlyingPlanet, type FlyMode } from '../app/components/FlyingPlanet';
import { SpaceCanvas } from '../app/components/scene/SpaceCanvas';
import { PerfStats } from '../app/components/scene/PerfStats';
import ixperiumLogoUrl from '../../zooi/Ixperiumlogo.png';

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
// Diameter (px) waar een fly-to-center planeet naartoe schaalt — ongeveer de
// grootte van de centrum-planeet.
const CENTER_FLY_DIAMETER = 300;
const FOCUS_SYNC_THROTTLE_MS = 220;
const PANEL_BACKGROUND = 'rgba(30, 8, 58, 0.30)';
const PANEL_LAYOUT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PANEL_LAYOUT_TRANSITION = {
  layout: { duration: 0.48, ease: PANEL_LAYOUT_EASE },
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

function mixHexRgba(hex: string, target: string, amount: number, alpha: number) {
  const sourceRgb = hexToRgb(hex);
  const targetRgb = hexToRgb(target);
  const t = Math.min(1, Math.max(0, amount));
  const r = Math.round(sourceRgb.r + (targetRgb.r - sourceRgb.r) * t);
  const g = Math.round(sourceRgb.g + (targetRgb.g - sourceRgb.g) * t);
  const b = Math.round(sourceRgb.b + (targetRgb.b - sourceRgb.b) * t);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbaHex(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Flat/pastel variant van een routekleur — mengt fors richting wit zodat de
 * swatch zachter en minder verzadigd oogt en beter aansluit op de pastel-
 * kleuren die de thema-paletten zelf gebruiken.
 */
function pastel(hex: string) {
  return mixHex(hex, '#FFFFFF', 0.5);
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
      <div
        className="relative flex h-[21rem] w-[21rem] items-center justify-center"
        // CSS-animatie i.p.v. framer JS-loop: zelfde float (orbit-float =
        // translate3d 0/-5px/0), maar volledig op de compositor-thread.
        style={{ animation: 'orbit-float 7s linear infinite', willChange: 'transform' }}
      >
        <div
          className="central-planet-label ixperium-core-mark relative z-10 w-[min(17.5rem,38vw)] text-center"
          style={{
            '--central-accent': accentColor,
            '--central-glow': rgbaHex(accentColor, 0.72),
            '--central-logo-glow-core': mixHexRgba(accentColor, '#FFFFFF', 0.46, 0.95),
            '--central-logo-glow-soft': mixHexRgba(accentColor, '#FFFFFF', 0.72, 0.86),
          } as CSSProperties & {
            '--central-accent': string;
            '--central-glow': string;
            '--central-logo-glow-core': string;
            '--central-logo-glow-soft': string;
          }}
        >
          <img
            className="ixperium-core-mark__logo"
            src={ixperiumLogoUrl}
            alt="iXperium Centre of Expertise"
            draggable={false}
          />
        </div>
      </div>
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
    <motion.aside
      layout
      transition={PANEL_LAYOUT_TRANSITION}
      className="pointer-events-auto fixed left-8 top-[18vh] z-[90] flex w-[min(24vw,21rem)] max-w-[21rem] flex-col gap-4 rounded-[1.875rem] border border-white/15 p-5 text-white shadow-[0_24px_90px_rgba(0,0,0,0.30)] backdrop-blur-xl max-[1120px]:hidden"
      style={{ backgroundColor: PANEL_BACKGROUND }}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold tracking-[0.24em] text-white/55">Routebord</p>
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
                className="h-11 w-11 flex-shrink-0 rounded-[0.875rem]"
                style={{ backgroundColor: pastel(node.color) }}
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
    </motion.aside>
  );
});

const FocusPreviewPanel = memo(function FocusPreviewPanel({
  routeNode,
  focusNode,
  progress,
}: {
  routeNode: ContentNode;
  focusNode: ContentNode;
  progress: number;
}) {
  // Alle onderwerpen binnen de gekozen kennisroute.
  const topics = [...(routeNode.children ?? [])].reverse();
  // Foto die bij het thema/onderwerp past — afkomstig uit dit project
  // (src/assets/topics) of de iXperium-bronafbeeldingen in content.ts.
  const image = focusNode.content?.image ?? routeNode.content?.image;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const barColor = mixHex(routeNode.color, '#FFFFFF', 0.32);

  return (
    <motion.aside
      layout
      transition={PANEL_LAYOUT_TRANSITION}
      className="pointer-events-none fixed right-8 top-[16vh] z-[90] flex max-h-[74vh] w-[min(24vw,21rem)] max-w-[21rem] flex-col gap-4 rounded-[1.875rem] border border-white/15 p-5 text-white shadow-[0_24px_90px_rgba(0,0,0,0.30)] backdrop-blur-xl max-[1120px]:hidden"
      style={{ backgroundColor: PANEL_BACKGROUND }}
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold tracking-[0.24em] text-white/55">Kennisroute</p>
        <h2 className="text-[1.7rem] font-black leading-[1.02] tracking-normal text-white">
          {routeNode.title}
        </h2>
      </div>

      {/* Thema-foto in plaats van de oude vector-planeet. Volgt de route of het
          onderwerp dat in focus staat. */}
      <div className="relative h-40 flex-shrink-0 overflow-hidden rounded-[1.5rem] bg-black/30">
        {image ? (
          <img
            src={image}
            alt={focusNode.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: `linear-gradient(135deg, ${routeNode.color}, ${mixHex(routeNode.color, '#040818', 0.6)})` }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(18,6,30,0.6)] to-transparent" />
      </div>

      <div className="flex flex-shrink-0 flex-col">
        <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${clampedProgress * 100}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Volledige lijst met onderwerpen; het onderwerp in focus is gemarkeerd. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {topics.length > 0 ? (
          topics.map((topic) => {
            const active = topic.id === focusNode.id;
            return (
              <div
                key={topic.id}
                className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold leading-4 transition-colors"
                style={{
                  backgroundColor: active ? rgbaHex(routeNode.color, 0.4) : 'rgba(255,255,255,0.08)',
                  color: active ? '#FFFFFF' : 'rgba(255,255,255,0.78)',
                }}
              >
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: pastel(topic.color) }}
                />
                <span className="min-w-0 truncate">{topic.title}</span>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl bg-white/[0.08] px-3.5 py-3 text-sm font-semibold text-white/70">
            Geen onderwerpen beschikbaar
          </div>
        )}
      </div>
    </motion.aside>
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
  // Onderwerp (kind) dat in de submenu-ring in focus staat — voedt de
  // voortgangsbalk + markering in het rechter venster terwijl je door de
  // onderwerp-planeten scrollt.
  const [focusedSub, setFocusedSub] = useState<ContentNode | null>(null);
  // Transiente fly-animatie state. Wanneer gezet rendert de FlyingPlanet overlay.
  const [flyState, setFlyState] = useState<{
    node: ContentNode;
    origin: PlanetSelectOrigin;
    mode: FlyMode;
  } | null>(null);
  const focusThrottleRef = useRef(0);
  const lastSyncedFocusNodeIdRef = useRef<string | null>(null);
  const visualStyle = DEFAULT_VISUAL_STYLE;

  const handleSelectMain = useCallback((node: ContentNode, origin?: PlanetSelectOrigin) => {
    // Route → centrum: laat de planeet naar het midden vliegen en commit
    // meteen de submenu-state zodat de centrum-planeet + kinderen verschijnen.
    if (origin) {
      setFlyState({ node, origin, mode: 'toCenter' });
    }
    setNavState({
      level: 'submenu',
      selectedMain: node,
      selectedSub: null,
    });
    setCurrentTheme(node.theme);
    setNearestPlanet(node);
    setFocusedSub(null);
    lastSyncedFocusNodeIdRef.current = node.id;
    focusThrottleRef.current = performance.now();
    publishNavigation({
      level: 'submenu',
      mainId: node.id,
      theme: node.theme,
      visualStyle: DEFAULT_VISUAL_STYLE,
    });
  }, [publishNavigation]);

  const handleSelectSub = useCallback((node: ContentNode, origin?: PlanetSelectOrigin) => {
    if (!navState.selectedMain) return;

    // Sub-onderwerp → cross-screen handoff: de planeet vliegt omhoog van de
    // tafel af. De tafel blijft op submenu (zodat je verder kunt verkennen);
    // de kiosk ontvangt 'detail' via de websocket en speelt zijn eigen
    // rise-from-bottom + expand animatie af.
    if (origin) {
      setFlyState({ node, origin, mode: 'upOff' });
    }
    publishNavigation({
      level: 'detail',
      mainId: navState.selectedMain.id,
      subId: node.id,
      theme: node.theme,
      visualStyle: DEFAULT_VISUAL_STYLE,
      // Stuur de planeet-snapshot mee zodat de kiosk exact dezelfde planeet
      // van onder laat opstijgen.
      planetImage: origin?.image,
    });
  }, [navState.selectedMain, publishNavigation]);

  const handleFlyComplete = useCallback(() => {
    setFlyState(null);
  }, []);

  const handleFocusChange = useCallback((node: ContentNode) => {
    if (lastSyncedFocusNodeIdRef.current === node.id) return;

    const now = performance.now();
    const isInitialFocus = lastSyncedFocusNodeIdRef.current === null;
    // Theme/socket updates are visible only when the focused route changes.
    if (!isInitialFocus && now - focusThrottleRef.current < FOCUS_SYNC_THROTTLE_MS) return;
    focusThrottleRef.current = now;
    lastSyncedFocusNodeIdRef.current = node.id;

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

  // Lichtgewicht focus-handler voor de submenu-ring: alleen lokale state, geen
  // socket-publicatie. Houdt bij welk onderwerp-planeet vooraan staat zodat de
  // voortgangsbalk meeloopt terwijl je door de onderwerpen scrollt.
  const handleSubFocusChange = useCallback((node: ContentNode) => {
    startTransition(() => setFocusedSub(node));
  }, []);

  const handleHome = useCallback(() => {
    setNavState({
      level: 'main',
      selectedMain: null,
      selectedSub: null
    });
    setCurrentTheme('main');
    setNearestPlanet(null);
    setFocusedSub(null);
    focusThrottleRef.current = 0;
    lastSyncedFocusNodeIdRef.current = null;
    resetNavigation();
  }, [resetNavigation]);

  const relatedNodes = useMemo(() => {
    if (navState.level === 'detail' && navState.selectedMain && navState.selectedSub) {
      return navState.selectedMain.children?.filter(n => n.id !== navState.selectedSub?.id) || [];
    }
    return [];
  }, [navState]);

  const activeRouteNode = navState.selectedMain ?? nearestPlanet ?? contentData[1] ?? contentData[0];

  // Het rechter venster toont de gekozen kennisroute + al haar onderwerpen.
  // - In de hoofdring scroll je door de routes: voortgang = positie van de
  //   route in de ring; de foto volgt de route in focus.
  // - In een submenu scroll je door de onderwerpen: voortgang = positie van het
  //   onderwerp in de lijst; de foto + markering volgen dat onderwerp.
  const inSubmenu = navState.level === 'submenu' && Boolean(navState.selectedMain?.children?.length);
  const panelFocusNode = inSubmenu
    ? (focusedSub ?? navState.selectedMain ?? activeRouteNode)
    : (nearestPlanet ?? activeRouteNode);

  const progress = (() => {
    if (inSubmenu) {
      const kids = navState.selectedMain!.children!;
      const idx = focusedSub ? kids.findIndex((k) => k.id === focusedSub.id) : -1;
      return kids.length > 1 ? Math.max(0, idx) / (kids.length - 1) : 1;
    }
    const focusId = nearestPlanet?.id ?? activeRouteNode.id;
    const idx = contentData.findIndex((n) => n.id === focusId);
    return contentData.length > 1 ? Math.max(0, idx) / (contentData.length - 1) : 1;
  })();

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
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_43%,rgba(102,42,136,0.22),transparent_24%),radial-gradient(circle_at_18%_82%,rgba(255,51,68,0.18),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(30,144,255,0.18),transparent_24%),linear-gradient(135deg,rgba(7,16,22,0.54),rgba(17,19,28,0.38))]" />
      <div className="pointer-events-none absolute inset-0 z-[1] opacity-[0.10] [background-image:linear-gradient(115deg,rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.20)_1px,transparent_1px)] [background-size:88px_88px,144px_144px]" />

      {/* Dev FPS overlay — alleen in development build */}
      <PerfStats />

      <ConnectionPill connected={connected} health={health} />
      <RouteCommandPanel activeNode={activeRouteNode} onSelectNode={handleSelectMain} />
      <FocusPreviewPanel routeNode={activeRouteNode} focusNode={panelFocusNode} progress={progress} />

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

      {/* Fly-to-center / fly-up overlay — de getapte planeet zelf verplaatst
          + vergroot (de orbit-planeet is verborgen via hiddenNodeId). */}
      <AnimatePresence>
        {flyState && (
          <FlyingPlanet
            key={`${flyState.mode}-${flyState.node.id}`}
            origin={flyState.origin}
            color={flyState.node.color}
            mode={flyState.mode}
            centerDiameter={CENTER_FLY_DIAMETER}
            title={getCompactTitle(flyState.node.title)}
            onComplete={handleFlyComplete}
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
              hiddenNodeId={flyState?.mode === 'toCenter' ? flyState.node.id : null}
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

            {/* Center planet — met terug-knop boven de titel */}
            <Planet
              node={navState.selectedMain}
              angle={0}
              isCenter
              visualStyle={visualStyle}
              onBack={handleHome}
            />

            {/* Submenu orbit */}
            {navState.selectedMain.children && navState.selectedMain.children.length > 0 && (
              <OrbitRing
                nodes={navState.selectedMain.children}
                onSelectNode={handleSelectSub}
                onFocusChange={handleSubFocusChange}
                radiusX={TABLE_SUBMENU_ORBIT.radiusX}
                radiusY={TABLE_SUBMENU_ORBIT.radiusY}
                centerOffsetX={20}
                centerMaskRadius={TABLE_SUBMENU_ORBIT.centerMaskRadius}
                visualStyle={visualStyle}
                hiddenNodeId={flyState?.mode === 'upOff' ? flyState.node.id : null}
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
