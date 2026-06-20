import { Application, Container, Graphics, Text, FillGradient } from 'pixi.js';
import Matter from 'matter-js';
import {
  CANVAS_W, CANVAS_H, CUSHION, TABLE_W, TABLE_H, BALL_R, POCKET_R,
  createEngine, rackBalls, pocketPositions, stepPockets,
  allBallsStopped, shootCue, respawnCue, clearBalls,
} from './pool.js';
import { createNet } from './net.js';

const { Engine, Vector, Body } = Matter;

const MAX_DRAG = 160;
const MAX_FORCE = 0.055;   // hard shots launch fast, like a real break
const MIN_DRAG = 8;
const SUBSTEPS = 4;        // split each physics frame so fast balls don't tunnel

// shared mutable game state — mode is 'solo' | 'host' | 'guest'
const game = {
  mode: 'solo', myPlayer: 1, turn: 1, started: false,
  balls: null, cueBall: null, sprites: null, byNumber: null,
  shots: 0, potted: 0, shooting: false, pottedAtShot: 0, cueFoulThisShot: false,
  net: null, settled: true, cuePotted: false,
};

let app, engine, ballLayer, aimLine, powerBar, powerLabel, streamTick = 0;

async function main() {
  app = new Application();
  await app.init({ width: CANVAS_W, height: CANVAS_H, backgroundColor: 0x0a0a0a, antialias: true });
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

  engine = createEngine();
  setupRack();

  let dragStart = null;
  app.canvas.addEventListener('pointerdown', (e) => {
    if (!canShoot()) return;
    dragStart = getCanvasPos(e);
  });
  // ponytail: move/up on window so dragging off the table keeps aiming instead of cancelling the shot.
  window.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    const pos = getCanvasPos(e);
    drawAim(pos);
    drawPower(Math.min(Vector.magnitude(Vector.sub(game.cueBall.position, pos)), MAX_DRAG) / MAX_DRAG);
  });
  window.addEventListener('pointerup', (e) => {
    if (!dragStart) return;
    const drag = Vector.sub(game.cueBall.position, getCanvasPos(e));
    const dist = Vector.magnitude(drag);
    if (canShoot() && dist > MIN_DRAG) {
      const power = Math.min(dist, MAX_DRAG) / MAX_DRAG * MAX_FORCE;
      if (game.mode === 'guest') game.net.send({ type: 'shoot', dx: drag.x, dy: drag.y, power });
      else doShoot(drag, power);
    }
    dragStart = null;
    aimLine.clear();
    powerBar.clear();
    powerLabel.visible = false;
  });

  app.ticker.add(tick);
  wireMenu();
}

function tick() {
  if (game.mode !== 'guest') {
    for (let i = 0; i < SUBSTEPS; i++) Engine.update(engine, 1000 / 60 / SUBSTEPS);
    stepPockets(engine, game.balls);
    if (game.cueBall.potted) game.cueFoulThisShot = true;
    if (game.cueBall.potted && allBallsStopped(game.balls)) respawnCue(engine, game.cueBall);
    const potted = game.balls.filter((b) => b.number !== 0 && b.potted).length;
    if (potted !== game.potted) { game.potted = potted; updateHud(); }
    if (game.mode === 'host' && game.shooting && allBallsStopped(game.balls)) resolveTurn();
    for (const [ball, spr] of game.sprites) {
      if (ball.potted) continue;
      const sp = Vector.magnitude(ball.velocity);
      spr.spin.rotation += (ball.velocity.x >= 0 ? 1 : -1) * sp * 0.05;
    }
    if (game.mode === 'host' && game.started && game.net && (++streamTick % 2 === 0)) sendState();
  }
  // update sprite transforms from body positions (all modes)
  for (const [ball, spr] of game.sprites) {
    spr.visible = !ball.potted;
    if (!ball.potted) spr.position.set(ball.position.x, ball.position.y);
  }
}

