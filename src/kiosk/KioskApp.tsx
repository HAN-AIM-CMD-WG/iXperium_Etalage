import { memo, useMemo, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PerfStats } from '../app/components/scene/PerfStats';
import { contentData, type ContentNode } from '../shared/content';
import { resolveNavigationState } from '../shared/navigation';
import { INITIAL_NAVIGATION_STATE, type ConnectionHealth } from '../shared/protocol';
import { DEFAULT_VISUAL_STYLE } from '../shared/visualStyle';
import { useNavigationSocket } from '../shared/useNavigationSocket';

const VECTOR_INK = '#07185F';
const VECTOR_CREAM = '#FFF2B8';

const themeCopy: Record<string, string> = {
  ai: 'Data, algoritmes en praktijkcases voor slimme besluitvorming.',
  xr: 'Mens-machine interactie, immersive media en bruikbare werkplekinterfaces.',
  twin: 'Simulaties, sensordata en digitale representaties van productieprocessen.',
  rapid: 'Van idee naar tastbaar prototype met digitale fabricage.',
  robotics: 'Robotica labs, cobots, autonome systemen en veilige testomgevingen.',
  main: 'Draai aan de touchtafel. Deze presentatie volgt live welk kennisthema in focus staat.',
};

type DisplayMode = 'idle' | 'focus' | 'submenu' | 'detail';

interface OrbitItem {
  id: string;
  title: string;
  color: string;
}

const mainByTheme = new Map(contentData.map((node) => [node.theme, node]));

// Aantal sterren met permanent draaiende CSS-animaties. Was 92 -- elke ster
// is een continu opacity+scale animatie, dus 92 simultane animation ticks
// per frame. Verlaagd voor minder animation-engine load (glitchy bij hoog
// volume). Sub-set is visueel nog steeds rijk genoeg.
const NEBULA_STAR_COUNT = 38;
const NEBULA_STARS = Array.from({ length: NEBULA_STAR_COUNT }, (_, index) => {
  const xSeed = Math.sin(index * 19.47 + 3.2) * 10000;
  const ySeed = Math.sin(index * 33.91 + 8.7) * 10000;
  const sizeSeed = Math.sin(index * 11.13 + 0.8) * 10000;
  const delaySeed = Math.sin(index * 7.71 + 2.4) * 10000;

  return {
    id: `nebula-star-${index}`,
    x: 20 + Math.abs(xSeed % 1560),
    y: 22 + Math.abs(ySeed % 956),
    size: 1.4 + Math.abs(sizeSeed % 4.8),
    delay: Math.abs(delaySeed % 6),
  };
});

