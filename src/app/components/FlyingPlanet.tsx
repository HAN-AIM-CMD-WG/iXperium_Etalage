import { motion } from 'motion/react';
import { memo, useMemo } from 'react';
import type { PlanetSelectOrigin } from './OrbitRing';

export type FlyMode = 'toCenter' | 'upOff';

interface FlyingPlanetProps {
  /** Viewport-positie + radius (+ snapshot) van de getapte planeet. */
  origin: PlanetSelectOrigin;
  /** Theme-kleur (fallback-bol als er geen snapshot is). */
  color: string;
  /** 'toCenter' = naar het scherm-midden vergroten; 'upOff' = omhoog van het scherm af. */
  mode: FlyMode;
  /** Diameter (px) van de centrum-planeet waar 'toCenter' naartoe schaalt. */
  centerDiameter: number;
  /** Titel (alleen voor de fallback-bol). */
  title?: string;
  /** Wordt aangeroepen wanneer de animatie klaar is. */
  onComplete: () => void;
}

/**
 * Transiente "vliegende planeet" overlay.
 *
 * Toont — indien beschikbaar — een snapshot van de exact getapte planeet uit
 * het canvas, zodat het letterlijk díe planeet is die beweegt:
 *  - 'upOff'   : vliegt ONGEWIJZIGD omhoog het scherm uit (cross-screen handoff).
 *  - 'toCenter': verplaatst naar het midden en vergroot (wordt de centrum-planeet).
 *
 * Zonder snapshot valt het terug op een themed gradient-bol.
 */
export const FlyingPlanet = memo(function FlyingPlanet({
  origin,
  color,
  mode,
  centerDiameter,
  title,
  onComplete,
}: FlyingPlanetProps) {
  const cx = typeof window !== 'undefined' ? window.innerWidth / 2 : origin.clientX;
  const cy = typeof window !== 'undefined' ? window.innerHeight / 2 : origin.clientY;

  const hasImage = Boolean(origin.image && origin.imageCssSize);
  // Elementgrootte: de snapshot-box, of (fallback) de centrum-diameter.
  const elementSize = hasImage ? (origin.imageCssSize as number) : centerDiameter;

  // Schaal voor 'toCenter': laat de planeet-bol binnen de snapshot tot
  // centerDiameter groeien. De planeet beslaat 2*clientRadius binnen de box.
  const toCenterScale = hasImage
    ? centerDiameter / Math.max(1, origin.clientRadius * 2)
    : 1;
  // Fallback-bol start klein (origin) en groeit naar centerDiameter.
  const fallbackStartScale = Math.max(0.2, (origin.clientRadius * 2) / centerDiameter);

  const sphereStyle = useMemo(
    () => ({
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      background: `
        radial-gradient(circle at 34% 28%, rgba(255,255,255,0.85) 0%, transparent 38%),
        radial-gradient(circle at 72% 80%, rgba(0,0,0,0.42) 0%, transparent 60%),
        linear-gradient(140deg, ${color} 0%, ${color}66 100%)
      `,
      boxShadow: `0 0 70px ${color}aa, 0 0 28px ${color}, inset -18px -20px 46px rgba(0,0,0,0.42)`,
    }),
    [color],
  );

  const initial = {
    x: origin.clientX,
    y: origin.clientY,
    scale: hasImage ? 1 : fallbackStartScale,
    opacity: 1,
  };

  const animateTo =
    mode === 'toCenter'
      ? { x: cx, y: cy, scale: hasImage ? toCenterScale : 1, opacity: 1 }
      : {
          // Ongewijzigd omhoog het scherm uit — geen schaalverandering.
          x: origin.clientX,
          y: -elementSize,
          scale: hasImage ? 1 : fallbackStartScale,
          opacity: hasImage ? [1, 1, 1, 0] : 1,
        };

  const transition =
    mode === 'toCenter'
      ? // Vloeiende glide zonder overshoot.
        { duration: 0.78, ease: [0.32, 0.12, 0.18, 1] as const }
      : // Versnellende glide omhoog.
        {
          duration: 0.62,
          ease: [0.45, 0, 0.7, 0] as const,
          opacity: { duration: 0.62, times: [0, 0.6, 0.9, 1] as const },
        };

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: elementSize,
        height: elementSize,
        marginLeft: -elementSize / 2,
        marginTop: -elementSize / 2,
        zIndex: 150,
        pointerEvents: 'none',
        willChange: 'transform',
      }}
      initial={initial}
      animate={animateTo}
      transition={transition}
      onAnimationComplete={onComplete}
    >
      {hasImage ? (
        <img
          src={origin.image}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <>
          <div style={sphereStyle} />
          {title ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 12%',
                textAlign: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: `${Math.max(14, centerDiameter * 0.09)}px`,
                lineHeight: 1.02,
                letterSpacing: '-0.02em',
                textShadow: '0 2px 10px rgba(0,0,0,0.6)',
              }}
            >
              {title}
            </div>
          ) : null}
        </>
      )}
    </motion.div>
  );
});
