/**
 * Centraal easing palette voor het hele project.
 *
 * Regel uit .roo/rules/02-visual-language.md:
 * - Geen inline magic numbers voor easing.
 * - Entry: ease.flashy (overshoot, aandacht-grijpend)
 * - Exit:  ease.snap (crisp, blokkeer UI niet)
 * - Hover: ease.soft (natuurlijke terugveer)
 * - Loop:  ease.linear (continue animatie, nooit easeInOut)
 */
export const ease = {
  /** Overshoot entry — geeft speelse, aandacht-grijpende feel. Gebruik voor mount/entry animaties. */
  flashy: [0.34, 1.56, 0.64, 1] as const,

  /** Crisp quick exit — snelle afronding, blokkeer UI niet. Gebruik voor unmount/dismiss. */
  snap: [0.22, 1, 0.36, 1] as const,

  /** Material-style — natuurlijke terugveer. Gebruik voor hover / tap / drag feedback. */
  soft: [0.4, 0, 0.2, 1] as const,

  /** Pure linear — voor continue loops (float, orbit, shader time). Nooit easeInOut op loops. */
  linear: [0, 0, 1, 1] as const,
} as const;

/** Duration presets (ms) — consistent gebruik tussen componenten. */
export const duration = {
  /** Micro interaction (hover, tap flash) */
  instant: 0.15,
  /** Standaard UI transition (sheet open/close, content swap) */
  quick: 0.35,
  /** Entry animaties met flair */
  normal: 0.6,
  /** Grote scene transitions */
  slow: 1.2,
} as const;

export type EaseKey = keyof typeof ease;
export type DurationKey = keyof typeof duration;