const KioskNebulaBackdrop = memo(function KioskNebulaBackdrop({
  accentColor,
}: {
  accentColor: string;
}) {
  const style = useMemo(() => ({
    '--nebula-accent': accentColor,
    '--nebula-accent-soft': rgbaHex(accentColor, 0.42),
    '--nebula-accent-muted': mixHex(accentColor, '#4E7BFF', 0.42),
    '--nebula-accent-warm': mixHex(accentColor, '#FFD400', 0.48),
  }) as CSSProperties & Record<string, string>, [accentColor]);

  return (
    <div className="kiosk-nebula-backdrop" style={style} aria-hidden="true">
      <svg
        className="kiosk-nebula-backdrop__svg"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="1600" height="1000" fill="#050817" />
        <path
          className="kiosk-nebula-backdrop__void"
          d="M-80 162 C205 36 357 174 566 117 C771 61 1036 -86 1680 94 L1680 0 L-80 0 Z"
        />
        <path
          className="kiosk-nebula-backdrop__void kiosk-nebula-backdrop__void--lower"
          d="M-120 914 C179 816 350 910 588 841 C817 775 1057 702 1720 812 L1720 1040 L-120 1040 Z"
        />

        <g className="kiosk-nebula-flow kiosk-nebula-flow--primary">
          <path
            fill="var(--nebula-accent)"
            opacity="0.34"
            d="M-88 584 C88 436 220 497 366 390 C545 259 724 172 960 201 C1148 224 1258 328 1460 301 C1549 289 1630 276 1700 300 L1700 492 C1505 438 1340 557 1140 501 C896 433 744 376 548 488 C366 591 153 635 -88 772 Z"
          />
          <path
            fill="#00E5FF"
            opacity="0.24"
            d="M-48 475 C162 337 340 372 512 287 C737 176 884 105 1122 145 C1315 177 1431 252 1668 206 L1668 346 C1390 390 1235 316 1051 285 C843 250 694 316 525 410 C317 527 131 543 -48 625 Z"
          />
          <path
            fill="var(--nebula-accent-warm)"
            opacity="0.2"
            d="M55 705 C212 600 372 604 540 530 C720 451 875 433 1014 500 C1129 555 1222 665 1410 626 C1515 605 1582 556 1660 558 L1660 711 C1499 728 1381 807 1214 780 C1038 751 968 613 793 610 C600 606 428 736 242 767 C161 781 94 769 55 705 Z"
          />
          <path
            className="kiosk-nebula-dust-lane"
            d="M-24 565 C194 512 303 528 455 435 C606 342 741 271 931 292 C1082 309 1157 388 1326 380 C1454 374 1554 325 1661 342 L1661 405 C1490 387 1408 460 1268 468 C1087 480 1003 397 847 383 C682 368 549 444 410 515 C261 591 119 609 -24 620 Z"
          />
          <path
            className="kiosk-nebula-filament"
            d="M82 452 C237 377 355 393 486 327 C651 244 825 187 1012 211 C1180 233 1288 299 1448 276"
          />
          <path
            className="kiosk-nebula-filament kiosk-nebula-filament--warm"
            d="M137 709 C314 628 428 651 593 568 C779 474 956 490 1093 583 C1212 664 1330 676 1492 619"
          />
        </g>

        <g className="kiosk-nebula-flow kiosk-nebula-flow--secondary">
          <path
            fill="#6E4BFF"
            opacity="0.3"
            d="M126 191 C216 104 346 97 445 143 C564 199 612 314 754 320 C904 326 960 204 1118 165 C1304 120 1479 179 1618 284 L1618 480 C1432 381 1294 352 1136 405 C971 460 829 521 647 459 C502 409 457 275 328 251 C230 232 157 271 82 333 Z"
          />
          <path
            fill="var(--nebula-accent-muted)"
            opacity="0.32"
            d="M-42 249 C74 174 192 163 296 204 C448 264 466 408 617 438 C777 471 919 357 1044 283 C1195 193 1407 217 1665 396 L1665 533 C1447 416 1310 402 1165 483 C1008 572 849 649 659 596 C503 553 434 423 300 376 C184 335 70 375 -42 466 Z"
          />
          <path
            className="kiosk-nebula-dust-lane kiosk-nebula-dust-lane--cool"
            d="M56 281 C178 237 288 258 392 325 C514 404 625 485 780 481 C947 475 1059 355 1196 308 C1324 264 1457 285 1600 355 L1600 421 C1450 345 1335 343 1214 397 C1062 465 948 577 761 571 C594 565 474 467 357 397 C248 333 150 324 56 353 Z"
          />
        </g>

        <g className="kiosk-nebula-pillars">
          <path
            fill="#111532"
            opacity="0.66"
            d="M1127 151 C1174 205 1167 310 1134 386 C1105 454 1125 507 1166 569 C1204 626 1196 705 1138 760 C1091 805 1046 805 1019 755 C984 690 1003 620 968 559 C933 499 880 462 884 388 C889 286 1009 248 1049 178 C1071 141 1098 128 1127 151 Z"
          />
          <path
            fill="var(--nebula-accent-warm)"
            opacity="0.22"
            d="M1058 191 C1082 268 1040 330 1033 402 C1023 509 1098 572 1073 680 C1062 730 1038 761 1014 754 C987 745 1005 675 968 594 C937 527 895 494 896 410 C897 311 997 268 1034 188 C1040 176 1052 177 1058 191 Z"
          />
          <path
            fill="#090B1E"
            opacity="0.72"
            d="M396 121 C446 191 418 267 384 333 C352 393 374 475 421 532 C466 587 465 665 410 720 C373 756 328 746 313 695 C291 622 327 572 300 497 C276 429 225 392 236 318 C250 224 325 193 355 126 C365 103 381 100 396 121 Z"
          />
          <path
            fill="#00E5FF"
            opacity="0.18"
            d="M341 157 C354 230 315 277 303 337 C286 419 350 478 340 580 C333 645 310 693 289 685 C265 676 297 606 268 519 C247 455 209 415 219 332 C230 246 304 219 331 158 C334 151 339 151 341 157 Z"
          />
        </g>

        <g className="kiosk-nebula-starfield">
          {NEBULA_STARS.map((star) => (
            <circle
              key={star.id}
              className="kiosk-nebula-star"
              cx={star.x}
              cy={star.y}
              r={star.size}
              style={{ '--star-delay': `${star.delay}s` } as CSSProperties & Record<string, string>}
            />
          ))}
        </g>

        <g className="kiosk-nebula-sparkles">
          <path d="M212 790 l10 29 l29 10 l-29 10 l-10 29 l-10 -29 l-29 -10 l29 -10 Z" />
          <path d="M1370 172 l8 23 l23 8 l-23 8 l-8 23 l-8 -23 l-23 -8 l23 -8 Z" />
          <path d="M1270 843 l12 34 l34 12 l-34 12 l-12 34 l-12 -34 l-34 -12 l34 -12 Z" />
        </g>
      </svg>
    </div>
  );
});

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

