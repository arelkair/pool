import {
  MM, TABLE_W, TABLE_H, CUSHION, BALL_R, BALL_COLORS, CORNER_MOUTH, SIDE_MOUTH,
  GRAVITY, MU_SLIDE, MU_ROLL, MU_BALL, MU_CUSHION, SPIN_DECEL, BALL_RESTITUTION, MAX_SHOT_SPEED,
} from './config.js';

const R = BALL_R;
const X0 = CUSHION, Y0 = CUSHION;
const X1 = CUSHION + TABLE_W, Y1 = CUSHION + TABLE_H;
const XM = (X0 + X1) / 2;
const MIN_X = X0 + R, MAX_X = X1 - R, MIN_Y = Y0 + R, MAX_Y = Y1 - R;

const CORNER_TIP = CORNER_MOUTH / Math.SQRT2;
const SIDE_TIP = SIDE_MOUTH / 2;

const CUSHIONS = [
  { x0: X0 + CORNER_TIP, x1: XM - SIDE_TIP, y0: Y0, y1: Y0, nx: 0, ny: 1 },
  { x0: XM + SIDE_TIP, x1: X1 - CORNER_TIP, y0: Y0, y1: Y0, nx: 0, ny: 1 },
  { x0: X0 + CORNER_TIP, x1: XM - SIDE_TIP, y0: Y1, y1: Y1, nx: 0, ny: -1 },
  { x0: XM + SIDE_TIP, x1: X1 - CORNER_TIP, y0: Y1, y1: Y1, nx: 0, ny: -1 },
  { x0: X0, x1: X0, y0: Y0 + CORNER_TIP, y1: Y1 - CORNER_TIP, nx: 1, ny: 0 },
  { x0: X1, x1: X1, y0: Y0 + CORNER_TIP, y1: Y1 - CORNER_TIP, nx: -1, ny: 0 },
];

const POCKETS = [
  { x: X0, y: Y0, r: CORNER_MOUTH * 0.5, side: false, ox: -1, oy: -1 },
  { x: XM, y: Y0, r: SIDE_MOUTH * 0.5, side: true, ox: 0, oy: -1 },
  { x: X1, y: Y0, r: CORNER_MOUTH * 0.5, side: false, ox: 1, oy: -1 },
  { x: X0, y: Y1, r: CORNER_MOUTH * 0.5, side: false, ox: -1, oy: 1 },
  { x: XM, y: Y1, r: SIDE_MOUTH * 0.5, side: true, ox: 0, oy: 1 },
  { x: X1, y: Y1, r: CORNER_MOUTH * 0.5, side: false, ox: 1, oy: 1 },
];

const TO_MS = 1 / (MM * 1000);
const SLIDE_RATE = 3.5 * MU_SLIDE * GRAVITY;
const ROLL_DECEL = MU_ROLL * GRAVITY;
const SLIDE_ACC = MU_SLIDE * GRAVITY;
const REST_SPEED = 0.6;

export function pocketPositions() {
  return POCKETS;
}

export function playBounds() {
  return { minX: MIN_X, maxX: MAX_X, minY: MIN_Y, maxY: MAX_Y };
}

function makeBall(x, y, n) {
  return { x, y, px: x, py: y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, number: n, color: BALL_COLORS[n], potted: false };
}

export function rack() {
  const balls = [makeBall(X0 + TABLE_W * 0.25, Y0 + TABLE_H / 2, 0)];

  const apexX = X0 + TABLE_W * 0.75;
  const apexY = Y0 + TABLE_H / 2;
  const rowGap = R * Math.sqrt(3) + 0.02;
  const colGap = R * 2 + 0.02;

  const slots = [];
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) slots.push({ x: apexX + row * rowGap, y: apexY + (i - row / 2) * colGap });
  }

  const solids = [1, 2, 3, 4, 5, 6, 7];
  const stripes = [9, 10, 11, 12, 13, 14, 15];
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  shuffle(solids);
  shuffle(stripes);

  const order = new Array(15);
  order[4] = 8;
  const cornerSolid = Math.random() < 0.5;
  order[10] = cornerSolid ? solids.pop() : stripes.pop();
  order[14] = cornerSolid ? stripes.pop() : solids.pop();
  const rest = shuffle([...solids, ...stripes]);
  for (let i = 0; i < 15; i++) if (order[i] === undefined) order[i] = rest.pop();

  for (let i = 0; i < 15; i++) balls.push(makeBall(slots[i].x, slots[i].y, order[i]));
  return balls;
}

