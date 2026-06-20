// Central place for every tunable: table geometry, ball sizes, physics feel.

// Table interior (playing surface) and rail thickness
export const TABLE_W = 1000;
export const TABLE_H = 500;
export const CUSHION = 30;

export const CANVAS_W = TABLE_W + CUSHION * 2;
export const CANVAS_H = TABLE_H + CUSHION * 2;

export const BALL_R = 12;
export const POCKET_R = 22;

// Physics feel (units: pixels, frames at 60fps)
export const MAX_SHOT_SPEED = 46;   // velocity of a full-power break — fast, like real life
export const FRICTION = 0.988;      // per-frame rolling decay (closer to 1 = longer roll)
export const STOP_SPEED = 0.32;     // below this a ball is snapped to rest
export const WALL_RESTITUTION = 0.9;
export const BALL_RESTITUTION = 0.96;

// Aiming
export const MAX_DRAG = 170;        // drag distance (px) that maps to full power
export const MIN_DRAG = 8;

// Ball colours, indexed by number (0 = cue). 1-8 solids, 9-15 stripes reuse 1-7 hues.
// Vivid but believable pool-ball hues.
export const BALL_COLORS = [
  0xfafafa,
  0xffcf1a, 0x1f5cff, 0xff2a2a, 0x9b27e0, 0xff7a1a, 0x16b24a, 0x9c1f1f, 0x1a1a1a,
  0xffcf1a, 0x1f5cff, 0xff2a2a, 0x9b27e0, 0xff7a1a, 0x16b24a, 0x9c1f1f,
];
