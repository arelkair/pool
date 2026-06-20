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
export const BALL_COLORS = [
  0xffffff,
  0xe8c000, 0x1f48d8, 0xd81f1f, 0x6a1fb0, 0xe8742a, 0x1f8a3a, 0x8a1f1f, 0x161616,
  0xe8c000, 0x1f48d8, 0xd81f1f, 0x6a1fb0, 0xe8742a, 0x1f8a3a, 0x8a1f1f,
];
