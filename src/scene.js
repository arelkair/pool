// All PixiJS drawing: the table, ball sprites, aim line and power bar.
import { Container, Graphics, Text, FillGradient } from 'pixi.js';
import { CANVAS_W, CANVAS_H, CUSHION, TABLE_W, TABLE_H, BALL_R, POCKET_R } from './config.js';
import { pocketPositions } from './physics.js';

export function drawTable() {
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

export function buildBallVisual(ball) {
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

  // sphere shading — fixed relative to the light, so it stays put while the surface spins
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
