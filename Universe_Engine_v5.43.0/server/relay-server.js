const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 8787);
const saveDir = process.env.UE_SAVE_DIR || path.join(__dirname, 'data');
fs.mkdirSync(saveDir, { recursive: true });

const rooms = new Map();
const safeRoom = id => String(id || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'default';
const fileOf = id => path.join(saveDir, `${safeRoom(id)}.json`);

function loadRoom(id) {
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(fileOf(id), 'utf8')); } catch {}
  return {
    clients: new Map(),
    presences: new Map(),
    seq: Number(saved?.seq) || 0,
    snapshot: saved?.snapshot || null,
    hostId: null,
    updatedAt: saved?.updatedAt || null
  };
}
function roomOf(id) { if (!rooms.has(id)) rooms.set(id, loadRoom(id)); return rooms.get(id); }
function persist(id, room) {
  try {
    fs.writeFileSync(fileOf(id), JSON.stringify({
      format: 'UE-ROOM-SAVE', room: id, seq: room.seq,
      updatedAt: new Date().toISOString(), snapshot: room.snapshot
    }, null, 2));
  } catch (e) { console.warn('room persist failed', e.message); }
}
function safeSend(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(room, obj, except = null) { for (const ws of room.clients.values()) if (ws !== except) safeSend(ws, obj); }
function presences(room) { return [...room.presences.values()]; }
function peers(room) {
  return [...room.clients.values()].map(ws => ws._ue).filter(Boolean).map(x => ({
    clientId: x.clientId, name: x.name, isHost: x.clientId === room.hostId,
    playMode: x.playMode, team: x.team
  }));
}
function cleanupRoom(id) {
  const r = rooms.get(id); if (!r) return;
  if (!r.clients.size) { rooms.delete(id); return; }
  if (!r.hostId || !r.clients.has(r.hostId)) {
    r.hostId = [...r.clients.keys()][0];
    const host = r.clients.get(r.hostId);
    if (host) safeSend(host, { type: 'host-changed', isHost: true });
  }
}

// Render and other PaaS health checks need an HTTP endpoint in addition to WebSocket.
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      ok: true,
      service: 'Universe Engine Relay',
      rooms: rooms.size,
      clients: [...rooms.values()].reduce((n, room) => n + room.clients.size, 0),
      time: new Date().toISOString()
    }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  ws._ue = null;
  ws.on('message', buf => {
    let msg; try { msg = JSON.parse(String(buf)); } catch { return; }
    if (msg.type === 'hello') {
      if (ws._ue) return;
      const roomId = safeRoom(msg.room), clientId = String(msg.clientId || '').slice(0, 120), name = String(msg.name || 'Player').slice(0, 80);
      if (!clientId) return safeSend(ws, { type: 'error', message: 'clientId required' });
      const room = roomOf(roomId);
      if (room.clients.has(clientId)) return safeSend(ws, { type: 'error', message: '同じclientIdが接続中です' });
      ws._ue = { roomId, clientId, name, playMode: msg.playMode === 'versus' ? 'versus' : 'coop', team: String(msg.team || 'A').slice(0, 12) };
      room.clients.set(clientId, ws);
      if (!room.hostId || (msg.wantsHost && room.clients.size === 1)) room.hostId = clientId;
      safeSend(ws, { type: 'welcome', room: roomId, clientId, isHost: room.hostId === clientId, peers: peers(room), presences: presences(room), seq: room.seq, hasSnapshot: !!room.snapshot, cloudSavedAt: room.updatedAt });
      broadcast(room, { type: 'peer-joined', peer: { clientId, name, isHost: room.hostId === clientId, playMode: ws._ue.playMode, team: ws._ue.team }, hasSnapshot: !!room.snapshot }, ws);
      if (room.snapshot) safeSend(ws, { type: 'project-snapshot', snapshot: room.snapshot, seq: room.seq, source: 'server-cloud-save' });
      return;
    }
    if (msg.type === 'ping') { safeSend(ws, { type: 'pong', t: msg.t || Date.now() }); return; }
    if (!ws._ue) return safeSend(ws, { type: 'error', message: 'hello first' });
    const room = rooms.get(ws._ue.roomId); if (!room) return;
    if (msg.type === 'project-snapshot' && msg.snapshot) {
      room.seq++; room.snapshot = msg.snapshot; room.updatedAt = new Date().toISOString();
      // Do not block the WebSocket message loop with synchronous disk writes on every update.
      clearTimeout(room.persistTimer);
      room.persistTimer = setTimeout(() => { persist(ws._ue.roomId, room); room.persistTimer = null; }, 1500);
      broadcast(room, { type: 'project-snapshot', snapshot: msg.snapshot, seq: room.seq, source: ws._ue.clientId, cloudSavedAt: room.updatedAt }, ws);
      safeSend(ws, { type: 'cloud-saved', seq: room.seq, cloudSavedAt: room.updatedAt }); return;
    }
    if (msg.type === 'presence') { const presence={ ...msg, clientId: ws._ue.clientId, name: ws._ue.name, playMode: ws._ue.playMode, team: ws._ue.team, serverTime: Date.now() }; room.presences.set(ws._ue.clientId,presence); broadcast(room, presence, ws); return; }
    if (msg.type === 'game-event') { broadcast(room, { ...msg, type: 'game-event', sourceClientId: ws._ue.clientId, sourceName: ws._ue.name, team: ws._ue.team }); return; }
  });
  ws.on('close', () => {
    const meta = ws._ue; if (!meta) return;
    const room = rooms.get(meta.roomId); if (!room) return;
    room.clients.delete(meta.clientId);room.presences.delete(meta.clientId); broadcast(room, { type: 'peer-left', clientId: meta.clientId }); cleanupRoom(meta.roomId);
  });
});

// Protocol-level heartbeat keeps Render/proxies and idle clients alive and removes dead sockets.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws._alive === false) { try { ws.terminate(); } catch {} continue; }
    ws._alive = false;
    try { ws.ping(); } catch {}
  }
}, 20000);
wss.on('connection', ws => { ws._alive = true; ws.on('pong', () => { ws._alive = true; }); });
server.on('close', () => clearInterval(heartbeat));

server.listen(port, '0.0.0.0', () => {
  console.log(`Universe Engine relay + cross-save listening on http/ws://0.0.0.0:${port}`);
});
