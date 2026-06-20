import Matter from 'matter-js';

const { Engine, World, Bodies, Body, Vector } = Matter;

export const TABLE_W = 1000;
export const TABLE_H = 500;
export const CUSHION = 30;
export const BALL_R = 12;
export const POCKET_R = 22;

export const CANVAS_W = TABLE_W + CUSHION * 2;
export const CANVAS_H = TABLE_H + CUSHION * 2;

const BALL_COLORS = [
  0xffffff, // 0 cue
  0xe8d000, 0x1f4fd8, 0xd81f1f, 0x6a1fb0, 0xe8742a, 0x1f8a3a, 0x8a1f1f, 0x1a1a1a,
  0xe8d000, 0x1f4fd8, 0xd81f1f, 0x6a1fb0, 0xe8742a, 0x1f8a3a, 0x8a1f1f,
];

export function pocketPositions() {
  const x0 = CUSHION, x1 = CUSHION + TABLE_W / 2, x2 = CUSHION + TABLE_W;
  const y0 = CUSHION, y1 = CUSHION + TABLE_H;
  return [
    { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x2, y: y0 },
    { x: x0, y: y1 }, { x: x1, y: y1 }, { x: x2, y: y1 },
  ];
}

export function createEngine() {
  const engine = Engine.create();
  engine.gravity.y = 0;
  // ponytail: bump solver iterations so hard shots don't tunnel through balls/cushions.
  engine.positionIterations = 10;
  engine.velocityIterations = 10;

  const t = CUSHION;
  const cushions = [
    Bodies.rectangle(CANVAS_W / 2, t / 2, CANVAS_W, t, { isStatic: true }),
    Bodies.rectangle(CANVAS_W / 2, CANVAS_H - t / 2, CANVAS_W, t, { isStatic: true }),
    Bodies.rectangle(t / 2, CANVAS_H / 2, t, CANVAS_H, { isStatic: true }),
    Bodies.rectangle(CANVAS_W - t / 2, CANVAS_H / 2, t, CANVAS_H, { isStatic: true }),
  ];
  cushions.forEach((c) => { c.restitution = 0.78; c.friction = 0; c.label = 'cushion'; });
  World.add(engine.world, cushions);

  return engine;
}

function makeBall(x, y, number) {
  const body = Bodies.circle(x, y, BALL_R, {
    restitution: 0.95,      // ivory balls barely lose energy on impact
    friction: 0.002,        // slight surface friction so spin reads naturally
    frictionAir: 0.009,     // rolling resistance of the cloth — gentle, long roll
    density: 0.0017,
    label: number === 0 ? 'cue' : 'ball',
  });
  body.number = number;
  body.color = BALL_COLORS[number];
  body.potted = false;
  return body;
}

export function rackBalls(engine) {
  const balls = [];
  const cueX = CUSHION + TABLE_W * 0.25;
  const cueY = CUSHION + TABLE_H / 2;
  balls.push(makeBall(cueX, cueY, 0));

  const apexX = CUSHION + TABLE_W * 0.72;
  const apexY = CUSHION + TABLE_H / 2;
  const rowGap = BALL_R * 1.74;
  let n = 1;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      const x = apexX + row * rowGap;
      const y = apexY + (i - row / 2) * (BALL_R * 2 + 0.6);
      balls.push(makeBall(x, y, n <= 15 ? n : 1));
      n++;
    }
  }

  World.add(engine.world, balls);
  return balls;
}

export function stepPockets(engine, balls) {
  const pockets = pocketPositions();
  for (const ball of balls) {
    if (ball.potted) continue;
    for (const p of pockets) {
      const dx = ball.position.x - p.x;
      const dy = ball.position.y - p.y;
      if (dx * dx + dy * dy < POCKET_R * POCKET_R) {
        ball.potted = true;
        World.remove(engine.world, ball);
        break;
      }
    }
  }
}

export function allBallsStopped(balls, threshold = 0.05) {
  return balls.every((b) => b.potted || Vector.magnitude(b.velocity) < threshold);
}

export function shootCue(cueBall, direction, power) {
  const force = Vector.mult(Vector.normalise(direction), power);
  Body.applyForce(cueBall, cueBall.position, force);
}

export function respawnCue(engine, cueBall) {
  Body.setPosition(cueBall, { x: CUSHION + TABLE_W * 0.25, y: CUSHION + TABLE_H / 2 });
  Body.setVelocity(cueBall, { x: 0, y: 0 });
  cueBall.potted = false;
  World.add(engine.world, cueBall);
}

export function clearBalls(engine, balls) {
  for (const b of balls) if (!b.potted) World.remove(engine.world, b);
}
