// Custom billiards physics: equal-mass elastic circles + rails + pockets.
// Pure data + functions, no rendering — so it runs in Node for the self-test at the bottom.
import {
  TABLE_W, TABLE_H, CUSHION, BALL_R, POCKET_R, BALL_COLORS,
  FRICTION, STOP_SPEED, WALL_RESTITUTION, BALL_RESTITUTION, MAX_SHOT_SPEED,
} from './config.js';

const MIN_X = CUSHION + BALL_R;
const MAX_X = CUSHION + TABLE_W - BALL_R;
const MIN_Y = CUSHION + BALL_R;
const MAX_Y = CUSHION + TABLE_H - BALL_R;

export function pocketPositions() {
  const x0 = CUSHION, x1 = CUSHION + TABLE_W / 2, x2 = CUSHION + TABLE_W;
  const y0 = CUSHION, y1 = CUSHION + TABLE_H;
  return [
    { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x2, y: y0 },
    { x: x0, y: y1 }, { x: x1, y: y1 }, { x: x2, y: y1 },
  ];
}

export function rack() {
  const balls = [];
  const make = (x, y, n) => ({ x, y, vx: 0, vy: 0, number: n, color: BALL_COLORS[n], potted: false });

  balls.push(make(CUSHION + TABLE_W * 0.25, CUSHION + TABLE_H / 2, 0)); // cue

  const apexX = CUSHION + TABLE_W * 0.72;
  const apexY = CUSHION + TABLE_H / 2;
  const rowGap = BALL_R * Math.sqrt(3) + 0.5;
  const colGap = BALL_R * 2 + 0.5;
  let n = 1;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      balls.push(make(apexX + row * rowGap, apexY + (i - row / 2) * colGap, n));
      n++;
    }
  }
  return balls;
}

export function shoot(cue, dirX, dirY, power) {
  const len = Math.hypot(dirX, dirY) || 1;
  const speed = power * MAX_SHOT_SPEED;
  cue.vx = (dirX / len) * speed;
  cue.vy = (dirY / len) * speed;
}

export function allStopped(balls) {
  return balls.every((b) => b.potted || (b.vx === 0 && b.vy === 0));
}

// Advance the world one 60fps frame. Returns the list of balls potted THIS frame.
export function step(balls) {
  const active = balls.filter((b) => !b.potted);

  // sub-step so fast balls can't tunnel through each other or the rails
  let maxSpeed = 0;
  for (const b of active) maxSpeed = Math.max(maxSpeed, Math.hypot(b.vx, b.vy));
  const sub = Math.min(16, Math.max(1, Math.ceil(maxSpeed / (BALL_R * 0.5))));

  for (let s = 0; s < sub; s++) {
    for (const b of active) { b.x += b.vx / sub; b.y += b.vy / sub; }
    bounceWalls(active);
    collideBalls(active);
  }

  // friction applied once per frame (not per sub-step, or balls would over-brake)
  for (const b of active) {
    b.vx *= FRICTION; b.vy *= FRICTION;
    if (Math.hypot(b.vx, b.vy) < STOP_SPEED) { b.vx = 0; b.vy = 0; }
  }

  return sinkPockets(balls);
}

function bounceWalls(active) {
  for (const b of active) {
    if (b.x < MIN_X) { b.x = MIN_X; b.vx = Math.abs(b.vx) * WALL_RESTITUTION; }
    else if (b.x > MAX_X) { b.x = MAX_X; b.vx = -Math.abs(b.vx) * WALL_RESTITUTION; }
    if (b.y < MIN_Y) { b.y = MIN_Y; b.vy = Math.abs(b.vy) * WALL_RESTITUTION; }
    else if (b.y > MAX_Y) { b.y = MAX_Y; b.vy = -Math.abs(b.vy) * WALL_RESTITUTION; }
  }
}

function collideBalls(active) {
  const minDist = BALL_R * 2;
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if (dist === 0) { dx = 0.01; dist = 0.01; }
      if (dist >= minDist) continue;

      // normal
      const nx = dx / dist, ny = dy / dist;
      // push apart so they no longer overlap (split evenly)
      const overlap = (minDist - dist) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap;
      b.x += nx * overlap; b.y += ny * overlap;

      // relative velocity along the normal
      const rvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rvn <= 0) continue; // already separating
      // equal-mass elastic impulse with restitution
      const jimp = (1 + BALL_RESTITUTION) / 2 * rvn;
      a.vx -= jimp * nx; a.vy -= jimp * ny;
      b.vx += jimp * nx; b.vy += jimp * ny;
    }
  }
}

function sinkPockets(balls) {
  const pockets = pocketPositions();
  const justPotted = [];
  for (const b of balls) {
    if (b.potted) continue;
    for (const p of pockets) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R) {
        b.potted = true; b.vx = 0; b.vy = 0;
        justPotted.push(b);
        break;
      }
    }
  }
  return justPotted;
}

export function respawnCue(cue) {
  cue.x = CUSHION + TABLE_W * 0.25;
  cue.y = CUSHION + TABLE_H / 2;
  cue.vx = 0; cue.vy = 0;
  cue.potted = false;
}

// --- self-test: `node src/physics.js` ---
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url.endsWith('physics.js') && process.argv[1].endsWith('physics.js')) {
  const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } };

  let balls = rack();
  assert(balls.length === 16, '16 balls racked');
  assert(balls.filter((b) => b.number === 0).length === 1, 'one cue ball');

  // racked balls must not overlap
  for (let i = 1; i < balls.length; i++)
    for (let j = i + 1; j < balls.length; j++)
      assert(Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y) >= BALL_R * 2 - 0.6, `no overlap ${i},${j}`);

  // full-power break: simulate to rest, nothing escapes the table, energy bleeds off
  const cue = balls.find((b) => b.number === 0);
  shoot(cue, 1, 0.04, 1);
  let frames = 0;
  while (!allStopped(balls) && frames < 4000) { step(balls); frames++; }
  assert(frames < 4000, 'simulation comes to rest');
  for (const b of balls) {
    if (b.potted) continue;
    assert(b.x >= MIN_X - 1 && b.x <= MAX_X + 1 && b.y >= MIN_Y - 1 && b.y <= MAX_Y + 1, `ball ${b.number} stayed on table`);
  }

  // momentum transfer: a head-on hit should get the target moving
  balls = [
    { x: 200, y: 300, vx: 20, vy: 0, number: 0, potted: false },
    { x: 300, y: 300, vx: 0, vy: 0, number: 1, potted: false },
  ];
  for (let i = 0; i < 20; i++) step(balls);
  assert(balls[1].x > 300, 'struck ball moved forward');

  console.log(`OK — break settled in ${frames} frames (~${(frames / 60).toFixed(1)}s)`);
}