export function shoot(cue, dirX, dirY, power, spin = {}) {
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len, uy = dirY / len;
  const speed = power * MAX_SHOT_SPEED;
  cue.vx = ux * speed;
  cue.vy = uy * speed;
  const roll = 2.5 * (spin.vert ?? 0);
  cue.wy = (cue.vx / R) * roll;
  cue.wx = -(cue.vy / R) * roll;
  cue.wz = (2.5 * speed * (spin.side ?? 0)) / R;
}

export function allStopped(balls) {
  for (const b of balls) if (!b.potted && (b.vx !== 0 || b.vy !== 0)) return false;
  return true;
}

function moveBall(b, h) {
  let rem = h;
  const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx;
  const us = Math.hypot(ux, uy);

  if (us > 1e-4) {
    const tSlip = us / SLIDE_RATE;
    const ts = Math.min(rem, tSlip);
    const ex = ux / us, ey = uy / us;
    const v0x = b.vx, v0y = b.vy;
    b.vx -= SLIDE_ACC * ex * ts;
    b.vy -= SLIDE_ACC * ey * ts;
    b.wy += (2.5 * SLIDE_ACC * ex * ts) / R;
    b.wx -= (2.5 * SLIDE_ACC * ey * ts) / R;
    b.x += ((v0x + b.vx) / 2) * ts;
    b.y += ((v0y + b.vy) / 2) * ts;
    rem -= ts;
    if (ts >= tSlip) {
      b.wy = b.vx / R;
      b.wx = -b.vy / R;
    }
  }

  if (rem > 0) {
    const s = Math.hypot(b.vx, b.vy);
    if (s > 0) {
      const dec = ROLL_DECEL * rem;
      if (s <= dec || s < REST_SPEED) {
        b.x += (b.vx / 2) * rem * Math.min(1, s / dec);
        b.y += (b.vy / 2) * rem * Math.min(1, s / dec);
        b.vx = 0; b.vy = 0; b.wx = 0; b.wy = 0;
      } else {
        const k = 1 - dec / s;
        const nvx = b.vx * k, nvy = b.vy * k;
        b.x += ((b.vx + nvx) / 2) * rem;
        b.y += ((b.vy + nvy) / 2) * rem;
        b.vx = nvx; b.vy = nvy;
        b.wy = nvx / R;
        b.wx = -nvy / R;
      }
    }
  }

  if (b.vx === 0 && b.vy === 0) {
    b.wx = 0; b.wy = 0;
  }
  if (b.wz !== 0) {
    const dw = SPIN_DECEL * h;
    b.wz = Math.abs(b.wz) <= dw ? 0 : b.wz - Math.sign(b.wz) * dw;
  }
}

function collideRails(active, hits) {
  for (const b of active) {
    for (const c of CUSHIONS) {
      const cx = b.x < c.x0 ? c.x0 : b.x > c.x1 ? c.x1 : b.x;
      const cy = b.y < c.y0 ? c.y0 : b.y > c.y1 ? c.y1 : b.y;
      let dx = b.x - cx, dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R * R) continue;

      let dist = Math.sqrt(d2), nx, ny;
      if (dist < 1e-6) {
        nx = c.nx; ny = c.ny; dist = 0;
      } else {
        nx = dx / dist; ny = dy / dist;
      }
      b.x += nx * (R - dist);
      b.y += ny * (R - dist);

      const vn = b.vx * nx + b.vy * ny;
      if (vn >= 0) continue;

      const vms = -vn * TO_MS;
      const e = Math.min(0.9, Math.max(0.6, 0.92 - 0.04 * vms));
      const jn = (1 + e) * -vn;
      b.vx += jn * nx;
      b.vy += jn * ny;

      const tx = -ny, ty = nx;
      const ut = b.vx * tx + b.vy * ty - R * b.wz;
      const jt = Math.sign(-ut) * Math.min(MU_CUSHION * jn, Math.abs(ut) / 3.5);
      b.vx += jt * tx;
      b.vy += jt * ty;
      b.wz -= (2.5 * jt) / R;

      if (vms > 0.05) hits.push({ type: 'rail', speed: vms });
    }
  }
}