function canShoot() {
  const stopped = game.mode === 'guest' ? game.settled : allBallsStopped(game.balls);
  if (!stopped) return false;
  if (game.mode === 'guest') return !game.cuePotted && game.turn === game.myPlayer;
  if (game.cueBall.potted) return false;
  if (game.mode === 'solo') return true;
  return game.turn === game.myPlayer; // host
}

function doShoot(dir, power) {
  shootCue(game.cueBall, dir, power);
  game.shots++;
  game.shooting = true;
  game.pottedAtShot = game.potted;
  game.cueFoulThisShot = false;
  updateHud();
  document.getElementById('hint').classList.add('gone');
}

function resolveTurn() {
  game.shooting = false;
  const gained = game.potted - game.pottedAtShot;
  if (!(gained > 0 && !game.cueFoulThisShot)) game.turn = game.turn === 1 ? 2 : 1;
  game.cueFoulThisShot = false;
  updateTurnHud();
  sendState();
}

function sendState() {
  game.net.send({
    type: 'state', turn: game.turn, settled: allBallsStopped(game.balls),
    cuePotted: game.cueBall.potted, shots: game.shots, potted: game.potted,
    balls: game.balls.map((b) => ({ n: b.number, x: b.position.x, y: b.position.y, r: game.sprites.get(b).spin.rotation, p: b.potted })),
  });
}

function applyState(m) {
  game.turn = m.turn; game.settled = m.settled; game.cuePotted = m.cuePotted;
  game.shots = m.shots; game.potted = m.potted;
  for (const bs of m.balls) {
    const entry = game.byNumber.get(bs.n);
    if (!entry) continue;
    entry.body.potted = bs.p;
    Body.setPosition(entry.body, { x: bs.x, y: bs.y });
    entry.spr.spin.rotation = bs.r;
  }
  updateHud();
  updateTurnHud();
}

function setupRack() {
  if (game.balls) clearBalls(engine, game.balls);
  ballLayer.removeChildren();
  const balls = rackBalls(engine);
  game.balls = balls;
  game.cueBall = balls.find((b) => b.number === 0);
  game.sprites = new Map();
  game.byNumber = new Map();
  for (const b of balls) {
    const v = buildBallVisual(b);
    game.sprites.set(b, v);
    game.byNumber.set(b.number, { body: b, spr: v });
    ballLayer.addChild(v);
  }
  game.shots = 0;
  game.potted = 0;
  game.shooting = false;
  updateHud();
}

function buildBallVisual(ball) {
  const c = new Container();
  const isCue = ball.number === 0;
  const isStripe = ball.number >= 9;

  c.addChild(new Graphics().ellipse(2.5, 3.5, BALL_R * 1.05, BALL_R * 0.9).fill({ color: 0x000000, alpha: 0.3 }));

  // spinning layer: the painted surface (colour, stripe, number) rotates as the ball rolls
  const spin = new Container();
  spin.addChild(new Graphics().circle(0, 0, BALL_R).fill(isStripe ? 0xffffff : ball.color));
  if (isStripe) {
    const band = new Graphics().rect(-BALL_R, -BALL_R * 0.5, BALL_R * 2, BALL_R).fill(ball.color);
    const mask = new Graphics().circle(0, 0, BALL_R).fill(0xffffff);
    spin.addChild(band, mask);
    band.mask = mask;
  }
  if (!isCue) {
    spin.addChild(new Graphics().circle(0, 0, BALL_R * 0.48).fill(0xfbf7ec));
    const t = new Text({ text: String(ball.number), style: { fontFamily: 'Arial, sans-serif', fontSize: 9, fontWeight: 'bold', fill: 0x111111 } });
    t.anchor.set(0.5);
    spin.addChild(t);
  }
  c.addChild(spin);
  c.spin = spin;

  // sphere shading — fixed relative to the light source, so it stays put while the surface spins
  const shade = new FillGradient({
    type: 'radial',
    innerCenter: { x: 0.38, y: 0.34 }, innerRadius: 0.1,
    outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.52,
    colorStops: [
      { offset: 0, color: 'rgba(0,0,0,0)' },
      { offset: 0.65, color: 'rgba(0,0,0,0)' },
      { offset: 1, color: 'rgba(0,0,0,0.5)' },
    ],
    textureSpace: 'local',
  });
  c.addChild(new Graphics().circle(0, 0, BALL_R).fill(shade));
  c.addChild(new Graphics().ellipse(-BALL_R * 0.34, -BALL_R * 0.38, BALL_R * 0.4, BALL_R * 0.28).fill({ color: 0xffffff, alpha: 0.65 }));
  c.addChild(new Graphics().circle(-BALL_R * 0.4, -BALL_R * 0.44, BALL_R * 0.12).fill({ color: 0xffffff, alpha: 0.9 }));
  return c;
}

