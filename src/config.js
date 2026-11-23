export const BALL_DIAMETER_MM = 57.15;
export const TABLE_LENGTH_MM = 2540;
export const TABLE_WIDTH_MM = 1270;
export const CORNER_MOUTH_MM = 117;
export const SIDE_MOUTH_MM = 130;

export const MM = 24 / BALL_DIAMETER_MM;

export const BALL_R = (BALL_DIAMETER_MM / 2) * MM;
export const TABLE_W = TABLE_LENGTH_MM * MM;
export const TABLE_H = TABLE_WIDTH_MM * MM;
export const CUSHION = 40;

export const CANVAS_W = Math.round(TABLE_W + CUSHION * 2);
export const CANVAS_H = Math.round(TABLE_H + CUSHION * 2);

export const CORNER_MOUTH = CORNER_MOUTH_MM * MM;
export const SIDE_MOUTH = SIDE_MOUTH_MM * MM;

export const GRAVITY = 9810 * MM;
export const MU_SLIDE = 0.2;
export const MU_ROLL = 0.012;
export const MU_BALL = 0.05;
export const MU_CUSHION = 0.14;
export const SPIN_DECEL = 38;
export const BALL_RESTITUTION = 0.95;

export const MAX_SHOT_SPEED = 8000 * MM;
export const POWER_CURVE = 1.6;

export const MAX_DRAG = 210;
export const MIN_DRAG = 10;

export const BALL_COLORS = [
  0xffffff,
  0xe8c000, 0x1f48d8, 0xd81f1f, 0x6a1fb0, 0xe8742a, 0x1f8a3a, 0x8a1f1f, 0x161616,
  0xe8c000, 0x1f48d8, 0xd81f1f, 0x6a1fb0, 0xe8742a, 0x1f8a3a, 0x8a1f1f,
];
