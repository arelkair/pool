import { Container, Graphics, Text, Sprite, Rectangle, FillGradient } from 'pixi.js';
import { CANVAS_W, CANVAS_H, CUSHION, TABLE_W, TABLE_H, BALL_R, BALL_COLORS } from './config.js';
import { pocketPositions } from './physics.js';
import { t } from './i18n.js';

const INK = 0xe8e8e8;
const MUTED = 0x8f8f8f;
const PAPER = 0x0f0f0f;

const FRAME = 0x14502d;
const RUBBER = 0x185f35;
const CLOTH = 0x1f7a45;

export function drawTable(renderer) {
  const g = new Graphics();

  g.roundRect(0, 0, CANVAS_W, CANVAS_H, 8).fill(FRAME);

  const lip = 14;
  g.rect(CUSHION - lip, CUSHION - lip, TABLE_W + lip * 2, TABLE_H + lip * 2).fill(RUBBER);
  g.rect(CUSHION, CUSHION, TABLE_W, TABLE_H).fill(CLOTH);

  const dots = [];
  for (const f of [0.125, 0.25, 0.375, 0.625, 0.75, 0.875]) {
    dots.push([CUSHION + TABLE_W * f, CUSHION / 2], [CUSHION + TABLE_W * f, CANVAS_H - CUSHION / 2]);
  }
  for (const f of [0.25, 0.5, 0.75]) {
    dots.push([CUSHION / 2, CUSHION + TABLE_H * f], [CANVAS_W - CUSHION / 2, CUSHION + TABLE_H * f]);
  }
  for (const [x, y] of dots) g.circle(x, y, 2.5).fill({ color: INK, alpha: 0.7 });

  for (const p of pocketPositions()) {
    const cx = p.x + p.ox * p.r * (p.side ? 0 : 0.45);
    const cy = p.y + p.oy * p.r * (p.side ? 0.5 : 0.45);
    g.circle(cx, cy, p.r * 1.05).fill(RUBBER);
    g.circle(cx, cy, p.r * 0.92).fill(PAPER);
  }

  const texture = renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, CANVAS_W, CANVAS_H), resolution: renderer.resolution, antialias: true });
  g.destroy();
  return new Sprite(texture);
}

function faceGraphics(number, color) {
  const g = new Container();
  const isCue = number === 0;
  const isStripe = number >= 9;

  g.addChild(new Graphics().circle(0, 0, BALL_R).fill(isCue || isStripe ? 0xffffff : color));

  if (isStripe) {
    const band = new Graphics().rect(-BALL_R, -BALL_R * 0.5, BALL_R * 2, BALL_R).fill(color);
    const mask = new Graphics().circle(0, 0, BALL_R).fill(0xffffff);
    g.addChild(band, mask);
    band.mask = mask;
  }

  if (!isCue) {
    g.addChild(new Graphics().circle(0, 0, BALL_R * 0.48).fill(0xfbf7ec));
    const label = new Text({ text: String(number), style: { fontFamily: 'Allo, system-ui, sans-serif', fontSize: 9, fontWeight: '700', fill: 0x111111 } });
    label.anchor.set(0.5);
    g.addChild(label);
  }

  return g;
}

function overlayGraphics() {
  const g = new Container();
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
  g.addChild(new Graphics().circle(0, 0, BALL_R).fill(shade));
  g.addChild(new Graphics().ellipse(-BALL_R * 0.34, -BALL_R * 0.38, BALL_R * 0.4, BALL_R * 0.28).fill({ color: 0xffffff, alpha: 0.45 }));
  g.addChild(new Graphics().circle(-BALL_R * 0.4, -BALL_R * 0.44, BALL_R * 0.12).fill({ color: 0xffffff, alpha: 0.7 }));
  g.addChild(new Graphics().circle(0, 0, BALL_R).stroke({ width: 1, color: 0x000000, alpha: 0.25 }));
  return g;
}

let TEX = null;

export function initBallTextures(renderer) {
  if (TEX) return;

  const bake = (node, half) => {
    const texture = renderer.generateTexture({ target: node, frame: new Rectangle(-half, -half, half * 2, half * 2), resolution: 2, antialias: true });
    node.destroy({ children: true });
    return texture;
  };

  const R = BALL_R + 2;
  const faces = new Map();
  for (let n = 0; n <= 15; n++) faces.set(n, bake(faceGraphics(n, BALL_COLORS[n]), R));
  const shadow = new Graphics().ellipse(0, 0, BALL_R * 1.05, BALL_R * 0.9).fill({ color: 0x000000, alpha: 0.3 });

  TEX = {
    faces,
    overlay: bake(overlayGraphics(), R),
    shadow: bake(shadow, BALL_R + 4),
  };
}

export function buildBallVisual(ball) {
  const c = new Container();
  const shadow = new Sprite(TEX.shadow);
  shadow.anchor.set(0.5);
  shadow.position.set(2.5, 3.5);
  const face = new Sprite(TEX.faces.get(ball.number));
  face.anchor.set(0.5);
  const overlay = new Sprite(TEX.overlay);
  overlay.anchor.set(0.5);
  c.addChild(shadow, face, overlay);
  c.spin = face;
  return c;
}

export function drawAim(g, cue, mx, my, power = 1) {
  g.clear();
  g.moveTo(cue.x, cue.y).lineTo(mx, my).stroke({ width: 1, color: INK, alpha: 0.25 });

  const len = Math.hypot(cue.x - mx, cue.y - my) || 1;
  let dx = (cue.x - mx) / len, dy = (cue.y - my) / len;
  let x = cue.x, y = cue.y, remaining = 50 + power * 260;
  const minX = CUSHION + BALL_R, maxX = CUSHION + TABLE_W - BALL_R;
  const minY = CUSHION + BALL_R, maxY = CUSHION + TABLE_H - BALL_R;

  g.moveTo(x, y);
  for (let bounces = 0; bounces < 3 && remaining > 0; bounces++) {
    let t = Infinity;
    if (dx > 0) t = Math.min(t, (maxX - x) / dx);
    else if (dx < 0) t = Math.min(t, (minX - x) / dx);
    if (dy > 0) t = Math.min(t, (maxY - y) / dy);
    else if (dy < 0) t = Math.min(t, (minY - y) / dy);
    t = Math.min(t, remaining);
    if (!isFinite(t) || t <= 0) break;

    const nx = x + dx * t, ny = y + dy * t;
    g.lineTo(nx, ny);
    remaining -= t;
    if (Math.abs(nx - minX) < 0.6 || Math.abs(nx - maxX) < 0.6) dx = -dx;
    if (Math.abs(ny - minY) < 0.6 || Math.abs(ny - maxY) < 0.6) dy = -dy;
    x = nx; y = ny;
  }
  g.stroke({ width: 1, color: INK, alpha: 0.45 });
}

export function drawPower(g, label, frac) {
  const x = CUSHION + 40, y = CANVAS_H - CUSHION - 26, w = 200, h = 12;
  g.clear();
  g.roundRect(x, y, w, h, 4).fill({ color: PAPER, alpha: 0.7 }).stroke({ width: 1, color: MUTED, alpha: 0.6 });
  g.roundRect(x + 2, y + 2, (w - 4) * frac, h - 4, 2).fill(INK);
  label.text = t('power');
  label.visible = true;
}
