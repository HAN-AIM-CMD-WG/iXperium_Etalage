import { startTransition, useDeferredValue, useState, useCallback, useMemo, memo, useRef, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { contentData, type ContentNode } from '../shared/content';
import { DEFAULT_VISUAL_STYLE } from '../shared/visualStyle';
import { useNavigationSocket } from '../shared/useNavigationSocket';
import { useIdleTimeout } from '../shared/useIdleTimeout';
import { useRenderProfile } from '../shared/renderProfile';
import { Planet } from '../app/components/Planet';
import { OrbitRing, type OrbitAutoSelectRequest, type PlanetSelectOrigin } from '../app/components/OrbitRing';
import { ContentView } from '../app/components/ContentView';
import { FlyingPlanet, type FlyMode } from '../app/components/FlyingPlanet';
import { SpaceCanvas } from '../app/components/scene/SpaceCanvas';
import smartIndustryWordmarkUrl from '../../Smart-Industry-wit.png';
// Brede witte "iXperium Smart Industry" wordmark — dezelfde asset als de
// hero-banner op het kioskscherm (index2.html), hier linksboven als branding.
import smartIndustryBrandUrl from '../../zooi/Smart-Industry-wit.png';

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
// Na deze periode zonder gebruikers-input valt de tafel (en via de socket ook
// de kiosk) terug naar het startscherm. Elke interactie zet de klok opnieuw.
const IDLE_RESET_MS = 5 * 60 * 1000;
const PANEL_BACKGROUND = 'rgba(30, 8, 58, 0.30)';
const PANEL_LAYOUT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const VIEW_TRANSITION = {
  duration: 0.2,
  ease: PANEL_LAYOUT_EASE,
};
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

function rgbaHex(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getThemePanelStyle(node: ContentNode | null, selected: boolean): CSSProperties {
  if (!node) {
    return { backgroundColor: PANEL_BACKGROUND };
  }

  return {
    background: `linear-gradient(145deg, ${rgbaHex(node.color, selected ? 0.46 : 0.26)} 0%, rgba(18, 6, 34, ${selected ? 0.74 : 0.58}) 48%, ${rgbaHex(node.color, selected ? 0.28 : 0.14)} 100%)`,
    borderColor: rgbaHex(node.color, selected ? 0.74 : 0.38),
    boxShadow: [
      `0 0 0 2px ${rgbaHex(node.color, selected ? 0.2 : 0.08)}`,
      `0 0 ${selected ? 52 : 28}px ${rgbaHex(node.color, selected ? 0.36 : 0.16)}`,
      '0 24px 90px rgba(0,0,0,0.30)',
    ].join(', '),
  };
}

/**
 * Flat/pastel variant van een routekleur — mengt fors richting wit zodat de
 * swatch zachter en minder verzadigd oogt en beter aansluit op de pastel-
 * kleuren die de thema-paletten zelf gebruiken.
 */
function pastel(hex: string) {
  return mixHex(hex, '#FFFFFF', 0.5);
}

function routeSwatchColor(hex: string) {
  return mixHex(hex, '#FFFFFF', 0.18);
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
const CentralPlanet = memo(function CentralPlanet() {
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
        >
          <img
            className="ixperium-core-mark__logo"
            src={smartIndustryWordmarkUrl}
            alt="Smart Industry"
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
        <h2 className="text-[2.35rem] font-black leading-[0.98] tracking-normal text-white">
          Kies een kennisroute
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
                style={{ backgroundColor: routeSwatchColor(node.color) }}
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
  themeSelected,
  interactive,
  pendingTopicId,
  onSelectTopic,
}: {
  routeNode: ContentNode;
  focusNode: ContentNode;
  progress: number;
  themeSelected: boolean;
  /** Alleen in een submenu draaien deze onderwerpen ook echt in de ring; dan
   *  zijn de items aanklikbaar. */
  interactive: boolean;
  /** Onderwerp waar de ring momenteel naartoe draait. */
  pendingTopicId: string | null;
  onSelectTopic: (topic: ContentNode) => void;
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
      className={`pointer-events-none flex w-full flex-col gap-4 rounded-[1.875rem] border p-5 text-white shadow-[0_24px_90px_rgba(0,0,0,0.30)] backdrop-blur-xl transition-[background,border-color,box-shadow] duration-500 ${themeSelected ? 'max-h-[calc(74vh-5.75rem)]' : 'max-h-[74vh]'}`}
      style={getThemePanelStyle(routeNode, themeSelected)}
    >
      {themeSelected && (
        <div
          className="h-2 w-full flex-shrink-0 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.18)]"
          style={{ background: `linear-gradient(90deg, ${routeNode.color}, ${barColor})` }}
        />
      )}

      <div className="flex flex-col gap-2.5">
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

      {/* Volledige lijst met onderwerpen; het onderwerp in focus is gemarkeerd.
          In een submenu is elk onderwerp aanklikbaar: de ring draait het naar
          voren en selecteert het daarna automatisch. */}
      <div
        className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 ${interactive ? 'pointer-events-auto' : ''}`}
      >
        {topics.length > 0 ? (
          topics.map((topic) => {
            const active = topic.id === focusNode.id;
            const pending = topic.id === pendingTopicId;
            const highlighted = active || pending;
            const style: CSSProperties = {
              backgroundColor: highlighted ? rgbaHex(routeNode.color, 0.4) : 'rgba(255,255,255,0.08)',
              color: highlighted ? '#FFFFFF' : 'rgba(255,255,255,0.78)',
              boxShadow: pending ? `0 0 0 2px ${rgbaHex(routeNode.color, 0.85)}` : undefined,
            };
            const content = (
              <>
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: pastel(topic.color) }}
                />
                <span className="min-w-0 truncate">{topic.title}</span>
              </>
            );

            if (!interactive) {
              return (
                <div
                  key={topic.id}
                  className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold leading-4 transition-colors"
                  style={style}
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => onSelectTopic(topic)}
                aria-pressed={pending}
                className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold leading-4 transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={style}
              >
                {content}
              </button>
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

const BackToRoutesButton = memo(function BackToRoutesButton({
  node,
  onBack,
}: {
  node: ContentNode;
  onBack: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onBack}
      className="pointer-events-auto relative flex min-h-[4.5rem] w-full items-center gap-3 overflow-hidden rounded-[1.35rem] border-4 border-white/75 px-4 py-3 text-left text-[#07185f] shadow-[0_8px_0_rgba(7,24,95,0.72),0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/75"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(217,241,255,0.76) 46%, rgba(244,250,255,0.58) 100%)',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -12px 28px rgba(97,177,255,0.16), 0 8px 0 rgba(7,24,95,0.72), 0 0 34px ${node.color}88, 0 18px 48px rgba(0,0,0,0.34)`,
      }}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.26, ease: PANEL_LAYOUT_EASE }}
      whileTap={{ scale: 0.97, y: 2 }}
    >
      <span className="relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[0.9rem] border border-white/40 bg-[#07185f]/85 text-white shadow-[0_4px_0_rgba(7,24,95,0.28),inset_0_1px_0_rgba(255,255,255,0.24)]">
        <ChevronLeft className="h-7 w-7" strokeWidth={3.5} />
      </span>
      <span className="relative z-10 min-w-0 text-[1.02rem] font-black leading-[1.06] tracking-[0.035em]">
        terug naar kennisroutes
      </span>
    </motion.button>
  );
});

