import { useEffect, useRef } from 'react';

/**
 * Gebruikers-input die de inactiviteitstimer opnieuw start. Pointer-events
 * dekken zowel touch (de tafel) als muis; keydown/wheel zijn er voor een
 * aangesloten toetsenbord of testen op een laptop.
 *
 * Bewust GEEN scroll/resize/visibilitychange: die kunnen door de app zelf of
 * door het OS worden getriggerd en zouden de timer eindeloos verlengen.
 */
const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'wheel',
  'keydown',
] as const satisfies readonly (keyof WindowEventMap)[];

interface UseIdleTimeoutOptions {
  /** Inactiviteit (ms) waarna `onIdle` wordt aangeroepen. */
  timeoutMs: number;
  /** Timer loopt alleen als dit true is. Bij een wissel start de timer opnieuw. */
  enabled?: boolean;
  onIdle: () => void;
}

/**
 * Roept `onIdle` aan zodra er `timeoutMs` lang geen gebruikers-input is geweest.
 * Elke interactie zet de volledige periode opnieuw.
 *
 * De input-listeners schrijven alleen een timestamp (geen timer-churn bij
 * bewegende vingers); één setTimeout controleert of de periode verstreken is en
 * plant zich anders opnieuw voor de resterende tijd. Er is dus maximaal één
 * timer actief, ongeacht het aantal events.
 */
export function useIdleTimeout({ timeoutMs, enabled = true, onIdle }: UseIdleTimeoutOptions) {
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled || timeoutMs <= 0 || typeof window === 'undefined') return;

    let timerId: number | null = null;
    // Date.now() i.p.v. performance.now(): als het apparaat gaat slapen telt die
    // tijd mee als inactiviteit, zodat de tafel na het wakker worden bij het
    // begin staat.
    let lastActivityAt = Date.now();

    const check = () => {
      const remaining = timeoutMs - (Date.now() - lastActivityAt);

      if (remaining > 0) {
        timerId = window.setTimeout(check, remaining);
        return;
      }

      timerId = null;
      onIdleRef.current();
    };

    const markActivity = () => {
      lastActivityAt = Date.now();
    };

    // Capture-fase + passive: ook input die door een component wordt
    // afgehandeld (en propagatie stopt) telt als activiteit, zonder scroll-
    // of touch-performance te beïnvloeden.
    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, markActivity, listenerOptions);
    }

    timerId = window.setTimeout(check, timeoutMs);

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, markActivity, listenerOptions);
      }
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [enabled, timeoutMs]);
}