function collideBalls(active, hits) {
  const reach = 2 * R;
  const reach2 = reach * reach;
  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    for (let j = i + 1; j < active.length; j++) {
      const b = active[j];
      let dx = b.x - a.x;
      if (dx > reach || dx < -reach) continue;
      let dy = b.y - a.y;
      if (dy > reach || dy < -reach) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach2) continue;

      let dist = Math.sqrt(d2);
      if (dist < 1e-6) { dx = 1e-3; dy = 0; dist = 1e-3; }
      const nx = dx / dist, ny = dy / dist;
      const push = (reach - dist) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;

      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn >= 0) continue;

      const jn = (-(1 + BALL_RESTITUTION) * vn) / 2;
      a.vx -= jn * nx; a.vy -= jn * ny;
      b.vx += jn * nx; b.vy += jn * ny;

      const tx = -ny, ty = nx;
      const ut = (a.vx - b.vx) * tx + (a.vy - b.vy) * ty + R * (a.wz + b.wz);
      const jt = Math.sign(-ut) * Math.min(MU_BALL * jn, Math.abs(ut) / 7);
      a.vx += jt * tx; a.vy += jt * ty;
      b.vx -= jt * tx; b.vy -= jt * ty;
      a.wz += (2.5 * jt) / R;
      b.wz += (2.5 * jt) / R;

      const vms = -vn * TO_MS;
      if (vms > 0.05) hits.push({ type: 'ball', speed: vms });
    }
  }
}

function sink(active, potted) {
  for (let i = active.length - 1; i >= 0; i--) {
    const b = active[i];
    if (b.x >= X0 && b.x <= X1 && b.y >= Y0 && b.y <= Y1) continue;
    b.potted = true;
    b.vx = 0; b.vy = 0; b.wx = 0; b.wy = 0; b.wz = 0;
    potted.push(b);
    active.splice(i, 1);
  }
}

const scratch = [];

export function step(balls, dt = 1 / 60) {
  const active = scratch;
  active.length = 0;
  let vmax = 0;
  for (const b of balls) {
    if (b.potted) continue;
    active.push(b);
    const s = Math.abs(b.vx) + Math.abs(b.vy);
    if (s > vmax) vmax = s;
  }

  const hits = [];
  const potted = [];
  const n = Math.min(32, Math.max(1, Math.ceil((vmax * dt) / (R * 0.25))));
  const h = dt / n;

  for (let s = 0; s < n; s++) {
    for (const b of active) moveBall(b, h);
    collideBalls(active, hits);
    collideRails(active, hits);
    sink(active, potted);
  }
  return { potted, hits };
}