function getCanvasPos(e) {
  const rect = app.canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (app.canvas.width / rect.width),
    y: (e.clientY - rect.top) * (app.canvas.height / rect.height),
  };
}

function drawAim(mousePos) {
  const cue = game.cueBall.position;
  aimLine.clear();
  aimLine.moveTo(cue.x, cue.y).lineTo(mousePos.x, mousePos.y).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
  const dir = Vector.normalise(Vector.sub(cue, mousePos));
  const tip = Vector.add(cue, Vector.mult(dir, 220));
  aimLine.moveTo(cue.x, cue.y).lineTo(tip.x, tip.y).stroke({ width: 2, color: 0xff3030, alpha: 0.85 });
}

function drawPower(frac) {
  const x = 24, y = CANVAS_H - 22, w = 200, h = 12;
  const r = Math.round(255 * frac), g = Math.round(255 * (1 - frac));
  powerBar.clear();
  powerBar.rect(x, y, w, h).fill({ color: 0x000000, alpha: 0.5 }).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
  powerBar.rect(x + 1, y + 1, (w - 2) * frac, h - 2).fill((r << 16) | (g << 8));
  powerLabel.visible = true;
}

function drawTable() {
  const g = new Graphics();
  const wood = new FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
    colorStops: [{ offset: 0, color: 0x6b4a2b }, { offset: 0.5, color: 0x4a3019 }, { offset: 1, color: 0x32200f }],
    textureSpace: 'local',
  });
  g.roundRect(0, 0, CANVAS_W, CANVAS_H, 14).fill(wood);

  const cloth = new FillGradient({
    type: 'radial',
    innerCenter: { x: 0.5, y: 0.5 }, innerRadius: 0.05,
    outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.62,
    colorStops: [{ offset: 0, color: 0x1ba14a }, { offset: 1, color: 0x0c6630 }],
    textureSpace: 'local',
  });
  g.rect(CUSHION, CUSHION, TABLE_W, TABLE_H).fill(cloth);
  g.rect(CUSHION, CUSHION, TABLE_W, TABLE_H).stroke({ width: 4, color: 0x000000, alpha: 0.22 });

  const dots = [];
  for (const f of [0.25, 0.5, 0.75]) {
    dots.push([CUSHION + TABLE_W * f, CUSHION / 2], [CUSHION + TABLE_W * f, CANVAS_H - CUSHION / 2]);
  }
  dots.push([CUSHION / 2, CUSHION + TABLE_H / 2], [CANVAS_W - CUSHION / 2, CUSHION + TABLE_H / 2]);
  for (const [x, y] of dots) {
    g.circle(x, y, 3.5).fill(0xf2e8cf);
    g.circle(x, y, 3.5).stroke({ width: 1, color: 0x000000, alpha: 0.3 });
  }

  for (const p of pocketPositions()) {
    g.circle(p.x, p.y, POCKET_R + 4).fill({ color: 0x000000, alpha: 0.35 });
    g.circle(p.x, p.y, POCKET_R).fill(0x080808);
    g.circle(p.x, p.y, POCKET_R).stroke({ width: 2, color: 0x2a2a2a, alpha: 0.8 });
  }
  return g;
}

function updateHud() {
  document.getElementById('hud-shots').textContent = game.shots;
  document.getElementById('hud-potted').textContent = `${game.potted}/15`;
}

