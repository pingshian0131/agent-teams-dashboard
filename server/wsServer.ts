import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import * as cache from './teamsCache.js';
import type { WsEvent } from '../src/types.js';

const HEARTBEAT_INTERVAL = 30_000;
const PONG_TIMEOUT = 10_000;

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
}

let wss: WebSocketServer | null = null;

function broadcast(event: WsEvent): void {
  if (!wss) return;
  const data = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  console.log('[ws] WebSocket server attached on /ws');

  wss.on('connection', (ws: ExtWebSocket) => {
    ws.isAlive = true;
    const clientCount = wss!.clients.size;
    console.log(`[ws] Client connected (total: ${clientCount})`);

    // Send initial lean snapshot (no agentActivity)
    const snapshot = cache.getLeanSnapshot();
    ws.send(JSON.stringify({ type: 'snapshot', data: snapshot } satisfies WsEvent));

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      const remaining = wss!.clients.size;
      console.log(`[ws] Client disconnected (total: ${remaining})`);
    });
  });

  // Heartbeat interval
  const heartbeat = setInterval(() => {
    if (!wss) return;
    for (const client of wss.clients) {
      const ws = client as ExtWebSocket;
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();

      // Terminate if no pong within timeout
      const pongTimer = setTimeout(() => {
        if (!ws.isAlive) ws.terminate();
      }, PONG_TIMEOUT);
      ws.once('pong', () => clearTimeout(pongTimer));
    }
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  // Listen for cache changes and broadcast lean snapshot + deltas
  cache.onChange.on('change', () => {
    const snap = cache.getLeanSnapshot();
    broadcast({ type: 'snapshot', data: snap });

    // Broadcast only new entries as deltas
    const newEntries = cache.getAndClearNewEntries();
    for (const [agentId, entries] of newEntries) {
      if (entries.length > 0) {
        broadcast({ type: 'agent_entries_delta', agentId, entries });
      }
    }
  });
}
