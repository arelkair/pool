import { Application, Container, Graphics, Text } from 'pixi.js';
import { CANVAS_W, CANVAS_H, MAX_DRAG, MIN_DRAG } from './config.js';
import { rack, step, allStopped, shoot, respawnCue } from './physics.js';
import { drawTable, buildBallVisual, drawAim, drawPower } from './scene.js';
import { host, join } from './net.js';
import * as ui from './ui.js';
import * as audio from './audio.js';

const groupOf = (n) => (n === 0 ? 'cue' : n === 8 ? 'eight' : n <= 7 ? 'solids' : 'stripes');
const other = (p) => (p === 1 ? 2 : 1);

const game = {
  mode: 'solo', myPlayer: 1, turn: 1, started: false,
  balls: null, cue: null, sprites: null, byNumber: null,
  shots: 0, shooting: false, shotPotted: [], cueFoul: false,
  groups: { 1: null, 2: null }, gameOver: false, winner: null,
  net: null, settled: true, cuePotted: false,
  sfxBall: 0, sfxRail: 0, sfxPocket: 0,
};

let app, ballLayer, aimLine, powerBar, powerLabel, frame = 0;
let bannerQ = [], bannerBusy = false;

async function main() {
  app = new Application();
  await app.init({ width: CANVAS_W, height: CANVAS_H, backgroundColor: 0x081109, antialias: true });
  app.ticker.maxFPS = 60;
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

  // start audio on the first user gesture (browser autoplay policy)
  const kick = () => { audio.resume(); audio.startMusic(); window.removeEventListener('pointerdown', kick); };
  window.addEventListener('pointerdown', kick);
}

function tick() {
  if (game.mode !== 'guest') {
    const { potted, hits } = step(game.balls);
    for (const h of hits) {
      if (h.type === 'ball') { audio.ballHit(h.speed); game.sfxBall = Math.max(game.sfxBall, h.speed); }
      else { audio.railHit(h.speed); game.sfxRail = Math.max(game.sfxRail, h.speed); }
    }
    for (const b of potted) {
      audio.pocket(); game.sfxPocket++;
      game.shotPotted.push(b.number);
      if (b.number === 0) game.cueFoul = true;
    }
    if (potted.length) refreshHud();
    if (game.cue.potted && allStopped(game.balls)) respawnCue(game.cue);
    if (game.shooting && allStopped(game.balls)) {
      if (game.mode === 'host') resolveTurn();
      else { game.shooting = false; refreshHud(); } // solo: free play
    }
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
  game.shots = 0; game.shooting = false; game.shotPotted = []; game.cueFoul = false;
  game.gameOver = false; game.winner = null;
  refreshHud();
}

function refreshHud() {
  if (game.mode === 'solo') {
    const p = game.balls.filter((b) => b.number !== 0 && b.potted).length;
    ui.updateHud(game.shots, p, 15);
  } else {
    const mg = game.groups[game.myPlayer];
    const p = mg ? game.balls.filter((b) => groupOf(b.number) === mg && b.potted).length : 0;
    ui.updateHud(game.shots, p, 7);
  }
}

function canShoot() {
  if (game.gameOver) return false;
  const stopped = game.mode === 'guest' ? game.settled : allStopped(game.balls);
  if (!stopped) return false;
  if (game.mode === 'guest') return !game.cuePotted && game.turn === game.myPlayer;
  if (game.cue.potted) return false;
  if (game.mode === 'solo') return true;
  return game.turn === game.myPlayer; // host
}

function doShoot(dx, dy, power) {
  shoot(game.cue, dx, dy, power);
  audio.cueStrike();
  game.shots++;
  game.shooting = true;
  game.shotPotted = [];
  game.cueFoul = false;
  refreshHud();
  ui.hideHint();
}

function resolveTurn() {
  game.shooting = false;
  const shooter = game.turn;
  const mg = game.groups[shooter];
  const potted = game.shotPotted;
  const cueFoul = game.cueFoul || potted.includes(0);
  const eight = potted.includes(8);
  const mineCount = potted.filter((n) => groupOf(n) === mg).length;

  if (eight) {
    const cleared = game.balls.filter((b) => groupOf(b.number) === mg && !b.potted).length === 0;
    endGame(cleared && !cueFoul ? shooter : other(shooter));
    return;
  }
  const keep = mineCount > 0 && !cueFoul;
  if (!keep) game.turn = other(shooter);
  game.shotPotted = []; game.cueFoul = false;
  refreshHud();
  announceTurn();
  sendState();
}

function endGame(winner) {
  game.gameOver = true; game.winner = winner;
  refreshHud();
  showEndBanner();
  sendState();
}

function showEndBanner() {
  const won = game.winner === game.myPlayer;
  ui.banner(won ? '¡Has ganado!' : 'Has perdido.');
  won ? audio.win() : audio.lose();
}

function announceTurn() {
  ui.updateTurn(game.mode, game.turn === game.myPlayer);
  queueBanner(game.turn === game.myPlayer ? 'Es tu turno.' : 'Es el turno del rival.');
  if (game.turn === game.myPlayer) audio.turnChime();
  maybeNotifyTurn();
}

function announceGroupAndTurn() {
  const mg = game.groups[game.myPlayer];
  queueBanner(mg === 'stripes' ? 'Tienes que meter todas las bolas rayadas.' : 'Tienes que meter todas las bolas lisas.');
  queueBanner(game.turn === game.myPlayer ? 'Es tu turno.' : 'Es el turno del rival.');
  ui.updateTurn(game.mode, game.turn === game.myPlayer);
  if (game.turn === game.myPlayer) { audio.turnChime(); maybeNotifyTurn(); }
  refreshHud();
}

function queueBanner(text) { bannerQ.push(text); if (!bannerBusy) nextBanner(); }
function nextBanner() {
  if (!bannerQ.length) { bannerBusy = false; return; }
  bannerBusy = true;
  ui.banner(bannerQ.shift());
  setTimeout(nextBanner, 2500);
}

function maybeNotifyTurn() {
  if (game.mode === 'solo' || game.turn !== game.myPlayer || !document.hidden) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Hey, no te despistes, que es tu turno.'); } catch { /* ignore */ }
  }
}

