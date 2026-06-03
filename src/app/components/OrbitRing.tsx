import { memo, useCallback, useEffect, useId, useRef } from 'react';
import { ContentNode } from '../data/content';
import {
  DEFAULT_VISUAL_STYLE,
  type AppVisualStyle,
} from '../../shared/visualStyle';

const PLANET_SIZE = 128;
const VELOCITY_MULTIPLIER = 0.018;
const VELOCITY_SCALE = 18;
const FRICTION = 0.955;
const VELOCITY_THRESHOLD = 0.0008;
const AUTO_ROTATE_SPEED = 0.0032;
const AUTO_ROTATE_LERP = 0.08;
const MAX_FRAME_SCALE = 2.5;
const DRAG_CLICK_THRESHOLD = 12;
const FOCUS_THROTTLE_MS = 70;
const LAYER_FADE_START = -0.22;
const LAYER_FADE_END = 0.22;
const ORBIT_ROTATION_DEG = -20;
const ORBIT_ROTATION = (ORBIT_ROTATION_DEG * Math.PI) / 180;
const TAU = Math.PI * 2;
const LABEL_FONT_FAMILY = 'Overpass, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MIN_LABEL_FONT_SIZE = 11;
const MAX_LABEL_FONT_SIZE = 22;
const VECTOR_INK = '#07185F';
const VECTOR_CREAM = '#FFF2B8';
const CENTRAL_LABEL_FILL = '#FFFFFF';
const CENTRAL_LABEL_SHADOW = 'rgba(7, 24, 95, 0.48)';
const VECTOR_ORBIT_STROKE_WIDTH = 8;
const VECTOR_ORBIT_STROKE = 'rgba(91, 224, 255, 0.96)';

interface OrbitRingProps {
  nodes: ContentNode[];
  onSelectNode: (node: ContentNode) => void;
  onFocusChange?: (node: ContentNode) => void;
  radiusX?: number;
  radiusY?: number;
  centerOffsetX?: number;
  centerOffsetY?: number;
  centerMaskRadius?: number;
  visualStyle?: AppVisualStyle;
}

interface RenderedPlanet {
  node: ContentNode;
  x: number;
  y: number;
  angle: number;
  radius: number;
  scale: number;
  opacity: number;
  depth: number;
  frontVisibility: number;
  backVisibility: number;
}

type OrbitLayer = 'back' | 'front';

function normalizeAngle(angle: number) {
  return ((angle % TAU) + TAU) % TAU;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function rotatePoint(x: number, y: number, rotation: number) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function pointOnEllipse(centerX: number, centerY: number, radiusX: number, radiusY: number, angle: number) {
  return {
    x: centerX + Math.cos(angle) * radiusX,
    y: centerY + Math.sin(angle) * radiusY,
  };
}

function describeEllipseArc(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  startAngle: number,
  endAngle: number,
) {
  const start = pointOnEllipse(centerX, centerY, radiusX, radiusY, startAngle);
  const end = pointOnEllipse(centerX, centerY, radiusX, radiusY, endAngle);
  const delta = Math.abs(endAngle - startAngle);
  const largeArcFlag = delta > Math.PI ? 1 : 0;
  const sweepFlag = endAngle >= startAngle ? 1 : 0;

  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radiusX.toFixed(2)} ${radiusY.toFixed(2)} 0 ${largeArcFlag} ${sweepFlag} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(' ');
}

/**
 * Module-level cache voor hexToRgb resultaten. Kleuren zijn stabiel
 * (~20 unieke hexes over de hele app: theme kleuren + derived shades).
 * Voorheen werd elk frame voor elke kleur opnieuw geparsed — nu één keer.
 *
 * Callers van hexToRgb (rgba, mixRgba) lezen alleen .r/.g/.b, mutatie van het
 * cached object komt niet voor — dus delen van hetzelfde object is veilig.
 */
const HEX_RGB_CACHE = new Map<string, { r: number; g: number; b: number }>();

function hexToRgb(hex: string) {
  const cached = HEX_RGB_CACHE.get(hex);
  if (cached) return cached;

  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized, 16);

  const result = Number.isNaN(value)
    ? { r: 255, g: 255, b: 255 }
    : {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
      };

  HEX_RGB_CACHE.set(hex, result);
  return result;
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixRgba(hex: string, target: { r: number; g: number; b: number }, mix: number, alpha: number) {
  const source = hexToRgb(hex);
  const t = clamp01(mix);
  const r = Math.round(source.r + (target.r - source.r) * t);
  const g = Math.round(source.g + (target.g - source.g) * t);
  const b = Math.round(source.b + (target.b - source.b) * t);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fraction(value: number) {
  return value - Math.floor(value);
}

function pseudoRandom(seed: number, index: number) {
  return fraction(Math.sin(seed * 0.017 + index * 12.9898) * 43758.5453);
}

// ============================================================
// PLANET SPRITE CACHE
//
// Statische lagen die per frame opnieuw werden gerenderd met radial
// gradients (CPU-rasterized) — nu één keer gerenderd naar OffscreenCanvas
// per unieke kleur, daarna per frame drawImage (GPU-blitted).
//
// Twee sprites per kleur om de oorspronkelijke z-order te behouden:
//   - halos:        outer halo + rim halo (achtergrond)
//   - bodyOverlay:  body gradient (vóór swirls/filaments)
//
// Tussen de twee drawImage's tekenen we de "back text band" zodat die
// tussen de halo en het body-oppervlak in zit, net als origineel.
//
// Sub-pixel verschil door bilineaire scaling; bij radial gradients
// visueel onzichtbaar omdat ze inherent soft zijn.
// ============================================================
const SPRITE_RENDER_RADIUS = 80;
const SPRITE_PAD = 1.85; // outer halo extends to radius * 1.85
const SPRITE_SIZE = Math.ceil(SPRITE_RENDER_RADIUS * SPRITE_PAD * 2 + 8); // 304
const VECTOR_SPRITE_RENDER_RADIUS = 80;
const VECTOR_SPRITE_PAD = 1.08;
const VECTOR_SPRITE_SIZE = Math.ceil(VECTOR_SPRITE_RENDER_RADIUS * VECTOR_SPRITE_PAD * 2 + 8);

type SpriteCanvas = HTMLCanvasElement | OffscreenCanvas;
type PlanetSpriteSet = { halos: SpriteCanvas; body: SpriteCanvas };
const PLANET_SPRITE_CACHE = new Map<string, PlanetSpriteSet>();
type VectorPlanetSpriteSet = { body: SpriteCanvas; innerLight: SpriteCanvas };
const VECTOR_PLANET_SPRITE_CACHE = new Map<string, VectorPlanetSpriteSet>();

function createSpriteCanvas(size: number): SpriteCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return new OffscreenCanvas(size, size);
    } catch {
      // fall through to HTMLCanvasElement
    }
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }
  return null;
}

function getPlanetSprites(color: string): PlanetSpriteSet | null {
  const cached = PLANET_SPRITE_CACHE.get(color);
  if (cached) return cached;

  const halos = createSpriteCanvas(SPRITE_SIZE);
  const body = createSpriteCanvas(SPRITE_SIZE);
  if (!halos || !body) return null;
  const haloCtx = halos.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  const bodyCtx = body.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!haloCtx || !bodyCtx) return null;

  const cx = SPRITE_SIZE / 2;
  const cy = SPRITE_SIZE / 2;
  const radius = SPRITE_RENDER_RADIUS;

  // --- Halos sprite ---
  // Gerenderd met "front" alpha-waarden; per-frame globalAlpha dimt voor back.
  const outerHalo = haloCtx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.85);
  outerHalo.addColorStop(0, rgba(color, 0.32));
  outerHalo.addColorStop(0.35, rgba(color, 0.16));
  outerHalo.addColorStop(1, rgba(color, 0));
  haloCtx.beginPath();
  haloCtx.arc(cx, cy, radius * 1.85, 0, TAU);
  haloCtx.fillStyle = outerHalo;
  haloCtx.fill();

  const rimHalo = haloCtx.createRadialGradient(cx, cy, radius * 0.98, cx, cy, radius * 1.22);
  rimHalo.addColorStop(0, rgba(color, 0.55));
  rimHalo.addColorStop(0.4, rgba(color, 0.28));
  rimHalo.addColorStop(1, rgba(color, 0));
  haloCtx.beginPath();
  haloCtx.arc(cx, cy, radius * 1.22, 0, TAU);
  haloCtx.fillStyle = rimHalo;
  haloCtx.fill();

  // --- Body sprite ---
  const bodyGrad = bodyCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  bodyGrad.addColorStop(0, 'rgba(12, 14, 28, 0.95)');
  bodyGrad.addColorStop(0.35, rgba(color, 0.4));
  bodyGrad.addColorStop(0.72, rgba(color, 0.88));
  bodyGrad.addColorStop(0.95, rgba(color, 1));
  bodyGrad.addColorStop(1, rgba(color, 0.92));
  bodyCtx.beginPath();
  bodyCtx.arc(cx, cy, radius, 0, TAU);
  bodyCtx.fillStyle = bodyGrad;
  bodyCtx.fill();

  const set: PlanetSpriteSet = { halos, body };
  PLANET_SPRITE_CACHE.set(color, set);
  return set;
}

