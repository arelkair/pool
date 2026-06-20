// All PixiJS drawing: the table, ball sprites, aim line and power bar.
import { Container, Graphics, Text, Sprite, Rectangle, FillGradient } from 'pixi.js';
import { CANVAS_W, CANVAS_H, CUSHION, TABLE_W, TABLE_H, BALL_R, POCKET_R, BALL_COLORS } from './config.js';
import { pocketPositions } from './physics.js';

export function drawTable() {
  const g = new Graphics();

  // outer wooden frame with warm gradient + top bevel highlight
  const wood = new FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
    colorStops: [{ offset: 0, color: 0x8a5a30 }, { offset: 0.5, color: 0x5c3b1d }, { offset: 1, color: 0x36230f }],
    textureSpace: 'local',
  });
  g.roundRect(0, 0, CANVAS_W, CANVAS_H, 16).fill(wood);
  g.roundRect(3, 3, CANVAS_W - 6, CANVAS_H - 6, 13).stroke({ width: 2, color: 0xffe2b0, alpha: 0.18 });

  // cushion frame (darker inner border ring around the cloth)
  g.rect(CUSHION - 8, CUSHION - 8, TABLE_W + 16, TABLE_H + 16).fill(0x1b6e3a);

  // cloth with a soft lit centre
  const cloth = new FillGradient({
    type: 'radial',
    innerCenter: { x: 0.5, y: 0.42 }, innerRadius: 0.04,
    outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.66,
    colorStops: [{ offset: 0, color: 0x24c55c }, { offset: 0.7, color: 0x12953f }, { offset: 1, color: 0x0a6b2c }],
    textureSpace: 'local',
  });
  g.rect(CUSHION, CUSHION, TABLE_W, TABLE_H).fill(cloth);
  // inner shadow cast by the rails onto the cloth
  g.rect(CUSHION, CUSHION, TABLE_W, TABLE_H).stroke({ width: 8, color: 0x000000, alpha: 0.18 });
  g.rect(CUSHION + 2, CUSHION + 2, TABLE_W - 4, TABLE_H - 4).stroke({ width: 2, color: 0x000000, alpha: 0.12 });

  // diamond sights
  const dots = [];
  for (const f of [0.25, 0.5, 0.75]) {
    dots.push([CUSHION + TABLE_W * f, CUSHION / 2], [CUSHION + TABLE_W * f, CANVAS_H - CUSHION / 2]);
  }
  dots.push([CUSHION / 2, CUSHION + TABLE_H / 2], [CANVAS_W - CUSHION / 2, CUSHION + TABLE_H / 2]);
  for (const [x, y] of dots) {
    g.circle(x, y, 3.5).fill(0xfff0cf);
    g.circle(x, y, 3.5).stroke({ width: 1, color: 0x4a3a1f, alpha: 0.5 });
  }

  // pockets: brass ring + recessed dark hole
  for (const p of pocketPositions()) {
    g.circle(p.x, p.y, POCKET_R + 6).fill({ color: 0x000000, alpha: 0.4 });
    g.circle(p.x, p.y, POCKET_R + 3).fill(0x4a3a1f);
    g.circle(p.x, p.y, POCKET_R + 3).stroke({ width: 2, color: 0xd9b15a, alpha: 0.7 });
    const hole = new FillGradient({
      type: 'radial', innerCenter: { x: 0.5, y: 0.4 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5,
      colorStops: [{ offset: 0, color: 0x101010 }, { offset: 1, color: 0x000000 }], textureSpace: 'local',
    });
    g.circle(p.x, p.y, POCKET_R).fill(hole);
  }
  return g;
}

// The painted face (colour + stripe + number) — this is what spins as the ball rolls.
function faceGraphics(number, color) {
  const g = new Container();
  const isCue = number === 0;
  const isStripe = number >= 9;
  g.addChild(new Graphics().circle(0, 0, BALL_R).fill(isCue ? 0xffffff : isStripe ? 0xfdfdfd : color));
  if (isStripe) {
    const band = new Graphics().rect(-BALL_R, -BALL_R * 0.52, BALL_R * 2, BALL_R * 1.04).fill(color);
    const mask = new Graphics().circle(0, 0, BALL_R).fill(0xffffff);
    g.addChild(band, mask);
    band.mask = mask;
  }
  if (!isCue) {
    g.addChild(new Graphics().circle(0, 0, BALL_R * 0.5).fill(0xffffff));
    g.addChild(new Graphics().circle(0, 0, BALL_R * 0.5).stroke({ width: 0.6, color: 0x000000, alpha: 0.15 }));
    const t = new Text({ text: String(number), style: { fontFamily: 'Arial, sans-serif', fontSize: 9, fontWeight: 'bold', fill: 0x141414 } });
    t.anchor.set(0.5);
    g.addChild(t);
  }
  return g;
}

