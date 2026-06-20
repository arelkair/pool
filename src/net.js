// Peer-to-peer multiplayer over WebRTC (PeerJS public broker).
// Works straight from the deployed website — no own server, no IPs, no port forwarding.
// One player "Crea sala" (gets a code), the other "Se une" with that code.
import Peer from 'peerjs';

const PREFIX = 'pool-arelkair-'; // namespace our ids on the shared broker
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function randomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

// Host: returns { code (filled async via handlers.ready), send, close }
export function host(handlers) {
  const code = randomCode();
  const peer = new Peer(PREFIX + code);
  let conn = null;
  peer.on('open', () => handlers.ready?.(code));
  peer.on('error', (e) => handlers.error?.(e));
  peer.on('connection', (c) => {
    conn = c;
    c.on('open', () => handlers.joined?.());
    c.on('data', (d) => handlers.message?.(d));
    c.on('close', () => handlers.left?.());
  });
  return {
    send: (o) => { if (conn && conn.open) conn.send(o); },
    close: () => { try { conn?.close(); peer.destroy(); } catch { /* ignore */ } },
  };
}

// Guest: connect to an existing room code.
export function join(code, handlers) {
  const peer = new Peer();
  let conn = null;
  peer.on('open', () => {
    conn = peer.connect(PREFIX + code.trim().toUpperCase());
    conn.on('open', () => handlers.connected?.());
    conn.on('data', (d) => handlers.message?.(d));
    conn.on('close', () => handlers.left?.());
    conn.on('error', (e) => handlers.error?.(e));
  });
  peer.on('error', (e) => handlers.error?.(e));
  return {
    send: (o) => { if (conn && conn.open) conn.send(o); },
    close: () => { try { conn?.close(); peer.destroy(); } catch { /* ignore */ } },
  };
}