function getMainNodeByTheme(theme?: string) {
  if (!theme || theme === 'main') return null;
  return mainByTheme.get(theme) ?? null;
}

function compactTitle(title: string) {
  return title
    .replace('Lectoraat Applied Data Science & AI', 'ADS & AI')
    .replace('Lectoraat DKE', 'DKE')
    .replace(/^Lectoraat\s+/, '')
    .replace('Artificial Intelligence', 'AI')
    .replace('XR & Human Machine Interaction', 'XR & HMI')
    .replace('Rapid Prototyping & Additive Manufacturing', 'Rapid Prototyping');
}

function getModeLabel(mode: DisplayMode) {
  if (mode === 'detail') return 'Onderwerp geopend';
  if (mode === 'submenu') return 'Route geopend';
  if (mode === 'focus') return 'Thema in focus';
  return 'Live kennissysteem';
}

function getModeIntro(mode: DisplayMode, node: ContentNode | null) {
  if (mode === 'detail') return 'Gekozen op de touchtafel';
  if (mode === 'submenu') return 'Hoofdthema actief';
  if (mode === 'focus') return 'Volgt de planeet in focus';
  return node?.title ?? 'iXperium Smart Industry';
}

function getPlanetMicroCopy(mode: DisplayMode) {
  if (mode === 'detail') return 'Detail actief';
  if (mode === 'submenu') return 'Route actief';
  if (mode === 'focus') return 'Live focus';
  return 'Smart Industry';
}

function getOrbitItems(node: ContentNode | null, relatedNodes: ContentNode[]) {
  if (relatedNodes.length) {
    return relatedNodes.map((item) => ({
      id: item.id,
      title: item.title,
      color: item.color,
    }));
  }

  if (node?.children?.length) {
    return node.children.map((item) => ({
      id: item.id,
      title: item.title,
      color: item.color,
    }));
  }

  if (node?.content?.relatedItems?.length) {
    return node.content.relatedItems.map((title, index) => ({
      id: `${node.id}-related-${index}`,
      title,
      color: mixHex(node.color, index % 2 === 0 ? '#00F5FF' : '#FFD400', 0.35),
    }));
  }

  return contentData.map((item) => ({
    id: item.id,
    title: item.title,
    color: item.color,
  }));
}