// The fixed shading/highlights drawn on top (does NOT spin — light stays put).
function overlayGraphics(isCue) {
  const g = new Container();
  const shade = new FillGradient({
    type: 'radial',
    innerCenter: { x: 0.36, y: 0.32 }, innerRadius: 0.08,
    outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.54,
    colorStops: [
      { offset: 0, color: 'rgba(255,255,255,0.10)' },
      { offset: 0.55, color: 'rgba(0,0,0,0)' },
      { offset: 1, color: `rgba(0,0,0,${isCue ? 0.28 : 0.36})` },
    ],
    textureSpace: 'local',
  });
  g.addChild(new Graphics().circle(0, 0, BALL_R).fill(shade));
  g.addChild(new Graphics().ellipse(BALL_R * 0.16, BALL_R * 0.52, BALL_R * 0.58, BALL_R * 0.22).fill({ color: 0xffffff, alpha: 0.14 }));
  g.addChild(new Graphics().ellipse(-BALL_R * 0.32, -BALL_R * 0.36, BALL_R * 0.5, BALL_R * 0.36).fill({ color: 0xffffff, alpha: 0.6 }));
  g.addChild(new Graphics().circle(-BALL_R * 0.4, -BALL_R * 0.44, BALL_R * 0.15).fill({ color: 0xffffff, alpha: 1 }));
  g.addChild(new Graphics().circle(0, 0, BALL_R).stroke({ width: 1, color: isCue ? 0xcfe0d0 : 0x000000, alpha: isCue ? 0.5 : 0.2 }));
  return g;
}

// Bake each ball part to a texture ONCE — runtime then draws cheap sprites instead of
// re-tessellating graphics and applying a mask per ball every frame.
let TEX = null;
export function initBallTextures(renderer) {
  if (TEX) return;
  const bake = (node, half) => {
    const t = renderer.generateTexture({ target: node, frame: new Rectangle(-half, -half, half * 2, half * 2), resolution: 2, antialias: true });
    node.destroy({ children: true });
    return t;
  };
  const R = BALL_R + 2;
  const faces = new Map();
  for (let n = 0; n <= 15; n++) faces.set(n, bake(faceGraphics(n, BALL_COLORS[n]), R));
  const shadow = new Graphics().ellipse(0, 0, BALL_R * 1.05, BALL_R * 0.9).fill({ color: 0x000000, alpha: 0.28 });
  const halo = new Graphics().circle(0, 0, BALL_R + 2.5).fill({ color: 0xffffff, alpha: 0.18 });
  TEX = {
    faces,
    overlayNormal: bake(overlayGraphics(false), R),
    overlayCue: bake(overlayGraphics(true), R),
    shadow: bake(shadow, BALL_R + 4),
    halo: bake(halo, BALL_R + 4),
  };
}

export function buildBallVisual(ball) {
  const c = new Container();
  const isCue = ball.number === 0;

  const shadow = new Sprite(TEX.shadow); shadow.anchor.set(0.5); shadow.position.set(2.5, 3.5);
  c.addChild(shadow);
  if (isCue) { const halo = new Sprite(TEX.halo); halo.anchor.set(0.5); c.addChild(halo); }

  const face = new Sprite(TEX.faces.get(ball.number)); face.anchor.set(0.5);
  const overlay = new Sprite(isCue ? TEX.overlayCue : TEX.overlayNormal); overlay.anchor.set(0.5);
  c.addChild(face, overlay);
  c.spin = face; // only the painted face rotates
  return c;
}

export function drawAim(g, cue, mx, my) {
  g.clear();
  g.moveTo(cue.x, cue.y).lineTo(mx, my).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
  const len = Math.hypot(cue.x - mx, cue.y - my) || 1;
  const tipX = cue.x + ((cue.x - mx) / len) * 220;
  const tipY = cue.y + ((cue.y - my) / len) * 220;
  g.moveTo(cue.x, cue.y).lineTo(tipX, tipY).stroke({ width: 2, color: 0xff3030, alpha: 0.85 });
}

export function drawPower(g, label, frac) {
  const x = 24, y = CANVAS_H - 22, w = 200, h = 12;
  const r = Math.round(255 * frac), gr = Math.round(255 * (1 - frac));
  g.clear();
  g.rect(x, y, w, h).fill({ color: 0x000000, alpha: 0.5 }).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
  g.rect(x + 1, y + 1, (w - 2) * frac, h - 2).fill((r << 16) | (gr << 8));
  label.visible = true;
}
