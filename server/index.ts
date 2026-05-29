import { createServer } from 'node:http';
import { Server } from 'socket.io';
import {
  INITIAL_NAVIGATION_STATE,
  type ClientCounts,
  type ClientToServerEvents,
  type InterServerEvents,
  type NavigationSetEvent,
  type ServerToClientEvents,
  type SocketData,
  type StateSnapshotEvent,
  isClientRole,
  isNavigationResetEvent,
  isNavigationSetEvent,
  isNewerNavigationState,
} from '../src/shared/protocol.js';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

const httpServer = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ ok: true, service: 'ixperium-navigation-hub' }));
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10_000,
  pingTimeout: 5_000,
});

let latestState: NavigationSetEvent = INITIAL_NAVIGATION_STATE;
let updatedAt = Date.now();

function getClientCounts(): ClientCounts {
  const counts: ClientCounts = { table: 0, kiosk: 0 };

  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.role === 'table') counts.table += 1;
    if (socket.data.role === 'kiosk') counts.kiosk += 1;
  }

  return counts;
}

function createSnapshot(): StateSnapshotEvent {
  return {
    state: latestState,
    serverSeq: latestState.seq,
    updatedAt,
    clients: getClientCounts(),
  };
}

function emitStatus() {
  io.emit('connection:status', {
    connected: true,
    health: 'connected',
    clients: getClientCounts(),
    serverTime: Date.now(),
  });
}

function broadcastSnapshot() {
  io.emit('state:snapshot', createSnapshot());
  emitStatus();
}

io.on('connection', (socket) => {
  socket.emit('state:snapshot', createSnapshot());

  socket.on('client:hello', (payload, ack) => {
    if (!isClientRole(payload.role)) {
      ack?.({ ok: false, reason: 'invalid role', snapshot: createSnapshot() });
      return;
    }

    socket.data.role = payload.role;
    socket.data.displayName = payload.displayName;
    socket.emit('state:snapshot', createSnapshot());
    emitStatus();
    ack?.({ ok: true, snapshot: createSnapshot() });
  });

  socket.on('navigation:set', (payload, ack) => {
    if (!isNavigationSetEvent(payload)) {
      ack?.({ ok: false, reason: 'invalid navigation payload', snapshot: createSnapshot() });
      return;
    }

    if (!isNewerNavigationState(payload, latestState)) {
      ack?.({ ok: false, reason: 'stale navigation payload', snapshot: createSnapshot() });
      return;
    }

    latestState = {
      level: payload.level,
      mainId: payload.mainId,
      subId: payload.subId,
      theme: payload.theme ?? 'main',
      visualStyle: INITIAL_NAVIGATION_STATE.visualStyle,
      seq: payload.seq,
      sentAt: payload.sentAt,
    };
    updatedAt = Date.now();

    broadcastSnapshot();
    ack?.({ ok: true, snapshot: createSnapshot() });
  });

  socket.on('navigation:reset', (payload, ack) => {
    if (!isNavigationResetEvent(payload)) {
      ack?.({ ok: false, reason: 'invalid reset payload', snapshot: createSnapshot() });
      return;
    }

    const resetState: NavigationSetEvent = {
      ...INITIAL_NAVIGATION_STATE,
      seq: payload.seq,
      sentAt: payload.sentAt,
    };

    if (!isNewerNavigationState(resetState, latestState)) {
      ack?.({ ok: false, reason: 'stale reset payload', snapshot: createSnapshot() });
      return;
    }

    latestState = resetState;
    updatedAt = Date.now();

    broadcastSnapshot();
    ack?.({ ok: true, snapshot: createSnapshot() });
  });

  socket.on('disconnect', emitStatus);
});

httpServer.listen(port, host, () => {
  console.log(`iXperium navigation hub listening on http://${host}:${port}`);
});