function getHighlights(node: ContentNode | null) {
  return node?.content?.highlights?.length
    ? node.content.highlights
    : node?.content?.relatedItems ?? ['Labs', 'Toolkits', 'Cases'];
}

function getApplications(node: ContentNode | null) {
  return node?.content?.applications?.length
    ? node.content.applications
    : ['Verkennen', 'Experimenteren', 'Toepassen'];
}

const StatusIndicator = memo(function StatusIndicator({
  connected,
  health,
}: {
  connected: boolean;
  health: ConnectionHealth;
}) {
  return (
    <div className="connection-pill fixed right-8 top-8 z-[220] flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-bold text-white/75 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-md">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: connected ? '#46B469' : '#FF3344' }}
      />
      <span>{connected ? 'Live sync' : health}</span>
    </div>
  );
});

const KioskBrand = memo(function KioskBrand() {
  return (
    <motion.div
      className="app-branding fixed left-8 top-8 z-[220] flex items-center gap-4 text-left"
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
    >
      <div className="app-branding__mark kiosk-brand-mark h-12 w-12 rounded-[0.9rem] bg-gradient-to-br from-[#46B469] to-[#1E90FF] shadow-[0_16px_42px_rgba(70,180,105,0.24)]" />
      <div>
        <h1 className="text-2xl font-black leading-7 tracking-normal text-white drop-shadow-lg">iXperium</h1>
        <p className="mt-1 text-xs font-semibold text-white/55">Smart Industry detailweergave</p>
      </div>
    </motion.div>
  );
});

const KioskDetailPlanet = memo(function KioskDetailPlanet({
  node,
  mode,
  accentColor,
}: {
  node: ContentNode | null;
  mode: DisplayMode;
  accentColor: string;
}) {
  const style = useMemo(() => ({
    '--kiosk-accent': accentColor,
    '--kiosk-accent-dark': mixHex(accentColor, VECTOR_INK, 0.52),
    '--kiosk-accent-deep': mixHex(accentColor, '#2a0c54', 0.4),
    '--kiosk-accent-warm': mixHex(accentColor, '#FFD400', 0.42),
    '--kiosk-accent-light': mixHex(accentColor, VECTOR_CREAM, 0.68),
    '--kiosk-accent-glow': rgbaHex(accentColor, 0.68),
  }) as CSSProperties & Record<string, string>, [accentColor]);

  const title = node ? compactTitle(node.title) : 'iXperium';
  const subtitle = getPlanetMicroCopy(mode);
  const image = node?.content?.image;

  return (
    <div className={`kiosk-detail-planet${image ? ' kiosk-detail-planet--has-image' : ''}`} style={style}>
      {image ? (
        <img src={image} alt={node?.title ?? 'iXperium Smart Industry'} loading="eager" />
      ) : null}
      <span className="kiosk-detail-planet__field kiosk-detail-planet__field--one" />
      <span className="kiosk-detail-planet__field kiosk-detail-planet__field--two" />
      <span className="kiosk-detail-planet__field kiosk-detail-planet__field--three" />
      <span className="kiosk-detail-planet__crater kiosk-detail-planet__crater--one" />
      <span className="kiosk-detail-planet__crater kiosk-detail-planet__crater--two" />
      <span className="kiosk-detail-planet__crater kiosk-detail-planet__crater--three" />
      <span className="kiosk-detail-planet__shine" />

      <div className="kiosk-detail-planet__label">
        <p>{getModeLabel(mode)}</p>
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
    </div>
  );
});