const RightPanelStack = memo(function RightPanelStack({
  routeNode,
  focusNode,
  progress,
  selectedNode,
  topicsInteractive,
  pendingTopicId,
  onSelectTopic,
  onBack,
}: {
  routeNode: ContentNode;
  focusNode: ContentNode;
  progress: number;
  selectedNode: ContentNode | null;
  topicsInteractive: boolean;
  pendingTopicId: string | null;
  onSelectTopic: (topic: ContentNode) => void;
  onBack: () => void;
}) {
  return (
    <div className="pointer-events-none fixed right-8 top-[16vh] z-[90] flex w-[min(24vw,21rem)] max-w-[21rem] flex-col gap-3 max-[1120px]:hidden">
      <FocusPreviewPanel
        routeNode={routeNode}
        focusNode={focusNode}
        progress={progress}
        themeSelected={Boolean(selectedNode)}
        interactive={topicsInteractive}
        pendingTopicId={pendingTopicId}
        onSelectTopic={onSelectTopic}
      />
      <AnimatePresence initial={false}>
        {selectedNode && (
          <BackToRoutesButton
            key={selectedNode.id}
            node={selectedNode}
            onBack={onBack}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

export function TableApp() {
  const { publishNavigation, resetNavigation } = useNavigationSocket('table');
  const [navState, setNavState] = useState<NavigationState>({
    level: 'main',
    selectedMain: null,
    selectedSub: null
  });

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
  const lastPreviewFocusNodeIdRef = useRef<string | null>(null);
  // Verzoek aan de submenu-ring: draai dit onderwerp naar voren en selecteer
  // het daarna automatisch. De nonce zorgt dat twee keer hetzelfde onderwerp
  // aanklikken ook twee keer een animatie start.
  const [autoSelectRequest, setAutoSelectRequest] = useState<OrbitAutoSelectRequest | null>(null);
  const autoSelectNonceRef = useRef(0);
  const visualStyle = DEFAULT_VISUAL_STYLE;
  const renderProfile = useRenderProfile();

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
    setNearestPlanet(node);
    setFocusedSub(null);
    setAutoSelectRequest(null);
    lastPreviewFocusNodeIdRef.current = node.id;
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

  // Klik in het rechter paneel: laat de ring dit onderwerp naar voren draaien.
  // De selectie zelf gebeurt pas als de planeet vooraan staat (zie
  // handleAutoSelectComplete), zodat het exact hetzelfde voelt als zelf tikken.
  const handleSelectTopicFromPanel = useCallback((node: ContentNode) => {
    autoSelectNonceRef.current += 1;
    setAutoSelectRequest({ nodeId: node.id, nonce: autoSelectNonceRef.current });
  }, []);

  const handleAutoSelectComplete = useCallback((node: ContentNode, origin?: PlanetSelectOrigin) => {
    setAutoSelectRequest(null);
    handleSelectSub(node, origin);
  }, [handleSelectSub]);

  const handleFocusChange = useCallback((node: ContentNode) => {
    if (lastPreviewFocusNodeIdRef.current === node.id) return;

    const now = performance.now();
    const isInitialFocus = lastPreviewFocusNodeIdRef.current === null;
    // On the unselected home screen this is only a lightweight preview signal.
    // Do not drive the full-screen theme/socket from auto-rotating focus: on
    // weaker Chromium/GPU setups that created near-continuous backdrop
    // crossfades when returning home or dragging the orbit.
    if (!isInitialFocus && now - focusThrottleRef.current < FOCUS_SYNC_THROTTLE_MS) return;
    focusThrottleRef.current = now;
    lastPreviewFocusNodeIdRef.current = node.id;

    startTransition(() => {
      setNearestPlanet(node);
    });
  }, []);

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
    setNearestPlanet(null);
    setFocusedSub(null);
    setAutoSelectRequest(null);
    focusThrottleRef.current = 0;
    lastPreviewFocusNodeIdRef.current = null;
    resetNavigation();
  }, [resetNavigation]);

  // Inactiviteit-reset: staat er een kennisroute open, dan valt de tafel na
  // IDLE_RESET_MS zonder input terug naar het startscherm. Op het startscherm
  // zelf is er niets te resetten, dus dan loopt de timer niet.
  useIdleTimeout({
    timeoutMs: IDLE_RESET_MS,
    enabled: navState.level !== 'main',
    onIdle: handleHome,
  });

  const relatedNodes = useMemo(() => {
    if (navState.level === 'detail' && navState.selectedMain && navState.selectedSub) {
      return navState.selectedMain.children?.filter(n => n.id !== navState.selectedSub?.id) || [];
    }
    return [];
  }, [navState]);

  const activeRouteNode = navState.selectedMain ?? nearestPlanet ?? contentData[1] ?? contentData[0];
  const selectedThemeNode = navState.selectedMain;
  // Kleur volgt de route in focus: een gekozen route wint, anders de route die
  // vooraan in de ring staat (home). Zo kleurt het universum dynamisch mee
  // terwijl je door de ring draait en is de routekleur al (bijna) toegepast op
  // het moment dat je een route kiest — de selectie-transitie heeft dan nog
  // nauwelijks kleurwerk te doen en voelt strak.
  const themeNode = selectedThemeNode ?? nearestPlanet;
  // De zware backdrop-recolor (≈10 crossfade-lagen die opnieuw rasteren, incl.
  // de 1800px disk-SVG) via useDeferredValue loskoppelen van de urgente
  // view/orbit-wissel. Twee voordelen: bij een routekeuze vallen het mounten van
  // de nieuwe OrbitRing en de recolor in aparte frames (geen dubbele hik), en
  // bij snel slepen door de ring coalesceert React de focus-wissels — alleen de
  // laatste kleur commit als de main thread druk is, dus geen stapel crossfades.
  // De crossfade zelf is interruptible (zie ThemeCrossfadeStack): een nieuwe wens
  // halverwege keert de lopende fade om i.p.v. een tweede in de wachtrij te zetten.
  const sceneTheme = useDeferredValue(themeNode?.theme ?? 'main');
  const pageAccentNode = themeNode;
  const pageAccentStyle = pageAccentNode
    ? ({
        '--table-accent': pageAccentNode.color,
        '--table-accent-soft': rgbaHex(pageAccentNode.color, selectedThemeNode ? 0.34 : 0.16),
        '--table-accent-wash': rgbaHex(pageAccentNode.color, selectedThemeNode ? 0.22 : 0.1),
        '--table-accent-rim': rgbaHex(pageAccentNode.color, selectedThemeNode ? 0.52 : 0.26),
      } as CSSProperties & Record<string, string>)
    : undefined;

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
      data-theme-selected={selectedThemeNode ? 'true' : 'false'}
      data-render-profile={renderProfile}
      style={pageAccentStyle}
    >
      {/* Vector scene layer. Pointer-events zijn uitgeschakeld. */}
      <SpaceCanvas
        theme={sceneTheme}
        surface="table"
        centralPlanetColor={themeNode?.color}
        showCentralPlanet={navState.level !== 'detail'}
      />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_43%,rgba(102,42,136,0.22),transparent_24%),radial-gradient(circle_at_18%_82%,rgba(255,51,68,0.18),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(30,144,255,0.18),transparent_24%),linear-gradient(135deg,rgba(7,16,22,0.54),rgba(17,19,28,0.38))]" />
      <div className="pointer-events-none absolute inset-0 z-[1] opacity-[0.10] [background-image:linear-gradient(115deg,rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(25deg,rgba(255,255,255,0.20)_1px,transparent_1px)] [background-size:88px_88px,144px_144px]" />
      {/* Accent-waas over de backdrop. Bewust GEEN mix-blend-mode: 'screen' meer:
          dat is een niet-geïsoleerde full-screen composite-pass die op trage
          Linux/Intel-Chromium (NUC) bij élke kleurwissel opnieuw moet worden
          samengesteld → een grote bron van haperingen. Een gewone (source-over)
          gekleurde waas met dezelfde lage alpha's geeft vrijwel hetzelfde beeld
          zonder die pass. */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] transition-opacity duration-500"
        style={{
          opacity: pageAccentNode ? 1 : 0,
          background: 'radial-gradient(circle at 50% 50%, var(--table-accent-soft), transparent 34%), linear-gradient(135deg, var(--table-accent-wash), transparent 46%, var(--table-accent-wash))',
        }}
      />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[210] h-2 transition-opacity duration-500"
        style={{
          opacity: selectedThemeNode ? 1 : 0,
          background: 'linear-gradient(90deg, transparent, var(--table-accent), var(--table-accent-rim), var(--table-accent), transparent)',
          boxShadow: '0 0 28px var(--table-accent-rim)',
        }}
      />

      <RouteCommandPanel activeNode={selectedThemeNode} onSelectNode={handleSelectMain} />
      <RightPanelStack
        routeNode={activeRouteNode}
        focusNode={panelFocusNode}
        progress={progress}
        selectedNode={selectedThemeNode}
        topicsInteractive={inSubmenu}
        pendingTopicId={autoSelectRequest?.nodeId ?? null}
        onSelectTopic={handleSelectTopicFromPanel}
        onBack={handleHome}
      />

      {/* iXperium Smart Industry branding linksboven */}
      <motion.img
        src={smartIndustryBrandUrl}
        alt="iXperium Smart Industry"
        className="app-branding fixed top-14 z-[200]"
        draggable={false}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      />

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
      <AnimatePresence initial={false}>
        {navState.level === 'main' && (
          <motion.div
            key="main"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={VIEW_TRANSITION}
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
            <CentralPlanet />

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={VIEW_TRANSITION}
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
                onFocusChange={handleSubFocusChange}
                radiusX={TABLE_SUBMENU_ORBIT.radiusX}
                radiusY={TABLE_SUBMENU_ORBIT.radiusY}
                centerOffsetX={20}
                centerMaskRadius={TABLE_SUBMENU_ORBIT.centerMaskRadius}
                visualStyle={visualStyle}
                hiddenNodeId={flyState?.mode === 'upOff' ? flyState.node.id : null}
                autoSelectRequest={autoSelectRequest}
                onAutoSelectComplete={handleAutoSelectComplete}
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
