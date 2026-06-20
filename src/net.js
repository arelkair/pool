// Thin WebSocket client: connect to the host's server and exchange JSON messages.
// ponytail: no reconnect/heartbeat — a LAN game is short-lived; reload to retry.
export function createNet(ip, port = 8080) {
  const ws = new WebSocket(`ws://${ip}:${port}`);
  const handlers = {};
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    handlers[m.type]?.(m);
  };
  return {
    on(type, fn) { handlers[type] = fn; },
    send(obj) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); },
    onOpen(fn) { ws.addEventListener('open', fn); },
    onError(fn) { ws.addEventListener('error', fn); },
    onClose(fn) { ws.addEventListener('close', fn); },
    close() { ws.close(); },
  };
}