function updateTurnHud() {
  const el = document.getElementById('hud-turn');
  if (game.mode === 'solo') { el.style.display = 'none'; return; }
  el.style.display = '';
  const mine = game.turn === game.myPlayer;
  el.textContent = mine ? 'Tu turno' : 'Turno del rival';
  el.style.background = mine ? 'rgba(60,200,130,.25)' : 'rgba(200,80,80,.25)';
  el.style.borderColor = mine ? 'rgba(120,255,180,.5)' : 'rgba(255,140,140,.5)';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function enterGame() {
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('hud').classList.add('show');
  document.getElementById('hint').classList.remove('gone');
  updateHud();
  updateTurnHud();
}

function wireMenu() {
  const menu = document.getElementById('menu');
  const hud = document.getElementById('hud');
  const status = document.getElementById('mp-status');
  const show = (id) => {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  };

  document.getElementById('btn-play').onclick = () => show('screen-mode');
  document.getElementById('btn-settings').onclick = () => {
    const s = document.getElementById('settings');
    s.style.display = s.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('btn-quit').onclick = () => window.close();
  document.querySelector('#screen-mode [data-back]').onclick = () => show('screen-main');
  document.querySelector('#screen-mp [data-back]').onclick = () => { closeNet(); show('screen-mode'); };

  document.getElementById('btn-solo').onclick = () => {
    game.mode = 'solo';
    setupRack();
    enterGame();
  };
  document.getElementById('btn-multi').onclick = () => { status.textContent = ''; status.classList.remove('error'); show('screen-mp'); };
  document.getElementById('btn-connect').onclick = connect;

  document.getElementById('btn-restart').onclick = () => {
    if (game.mode === 'guest') return; // only the host owns the table
    setupRack();
    if (game.mode === 'host') { game.turn = 1; updateTurnHud(); sendState(); }
    document.getElementById('hint').classList.remove('gone');
  };
  document.getElementById('btn-menu').onclick = () => {
    closeNet();
    game.mode = 'solo'; game.started = false;
    menu.classList.remove('hidden'); hud.classList.remove('show');
    show('screen-main');
  };
}

function closeNet() {
  if (game.net) { game.net.close(); game.net = null; }
  game.started = false;
}

function connect() {
  const ip = document.getElementById('mp-ip').value.trim();
  const status = document.getElementById('mp-status');
  status.classList.remove('error');
  status.textContent = 'Conectando…';
  let net;
  try { net = createNet(ip); } catch { status.classList.add('error'); status.textContent = 'IP inválida.'; return; }
  game.net = net;

  net.onError(() => { status.classList.add('error'); status.textContent = 'No se pudo conectar. ¿Está encendido el servidor del anfitrión?'; });
  net.onClose(() => { if (!game.started) { status.classList.add('error'); status.textContent = 'Conexión cerrada.'; } });

  net.on('full', () => { status.classList.add('error'); status.textContent = 'La partida ya está llena (2 jugadores).'; });
  net.on('role', (m) => {
    game.myPlayer = m.role;
    game.mode = m.role === 1 ? 'host' : 'guest';
    status.textContent = m.role === 1
      ? 'Conectado. Esperando al jugador 2…'
      : 'Conectado. Esperando a que el anfitrión inicie…';
  });
  net.on('peer-joined', () => {
    // host: the guest arrived — start a fresh game and tell them to begin
    setupRack();
    game.turn = 1; game.started = true;
    showToast('El jugador 2 se ha unido a la partida');
    enterGame();
    game.net.send({ type: 'start' });
    sendState();
  });
  net.on('start', () => { setupRack(); game.started = true; enterGame(); });
  net.on('shoot', (m) => { if (game.mode === 'host' && game.turn === 2) doShoot({ x: m.dx, y: m.dy }, m.power); });
  net.on('state', (m) => { if (game.mode === 'guest') applyState(m); });
  net.on('peer-left', () => {
    showToast('El otro jugador se ha desconectado');
    game.started = false;
  });
}

main();
