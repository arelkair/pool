import { Application, Container, Graphics, Text } from 'pixi.js';
import { CANVAS_W, CANVAS_H, BALL_R, MAX_DRAG, MIN_DRAG } from './config.js';
import { rack, step, allStopped, shoot, respawnCue } from './physics.js';
import { drawTable, buildBallVisual, drawAim, drawPower } from './scene.js';
import { host, join } from './net.js';
import * as ui from './ui.js';

const game = {
  mode: 'solo', myPlayer: 1, turn: 1, started: false,
  balls: null, cue: null, sprites: null, byNumber: null,
  shots: 0, potted: 0, shooting: false, pottedAtShot: 0, cueFoul: false,
  net: null, settled: true, cuePotted: false,
};

let app, ballLayer, aimLine, powerBar, powerLabel, frame = 0;

async function main() {
  app = new Application();
  await app.init({ width: CANVAS_W, height: CANVAS_H, backgroundColor: 0x081109, antialias: true });
  app.ticker.maxFPS = 60; // keep frame-based physics consistent across refresh rates
  document.getElementById('app').appendChild(app.canvas);

  app.stage.addChild(drawTable());
  ballLayer = new Container();
  app.stage.addChild(ballLayer);
  aimLine = new Graphics();
  powerBar = new Graphics();
  powerLabel = new Text({ text: 'POTENCIA', style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 'bold', fill: 0xffffff } });
  powerLabel.position.set(24, CANVAS_H - 40);
  powerLabel.visible = false;
  app.stage.addChild(aimLine, powerBar, powerLabel);

  setupRack();
  setupInput();
  app.ticker.add(tick);
  wireMenu();
}

function tick() {
  if (game.mode !== 'guest') {
    step(game.balls);
    if (game.cue.potted) game.cueFoul = true;
    if (game.cue.potted && allStopped(game.balls)) respawnCue(game.cue);
    const potted = game.balls.filter((b) => b.number !== 0 && b.potted).length;
    if (potted !== game.potted) { game.potted = potted; ui.updateHud(game.shots, game.potted); }
    if (game.mode === 'host' && game.shooting && allStopped(game.balls)) resolveTurn();
    for (const [ball, spr] of game.sprites) {
      if (ball.potted) continue;
      const sp = Math.hypot(ball.vx, ball.vy);
      spr.spin.rotation += (ball.vx >= 0 ? 1 : -1) * sp * 0.04;
    }
    if (game.mode === 'host' && game.started && game.net && (++frame % 2 === 0)) sendState();
  }
  for (const [ball, spr] of game.sprites) {
    spr.visible = !ball.potted;
    if (!ball.potted) spr.position.set(ball.x, ball.y);
  }
}

function setupRack() {
  ballLayer.removeChildren();
  game.balls = rack();
  game.cue = game.balls.find((b) => b.number === 0);
  game.sprites = new Map();
  game.byNumber = new Map();
  for (const b of game.balls) {
    const v = buildBallVisual(b);
    game.sprites.set(b, v);
    game.byNumber.set(b.number, { ball: b, spr: v });
    ballLayer.addChild(v);
  }
  game.shots = 0; game.potted = 0; game.shooting = false;
  ui.updateHud(0, 0);
}

function canShoot() {
  const stopped = game.mode === 'guest' ? game.settled : allStopped(game.balls);
  if (!stopped) return false;
  if (game.mode === 'guest') return !game.cuePotted && game.turn === game.myPlayer;
  if (game.cue.potted) return false;
  if (game.mode === 'solo') return true;
  return game.turn === game.myPlayer; // host
}

function doShoot(dx, dy, power) {
  shoot(game.cue, dx, dy, power);
  game.shots++;
  game.shooting = true;
  game.pottedAtShot = game.potted;
  game.cueFoul = false;
  ui.updateHud(game.shots, game.potted);
  ui.hideHint();
}

function resolveTurn() {
  game.shooting = false;
  const gained = game.potted - game.pottedAtShot;
  if (!(gained > 0 && !game.cueFoul)) game.turn = game.turn === 1 ? 2 : 1;
  game.cueFoul = false;
  ui.updateTurn(game.mode, game.turn === game.myPlayer);
  sendState();
}

function sendState() {
  game.net.send({
    type: 'state', turn: game.turn, settled: allStopped(game.balls), cuePotted: game.cue.potted,
    shots: game.shots, potted: game.potted,
    balls: game.balls.map((b) => ({ n: b.number, x: b.x, y: b.y, r: game.sprites.get(b).spin.rotation, p: b.potted })),
  });
}

function applyState(m) {
  game.turn = m.turn; game.settled = m.settled; game.cuePotted = m.cuePotted;
  game.shots = m.shots; game.potted = m.potted;
  for (const bs of m.balls) {
    const e = game.byNumber.get(bs.n);
    if (!e) continue;
    e.ball.x = bs.x; e.ball.y = bs.y; e.ball.potted = bs.p;
    e.spr.spin.rotation = bs.r;
  }
  ui.updateHud(game.shots, game.potted);
  ui.updateTurn(game.mode, game.turn === game.myPlayer);
}