async function maybeAskNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  const ok = await ui.askNotifications();
  if (!ok) return;
  const perm = await Notification.requestPermission();
  if (perm === 'granted') { audio.notify(); ui.toast('Se han habilitado las notificaciones del sistema.'); }
}

function sendState() {
  game.net.send({
    type: 'state', turn: game.turn, settled: allStopped(game.balls), cuePotted: game.cue.potted,
    shots: game.shots, groups: game.groups, gameOver: game.gameOver, winner: game.winner,
    sfx: { b: game.sfxBall, r: game.sfxRail, p: game.sfxPocket },
    balls: game.balls.map((b) => ({ n: b.number, x: b.x, y: b.y, r: game.sprites.get(b).spin.rotation, p: b.potted })),
  });
  game.sfxBall = 0; game.sfxRail = 0; game.sfxPocket = 0;
}

function applyState(m) {
  const prevTurn = game.turn, prevOver = game.gameOver;
  game.turn = m.turn; game.settled = m.settled; game.cuePotted = m.cuePotted; game.shots = m.shots;
  game.groups = m.groups; game.gameOver = m.gameOver; game.winner = m.winner;
  for (const bs of m.balls) {
    const e = game.byNumber.get(bs.n);
    if (!e) continue;
    e.ball.x = bs.x; e.ball.y = bs.y; e.ball.potted = bs.p; e.spr.spin.rotation = bs.r;
  }
  if (m.sfx) { if (m.sfx.b > 0) audio.ballHit(m.sfx.b); if (m.sfx.r > 0) audio.railHit(m.sfx.r); for (let i = 0; i < m.sfx.p; i++) audio.pocket(); }
  refreshHud();
  ui.updateTurn(game.mode, game.turn === game.myPlayer);
  if (m.turn !== prevTurn) {
    queueBanner(game.turn === game.myPlayer ? 'Es tu turno.' : 'Es el turno del rival.');
    if (game.turn === game.myPlayer) audio.turnChime();
    maybeNotifyTurn();
  }
  if (game.gameOver && !prevOver) showEndBanner();
}

