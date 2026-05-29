import { useRef, useCallback, useEffect } from 'react';

interface MomentumState {
  rotation: number;
  velocity: number;
  lastTime: number;
  isDragging: boolean;
  lastDirection: number;
}

const VELOCITY_MULTIPLIER = 0.01;
const VELOCITY_SCALE = 16;

export function useMomentum(
  rotation: number,
  setRotation: (r: number) => void,
  friction: number = 0.95,
  velocityThreshold: number = 0.001
) {
  const stateRef = useRef<MomentumState>({
    rotation,
    velocity: 0,
    lastTime: Date.now(),
    isDragging: false,
    lastDirection: 1
  });

  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef(false);

  useEffect(() => {
    stateRef.current.rotation = rotation;
  }, [rotation]);

  const animate = useCallback(() => {
    const state = stateRef.current;

    if (!state.isDragging && Math.abs(state.velocity) > velocityThreshold) {
      state.velocity *= friction;
      state.rotation += state.velocity;
      setRotation(state.rotation);
      requestAnimationFrame(animate);
    }
  }, [setRotation, friction, velocityThreshold]);

  const startDrag = useCallback(() => {
    stateRef.current.isDragging = true;
    stateRef.current.velocity = 0;
    stateRef.current.lastTime = Date.now();
  }, []);

  const drag = useCallback((deltaX: number) => {
    const state = stateRef.current;
    const now = Date.now();
    const deltaTime = Math.max(now - state.lastTime, 1);

    // Reverse the drag direction
    state.rotation -= deltaX * VELOCITY_MULTIPLIER;
    state.velocity = -(deltaX * VELOCITY_MULTIPLIER) / (deltaTime / VELOCITY_SCALE);

    // Track the direction of movement
    if (Math.abs(deltaX) > 0.5) {
      state.lastDirection = deltaX > 0 ? -1 : 1; // Reversed because of drag reversal
    }

    state.lastTime = now;

    // Batch updates with requestAnimationFrame for smooth 60fps
    if (!pendingUpdateRef.current) {
      pendingUpdateRef.current = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        setRotation(state.rotation);
        pendingUpdateRef.current = false;
        rafRef.current = null;
      });
    }
  }, [setRotation]);

  const endDrag = useCallback(() => {
    stateRef.current.isDragging = false;
    requestAnimationFrame(animate);
  }, [animate]);

  const getLastDirection = useCallback(() => {
    return stateRef.current.lastDirection;
  }, []);

  return { startDrag, drag, endDrag, getLastDirection };
}
