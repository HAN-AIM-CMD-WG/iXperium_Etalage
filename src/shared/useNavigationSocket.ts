import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  INITIAL_NAVIGATION_STATE,
  PROTOCOL_VERSION,
  type AckResponse,
  type ClientRole,
  type ClientToServerEvents,
  type ConnectionHealth,
  type NavigationSetEvent,
  type ServerToClientEvents,
  type StateSnapshotEvent,
  isNewerNavigationState,
} from './protocol';

function getDefaultSocketUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3001';

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:3001`;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? getDefaultSocketUrl();
const FALLBACK_SNAPSHOT: StateSnapshotEvent = {
  state: INITIAL_NAVIGATION_STATE,
  serverSeq: 0,
  updatedAt: 0,
  clients: { table: 0, kiosk: 0 },
};

interface UseNavigationSocketResult {
  connected: boolean;
  health: ConnectionHealth;
  lastSnapshot: StateSnapshotEvent | null;
  publishNavigation: (payload: Omit<NavigationSetEvent, 'seq' | 'sentAt'>) => void;
  resetNavigation: () => void;
}

export function useNavigationSocket(role: ClientRole): UseNavigationSocketResult {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const seqRef = useRef(0);
  const snapshotRef = useRef<StateSnapshotEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [health, setHealth] = useState<ConnectionHealth>('connecting');
  const [lastSnapshot, setLastSnapshot] = useState<StateSnapshotEvent | null>(null);

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 400,
      reconnectionDelayMax: 2500,
      timeout: 4000,
    });

    socketRef.current = socket;

    const applySnapshot = (snapshot: StateSnapshotEvent) => {
      const current = snapshotRef.current;

      if (current && !isNewerNavigationState(snapshot.state, current.state)) {
        return;
      }

      seqRef.current = Math.max(seqRef.current, snapshot.state.seq);
      snapshotRef.current = snapshot;
      setLastSnapshot(snapshot);
    };

    const sayHello = () => {
      socket.emit('client:hello', { role, version: PROTOCOL_VERSION }, (response?: AckResponse) => {
        if (response?.snapshot) {
          applySnapshot(response.snapshot);
        }
      });
    };

    socket.on('connect', () => {
      setConnected(true);
      setHealth('connected');
      sayHello();
    });

    socket.io.on('reconnect_attempt', () => {
      setConnected(false);
      setHealth('reconnecting');
    });

    socket.io.on('reconnect', () => {
      setConnected(true);
      setHealth('connected');
      sayHello();
    });

    socket.on('connect_error', () => {
      setConnected(false);
      setHealth('reconnecting');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setHealth('disconnected');
    });

    socket.on('state:snapshot', applySnapshot);

    socket.on('connection:status', (status) => {
      setHealth(status.health);
      setConnected(status.connected);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [role]);

  const publishNavigation = useCallback((payload: Omit<NavigationSetEvent, 'seq' | 'sentAt'>) => {
    const socket = socketRef.current;
    if (!socket) return;

    const nextState: NavigationSetEvent = {
      ...payload,
      seq: seqRef.current + 1,
      sentAt: Date.now(),
    };

    seqRef.current = nextState.seq;
    socket.emit('navigation:set', nextState, (response?: AckResponse) => {
      if (!response?.ok && response?.snapshot) {
        snapshotRef.current = response.snapshot;
        setLastSnapshot(response.snapshot);
      }
    });
  }, []);

  const resetNavigation = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const resetEvent = {
      seq: seqRef.current + 1,
      sentAt: Date.now(),
    };

    seqRef.current = resetEvent.seq;
    socket.emit('navigation:reset', resetEvent, (response?: AckResponse) => {
      if (response?.snapshot) {
        snapshotRef.current = response.snapshot;
        setLastSnapshot(response.snapshot);
      }
    });
  }, []);

  return {
    connected,
    health,
    lastSnapshot: lastSnapshot ?? FALLBACK_SNAPSHOT,
    publishNavigation,
    resetNavigation,
  };
}
