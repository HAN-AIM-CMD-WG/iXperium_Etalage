import {
  DEFAULT_VISUAL_STYLE,
  isAppVisualStyle,
  type AppVisualStyle,
} from './visualStyle.js';

export type ClientRole = 'table' | 'kiosk';
export type NavigationLevel = 'main' | 'submenu' | 'detail';
export type ConnectionHealth = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface ClientHelloEvent {
  role: ClientRole;
  displayName?: string;
  version: 1;
}

export interface NavigationSetEvent {
  level: NavigationLevel;
  mainId?: string;
  subId?: string;
  theme?: string;
  visualStyle?: AppVisualStyle;
  /** Snapshot (dataURL) van de planeet die op de tafel naar de kiosk vloog,
   *  zodat de kiosk-handoff exact dezelfde planeet toont. Transient/optioneel. */
  planetImage?: string;
  seq: number;
  sentAt: number;
}

export interface NavigationResetEvent {
  seq: number;
  sentAt: number;
}

export interface ClientCounts {
  table: number;
  kiosk: number;
}

export interface ConnectionStatusEvent {
  connected: boolean;
  health: ConnectionHealth;
  clients: ClientCounts;
  serverTime: number;
}

export interface StateSnapshotEvent {
  state: NavigationSetEvent;
  serverSeq: number;
  updatedAt: number;
  clients: ClientCounts;
}

export interface AckResponse {
  ok: boolean;
  reason?: string;
  snapshot?: StateSnapshotEvent;
}

export interface ServerToClientEvents {
  'state:snapshot': (snapshot: StateSnapshotEvent) => void;
  'connection:status': (status: ConnectionStatusEvent) => void;
}

export interface ClientToServerEvents {
  'client:hello': (payload: ClientHelloEvent, ack?: (response: AckResponse) => void) => void;
  'navigation:set': (payload: NavigationSetEvent, ack?: (response: AckResponse) => void) => void;
  'navigation:reset': (payload: NavigationResetEvent, ack?: (response: AckResponse) => void) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  role?: ClientRole;
  displayName?: string;
}

export const PROTOCOL_VERSION = 1;

export const INITIAL_NAVIGATION_STATE: NavigationSetEvent = {
  level: 'main',
  theme: 'main',
  visualStyle: DEFAULT_VISUAL_STYLE,
  seq: 0,
  sentAt: 0,
};

export function isNewerNavigationState(next: NavigationSetEvent, current: NavigationSetEvent) {
  if (next.seq !== current.seq) {
    return next.seq > current.seq;
  }

  return next.sentAt > current.sentAt;
}

export function isNavigationLevel(value: unknown): value is NavigationLevel {
  return value === 'main' || value === 'submenu' || value === 'detail';
}

export function isClientRole(value: unknown): value is ClientRole {
  return value === 'table' || value === 'kiosk';
}

export function isNavigationSetEvent(value: unknown): value is NavigationSetEvent {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<NavigationSetEvent>;

  if (!isNavigationLevel(candidate.level)) return false;
  if (typeof candidate.seq !== 'number' || !Number.isFinite(candidate.seq)) return false;
  if (typeof candidate.sentAt !== 'number' || !Number.isFinite(candidate.sentAt)) return false;
  if (candidate.mainId !== undefined && typeof candidate.mainId !== 'string') return false;
  if (candidate.subId !== undefined && typeof candidate.subId !== 'string') return false;
  if (candidate.theme !== undefined && typeof candidate.theme !== 'string') return false;
  if (candidate.visualStyle !== undefined && !isAppVisualStyle(candidate.visualStyle)) return false;
  if (candidate.planetImage !== undefined && typeof candidate.planetImage !== 'string') return false;

  if (candidate.level === 'main' && (candidate.mainId || candidate.subId)) return false;
  if (candidate.level === 'submenu' && !candidate.mainId) return false;
  if (candidate.level === 'detail' && (!candidate.mainId || !candidate.subId)) return false;

  return true;
}

export function isNavigationResetEvent(value: unknown): value is NavigationResetEvent {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<NavigationResetEvent>;
  return (
    typeof candidate.seq === 'number' &&
    Number.isFinite(candidate.seq) &&
    typeof candidate.sentAt === 'number' &&
    Number.isFinite(candidate.sentAt)
  );
}