function getVectorPlanetSprites(color: string): VectorPlanetSpriteSet | null {
  const cached = VECTOR_PLANET_SPRITE_CACHE.get(color);
  if (cached) return cached;

  const body = createSpriteCanvas(VECTOR_SPRITE_SIZE);
  const innerLightCanvas = createSpriteCanvas(VECTOR_SPRITE_SIZE);
  if (!body || !innerLightCanvas) return null;

  const bodyCtx = body.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  const lightCtx = innerLightCanvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!bodyCtx || !lightCtx) return null;

  const cx = VECTOR_SPRITE_SIZE / 2;
  const cy = VECTOR_SPRITE_SIZE / 2;
  const radius = VECTOR_SPRITE_RENDER_RADIUS;

  bodyCtx.save();
  bodyCtx.beginPath();
  bodyCtx.arc(cx, cy, radius, 0, TAU);
  bodyCtx.clip();
  const bodyGradient = bodyCtx.createLinearGradient(cx - radius, cy - radius * 0.12, cx + radius, cy + radius * 0.1);
  bodyGradient.addColorStop(0, mixRgba(color, { r: 48, g: 0, b: 96 }, 0.44, 1));
  bodyGradient.addColorStop(0.46, mixRgba(color, { r: 255, g: 60, b: 150 }, 0.18, 1));
  bodyGradient.addColorStop(0.78, mixRgba(color, { r: 255, g: 216, b: 48 }, 0.34, 1));
  bodyGradient.addColorStop(1, mixRgba(color, { r: 255, g: 255, b: 210 }, 0.58, 1));
  bodyCtx.fillStyle = bodyGradient;
  bodyCtx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  bodyCtx.restore();

  lightCtx.save();
  lightCtx.beginPath();
  lightCtx.arc(cx, cy, radius, 0, TAU);
  lightCtx.clip();
  const innerLight = lightCtx.createRadialGradient(
    cx + radius * 0.38,
    cy - radius * 0.32,
    radius * 0.1,
    cx + radius * 0.46,
    cy - radius * 0.36,
    radius * 1.0,
  );
  innerLight.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  innerLight.addColorStop(0.46, mixRgba(color, { r: 255, g: 255, b: 255 }, 0.4, 0.12));
  innerLight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  lightCtx.fillStyle = innerLight;
  lightCtx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  lightCtx.restore();

  const set: VectorPlanetSpriteSet = { body, innerLight: innerLightCanvas };
  VECTOR_PLANET_SPRITE_CACHE.set(color, set);
  return set;
}

/**
 * Deterministische hash van string id — gebruikt voor per-planet visuele variatie
 * (cloud patch posities, spin-phase). Zelfde node → zelfde signatuur elke frame.
 */
function stringHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function compactLabelCandidate(text: string) {
  return text
    .replace(/XR\s*&\s*Human Machine Interaction/gi, 'XR & HMI')
    .replace(/Rapid Prototyping\s*&\s*Additive Manufacturing/gi, 'Rapid Proto & Additive Mfg.')
    .replace(/Artificial Intelligence/gi, 'AI')
    .replace(/Applied Data Science\s*&\s*AI/gi, 'Data Science & AI')
    .replace(/Additive Manufacturing/gi, 'Additive Mfg.')
    .replace(/Rapid Prototyping/gi, 'Rapid Proto')
    .replace(/\s+/g, ' ')
    .trim();
}

function ultraCompactLabelCandidate(text: string) {
  return compactLabelCandidate(text)
    .replace(/Rapid Proto\s*&\s*Additive Mfg\./gi, 'Rapid Proto & Mfg.')
    .replace(/Data Science\s*&\s*AI/gi, 'Data & AI')
    .replace(/^Lectoraat\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLabelCandidates(text: string) {
  const candidates = [
    text,
    text.replace(/^Lectoraat\s+/gi, ''),
    compactLabelCandidate(text),
    ultraCompactLabelCandidate(text),
  ].map((candidate) => candidate.trim()).filter(Boolean);

  return [...new Set(candidates)];
}

function setLabelFont(context: CanvasRenderingContext2D, fontSize: number) {
  context.font = `900 ${fontSize}px ${LABEL_FONT_FAMILY}`;
  context.letterSpacing = `${(-0.025 * fontSize).toFixed(2)}px`;
}

function truncateToWidth(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) {
    return { text, truncated: false };
  }

  const suffix = '...';
  const availableWidth = Math.max(0, maxWidth - context.measureText(suffix).width);
  let low = 0;
  let high = text.length;
  let best = '';

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(0, mid).trimEnd();
    if (context.measureText(candidate).width <= availableWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return { text: `${best}${suffix}`, truncated: true };
}

function wrapLabel(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';
  let truncated = false;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      const result = truncateToWidth(context, word, maxWidth);
      lines.push(result.text);
      truncated = truncated || result.truncated;
      currentLine = '';
    }

    if (lines.length === maxLines) {
      const remainingText = [currentLine, ...words.slice(index + 1)].filter(Boolean).join(' ');
      if (remainingText) {
        const result = truncateToWidth(context, `${lines[maxLines - 1]} ${remainingText}`, maxWidth);
        lines[maxLines - 1] = result.text;
        truncated = true;
      }
      return { lines, truncated };
    }
  }

  if (currentLine) lines.push(currentLine);

  if (lines.length > maxLines) {
    const collapsedLine = lines.slice(maxLines - 1).join(' ');
    const result = truncateToWidth(context, collapsedLine, maxWidth);
    return {
      lines: [...lines.slice(0, maxLines - 1), result.text],
      truncated: true,
    };
  }

  const fittedLines = lines.map((line) => {
    const result = truncateToWidth(context, line, maxWidth);
    truncated = truncated || result.truncated;
    return result.text;
  });

  return { lines: fittedLines, truncated };
}

function getPlanetLabelLayout(context: CanvasRenderingContext2D, text: string, radius: number, scale: number) {
  const maxWidth = Math.max(38, radius * (scale < 0.62 ? 1.5 : 1.62));
  const maxLines = radius < 32 ? 2 : 3;
  const baseFontSize = clamp(radius * 0.36, MIN_LABEL_FONT_SIZE, MAX_LABEL_FONT_SIZE);
  const minFontSize = radius < 32 ? 8.6 : MIN_LABEL_FONT_SIZE;
  const candidates = getLabelCandidates(text);
  let fallback: {
    lines: string[];
    fontSize: number;
    lineHeight: number;
    maxLineWidth: number;
  } | null = null;

  for (const candidate of candidates) {
    for (let fontSize = baseFontSize; fontSize >= minFontSize; fontSize -= 0.4) {
      setLabelFont(context, fontSize);
      const lineHeight = fontSize * 0.96;
      const wrap = wrapLabel(context, candidate, maxWidth, maxLines);
      const maxLineWidth = wrap.lines.reduce(
        (largest, line) => Math.max(largest, context.measureText(line).width),
        0,
      );
      const labelHeight = wrap.lines.length * lineHeight;

      const layout = { lines: wrap.lines, fontSize, lineHeight, maxLineWidth };
      fallback = layout;

      if (!wrap.truncated && labelHeight <= radius * 1.18) {
        return layout;
      }
    }
  }

  return fallback ?? {
    lines: [text],
    fontSize: minFontSize,
    lineHeight: minFontSize * 0.96,
    maxLineWidth: 0,
  };
}