function setupInput() {
  let dragStart = null;
  const pos = (e) => {
    const r = app.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (app.canvas.width / r.width), y: (e.clientY - r.top) * (app.canvas.height / r.height) };
  };
  app.canvas.addEventListener('pointerdown', (e) => {
    // ignore the click that just brought the window back into focus, and require aiming
    if (!document.hasFocus() || !canShoot()) return;
    dragStart = pos(e);
  });
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
    aimLine.clear(); powerBar.clear(); powerLabel.visible = false;
  });
}

function closeNet() {
  if (game.net) { game.net.close(); game.net = null; }
  game.started = false;
}

function onMessage(m) {
  if (m.type === 'start' && game.mode === 'guest') {
    setupRack();
    game.groups = m.groups; game.turn = m.turn; game.started = true; game.gameOver = false;
    ui.enterGame();
    maybeAskNotifications().then(announceGroupAndTurn);
  } else if (m.type === 'state' && game.mode === 'guest') applyState(m);
  else if (m.type === 'shoot' && game.mode === 'host' && game.turn === 2 && !game.gameOver) doShoot(m.dx, m.dy, m.power);
}

function startHost() {
  closeNet();
  game.mode = 'host'; game.myPlayer = 1;
  ui.el('host-code').textContent = '····';
  game.net = host({
    ready: (code) => { ui.el('host-code').textContent = code; },
    joined: () => {
      setupRack();
      const p1 = Math.random() < 0.5 ? 'solids' : 'stripes';
      game.groups = { 1: p1, 2: p1 === 'solids' ? 'stripes' : 'solids' };
      game.turn = 1; game.started = true;
      audio.notify();
      ui.toast('El rival se ha unido a la partida');
      ui.enterGame();
      game.net.send({ type: 'start', groups: game.groups, turn: game.turn });
      sendState();
      maybeAskNotifications().then(announceGroupAndTurn);
    },
    message: onMessage,
    left: () => ui.toast('El otro jugador se ha desconectado'),
    error: () => { /* host id taken — rare; user can re-open */ },
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
    left: () => ui.setStatus('join-status', 'Conexión cerrada.', true),
    error: () => ui.setStatus('join-status', 'No se ha encontrado la sala o el código es incorrecto.', true),
  });
}

function wireMenu() {
  const click = (id, fn) => { ui.el(id).onclick = () => { audio.resume(); audio.uiClick(); fn(); }; };

  click('btn-play', () => ui.showScreen('screen-mode'));
  click('btn-settings', () => { const s = ui.el('settings'); s.style.display = s.style.display === 'none' ? 'block' : 'none'; });
  click('btn-quit', () => window.close());
  document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => { audio.uiClick(); closeNet(); ui.showScreen(b.dataset.back); }; });

  click('btn-solo', () => { closeNet(); game.mode = 'solo'; setupRack(); ui.enterGame(); ui.updateTurn('solo'); });
  click('btn-multi', () => ui.showScreen('screen-mp'));
  click('btn-create', () => { ui.showScreen('screen-host'); startHost(); });
  click('btn-join', () => { ui.setStatus('join-status', ''); ui.showScreen('screen-join'); });
  click('btn-connect', startJoin);

  ui.el('btn-mute').onclick = () => { audio.setMuted(!audio.isMuted()); ui.setMuteIcon(audio.isMuted()); audio.uiClick(); };
  ui.el('btn-restart').onclick = async () => {
    audio.uiClick();
    if (game.mode === 'guest') return;
    const ok = await ui.askRestart();
    if (!ok) return;
    setupRack();
    if (game.mode === 'host') {
      const p1 = Math.random() < 0.5 ? 'solids' : 'stripes';
      game.groups = { 1: p1, 2: p1 === 'solids' ? 'stripes' : 'solids' };
      game.turn = 1;
      game.net.send({ type: 'start', groups: game.groups, turn: game.turn });
      sendState();
      announceGroupAndTurn();
    }
    ui.showHint();
  };
  ui.el('btn-menu').onclick = () => { audio.uiClick(); closeNet(); game.mode = 'solo'; ui.backToMenu(); };

  // subtle hover blips on menu buttons
  document.querySelectorAll('.glass').forEach((b) => b.addEventListener('pointerenter', () => audio.uiHover()));
}

main();