function setupInput() {
  let dragStart = null;
  const pos = (e) => {
    const r = app.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (app.canvas.width / r.width), y: (e.clientY - r.top) * (app.canvas.height / r.height) };
  };
  app.canvas.addEventListener('pointerdown', (e) => { if (canShoot()) dragStart = pos(e); });
  // move/up on window so dragging off the table keeps aiming instead of cancelling the shot
  window.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    const p = pos(e);
    drawAim(aimLine, game.cue, p.x, p.y);
    drawPower(powerBar, powerLabel, Math.min(Math.hypot(game.cue.x - p.x, game.cue.y - p.y), MAX_DRAG) / MAX_DRAG);
  });
  window.addEventListener('pointerup', (e) => {
    if (!dragStart) return;
    const p = pos(e);
    const dx = game.cue.x - p.x, dy = game.cue.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (canShoot() && dist > MIN_DRAG) {
      const power = Math.min(dist, MAX_DRAG) / MAX_DRAG;
      if (game.mode === 'guest') game.net.send({ type: 'shoot', dx, dy, power });
      else doShoot(dx, dy, power);
    }
    dragStart = null;
    aimLine.clear();
    powerBar.clear();
    powerLabel.visible = false;
  });
}

function closeNet() {
  if (game.net) { game.net.close(); game.net = null; }
  game.started = false;
}

function onMessage(m) {
  if (m.type === 'start' && game.mode === 'guest') { setupRack(); game.started = true; ui.enterGame(); ui.updateTurn(game.mode, game.turn === game.myPlayer); }
  else if (m.type === 'state' && game.mode === 'guest') applyState(m);
  else if (m.type === 'shoot' && game.mode === 'host' && game.turn === 2) doShoot(m.dx, m.dy, m.power);
}

function startHost() {
  closeNet();
  game.mode = 'host'; game.myPlayer = 1;
  ui.setStatus('host-status', 'Creando sala…');
  ui.el('host-code').textContent = '····';
  game.net = host({
    ready: (code) => { ui.el('host-code').textContent = code; ui.setStatus('host-status', 'Esperando al jugador 2…'); },
    joined: () => {
      setupRack(); game.turn = 1; game.started = true;
      ui.toast('El jugador 2 se ha unido a la partida');
      ui.enterGame(); ui.updateTurn('host', true);
      game.net.send({ type: 'start' });
      sendState();
    },
    message: onMessage,
    left: () => ui.toast('El otro jugador se ha desconectado'),
    error: () => ui.setStatus('host-status', 'Error creando la sala. Vuelve a intentarlo.', true),
  });
}

function startJoin() {
  const code = ui.el('join-code').value.trim().toUpperCase();
  if (code.length < 4) { ui.setStatus('join-status', 'Escribe el código de 4 letras.', true); return; }
  closeNet();
  game.mode = 'guest'; game.myPlayer = 2;
  ui.setStatus('join-status', 'Conectando…');
  game.net = join(code, {
    connected: () => ui.setStatus('join-status', 'Conectado. Esperando al anfitrión…'),
    message: onMessage,
    left: () => { ui.setStatus('join-status', 'Conexión cerrada.', true); },
    error: () => ui.setStatus('join-status', 'No se encontró la sala. Revisa el código.', true),
  });
}

function wireMenu() {
  ui.el('btn-play').onclick = () => ui.showScreen('screen-mode');
  ui.el('btn-settings').onclick = () => {
    const s = ui.el('settings');
    s.style.display = s.style.display === 'none' ? 'block' : 'none';
  };
  ui.el('btn-quit').onclick = () => window.close();
  document.querySelectorAll('[data-back]').forEach((b) => {
    b.onclick = () => { closeNet(); ui.showScreen(b.dataset.back); };
  });

  ui.el('btn-solo').onclick = () => { closeNet(); game.mode = 'solo'; setupRack(); ui.enterGame(); ui.updateTurn('solo'); };
  ui.el('btn-multi').onclick = () => ui.showScreen('screen-mp');
  ui.el('btn-create').onclick = () => { ui.showScreen('screen-host'); startHost(); };
  ui.el('btn-join').onclick = () => { ui.setStatus('join-status', ''); ui.showScreen('screen-join'); };
  ui.el('btn-connect').onclick = startJoin;
  ui.el('btn-copy').onclick = () => navigator.clipboard?.writeText(ui.el('host-code').textContent);

  ui.el('btn-restart').onclick = () => {
    if (game.mode === 'guest') return;
    setupRack();
    if (game.mode === 'host') { game.turn = 1; ui.updateTurn('host', true); sendState(); }
    ui.showHint();
  };
  ui.el('btn-menu').onclick = () => { closeNet(); game.mode = 'solo'; ui.backToMenu(); };
}

main();