type PlanetLabelLayout = ReturnType<typeof getPlanetLabelLayout>;

const LABEL_LAYOUT_CACHE_LIMIT = 480;
const LABEL_LAYOUT_CACHE = new Map<string, PlanetLabelLayout>();

function getLabelCacheParts(node: ContentNode, radius: number, scale: number) {
  return {
    radiusBucket: Math.round(radius * 2) / 2,
    scaleBucket: Math.round(scale * 100) / 100,
    baseKey: `${node.id}|${node.title}|${Math.round(radius * 2) / 2}|${Math.round(scale * 100) / 100}`,
  };
}

function getCachedPlanetLabelLayout(
  context: CanvasRenderingContext2D,
  node: ContentNode,
  radius: number,
  scale: number,
) {
  const { radiusBucket, scaleBucket, baseKey } = getLabelCacheParts(node, radius, scale);
  const cached = LABEL_LAYOUT_CACHE.get(baseKey);
  if (cached) return cached;

  const layout = getPlanetLabelLayout(context, node.title, radiusBucket, scaleBucket);
  LABEL_LAYOUT_CACHE.set(baseKey, layout);

  if (LABEL_LAYOUT_CACHE.size > LABEL_LAYOUT_CACHE_LIMIT) {
    const oldestKey = LABEL_LAYOUT_CACHE.keys().next().value;
    if (oldestKey) LABEL_LAYOUT_CACHE.delete(oldestKey);
  }

  return layout;
}

function drawCentralStyleLabelLine(
  context: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  fontSize: number,
  glowColor: string,
) {
  const shadowX = clamp(fontSize * 0.07, 1.1, 3.0);
  const shadowY = clamp(fontSize * 0.095, 1.4, 3.8);
  // Dunnere donkere outline: genoeg voor contrast, maar vreet de witte
  // glyphs niet aan (dat liet de tekst eerder grijs ogen).
  const outlineWidth = clamp(fontSize * 0.07, 1.2, 2.2);
  const glowBlur = clamp(fontSize * 0.26, 3, 9);

  context.save();
  setLabelFont(context, fontSize);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.miterLimit = 2;
  context.globalAlpha = 1;

  // 1) Donkere drop-offset voor diepte tegen lichte planeet-delen.
  context.shadowBlur = 0;
  context.fillStyle = CENTRAL_LABEL_SHADOW;
  context.fillText(line, x + shadowX, y + shadowY);

  // 2) Zachte witte glow als halo ACHTER de tekst — geeft "oplichtend" gevoel
  //    zonder de kern te vertroebelen.
  context.shadowColor = 'rgba(255, 255, 255, 0.85)';
  context.shadowBlur = glowBlur;
  context.fillStyle = '#FFFFFF';
  context.fillText(line, x, y);

  // 3) Donkere contour (dun) voor crisp losmaken van de body.
  context.shadowBlur = 0;
  context.lineWidth = outlineWidth;
  context.strokeStyle = 'rgba(2, 6, 20, 0.92)';
  context.strokeText(line, x, y);

  // 4) Finale SOLIDE pure-witte fill bovenop — dit is de dominante,
  //    crisp #FFFFFF laag. Geen glow, geen tint, volle alpha.
  context.fillStyle = '#FFFFFF';
  context.fillText(line, x, y);
  context.fillText(line, x, y);
  context.restore();
}