const KioskInfoPanel = memo(function KioskInfoPanel({
  node,
  mode,
  accentColor,
  orbitItems,
}: {
  node: ContentNode | null;
  mode: DisplayMode;
  accentColor: string;
  orbitItems: OrbitItem[];
}) {
  const title = node?.title ?? 'Kies een route op de touchtafel';
  const intro = node?.content?.intro ?? themeCopy.main;
  const detail = node?.content?.detail ?? 'Wanneer een planeet in focus komt of een onderwerp wordt geopend, verandert deze pagina automatisch mee met de live websocket-state.';
  const highlights = getHighlights(node);
  const applications = getApplications(node);
  const sourceLabel = node?.content?.sourceLabel ?? 'Projectdocument iXperium kiosk UI';

  return (
    <div
      className="kiosk-detail-panel"
      style={{
        '--panel-accent': accentColor,
        '--panel-glow': rgbaHex(accentColor, 0.34),
      } as CSSProperties & Record<string, string>}
    >
      <div className="kiosk-detail-panel__header">
        <div>
          <p>{getModeLabel(mode)}</p>
          <h1>{title}</h1>
        </div>
        <span>{getModeIntro(mode, node)}</span>
      </div>

      <p className="kiosk-detail-panel__intro">{intro}</p>
      <p className="kiosk-detail-panel__body">{detail}</p>

      <div className="kiosk-detail-panel__columns">
        <section>
          <h2>Highlights</h2>
          <ul>
            {highlights.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Toepassingen</h2>
          <ul>
            {applications.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="kiosk-signal-strip">
        <div>
          <strong>{String(orbitItems.length).padStart(2, '0')}</strong>
          <span>verbonden onderwerpen</span>
        </div>
        <div>
          <strong>{sourceLabel}</strong>
          <span>bronlaag</span>
        </div>
      </div>
    </div>
  );
});

export function KioskApp() {
  const { connected, health, lastSnapshot } = useNavigationSocket('kiosk');

  const navigationState = lastSnapshot?.state ?? INITIAL_NAVIGATION_STATE;
  const resolvedState = useMemo(() => resolveNavigationState(navigationState), [navigationState]);
  const focusedMainNode = navigationState.level === 'main'
    ? getMainNodeByTheme(navigationState.theme)
    : null;
  const displayNode = resolvedState.subNode ?? resolvedState.mainNode ?? focusedMainNode ?? null;
  const parentNode = resolvedState.mainNode ?? focusedMainNode ?? getMainNodeByTheme(displayNode?.theme);
  const activeTheme = displayNode?.theme ?? navigationState.theme ?? resolvedState.theme;
  const accentColor = displayNode?.color ?? parentNode?.color ?? '#46B469';
  const visualStyle = DEFAULT_VISUAL_STYLE;

  const mode: DisplayMode = resolvedState.subNode
    ? 'detail'
    : resolvedState.mainNode
      ? 'submenu'
      : focusedMainNode
        ? 'focus'
        : 'idle';

  const orbitItems = useMemo(() => (
    getOrbitItems(displayNode ?? parentNode, resolvedState.relatedNodes)
  ), [displayNode, parentNode, resolvedState.relatedNodes]);

  const viewKey = `${mode}-${displayNode?.id ?? activeTheme ?? 'idle'}-${visualStyle}`;

  return (
    <div
      className="kiosk-detail-shell relative isolate size-full min-h-screen overflow-hidden bg-[#071016] text-white"
      data-visual-style={visualStyle}
    >
      <KioskNebulaBackdrop accentColor={accentColor} />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_43%,rgba(5,8,23,0.04),rgba(5,8,23,0.30)_48%,rgba(5,8,23,0.72)_100%)]" />

      <PerfStats />
      <KioskBrand />
      <StatusIndicator connected={connected} health={health} />

      <main className="kiosk-detail-main relative z-10 flex min-h-screen items-center px-[4.8vw] pb-12 pt-32">
        <AnimatePresence mode="wait">
          <motion.section
            key={viewKey}
            className="kiosk-detail-layout"
            // Alleen opacity animeren — y + scale dwingen elk frame een
            // re-composit van de hele layout-section met z'n zware kinderen.
            // Crossfade is visueel even soepel en aanzienlijk goedkoper.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="kiosk-detail-planet-zone">
              <KioskDetailPlanet node={displayNode} mode={mode} accentColor={accentColor} />
            </div>

            <KioskInfoPanel
              node={displayNode}
              mode={mode}
              accentColor={accentColor}
              orbitItems={orbitItems}
            />
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default KioskApp;