export function placeCue(cue, balls, x, y) {
  let nx = Math.min(Math.max(x, MIN_X), MAX_X);
  let ny = Math.min(Math.max(y, MIN_Y), MAX_Y);
  for (let pass = 0; pass < 3; pass++) {
    for (const b of balls) {
      if (b === cue || b.potted) continue;
      const dx = nx - b.x, dy = ny - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      if (dist < R * 2) {
        nx = b.x + (dx / dist) * R * 2;
        ny = b.y + (dy / dist) * R * 2;
      }
    }
    nx = Math.min(Math.max(nx, MIN_X), MAX_X);
    ny = Math.min(Math.max(ny, MIN_Y), MAX_Y);
  }
  cue.x = cue.px = nx;
  cue.y = cue.py = ny;
  cue.vx = cue.vy = cue.wx = cue.wy = cue.wz = 0;
  cue.potted = false;
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url.endsWith('physics.js') && process.argv[1].endsWith('physics.js')) {
  const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } };
  const near = (a, b, tol, m) => assert(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
  const ball = (x, y, n = 0) => makeBall(x, y, n);
  const run = (balls, seconds) => { for (let i = 0; i < seconds * 60; i++) step(balls); };

  near(TABLE_W / TABLE_H, 2, 1e-9, 'table is 2:1');
  near((2 * R) / TABLE_W, 57.15 / 2540, 1e-9, 'ball to table ratio');

  let balls = rack();
  assert(balls.length === 16, '16 balls racked');
  assert(new Set(balls.map((b) => b.number)).size === 16, 'every ball once');
  const eight = balls.find((b) => b.number === 8);
  near(eight.x, X0 + TABLE_W * 0.75 + 2 * (R * Math.sqrt(3) + 0.02), 1e-6, '8 ball in third row');
  const corners = [balls[11], balls[15]].map((b) => b.number > 8);
  assert(corners[0] !== corners[1], 'rack corners are one solid and one stripe');
  for (let i = 0; i < balls.length; i++)
    for (let j = i + 1; j < balls.length; j++)
      assert(Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y) >= R * 2 - 1e-6, `no overlap ${i},${j}`);

  const cue = balls[0];
  shoot(cue, 1, 0.03, 1);
  let frames = 0;
  while (!allStopped(balls) && frames < 6000) { step(balls); frames++; }
  assert(frames < 6000, 'break comes to rest');
  for (const b of balls) {
    if (b.potted) continue;
    assert(b.x >= MIN_X - 0.5 && b.x <= MAX_X + 0.5 && b.y >= MIN_Y - 0.5 && b.y <= MAX_Y + 0.5, `ball ${b.number} stayed on table`);
  }

  balls = [ball(300, 300), ball(400, 300, 1)];
  shoot(balls[0], 1, 0, 0.1);
  run(balls, 1.5);
  assert(balls[1].x > 400 + 30, 'struck ball moved forward');
  assert(balls[0].x < balls[1].x, 'cue ball did not pass through');

  balls = [ball(300, 300)];
  shoot(balls[0], 1, 0, 0.3);
  const e0 = balls[0].vx ** 2;
  run(balls, 0.5);
  assert(balls[0].vx ** 2 < e0, 'friction removes energy');
  run(balls, 30);
  assert(allStopped(balls), 'lone ball stops');

  balls = [ball(500, Y0 + 100)];
  shoot(balls[0], 0, -1, 0.2);
  run(balls, 1);
  assert(balls[0].vy > 0, 'ball rebounds off the top cushion');
  assert(balls[0].y >= MIN_Y - 1e-6, 'ball held by the cushion');

  balls = [ball(X0 + 120, Y0 + 120)];
  shoot(balls[0], -1, -1, 0.4);
  run(balls, 3);
  assert(balls[0].potted, 'corner pocket takes a ball on the diagonal');

  balls = [ball(XM, Y1 - 150)];
  shoot(balls[0], 0, 1, 0.4);
  run(balls, 3);
  assert(balls[0].potted, 'side pocket takes a ball on the centre line');

  balls = [ball(XM - 200, Y0 + R)];
  shoot(balls[0], 1, 0, 0.1);
  run(balls, 1.4);
  assert(!balls[0].potted && balls[0].x > XM + 30, 'cushion jaw lets a rail-hugging ball pass the side pocket edge');

  balls = [ball(300, 300), ball(400, 300, 1)];
  shoot(balls[0], 1, 0, 0.15, { vert: -0.4 });
  run(balls, 3);
  assert(balls[0].x < 370, 'back spin draws the cue ball back after contact');

  console.log(`OK, break settled in ${frames} frames (${(frames / 60).toFixed(1)}s)`);
}