function getBandLabel(text: string) {
  return text
    .replace(/XR\s*&\s*Human Machine Interaction/gi, 'XR & HMI')
    .replace(/Rapid Prototyping\s*&\s*Additive Manufacturing/gi, 'Rapid Proto & Mfg.')
    .replace(/Applied Data Science\s*&\s*AI/gi, 'Data & AI')
    .replace(/^Lectoraat\s+/gi, '')
    .replace(/Additive Manufacturing/gi, 'Additive Mfg.')
    .replace(/Rapid Prototyping/gi, 'Rapid Proto')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function drawSurfaceFilaments(
  context: CanvasRenderingContext2D,
  planet: RenderedPlanet,
  seed: number,
  isFront: boolean,
  visibility: number,
  animTime: number,
) {
  if (planet.radius < 28) return;

  const branchCount = clamp(Math.floor(planet.radius * (isFront ? 0.22 : 0.14)), 5, isFront ? 14 : 8);
  const baseAlpha = (isFront ? 0.46 : 0.22) * visibility;

  context.save();
  context.globalCompositeOperation = 'screen';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  // GEEN shadowBlur in deze loop — vroeger ~80 offscreen blur passes/frame.
  // Filamenten gebruiken nu alleen line-width + alpha voor contrast.
  context.shadowBlur = 0;

  for (let index = 0; index < branchCount; index += 1) {
    const orbit = pseudoRandom(seed, index);
    const radiusFactor = 0.18 + pseudoRandom(seed + 131, index) * 0.62;
    const angle = orbit * TAU + animTime * (0.06 + pseudoRandom(seed + 11, index) * 0.04);
    const sx = planet.x + Math.cos(angle) * planet.radius * radiusFactor;
    const sy = planet.y + Math.sin(angle) * planet.radius * radiusFactor * 0.72;
    const direction = Math.round((angle + pseudoRandom(seed + 47, index) * Math.PI) / (Math.PI / 4)) * (Math.PI / 4);
    const lengthA = planet.radius * (0.16 + pseudoRandom(seed + 73, index) * 0.24);
    const lengthB = planet.radius * (0.08 + pseudoRandom(seed + 97, index) * 0.17);
    const bend = direction + (pseudoRandom(seed + 193, index) > 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const mx = sx + Math.cos(direction) * lengthA;
    const my = sy + Math.sin(direction) * lengthA * 0.58;
    const ex = mx + Math.cos(bend) * lengthB;
    const ey = my + Math.sin(bend) * lengthB * 0.58;
    const pulse = 0.55 + 0.45 * Math.sin(animTime * 1.8 + index * 0.9 + seed * 0.003);

    context.globalAlpha = baseAlpha * pulse;
    context.lineWidth = Math.max(0.45, planet.scale * (0.75 + pseudoRandom(seed + 211, index) * 0.85));
    context.strokeStyle = index % 4 === 0
      ? `rgba(255, 244, 220, ${0.34 * pulse})`
      : rgba(planet.node.color, 0.58 * pulse);
    context.beginPath();
    context.moveTo(sx, sy);
    context.lineTo(mx, my);
    context.lineTo(ex, ey);
    context.stroke();

    if (index % 3 === 0) {
      context.fillStyle = `rgba(255, 248, 226, ${0.58 * pulse})`;
      context.beginPath();
      context.arc(ex, ey, Math.max(0.8, planet.radius * 0.018), 0, TAU);
      context.fill();
    }
  }

  context.restore();
}

function drawOrbitingTextBand(
  context: CanvasRenderingContext2D,
  planet: RenderedPlanet,
  seed: number,
  isFront: boolean,
  visibility: number,
  animTime: number,
  segment: 'back' | 'front',
  textSpeed: number,
  bandLabel: string,
) {
  const radius = planet.radius;
  const bandHeight = clamp(radius * 0.58, 21, 44);
  const bandTilt = -0.18 + Math.sin(animTime * 0.32 + seed * 0.004) * 0.055;
  const bandOffsetY = Math.sin(animTime * 0.54 + seed * 0.01) * radius * 0.035;
  const ringRadiusX = radius * 1.42;
  const ringRadiusY = radius * 0.47;
  const alpha = (isFront ? 0.94 : 0.68) * visibility;

  context.save();
  context.translate(planet.x, planet.y);
  context.rotate(bandTilt);
  context.globalAlpha = alpha;

  if (segment === 'back') {
    // GEEN shadowBlur — bespaart ~16 offscreen blur passes/frame.
    context.lineCap = 'round';
    context.shadowBlur = 0;
    context.lineWidth = bandHeight * 0.78;
    context.strokeStyle = 'rgba(3, 7, 18, 0.74)';
    context.beginPath();
    context.ellipse(0, bandOffsetY, ringRadiusX, ringRadiusY, 0, Math.PI, TAU);
    context.stroke();

    context.lineWidth = Math.max(1.4, bandHeight * 0.16);
    context.strokeStyle = rgba(planet.node.color, isFront ? 0.48 : 0.3);
    context.beginPath();
    context.ellipse(0, bandOffsetY, ringRadiusX, ringRadiusY, 0, Math.PI, TAU);
    context.stroke();
    context.restore();
    return;
  }

  // ============================================================
  // FRONT SEGMENT — minimalistische, snelle tekstband
  //
  // Tijdens performance work agressief uitgekleed: één dark backing
  // arc als contrast-bedding (zonder shadow), geen rails, en per-glyph
  // alleen fillText (geen strokeText, geen shadowBlur). Dat bespaart
  // honderden Canvas2D-calls per frame.
  //
  // Bewaard: edge fade (smooth in/uit aan arc-randen), sweep brightness
  // boost (via fill-kleur), ✦ ster-bullet, refined typography weight.
  // ============================================================

  // Dark backing arc — enige achtergrond. Donkerder + dikker dan voorheen
  // zodat de fellere witte tekst goed contrasteert en leesbaar blijft.
  context.lineCap = 'round';
  context.shadowBlur = 0;
  context.lineWidth = bandHeight * 0.82;
  context.strokeStyle = 'rgba(2, 4, 11, 0.84)';
  context.beginPath();
  context.ellipse(0, bandOffsetY, ringRadiusX, ringRadiusY, 0, Math.PI * 0.05, Math.PI * 0.95);
  context.stroke();

  // Tekst-setup (één keer voor de glyph-loop). Groter + zwaarder gewicht
  // voor betere leesbaarheid op de draaiende planeten.
  const fontSize = clamp(radius * 0.36, 14, 27);
  context.font = `800 ${fontSize}px ${LABEL_FONT_FAMILY}`;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.letterSpacing = '0.6px';

  // ✦ ster-bullet voelt premium ten opzichte van de oude • dot.
  const repeated = `${bandLabel}   ✦   `;
  const glyphGap = fontSize * 0.18;
  const repeatedGlyphs = [...repeated].map((glyph) => ({
    glyph,
    width: Math.max(fontSize * 0.42, context.measureText(glyph).width + glyphGap),
  }));
  const repeatedWidth = repeatedGlyphs.reduce((width, glyph) => width + glyph.width, 0);
  const arcLength = ringRadiusX * Math.PI * 0.9;
  const scroll = (animTime * (5 + (seed % 4)) * textSpeed + seed * 0.07) % repeatedWidth;
  let textCursor = -scroll - repeatedWidth;

  // Holografische sweep — heldere "scanner-streep" beweegt langs de arc.
  // Eén cyclus per ~6.5s zodat het rustig, niet flikkerend, aanvoelt.
  const sweepPosition = (animTime * 0.155 + seed * 0.011) % 1;
  const sweepHalfWidth = 0.18;

  // Geen per-glyph shadowBlur en geen strokeText meer — alleen fillText.
  // Contrast komt volledig van de dikke dark backing arc onder de tekst.
  // Bespaart ~480 strokeText-calls per frame én alle offscreen blur passes.
  context.shadowBlur = 0;

  // Bijna-puur-wit voor maximale leesbaarheid + felheid. Heel licht warm
  // getint zodat het niet klinisch-koud aanvoelt, maar duidelijk wit.
  const baseCream = { r: 255, g: 255, b: 255 };
  const accentCream = { r: 255, g: 250, b: 236 };

  while (textCursor < arcLength + repeatedWidth) {
    for (let glyphIndex = 0; glyphIndex < repeatedGlyphs.length; glyphIndex += 1) {
      const { glyph, width } = repeatedGlyphs[glyphIndex];
      const glyphCenter = textCursor + width / 2;
      if (glyphCenter >= 0 && glyphCenter <= arcLength && glyph !== ' ') {
        const progress = glyphCenter / arcLength;

        // --- Position-based alpha fade (smoothstep edges) ---
        const fadeZone = 0.14;
        let edgeAlpha = 1;
        if (progress < fadeZone) {
          const t = progress / fadeZone;
          edgeAlpha = t * t * (3 - 2 * t);
        } else if (progress > 1 - fadeZone) {
          const t = (1 - progress) / fadeZone;
          edgeAlpha = t * t * (3 - 2 * t);
        }
        if (edgeAlpha < 0.02) {
          textCursor += width;
          continue;
        }

        // --- Holografische sweep brightness boost ---
        // Geen extra fillText pass meer; we bakken het effect in de fill-kleur.
        let sweepDistance = Math.abs(progress - sweepPosition);
        if (sweepDistance > 0.5) sweepDistance = 1 - sweepDistance;
        const sweep = Math.max(0, 1 - sweepDistance / sweepHalfWidth);
        const sweepBoost = sweep * sweep;

        // --- Glyph positie op de ellipse ---
        const theta = Math.PI * 0.95 - progress * Math.PI * 0.9;
        const glyphX = Math.cos(theta) * ringRadiusX;
        const glyphY = bandOffsetY + Math.sin(theta) * ringRadiusY;
        const tangentAngle = Math.atan2(
          -Math.cos(theta) * ringRadiusY,
          Math.sin(theta) * ringRadiusX,
        );

        // --- Kleur per glyph ---
        // Bullet ✦: pure theme-accent met cream highlight.
        // Letters: cream-white met theme-tint; mix-amount stijgt met sweepBoost
        // zodat de letter helderder oogt tijdens de sweep-piek (geen extra
        // draw-call meer voor een wit-overlay).
        const isStar = glyph === '✦';
        let fillColor: string;
        if (isStar) {
          // Bullet houdt iets meer theme-kleur als accent.
          fillColor = mixRgba(planet.node.color, baseCream, 0.7 + sweepBoost * 0.3, 1);
        } else {
          // Letters bijna volledig wit (0.92→1.0 richting wit) zodat ze fel
          // en leesbaar zijn, ongeacht de planeetkleur eronder.
          const target = glyphIndex % 4 === 0 ? accentCream : baseCream;
          const mixAmount = 0.92 + sweepBoost * 0.08;
          fillColor = mixRgba(planet.node.color, target, mixAmount, 1);
        }

        context.save();
        context.translate(glyphX, glyphY);
        context.rotate(tangentAngle);
        // Eén globalAlpha-write per glyph; outer band alpha × position fade.
        context.globalAlpha = alpha * edgeAlpha;
        context.fillStyle = fillColor;
        context.fillText(glyph, 0, fontSize * 0.04);
        context.restore();
      }
      textCursor += width;
    }
  }

  context.restore();
}

function drawAtmospherePatch(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  color: string,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.beginPath();
  context.ellipse(0, 0, radiusX, radiusY, 0, 0, TAU);
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawVectorPlanet(
  context: CanvasRenderingContext2D,
  planet: RenderedPlanet,
  layer: OrbitLayer,
  visibility: number,
  seed: number,
  animTime: number,
) {
  if (visibility <= 0.01) return;

  const isFront = layer === 'front';
  const layerOpacity = (isFront ? planet.opacity : planet.opacity * 0.54) * visibility;
  const outlineWidth = clamp(planet.radius * 0.075, 3, 7);
  const color = planet.node.color;
  const radius = planet.radius;
  const rotation = ((seed % 360) / 360) * TAU + Math.sin(animTime * 0.16 + seed * 0.01) * 0.05;
  const surfacePhase = animTime * (0.11 + (seed % 7) * 0.008) + seed * 0.003;
  const atmospherePulse = 0.5 + 0.5 * Math.sin(animTime * 0.7 + seed * 0.02);

  context.save();
  context.globalAlpha = layerOpacity;
  context.globalCompositeOperation = 'source-over';
  context.shadowBlur = 0;

  const halo = context.createRadialGradient(
    planet.x,
    planet.y,
    radius * 0.86,
    planet.x,
    planet.y,
    radius * (1.32 + atmospherePulse * 0.06),
  );
  halo.addColorStop(0, rgba(color, isFront ? 0.34 : 0.16));
  halo.addColorStop(0.44, rgba(color, isFront ? 0.16 : 0.08));
  halo.addColorStop(1, rgba(color, 0));
  context.beginPath();
  context.arc(planet.x, planet.y, radius * 1.38, 0, TAU);
  context.fillStyle = halo;
  context.fill();

  context.save();
  context.beginPath();
  context.arc(planet.x, planet.y, radius, 0, TAU);
  context.clip();
  context.translate(planet.x, planet.y);
  const vectorSpriteSet = getVectorPlanetSprites(color);
  if (vectorSpriteSet) {
    context.drawImage(vectorSpriteSet.body, -radius, -radius, radius * 2, radius * 2);
  } else {
    const bodyGradient = context.createLinearGradient(-radius, -radius * 0.12, radius, radius * 0.1);
    bodyGradient.addColorStop(0, mixRgba(color, { r: 48, g: 0, b: 96 }, 0.44, 1));
    bodyGradient.addColorStop(0.46, mixRgba(color, { r: 255, g: 60, b: 150 }, 0.18, 1));
    bodyGradient.addColorStop(0.78, mixRgba(color, { r: 255, g: 216, b: 48 }, 0.34, 1));
    bodyGradient.addColorStop(1, mixRgba(color, { r: 255, g: 255, b: 210 }, 0.58, 1));
    context.fillStyle = bodyGradient;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);
  }

  context.rotate(rotation * 0.28);

  drawAtmospherePatch(
    context,
    -radius * (0.38 + Math.sin(surfacePhase) * 0.04),
    -radius * 0.05,
    radius * 0.62,
    radius * 1.16,
    -0.08 + Math.sin(surfacePhase * 0.7) * 0.04,
    mixRgba(color, { r: 38, g: 0, b: 92 }, 0.5, 0.34),
  );
  drawAtmospherePatch(
    context,
    radius * (0.2 + Math.sin(surfacePhase * 0.9 + 1.5) * 0.05),
    radius * 0.05,
    radius * 0.44,
    radius * 1.06,
    0.04 + Math.cos(surfacePhase * 0.6) * 0.05,
    mixRgba(color, { r: 255, g: 255, b: 255 }, 0.32, 0.22),
  );
  drawAtmospherePatch(
    context,
    radius * (0.54 + Math.sin(surfacePhase * 0.55) * 0.04),
    radius * 0.08,
    radius * 0.34,
    radius * 0.96,
    -0.06,
    mixRgba(color, { r: 255, g: 244, b: 90 }, 0.48, 0.25),
  );

  for (let index = 0; index < 7; index += 1) {
    const angle = pseudoRandom(seed, index * 3 + 1) * TAU + Math.sin(surfacePhase * 0.42 + index) * 0.08;
    const distance = radius * (0.16 + pseudoRandom(seed, index * 3 + 2) * 0.62);
    const craterX = Math.cos(angle) * distance + Math.sin(surfacePhase + index) * radius * 0.025;
    const craterY = Math.sin(angle) * distance * 0.92 + Math.cos(surfacePhase * 0.8 + index) * radius * 0.02;
    const craterRadius = radius * (0.07 + pseudoRandom(seed, index * 3 + 3) * 0.13);
    const isBright = index % 3 === 1;

    drawAtmospherePatch(
      context,
      craterX,
      craterY,
      craterRadius * (1.05 + pseudoRandom(seed, index + 20) * 0.55),
      craterRadius * (0.86 + pseudoRandom(seed, index + 30) * 0.3),
      pseudoRandom(seed, index + 40) * TAU,
      isBright
        ? mixRgba(color, { r: 255, g: 242, b: 160 }, 0.34, 0.26)
        : mixRgba(color, { r: 34, g: 0, b: 88 }, 0.62, 0.36),
    );
  }

  if (vectorSpriteSet) {
    context.drawImage(vectorSpriteSet.innerLight, -radius, -radius, radius * 2, radius * 2);
  } else {
    const innerLight = context.createRadialGradient(
      radius * 0.38,
      -radius * 0.32,
      radius * 0.1,
      radius * 0.46,
      -radius * 0.36,
      radius * 1.0,
    );
    innerLight.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    innerLight.addColorStop(0.46, mixRgba(color, { r: 255, g: 255, b: 255 }, 0.4, 0.12));
    innerLight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = innerLight;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);
  }

  context.restore();

  context.beginPath();
  context.arc(planet.x, planet.y, radius, 0, TAU);
  context.lineWidth = outlineWidth;
  context.strokeStyle = VECTOR_INK;
  context.stroke();

  context.save();
  context.lineCap = 'round';
  context.lineWidth = clamp(radius * 0.12, 6, 14);
  context.strokeStyle = `rgba(255, 255, 255, ${isFront ? 0.88 : 0.42})`;
  context.beginPath();
  context.arc(
    planet.x + radius * 0.02,
    planet.y - radius * 0.01,
    radius * 0.94,
    -0.58 + Math.sin(surfacePhase * 0.35) * 0.03,
    0.72 + Math.sin(surfacePhase * 0.3) * 0.03,
  );
  context.stroke();
  context.restore();

  if (isFront && visibility > 0.2 && planet.radius > 28) {
    const layout = getCachedPlanetLabelLayout(context, planet.node, planet.radius, planet.scale);
    const labelCenterY = planet.y + planet.radius * 0.23;
    const labelWidth = clamp(layout.maxLineWidth, planet.radius * 0.84, planet.radius * 1.48);

    setLabelFont(context, layout.fontSize);
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Label staat bovenaan de visuele hiërarchie: volle alpha (1.0),
    // onafhankelijk van de depth-dimming van de planeet-body. Zo blijft de
    // tekst overal even fel, ook op planeten verder naar achter.
    context.save();
    context.globalAlpha = 1;

    const firstLineY = labelCenterY - ((layout.lines.length - 1) * layout.lineHeight) / 2;
    layout.lines.forEach((line, index) => {
      const y = firstLineY + index * layout.lineHeight;
      drawCentralStyleLabelLine(context, line, planet.x, y, layout.fontSize, planet.node.color);
    });

    context.restore();

    context.save();
    context.shadowBlur = clamp(planet.radius * 0.04, 1.8, 4.5);
    context.shadowColor = rgba(planet.node.color, 0.86);
    context.lineCap = 'round';
    context.lineWidth = clamp(planet.radius * 0.035, 2.2, 4.2);
    context.strokeStyle = mixRgba(planet.node.color, { r: 255, g: 242, b: 184 }, 0.44, 0.78);
    context.beginPath();
    context.moveTo(planet.x - labelWidth * 0.27, labelCenterY + (layout.lines.length * layout.lineHeight) * 0.5 + planet.radius * 0.06);
    context.lineTo(planet.x + labelWidth * 0.27, labelCenterY + (layout.lines.length * layout.lineHeight) * 0.5 + planet.radius * 0.06);
    context.stroke();
    context.restore();
  }

  context.restore();
}

export const OrbitRing = memo(function OrbitRing({
  nodes,
  onSelectNode,
  onFocusChange,
  radiusX = 400,
  radiusY = 200,
  centerOffsetX = 0,
  centerOffsetY = 0,
  centerMaskRadius = 0,
  visualStyle = DEFAULT_VISUAL_STYLE,
}: OrbitRingProps) {
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const stageSizeRef = useRef({ width: 1, height: 1 });
  const rotationRef = useRef(Math.PI / 2);
  const velocityRef = useRef(AUTO_ROTATE_SPEED);
  const momentumActiveRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  // Tijd accumulator voor de plasma-swirl animatie op orbit-planeten.
  // Telt in seconden op basis van frame delta zodat snelheid onafhankelijk is van fps.
  const animTimeRef = useRef(0);
  const lastPointerXRef = useRef(0);
  const lastPointerYRef = useRef(0);
  const lastPointerTimeRef = useRef(0);
  const totalDragRef = useRef(0);
  const lastDirectionRef = useRef(1);
  const lastFocusedNodeRef = useRef<string | null>(null);
  const focusChangeThrottleRef = useRef(0);
  const renderedPlanetsRef = useRef<RenderedPlanet[]>([]);
  const nodesRef = useRef(nodes);
  const onSelectNodeRef = useRef(onSelectNode);
  const onFocusChangeRef = useRef(onFocusChange);
  // Per-node memo voor deterministische, frame-invariante waarden.
  // stringHash en getBandLabel zijn pure functies van node.id / node.title;
  // we cachen ze zodat ze niet elke frame opnieuw uitgerekend worden.
  const nodeMetaRef = useRef(new Map<string, { hash: number; bandLabel: string }>());
  // Gecachete layout-metrics. Voorkomt synchronous forced layout per frame:
  // getBoundingClientRect + window.innerWidth/innerHeight zijn read-from-DOM
  // operaties die alle pending style/transform writes (Framer Motion!) eerst
  // flushen. Op een drukke DOM kost dat tientallen ms per frame.
  // We updaten deze waarden alleen op ResizeObserver + window resize.
  const layoutMetricsRef = useRef({
    rectLeft: 0,
    rectTop: 0,
    rectWidth: 1,
    rectHeight: 1,
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1,
    windowHeight: typeof window !== 'undefined' ? window.innerHeight : 1,
  });
  const vectorOrbitMaskId = `vector-orbit-mask-${useId().replace(/:/g, '')}`;
  const isVectorStyle = visualStyle === 'kurzgesagt';
  const orbitRadiusX = isVectorStyle ? radiusX * 1.32 : radiusX;
  const orbitRadiusY = isVectorStyle ? radiusY * 0.92 : radiusY;
  useEffect(() => {
    nodesRef.current = nodes;
    lastFocusedNodeRef.current = null;
    // Cache vullen + opschonen voor nodes die niet meer voorkomen.
    const meta = nodeMetaRef.current;
    const ids = new Set(nodes.map((n) => n.id));
    for (const key of meta.keys()) {
      if (!ids.has(key)) meta.delete(key);
    }
    for (const node of nodes) {
      if (!meta.has(node.id)) {
        meta.set(node.id, { hash: stringHash(node.id), bandLabel: getBandLabel(node.title) });
      }
    }
  }, [nodes]);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
    onFocusChangeRef.current = onFocusChange;
  }, [onSelectNode, onFocusChange]);

  const drawOrbitArc = (
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    layer: OrbitLayer,
    width: number,
  ) => {
    context.save();
    context.translate(centerX, centerY);

    const startAngle = layer === 'front' ? 0 : Math.PI;
    const endAngle = layer === 'front' ? Math.PI : TAU;

    if (visualStyle === 'kurzgesagt') {
      // De vector-orbit wordt als SVG in de DOM getekend. Safari/Chrome
      // renderden canvas-strokes op deze geroteerde ellipse soms met wedges.
      context.restore();
      return;
    }

    const primaryStroke = layer === 'front' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)';
    const accentStroke = layer === 'front' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)';

    context.lineWidth = layer === 'front' ? 2 : 1.25;
    context.setLineDash([14, 16]);
    context.lineDashOffset = layer === 'front' ? -rotationRef.current * 48 : rotationRef.current * 24;
    context.strokeStyle = primaryStroke;
    context.beginPath();
    context.ellipse(0, 0, orbitRadiusX, orbitRadiusY, ORBIT_ROTATION, startAngle, endAngle);
    context.stroke();

    context.setLineDash([]);
    context.lineWidth = layer === 'front' ? 2.5 : 1.5;
    context.strokeStyle = accentStroke;
    // Geen shadowBlur op de orbit-ring — bespaart 4 offscreen blur passes/frame.
    context.beginPath();
    context.ellipse(0, 0, orbitRadiusX, orbitRadiusY, ORBIT_ROTATION, startAngle, endAngle);
    context.stroke();

    context.restore();
  };

  const drawPlanet = (
    context: CanvasRenderingContext2D,
    planet: RenderedPlanet,
    layer: OrbitLayer,
    visibility: number,
    animTime: number,
  ) => {
    if (visibility <= 0.01) return;

    const isFront = layer === 'front';
    const layerOpacity = (isFront ? planet.opacity : planet.opacity * 0.56) * visibility;

    // Per-planet deterministische signatuur — gecached per node.id zodat de
    // hash niet elke frame opnieuw door de string heen loopt.
    const meta = nodeMetaRef.current.get(planet.node.id);
    const seed = meta ? meta.hash : stringHash(planet.node.id);

    if (visualStyle === 'kurzgesagt') {
      drawVectorPlanet(context, planet, layer, visibility, seed, animTime);
      return;
    }

    const bandLabel = meta ? meta.bandLabel : getBandLabel(planet.node.title);

    const spin = ((seed % 360) / 360) * TAU; // start rotatie
    const swirlTilt = ((seed % 100) / 100 - 0.5) * 0.6;
    const textBandSpeed = isDraggingRef.current || momentumActiveRef.current ? 0.58 : 0.18;
    // Langzame rotatie van de plasma swirl — elke planet draait op eigen tempo
    const swirlRotation = spin + animTime * (0.08 + ((seed >> 3) % 20) / 400);

    context.save();
    context.globalAlpha = layerOpacity;

    // Pre-gerenderde sprite-set (halos + body), één keer gegenereerd per
    // unieke node.color. Twee drawImage's vervangen 6 createRadialGradient
    // + 6 arc + 6 fill per frame per planeet — fors snellere GPU-blit.
    const spriteSet = getPlanetSprites(planet.node.color);
    const drawScale = planet.radius / SPRITE_RENDER_RADIUS;
    const drawSize = SPRITE_SIZE * drawScale;
    const halfDraw = drawSize / 2;

    // 1+2) Outer halo + rim halo
    if (spriteSet) {
      context.drawImage(
        spriteSet.halos,
        planet.x - halfDraw,
        planet.y - halfDraw,
        drawSize,
        drawSize,
      );
    }

    // 2b) Achterste helft van de draaiende tekstband — tussen halo's en body
    // zodat hij echt om de bol heen voelt.
    drawOrbitingTextBand(context, planet, seed, isFront, visibility, animTime, 'back', textBandSpeed, bandLabel);

    // 3) Planet body — dekt het binnenste van de back-text-band af.
    if (spriteSet) {
      context.drawImage(
        spriteSet.body,
        planet.x - halfDraw,
        planet.y - halfDraw,
        drawSize,
        drawSize,
      );
    }

    // 4) Plasma swirls binnen de bol
    context.save();
    context.beginPath();
    context.arc(planet.x, planet.y, planet.radius, 0, TAU);
    context.clip();

    // Gebruik ADDITIEVE blending zodat de swirls opgloeien
    context.globalCompositeOperation = 'screen';

    // 3 grote vloeiende swirl lobes die roteren op een eigen tempo
    // Elke lobe heeft een warm-bright kern (peakTone) en een subtiele buitenglow
    const lobeCount = 3;
    for (let i = 0; i < lobeCount; i++) {
      const lobeAngle = swirlRotation + (i / lobeCount) * TAU + Math.sin(animTime * 0.4 + i) * 0.2;
      const lobeDist = planet.radius * (0.25 + 0.1 * Math.sin(animTime * 0.3 + i * 1.3 + seed * 0.01));
      const cx = planet.x + Math.cos(lobeAngle) * lobeDist;
      const cy = planet.y + Math.sin(lobeAngle) * lobeDist * (0.55 + swirlTilt * 0.3);
      const r = planet.radius * (0.55 + 0.1 * Math.sin(animTime * 0.25 + i));

      const swirl = context.createRadialGradient(cx, cy, 0, cx, cy, r);
      // bright kern geleidelijk naar transparant
      swirl.addColorStop(0, rgba(planet.node.color, isFront ? 0.85 : 0.4));
      swirl.addColorStop(0.35, rgba(planet.node.color, isFront ? 0.35 : 0.15));
      swirl.addColorStop(1, rgba(planet.node.color, 0));
      context.beginPath();
      context.arc(cx, cy, r, 0, TAU);
      context.fillStyle = swirl;
      context.fill();
    }

    // Circuit/neural filaments in de stijl van de gegenereerde referentie-planeet.
    drawSurfaceFilaments(context, planet, seed, isFront, visibility, animTime);

    // Hele bright "plasma crest" — klein hotspot dat meedraait
    const crestAngle = swirlRotation * 1.3 + Math.cos(animTime * 0.6) * 0.5;
    const crestDist = planet.radius * 0.28;
    const cx = planet.x + Math.cos(crestAngle) * crestDist;
    const cy = planet.y + Math.sin(crestAngle) * crestDist;
    const crestRadius = planet.radius * 0.24;
    const crest = context.createRadialGradient(cx, cy, 0, cx, cy, crestRadius);
    crest.addColorStop(0, `rgba(255,255,255,${isFront ? 0.65 : 0.28})`);
    crest.addColorStop(0.4, rgba(planet.node.color, isFront ? 0.5 : 0.22));
    crest.addColorStop(1, rgba(planet.node.color, 0));
    context.beginPath();
    context.arc(cx, cy, crestRadius, 0, TAU);
    context.fillStyle = crest;
    context.fill();

    context.restore();

    // 5) Subtle dark vignette op de rand binnen de bol (geeft 3D volume)
    context.save();
    context.beginPath();
    context.arc(planet.x, planet.y, planet.radius, 0, TAU);
    context.clip();
    const vignette = context.createRadialGradient(
      planet.x,
      planet.y,
      planet.radius * 0.72,
      planet.x,
      planet.y,
      planet.radius,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.32)');
    context.fillStyle = vignette;
    context.fillRect(
      planet.x - planet.radius,
      planet.y - planet.radius,
      planet.radius * 2,
      planet.radius * 2,
    );
    context.restore();

    // 6) Bright outline — sluit de body af met een helder rim streepje
    context.beginPath();
    context.arc(planet.x, planet.y, planet.radius * 0.99, 0, TAU);
    context.lineWidth = Math.max(1, 1.1 * planet.scale);
    context.strokeStyle = isFront
      ? rgba(planet.node.color, 0.65 + visibility * 0.15)
      : rgba(planet.node.color, 0.28 + visibility * 0.1);
    context.stroke();

    // 7) Voorste helft van de draaiende tekstband, met marquee-tekst.
    drawOrbitingTextBand(context, planet, seed, isFront, visibility, animTime, 'front', textBandSpeed, bandLabel);

    context.restore();
  };

  const drawOrbit = useCallback((
    backCanvas: HTMLCanvasElement,
    backContext: CanvasRenderingContext2D,
    frontCanvas: HTMLCanvasElement,
    frontContext: CanvasRenderingContext2D,
  ) => {
    const currentNodes = nodesRef.current;
    const { width, height } = stageSizeRef.current;
    // Gebruik gecachete layout-metrics i.p.v. per-frame getBoundingClientRect
    // (zou anders alle pending DOM writes synchronously flushen).
    const metrics = layoutMetricsRef.current;
    const scaleX = metrics.rectWidth > 0 ? width / metrics.rectWidth : 1;
    const scaleY = metrics.rectHeight > 0 ? height / metrics.rectHeight : 1;
    const centerX = metrics.rectWidth > 0
      ? (metrics.windowWidth / 2 - metrics.rectLeft) * scaleX + centerOffsetX
      : width / 2 + centerOffsetX;
    const centerY = metrics.rectHeight > 0
      ? (metrics.windowHeight / 2 - metrics.rectTop) * scaleY + centerOffsetY
      : height / 2 + centerOffsetY;

    backContext.clearRect(0, 0, width, height);
    frontContext.clearRect(0, 0, width, height);

    if (currentNodes.length === 0) {
      renderedPlanetsRef.current = [];
      return;
    }

    drawOrbitArc(backContext, centerX, centerY, 'back', width);
    drawOrbitArc(frontContext, centerX, centerY, 'front', width);

    // Hergebruik de buffer-array + RenderedPlanet objecten over frames heen
    // i.p.v. elk frame nieuw te .map'en. Bespaart ~8 object-allocs + 1 array-alloc
    // per frame (≈ 480/s GC pressure). Het sorteren gebeurt nog steeds in-place.
    const planets = renderedPlanetsRef.current;
    planets.length = currentNodes.length;
    const nodeCount = currentNodes.length;
    const rotation = rotationRef.current;

    for (let index = 0; index < nodeCount; index += 1) {
      const node = currentNodes[index];
      const nodeAngle = (index / nodeCount) * TAU + rotation;
      const normalizedAngle = normalizeAngle(nodeAngle);
      const depth = Math.sin(normalizedAngle);
      const scale = 0.48 + (depth * 0.5 + 0.5) * 0.64;
      const opacity = 0.34 + (depth * 0.5 + 0.5) * 0.66;
      const frontVisibility = smoothstep(LAYER_FADE_START, LAYER_FADE_END, depth);
      const backVisibility = 1 - frontVisibility;
      const localPoint = rotatePoint(
        Math.cos(nodeAngle) * orbitRadiusX,
        Math.sin(nodeAngle) * orbitRadiusY,
        ORBIT_ROTATION,
      );
      const x = centerX + localPoint.x;
      const y = centerY + localPoint.y;
      const radius = (PLANET_SIZE * scale) / 2;

      const existing = planets[index];
      if (existing) {
        existing.node = node;
        existing.x = x;
        existing.y = y;
        existing.angle = normalizedAngle;
        existing.radius = radius;
        existing.scale = scale;
        existing.opacity = opacity;
        existing.depth = depth;
        existing.frontVisibility = frontVisibility;
        existing.backVisibility = backVisibility;
      } else {
        planets[index] = { node, x, y, angle: normalizedAngle, radius, scale, opacity, depth, frontVisibility, backVisibility };
      }
    }

    planets.sort((a, b) => a.depth - b.depth);

    const targetAngle = Math.PI / 2;
    let closestNode: ContentNode | null = null;
    let smallestDiff = Infinity;
    const shouldCheckFocus = Boolean(onFocusChangeRef.current) && performance.now() - focusChangeThrottleRef.current >= FOCUS_THROTTLE_MS;

    const animTime = animTimeRef.current;
    for (const planet of planets) {
      drawPlanet(backContext, planet, 'back', planet.backVisibility, animTime);
      drawPlanet(frontContext, planet, 'front', planet.frontVisibility, animTime);

      if (shouldCheckFocus) {
        let diff = Math.abs(planet.angle - targetAngle);
        if (diff > Math.PI) diff = TAU - diff;

        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestNode = planet.node;
        }
      }
    }

    if (centerMaskRadius > 0) {
      backContext.save();
      backContext.globalCompositeOperation = 'destination-out';

      // Mask alleen de achterlaag: rear planets verdwijnen achter de core,
      // front planets blijven zichtbaar wanneer ze voorlangs passeren.
      const maskRadius = visualStyle === 'kurzgesagt' ? centerMaskRadius * 1.22 : centerMaskRadius;
      const maskGradient = backContext.createRadialGradient(
        centerX,
        centerY,
        maskRadius * 0.84,
        centerX,
        centerY,
        maskRadius * 1.08,
      );
      maskGradient.addColorStop(0, 'rgba(0,0,0,1)');
      maskGradient.addColorStop(0.84, 'rgba(0,0,0,1)');
      maskGradient.addColorStop(1, 'rgba(0,0,0,0)');
      backContext.beginPath();
      backContext.arc(centerX, centerY, maskRadius * 1.08, 0, TAU);
      backContext.fillStyle = maskGradient;
      backContext.fill();
      backContext.restore();
    }

    if (shouldCheckFocus) {
      focusChangeThrottleRef.current = performance.now();
    }

    if (closestNode && lastFocusedNodeRef.current !== closestNode.id) {
      lastFocusedNodeRef.current = closestNode.id;
      onFocusChangeRef.current?.(closestNode);
    }
  }, [centerMaskRadius, centerOffsetX, centerOffsetY, orbitRadiusX, orbitRadiusY, visualStyle]);

  useEffect(() => {
    const backCanvas = backCanvasRef.current;
    const frontCanvas = frontCanvasRef.current;
    const wrapper = wrapperRef.current;
    const canvasContextOptions: CanvasRenderingContext2DSettings = {
      alpha: true,
      desynchronized: true,
    };
    const backContext = backCanvas?.getContext('2d', canvasContextOptions);
    const frontContext = frontCanvas?.getContext('2d', canvasContextOptions);
    if (!backCanvas || !frontCanvas || !wrapper || !backContext || !frontContext) return;

    let width = 0;
    let height = 0;
    lastFrameTimeRef.current = 0;

    const updateLayoutMetrics = () => {
      // Eén keer per resize (en window resize) lezen we de DOM-rect; per frame
      // gebruikt drawOrbit de gecachete waarden zonder forced layout.
      const r = frontCanvas.getBoundingClientRect();
      layoutMetricsRef.current.rectLeft = r.left;
      layoutMetricsRef.current.rectTop = r.top;
      layoutMetricsRef.current.rectWidth = r.width;
      layoutMetricsRef.current.rectHeight = r.height;
      layoutMetricsRef.current.windowWidth = window.innerWidth;
      layoutMetricsRef.current.windowHeight = window.innerHeight;
    };

    const resizeCanvas = () => {
      const rect = wrapper.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      const sizeChanged = width !== nextWidth || height !== nextHeight;
      if (sizeChanged) {
        width = nextWidth;
        height = nextHeight;
        stageSizeRef.current = { width, height };
        for (const canvas of [backCanvas, frontCanvas]) {
          canvas.width = Math.floor(width * pixelRatio);
          canvas.height = Math.floor(height * pixelRatio);
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }
        backContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        frontContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }

      // Layout-metrics updaten ook als size niet wijzigt — de canvas-positie
      // op het scherm kan zijn opgeschoven door layout-veranderingen
      // elders (bv. ander panel mounten/unmounten).
      updateLayoutMetrics();
    };

    const handleWindowResize = () => updateLayoutMetrics();

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(wrapper);
    resizeCanvas();
    window.addEventListener('resize', handleWindowResize, { passive: true });

    const tick = () => {
      const now = performance.now();
      const previousFrameTime = lastFrameTimeRef.current || now;
      const frameScale = Math.min((now - previousFrameTime) / (1000 / 60), MAX_FRAME_SCALE);
      const deltaSec = Math.min((now - previousFrameTime) / 1000, 0.1);
      lastFrameTimeRef.current = now;

      // Animatie tijd voor plasma swirls op orbit-planeten
      animTimeRef.current += deltaSec;

      if (!isDraggingRef.current) {
        if (momentumActiveRef.current) {
          rotationRef.current += velocityRef.current * frameScale;
          velocityRef.current *= Math.pow(FRICTION, frameScale);
          lastDirectionRef.current = velocityRef.current > 0 ? 1 : -1;

          if (Math.abs(velocityRef.current) <= VELOCITY_THRESHOLD) {
            momentumActiveRef.current = false;
          }
        } else {
          const targetVelocity = AUTO_ROTATE_SPEED * lastDirectionRef.current;
          const lerpAmount = Math.min(AUTO_ROTATE_LERP * frameScale, 1);
          velocityRef.current += (targetVelocity - velocityRef.current) * lerpAmount;
          rotationRef.current += velocityRef.current * frameScale;
        }
      }

      drawOrbit(backCanvas, backContext, frontCanvas, frontContext);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [drawOrbit]);

  const findHitPlanet = (clientX: number, clientY: number) => {
    const canvas = frontCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const { width, height } = stageSizeRef.current;
    const x = rect.width > 0 ? (clientX - rect.left) * (width / rect.width) : clientX - rect.left;
    const y = rect.height > 0 ? (clientY - rect.top) * (height / rect.height) : clientY - rect.top;

    for (let index = renderedPlanetsRef.current.length - 1; index >= 0; index -= 1) {
      const planet = renderedPlanetsRef.current[index];
      const hitRadius = Math.max(planet.radius, 54);
      const distance = Math.hypot(x - planet.x, y - planet.y);

      if (distance <= hitRadius) {
        return planet.node;
      }
    }

    return null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    momentumActiveRef.current = false;
    velocityRef.current = 0;
    totalDragRef.current = 0;
    lastPointerXRef.current = event.clientX;
    lastPointerYRef.current = event.clientY;
    lastPointerTimeRef.current = performance.now();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

    const now = performance.now();
    const deltaX = event.clientX - lastPointerXRef.current;
    const deltaY = event.clientY - lastPointerYRef.current;
    const deltaTime = Math.max(now - lastPointerTimeRef.current, 1);

    totalDragRef.current += Math.hypot(deltaX, deltaY);
    rotationRef.current -= deltaX * VELOCITY_MULTIPLIER;
    velocityRef.current = -(deltaX * VELOCITY_MULTIPLIER) / (deltaTime / VELOCITY_SCALE);

    if (Math.abs(deltaX) > 0.5) {
      lastDirectionRef.current = deltaX > 0 ? -1 : 1;
    }

    lastPointerXRef.current = event.clientX;
    lastPointerYRef.current = event.clientY;
    lastPointerTimeRef.current = now;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    isDraggingRef.current = false;
    momentumActiveRef.current = Math.abs(velocityRef.current) > VELOCITY_THRESHOLD;

    if (totalDragRef.current <= DRAG_CLICK_THRESHOLD) {
      momentumActiveRef.current = false;
      const hitNode = findHitPlanet(event.clientX, event.clientY);
      if (hitNode) onSelectNodeRef.current(hitNode);
    }
  };

  const vectorOrbitExtentX = orbitRadiusX * Math.abs(Math.cos(ORBIT_ROTATION)) + orbitRadiusY * Math.abs(Math.sin(ORBIT_ROTATION));
  const vectorOrbitExtentY = orbitRadiusX * Math.abs(Math.sin(ORBIT_ROTATION)) + orbitRadiusY * Math.abs(Math.cos(ORBIT_ROTATION));
  const vectorOrbitSize = {
    width: vectorOrbitExtentX * 2 + VECTOR_ORBIT_STROKE_WIDTH * 2,
    height: vectorOrbitExtentY * 2 + VECTOR_ORBIT_STROKE_WIDTH * 2,
  };
  const vectorOrbitCenter = {
    x: vectorOrbitSize.width / 2,
    y: vectorOrbitSize.height / 2,
  };
  const vectorOrbitBackPath = describeEllipseArc(
    vectorOrbitCenter.x,
    vectorOrbitCenter.y,
    orbitRadiusX,
    orbitRadiusY,
    Math.PI,
    TAU,
  );
  const vectorOrbitFrontPath = describeEllipseArc(
    vectorOrbitCenter.x,
    vectorOrbitCenter.y,
    orbitRadiusX,
    orbitRadiusY,
    0,
    Math.PI,
  );
  const vectorOrbitOcclusionRadius = Math.max(0, centerMaskRadius * 1.22 + VECTOR_ORBIT_STROKE_WIDTH * 1.5);

  const renderVectorOrbitSegment = (path: string, zIndex: number, occludeCenter = false) => (
    <svg
      className="absolute pointer-events-none"
      width={vectorOrbitSize.width}
      height={vectorOrbitSize.height}
      viewBox={`0 0 ${vectorOrbitSize.width} ${vectorOrbitSize.height}`}
      style={{
        zIndex,
        left: `calc(50% + ${centerOffsetX}px - ${vectorOrbitCenter.x}px)`,
        top: `calc(50% + ${centerOffsetY}px - ${vectorOrbitCenter.y}px)`,
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      {occludeCenter && vectorOrbitOcclusionRadius > 0 && (
        <defs>
          <mask id={vectorOrbitMaskId} maskUnits="userSpaceOnUse">
            <rect width={vectorOrbitSize.width} height={vectorOrbitSize.height} fill="white" />
            <circle
              cx={vectorOrbitCenter.x}
              cy={vectorOrbitCenter.y}
              r={vectorOrbitOcclusionRadius}
              fill="black"
            />
          </mask>
        </defs>
      )}
      <g transform={`rotate(${ORBIT_ROTATION_DEG} ${vectorOrbitCenter.x} ${vectorOrbitCenter.y})`}>
        <path
          d={path}
          fill="none"
          stroke={VECTOR_ORBIT_STROKE}
          strokeWidth={VECTOR_ORBIT_STROKE_WIDTH}
          strokeLinecap="butt"
          mask={occludeCenter && vectorOrbitOcclusionRadius > 0 ? `url(#${vectorOrbitMaskId})` : undefined}
        />
      </g>
    </svg>
  );

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none select-none"
      style={{
        width: '100%',
        height: '100%',
        // GPU compositor hints: isoleer paint/layout zodat motion-animaties in
        // de omliggende DOM (KurzgesagtBackdrop etc.) niet de canvas-laag
        // mee-invalideren. transform: translateZ(0) promoot dit blok tot een
        // eigen GPU-laag.
        contain: 'layout style paint',
        transform: 'translateZ(0)',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {visualStyle === 'kurzgesagt' && (
        <>
          {renderVectorOrbitSegment(vectorOrbitBackPath, 34, true)}
          {renderVectorOrbitSegment(vectorOrbitFrontPath, 55)}
        </>
      )}
      <canvas
        ref={backCanvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
        style={{ zIndex: 35, willChange: 'transform', transform: 'translateZ(0)' }}
        aria-hidden="true"
      />
      <canvas
        ref={frontCanvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
        style={{
          zIndex: visualStyle === 'kurzgesagt' ? 56 : 44,
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
        aria-label="Orbit navigation"
      />
    </div>
  );
});
