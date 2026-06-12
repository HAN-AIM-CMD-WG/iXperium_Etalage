import { motion } from 'motion/react';
import { memo, useMemo, type CSSProperties } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ContentNode } from '../data/content';
import { ease } from '../motion/easing';
import {
  DEFAULT_VISUAL_STYLE,
  type AppVisualStyle,
} from '../../shared/visualStyle';

/**
 * Compacte variant van de hoofdtitel voor de centrale planeet — voorkomt dat
 * lange routenamen het label in 3+ regels breken. De volledige naam komt nog
 * wel terug als subtitel onder de divider.
 */
function compactTitleForCenter(title: string) {
  return title
    .replace('Artificial Intelligence', 'AI')
    .replace('XR & Human Machine Interaction', 'XR & HMI')
    .replace('Rapid Prototyping & Additive Manufacturing', 'Rapid Prototyping');
}

interface PlanetProps {
  node: ContentNode;
  angle: number;
  isCenter?: boolean;
  onSelect?: () => void;
  /** Terug-knop bovenaan de centrum-planeet (alleen relevant als isCenter). */
  onBack?: () => void;
  radiusX?: number;
  radiusY?: number;
  floatDelay?: number;
  visualStyle?: AppVisualStyle;
}

export const Planet = memo(function Planet({
  node,
  angle,
  isCenter = false,
  onSelect,
  onBack,
  radiusX = 400,
  radiusY = 200,
  floatDelay = 0,
  visualStyle = DEFAULT_VISUAL_STYLE,
}: PlanetProps) {
  const isVector = visualStyle === 'kurzgesagt';

  if (isCenter) {
    const compact = compactTitleForCenter(node.title);
    const hasLongForm = compact !== node.title;
    const rawCode = node.theme || node.id;
    const themeCode = rawCode.charAt(0).toUpperCase() + rawCode.slice(1);
    const labelStyle = {
      '--central-accent': node.color,
      '--central-text': '#ffffff',
      '--central-secondary': 'rgba(255,255,255,0.74)',
      '--central-highlight': '#ffffff',
      '--central-glow': `${node.color}99`,
    } as CSSProperties & Record<string, string>;

    return (
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: ease.flashy }}
        style={{ zIndex: 60 }}
      >
        <div
          className="relative flex h-[21rem] w-[21rem] items-center justify-center"
          // CSS-animatie i.p.v. framer JS-loop: zelfde float (orbit-float =
          // translate3d 0/-5px/0), maar volledig op de compositor-thread.
          style={{ animation: 'orbit-float 6.5s linear infinite', willChange: 'transform' }}
        >
          <div
            className="central-planet-label relative z-10 w-[min(18.5rem,42vw)] text-center"
            style={labelStyle}
          >
            {/* Terug-knop — boven de titel op de planeet. Vervangt de oude
                back-knop linksboven. pointer-events-auto omdat de planeet zelf
                pointer-events-none is. */}
            {onBack && (
              <motion.button
                type="button"
                onClick={onBack}
                className="pointer-events-auto mx-auto mb-4 flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.12] px-4 py-2 text-xs font-bold tracking-normal text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                whileTap={{ scale: 0.94 }}
                style={{ boxShadow: `0 0 22px ${node.color}55, 0 8px 24px rgba(0,0,0,0.35)` }}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Terug</span>
              </motion.button>
            )}

            {/* Thema-accent puls — bovenaan, glowend in de routekleur */}
            <motion.div
              className="mx-auto h-[7px] w-[7px] rounded-full"
              style={{
                backgroundColor: node.color,
                boxShadow: `0 0 12px ${node.color}, 0 0 28px ${node.color}66`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.55, ease: ease.flashy }}
            />

            {/* Eyebrow — tracking-widest small caps, subtiel theme-getint */}
            <motion.p
              className="central-planet-label__kicker mt-5 text-[10px] font-bold text-white/58"
              style={{ letterSpacing: '0.42em' }}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.4 }}
            >
              Geselecteerde route
            </motion.p>

            {/* Hero titel — compacte vorm, groot en strak */}
            <motion.h2
              className="central-planet-label__title mt-3.5 font-black leading-[0.92] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.82)]"
              style={{
                fontSize: 'clamp(2.4rem, 5vw, 3.5rem)',
                letterSpacing: '-0.025em',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.55, ease: ease.flashy }}
            >
              {compact}
            </motion.h2>

            {/* Divider met centraal diamantje in theme-kleur */}
            <motion.div
              className="mt-5 flex items-center justify-center gap-2.5"
              initial={{ opacity: 0, scaleX: 0.65 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.48, duration: 0.55 }}
            >
              <div
                className="central-planet-divider h-px w-12"
                style={{
                  background: `linear-gradient(90deg, transparent, ${node.color}cc)`,
                }}
              />
              <div
                className="h-[5px] w-[5px] rotate-45"
                style={{
                  backgroundColor: node.color,
                  boxShadow: `0 0 10px ${node.color}cc`,
                }}
              />
              <div
                className="central-planet-divider h-px w-12"
                style={{
                  background: `linear-gradient(90deg, ${node.color}cc, transparent)`,
                }}
              />
            </motion.div>

            {/* Volledige titel (als die afwijkt van compact) OF thema-code */}
            {hasLongForm ? (
              <motion.p
                className="central-planet-label__subtitle mt-4 px-2 text-[0.95rem] font-light leading-[1.22] text-white/72"
                style={{ letterSpacing: '0.005em' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                {node.title}
              </motion.p>
            ) : (
              <motion.p
                className="central-planet-label__footer mt-4 text-[10.5px] font-bold text-white/45"
                style={{ letterSpacing: '0.4em' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                Route · {themeCode}
              </motion.p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Memoize expensive calculations
  const planetProps = useMemo(() => {
    // Calculate position on ellipse
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;

    // Calculate depth (z-axis simulation)
    // Normalize angle to 0-2π
    const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Bottom (π/2) is front, top (3π/2) is back
    const depthFactor = Math.sin(normalizedAngle);

    // Scale: 0.4 at back (top), 1.0 at front (bottom)
    const scale = 0.4 + (depthFactor * 0.5 + 0.5) * 0.6;

    // Opacity: 0.3 at back (top), 1.0 at front (bottom)
    const opacity = 0.3 + (depthFactor * 0.5 + 0.5) * 0.7;

    // Size based on depth
    const size = 80 + scale * 60;

    // Z-index: higher at front, lower at back
    const zIndex = Math.round(50 + depthFactor * 50);

    return { x, y, scale, opacity, size, zIndex };
  }, [angle, radiusX, radiusY]);

  const { x, y, scale, opacity, size, zIndex } = planetProps;

  return (
    <motion.div
      className="absolute cursor-pointer group pointer-events-auto select-none"
      style={{
        left: '50%',
        top: '50%',
        zIndex,
        willChange: 'transform',
        x: x - size / 2,
        y: y - size / 2
      }}
      animate={{
        scale,
        opacity
      }}
      whileHover={{ scale: scale * 1.1 }}
      whileTap={{ scale: scale * 0.95 }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      initial={{ scale: 0, opacity: 0 }}
      transition={{ duration: 0, type: 'tween', ease: 'linear' }}
    >
      <motion.div
        animate={{
          y: [0, -5, 0]
        }}
        transition={{
          duration: 4 + floatDelay,
          repeat: Infinity,
          ease: 'linear',
          delay: floatDelay
        }}
      >
        <div
          className={`orbit-planet relative rounded-full ${isVector ? '' : `bg-gradient-to-br ${node.gradient} shadow-lg`} flex items-center justify-center`}
          style={{
            backgroundColor: isVector ? node.color : undefined,
            width: size,
            height: size,
            boxShadow: isVector ? undefined : `0 0 ${30 * scale}px ${node.color}80, 0 0 ${60 * scale}px ${node.color}50, 0 0 ${90 * scale}px ${node.color}30`,
            willChange: 'transform'
          }}
        >
          {!isVector && <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent" />}
          <p className="orbit-planet-label text-white font-semibold text-center px-4 relative z-10 drop-shadow-md" style={{ fontSize: `${10 + scale * 4}px` }}>
            {node.title}
          </p>

          {/* Glow effect */}
          {!isVector && (
            <>
              <div
                className="absolute inset-0 rounded-full opacity-60 blur-xl group-hover:opacity-80 transition-opacity"
                style={{ background: `radial-gradient(circle, ${node.color}80, transparent 70%)` }}
              />
              <div
                className="absolute inset-0 rounded-full opacity-40 blur-2xl"
                style={{ background: `radial-gradient(circle, ${node.color}60, transparent 80%)` }}
              />
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders when only angle changes slightly
  // Only re-render if angle changed significantly (> 0.01 radians) or other props changed
  if (prevProps.node.id !== nextProps.node.id) return false;
  if (prevProps.isCenter !== nextProps.isCenter) return false;
  if (prevProps.radiusX !== nextProps.radiusX) return false;
  if (prevProps.radiusY !== nextProps.radiusY) return false;
  if (prevProps.visualStyle !== nextProps.visualStyle) return false;
  if (Math.abs(prevProps.angle - nextProps.angle) > 0.01) return false;
  return true;
});
