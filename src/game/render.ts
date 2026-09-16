import { SHAPES, WEAPONS, polyPath } from './defs';
import type { Game } from './engine';

let bgGrad: CanvasGradient | null = null;
let bgKey = '';

const FONT = 'Rajdhani, "Segoe UI", system-ui, sans-serif';
const MONO = '"SF Mono", ui-monospace, Menlo, monospace';

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function screenTransform(g: Game, ctx: CanvasRenderingContext2D, shake = false) {
  const sx = shake ? g.fx.shakeX : 0;
  const sy = shake ? g.fx.shakeY : 0;
  ctx.setTransform(g.dpr, 0, 0, g.dpr, sx * g.dpr, sy * g.dpr);
}

function worldTransform(g: Game, ctx: CanvasRenderingContext2D) {
  const s = g.viewScale * g.dpr;
  ctx.setTransform(s, 0, 0, s, (g.fx.shakeX - g.camX * g.viewScale) * g.dpr, (g.fx.shakeY - g.camY * g.viewScale) * g.dpr);
}

export function render(g: Game, tNow: number) {
  const ctx = g.ctx;
  const W = g.W, H = g.H;
  const th = g.theme;
  const key = W + 'x' + H + th.id;
  if (key !== bgKey) {
    bgKey = key;
    const gr = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.82);
    gr.addColorStop(0, th.bg[0]);
    gr.addColorStop(0.55, th.bg[1]);
    gr.addColorStop(1, th.bg[2]);
    bgGrad = gr;
  }

  const inGame = g.phase !== 'menu';

  // ---- background (screen space, gentle shake) ----
  screenTransform(g, ctx, true);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgGrad || '#080c18';
  ctx.fillRect(-40, -40, W + 80, H + 80);
  drawBackground(g, ctx, tNow, inGame);

  if (g.phase === 'menu') {
    drawMenuDeco(g, ctx, tNow);
    screenTransform(g, ctx, false);
    drawVignette(g, ctx);
    return;
  }

  // ---- world (camera space) ----
  worldTransform(g, ctx);
  ctx.globalCompositeOperation = 'lighter';
  drawPickups(g, ctx);
  drawMines(g, ctx);
  drawEnemyTelegraphs(g, ctx);
  ctx.globalCompositeOperation = 'source-over';
  drawEnemies(g, ctx);
  drawEBullets(g, ctx);
  drawHelpers(g, ctx);
  drawOrbitals(g, ctx);
  drawPlayer(g, ctx, tNow);
  drawProjs(g, ctx);
  drawBeams(g, ctx);
  drawParticles(g, ctx);
  drawRings(g, ctx);
  drawFloats(g, ctx);
  ctx.globalCompositeOperation = 'source-over';
  drawArenaEdge(g, ctx);

  // ---- HUD & overlays (screen space, no shake) ----
  screenTransform(g, ctx, false);
  drawHUD(g, ctx, tNow);
  drawVignette(g, ctx);
  drawFlash(g, ctx);
}

function drawBackground(g: Game, ctx: CanvasRenderingContext2D, t: number, inGame: boolean) {
  const W = g.W, H = g.H;
  const scale = inGame ? g.viewScale : 1;
  const step = 64 * scale;
  // grid scrolls with the camera in world space (projected to screen)
  let ox = inGame ? (-g.camX * scale) % step : (t * 6) % step;
  let oy = inGame ? (-g.camY * scale) % step : 0;
  if (ox < 0) ox += step;
  if (oy < 0) oy += step;
  ctx.lineWidth = 1;
  ctx.strokeStyle = g.theme.grid;
  ctx.beginPath();
  for (let x = ox - step; x < W + step; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy - step; y < H + step; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // parallax stars
  ctx.fillStyle = g.theme.star;
  const n = g.stars.length;
  const px = inGame ? g.camX * scale : 0;
  const py = inGame ? g.camY * scale : 0;
  for (let i = 0; i < n; i++) {
    const s = g.stars[i];
    const sx = s.x - px * 0.14 * s.z;
    const sy = s.y - py * 0.14 * s.z;
    const sz = s.z * 1.7;
    ctx.globalAlpha = 0.15 + 0.5 * s.z * (0.6 + 0.4 * Math.sin(t * 1.6 + i));
    ctx.fillRect(((sx % W) + W) % W, ((sy % H) + H) % H, sz, sz);
  }
  ctx.globalAlpha = 1;
}

function drawMenuDeco(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  const W = g.W, H = g.H;
  ctx.globalCompositeOperation = 'lighter';
  const cols = ['#38f5e0', '#5ce1ff', '#a78bfa', '#fde047', '#fb923c', '#f472b6', '#e879f9'];
  for (let i = 0; i < 16; i++) {
    const sides = (i % 7) + 1;
    const r = 16 + (i % 4) * 9;
    const x = W * (0.12 + 0.76 * ((i * 0.37 + Math.sin(t * 0.14 + i) * 0.06) % 1));
    const y = H * (0.14 + 0.72 * ((i * 0.61 + Math.cos(t * 0.11 + i * 2) * 0.06) % 1));
    const c = cols[i % cols.length];
    const rot = t * (0.3 + (i % 3) * 0.16) * (i % 2 ? 1 : -1);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = c;
    polyPath(ctx, x, y, r * 1.9, sides, rot);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.6;
    polyPath(ctx, x, y, r, sides, rot);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawArenaEdge(g: Game, ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = g.theme.edge;
  ctx.lineWidth = 3 / g.viewScale;
  ctx.strokeRect(0, 0, g.worldW, g.worldH);
}

function drawPickups(g: Game, ctx: CanvasRenderingContext2D) {
  const t = performance.now() / 1000;
  for (let i = 0; i < g.pickups.length; i++) {
    const p = g.pickups[i];
    if (!p.active) continue;
    const pulse = 0.7 + 0.3 * Math.sin(t * 9 + i);
    // green XP orbs (diamond) vs green heal orbs (cross)
    const c = p.heal ? '#8affc0' : '#5ef07a';
    const big = !p.heal && p.v >= 30;
    const R = (p.heal ? 11 : big ? 12 : 9) * pulse;
    ctx.globalAlpha = p.life < 3 ? 0.3 + 0.7 * Math.abs(Math.sin(p.life * 8)) : 1;
    ctx.fillStyle = hexA(c, 0.2 * pulse);
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = c;
    if (p.heal) {
      const w = 2.6, l = 7.5;
      ctx.beginPath();
      ctx.rect(p.x - w / 2, p.y - l, w, l * 2);
      ctx.rect(p.x - l, p.y - w / 2, l * 2, w);
      ctx.fill();
      ctx.globalAlpha *= 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, 6.2832);
      ctx.fill();
    } else {
      const r = big ? 6.5 : 4.6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y);
      ctx.closePath();
      ctx.fill();
      if (big) {
        ctx.globalAlpha *= 0.55;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawMines(g: Game, ctx: CanvasRenderingContext2D) {
  for (const m of g.mines) {
    if (!m.active) continue;
    const armed = m.armed <= 0;
    const pulse = armed ? 0.55 + 0.45 * Math.sin(m.t * 12) : 0.35;
    ctx.globalAlpha = 0.25 * pulse;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(m.x, m.y, 14, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    polyPath(ctx, m.x, m.y, 6.5, 4, m.t * 2);
    ctx.stroke();
    ctx.fillStyle = hexA('#ffd166', 0.8 * pulse);
    ctx.beginPath(); ctx.arc(m.x, m.y, 2.6, 0, 6.2832); ctx.fill();
  }
}

function drawEnemies(g: Game, ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (!e.active) continue;
    const c = e.def.color;
    const flash = e.flash > 0;
    const frozen = e.frozen > 0;
    const wind = e.windup > 0 && e.state === 1;

    // soft glow
    ctx.globalAlpha = e.def.boss ? 0.3 : 0.15;
    ctx.fillStyle = frozen ? '#7dd3fc' : c;
    polyPath(ctx, e.x, e.y, e.r * (e.def.boss ? 1.5 : 1.75), e.sides, e.rot);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.lineWidth = e.def.boss ? 4 : 2.2;
    ctx.strokeStyle = flash ? '#ffffff' : frozen ? '#a5e8ff' : c;
    ctx.fillStyle = flash ? 'rgba(255,255,255,0.85)' : frozen ? 'rgba(125,211,252,0.32)' : hexA(c, wind ? 0.55 : 0.2);
    polyPath(ctx, e.x, e.y, e.r, e.sides, e.rot);
    ctx.fill();
    ctx.stroke();

    // inner core
    ctx.fillStyle = flash ? '#fff' : hexA(c, 0.85);
    polyPath(ctx, e.x, e.y, Math.max(2, e.r * 0.32), e.sides, -e.rot * 1.5);
    ctx.fill();

    if (e.def.boss || e.maxHp > 90) {
      const w = e.r * 2.2;
      const y = e.y - e.r - 11;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, y, w, 4.5);
      const f = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = f > 0.5 ? '#ff6b6b' : f > 0.22 ? '#ffb347' : '#ff2d55';
      ctx.fillRect(e.x - w / 2, y, w * f, 4.5);
      ctx.globalAlpha = 1;
    }
    if (e.def.boss) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 180);
      ctx.strokeStyle = '#ff2d55';
      ctx.lineWidth = 2;
      polyPath(ctx, e.x, e.y, e.r * 1.35, 10, -e.rot * 0.7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawEnemyTelegraphs(g: Game, ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (!e.active || e.state !== 1) continue;
    const p = 1 - e.windup / (e.atk === 'slam' ? 0.75 : 0.62);
    if (e.atk === 'laser') {
      const range = 900;
      ctx.globalAlpha = 0.25 + 0.45 * p;
      ctx.strokeStyle = '#ff9a3c';
      ctx.lineWidth = 1 + p * 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.ax * range, e.y + e.ay * range);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (e.atk === 'slam') {
      ctx.globalAlpha = 0.2 + 0.35 * p;
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 175 * p, 0, 6.2832);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawEBullets(g: Game, ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < g.ebullets.length; i++) {
    const b = g.ebullets[i];
    if (!b.active) continue;
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.1, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.color;
    if (b.kind === 1) {
      polyPath(ctx, b.x, b.y, b.r, 3, b.rot);
      ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.36, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawProjs(g: Game, ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < g.projs.length; i++) {
    const p = g.projs[i];
    if (!p.active) continue;
    const c = p.crit ? '#ffe066' : p.color;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c;
    switch (p.kind) {
      case 'disc': {
        ctx.strokeStyle = c;
        ctx.lineWidth = p.r * 0.45;
        polyPath(ctx, p.x, p.y, p.r, 6, p.rot);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.3, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'orb': {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.6;
        polyPath(ctx, p.x, p.y, p.r * 1.5, 6, p.rot);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'shell': {
        polyPath(ctx, p.x, p.y, p.r, 8, p.rot);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'missile': {
        polyPath(ctx, p.x, p.y, p.r * 1.3, 3, Math.atan2(p.vy, p.vx));
        ctx.fill();
        break;
      }
      default: {
        const a = Math.atan2(p.vy, p.vx);
        const l = p.r * 2.6;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.fillRect(-l, -p.r * 0.55, l * 2, p.r * 1.1);
        ctx.restore();
      }
    }
  }
}

function drawBeams(g: Game, ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < g.fx.beams.length; i++) {
    const b = g.fx.beams[i];
    if (!b.active) continue;
    const f = b.life / b.max;
    ctx.globalAlpha = 0.28 * f;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.w * 3.2 * f;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.globalAlpha = 0.95 * f;
    ctx.lineWidth = Math.max(1, b.w * f);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.lineCap = 'butt';
}

function drawOrbitals(g: Game, ctx: CanvasRenderingContext2D) {
  for (const o of g.orbitals) {
    if (!o.active) continue;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = o.color;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 2, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = o.color;
    polyPath(ctx, o.x, o.y, o.r, o.kind === 1 ? 4 : 0, o.spin);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    polyPath(ctx, o.x, o.y, o.r, o.kind === 1 ? 4 : 0, o.spin);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawHelpers(g: Game, ctx: CanvasRenderingContext2D) {
  for (const h of g.helpers) {
    if (!h.active) continue;
    if (h.kind === 1) {
      ctx.globalAlpha = 0.2; ctx.fillStyle = '#8ef7ff';
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 2, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#8ef7ff';
      polyPath(ctx, h.x, h.y, h.r, 3, h.rot + performance.now() / 400);
      ctx.fill();
      ctx.fillStyle = '#04202b';
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.34, 0, 6.2832); ctx.fill();
    } else if (h.kind === 0) {
      const life = h.life < 4 ? 0.35 + 0.65 * Math.abs(Math.sin(h.life * 8)) : 1;
      ctx.globalAlpha = life;
      ctx.fillStyle = '#fbbf24';
      polyPath(ctx, h.x, h.y, h.r, 4, Math.PI / 4);
      ctx.fill();
      ctx.strokeStyle = '#fff7d6';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x + Math.cos(h.rot) * h.r * 1.7, h.y + Math.sin(h.rot) * h.r * 1.7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      const sh = SHAPES.square;
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#7dfcd6';
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 2.1, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#7dfcd6';
      ctx.lineWidth = 2.4;
      polyPath(ctx, h.x, h.y, h.r, sh.sides, h.rot);
      ctx.stroke();
      ctx.fillStyle = hexA('#7dfcd6', 0.28);
      polyPath(ctx, h.x, h.y, h.r, sh.sides, h.rot);
      ctx.fill();
    }
  }
}

function drawPlayer(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  const sh = SHAPES[g.shapeId];
  const col = g.playerColor || sh.color;
  const acc = g.playerColor || sh.accent;
  const inv = g.invuln > 0 && Math.floor(g.invuln * 20) % 2 === 0;
  const vel = Math.hypot(g.pvx, g.pvy);
  const rot = Math.atan2(g.pvy, g.pvx) + (vel > 20 ? 0 : t * 0.7);
  const r = sh.size * (1 + 0.05 * Math.sin(t * 5));

  // thrust
  if (vel > 30) {
    const a = Math.atan2(g.pvy, g.pvx) + Math.PI;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = acc;
    polyPath(ctx, g.px + Math.cos(a) * r * 1.15, g.py + Math.sin(a) * r * 1.15, r * 0.45, 3, a);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // glow
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(g.px, g.py, r * 2.6, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.arc(g.px, g.py, r * 4.2, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;

  // aim tick
  ctx.strokeStyle = hexA(col, 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(g.px + Math.cos(g.aimA) * (r + 6), g.py + Math.sin(g.aimA) * (r + 6));
  ctx.lineTo(g.px + Math.cos(g.aimA) * (r + 16), g.py + Math.sin(g.aimA) * (r + 16));
  ctx.stroke();

  // body
  ctx.globalAlpha = inv ? 0.4 : 1;
  ctx.fillStyle = hexA(col, 0.28);
  ctx.strokeStyle = inv ? '#ffffff' : col;
  ctx.lineWidth = 3;
  polyPath(ctx, g.px, g.py, r, sh.sides, rot);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = col;
  polyPath(ctx, g.px, g.py, r * 0.42, sh.sides, -rot * 1.6 + t);
  ctx.fill();
  ctx.globalAlpha = 1;

  // shield
  if (g.shield > 0) {
    for (let i = 0; i < g.shield; i++) {
      const a = t * 1.6 + (i / Math.max(1, g.shield)) * Math.PI * 2;
      const sx = g.px + Math.cos(a) * (r + 15), sy = g.py + Math.sin(a) * (r + 15);
      ctx.fillStyle = '#7dd3fc';
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(sx, sy, 4.4, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 0.13 + 0.05 * Math.sin(t * 4);
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(g.px, g.py, r + 15, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawParticles(g: Game, ctx: CanvasRenderingContext2D) {
  const ps = g.fx.parts;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (!p.active) continue;
    const f = p.life / p.max;
    ctx.globalAlpha = f > 0.7 ? 1 : f * 1.35;
    ctx.fillStyle = p.color;
    if (p.sides === 3) {
      polyPath(ctx, p.x, p.y, p.size * f, 3, p.rot);
      ctx.fill();
    } else if (p.sides === 4 || p.sides === 5 || p.sides === 6) {
      polyPath(ctx, p.x, p.y, p.size * f, p.sides, p.rot);
      ctx.fill();
    } else {
      const s = p.size * (0.4 + f * 0.9);
      ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
    }
  }
  ctx.globalAlpha = 1;
}

function drawRings(g: Game, ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < g.fx.rings.length; i++) {
    const r = g.fx.rings[i];
    if (!r.active) continue;
    const f = r.life / r.max;
    ctx.globalAlpha = f * 0.85;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.w * f;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.2832); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFloats(g: Game, ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center';
  for (let i = 0; i < g.fx.floats.length; i++) {
    const f = g.fx.floats[i];
    if (!f.active) continue;
    const k = f.life / f.max;
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.font = `800 ${f.size}px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(f.text, f.x + 1.5, f.y + 1.5);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/* ------------------------------- HUD ------------------------------- */

function drawHUD(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  void t;
  const W = g.W, H = g.H;
  const pad = 14;

  // ---- score (top centre) ----
  ctx.textAlign = 'center';
  ctx.font = `800 34px ${MONO}`;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(fmt(g.score), W / 2 + 2, 44);
  ctx.fillStyle = '#eaf6ff';
  ctx.fillText(fmt(g.score), W / 2, 42);
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = 'rgba(160,200,240,0.75)';
  ctx.fillText('SCORE', W / 2, 58);
  if (g.combo > 1) {
    const k = Math.min(1, g.comboT / (2.1 * (1 + (g.stats?.comboPow || 0) * 0.5)));
    ctx.font = `800 ${18 + Math.min(12, g.combo * 0.4)}px ${FONT}`;
    ctx.fillStyle = k > 0.35 ? '#ffe066' : '#ff9a3c';
    ctx.fillText(`x${g.combo} COMBO`, W / 2, 80);
    ctx.fillStyle = 'rgba(255,224,102,0.35)';
    ctx.fillRect(W / 2 - 46, 86, 92 * k, 3);
  }

  // ---- top-left: wave + time ----
  ctx.textAlign = 'left';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = 'rgba(150,190,235,0.85)';
  ctx.fillText(`WAVE ${g.wave}`, pad, pad + 14);
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = 'rgba(120,160,210,0.7)';
  ctx.fillText(`${fmtTime(g.elapsed)}   LV ${g.level}`, pad, pad + 32);

  // ---- hp bar (bottom-left) ----
  const bw = Math.min(250, W * 0.42), bh = 15;
  const bx = pad, by = H - bh - pad;
  ctx.fillStyle = 'rgba(4,10,20,0.72)';
  roundRect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 6);
  ctx.fill();
  const frac = Math.max(0, g.hp / g.maxHp);
  const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  const hc = frac > 0.5 ? '#38f5e0' : frac > 0.25 ? '#ffd166' : '#ff4d6d';
  grd.addColorStop(0, hc);
  grd.addColorStop(1, hexA(hc, 0.55));
  ctx.fillStyle = grd;
  roundRect(ctx, bx, by, Math.max(3, bw * frac), bh, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  roundRect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 6);
  ctx.stroke();
  ctx.font = `800 12px ${MONO}`;
  ctx.fillStyle = '#03121a';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.ceil(g.hp)}/${Math.round(g.maxHp)}`, bx + 6, by + bh - 4);

  // shape name
  ctx.font = `800 12px ${FONT}`;
  ctx.fillStyle = SHAPES[g.shapeId].color;
  ctx.fillText(SHAPES[g.shapeId].name.toUpperCase() + '  ·  ' + g.weapons.map((w) => WEAPONS[w].name).join(' + '), bx, by - 8);

  // ---- xp bar (bottom, full width thin) ----
  const xy = H - 4;
  const xf = Math.min(1, g.xp / g.xpNeed);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, xy, W, 4);
  const xg = ctx.createLinearGradient(0, 0, W, 0);
  xg.addColorStop(0, '#7dfcd6');
  xg.addColorStop(1, '#ffe066');
  ctx.fillStyle = xg;
  ctx.fillRect(0, xy, W * xf, 4);

  // ---- weapon icons (bottom-right) ----
  const n = g.weapons.length;
  const iw = 34;
  let wx = W - pad - n * (iw + 6) + 6;
  const wy = H - pad - iw - 22;
  for (let i = 0; i < n; i++) {
    const w = WEAPONS[g.weapons[i]];
    ctx.globalAlpha = i === 0 ? 1 : 0.62;
    ctx.fillStyle = 'rgba(6,14,28,0.8)';
    roundRect(ctx, wx, wy, iw, iw, 8);
    ctx.fill();
    ctx.strokeStyle = hexA(w.color, 0.7);
    ctx.lineWidth = 1.6;
    roundRect(ctx, wx, wy, iw, iw, 8);
    ctx.stroke();
    ctx.fillStyle = w.color;
    ctx.font = `700 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(w.icon, wx + iw / 2, wy + iw / 2 + 6);
    ctx.globalAlpha = 1;
    wx += iw + 6;
  }

  // ---- opening control hint ----
  if (g.elapsed < 5.5) {
    const a = Math.min(1, (5.5 - g.elapsed) / 1.4) * 0.85;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = 'rgba(180,220,255,0.75)';
    ctx.fillText('DODGE THE RED SHAPES', W / 2, H * 0.62);
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = 'rgba(140,180,220,0.6)';
    ctx.fillText('DRAG anywhere · or WASD / Arrows', W / 2, H * 0.62 + 20);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // ---- banner ----
  if (g.bannerT > 0 && g.bannerText) {
    const k = Math.min(1, g.bannerT * 2.2);
    const pop = 1 + Math.max(0, (g.bannerT - 1.2)) * 0.5;
    ctx.globalAlpha = k;
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(30 * pop)}px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(g.bannerText, W / 2 + 2, H * 0.28 + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(g.bannerText, W / 2, H * 0.28);
    ctx.globalAlpha = 1;
  }

  // ---- touch joystick ----
  if (g.touchActive) {
    const dx = g.tX - g.tOx, dy = g.tY - g.tOy;
    const d = Math.hypot(dx, dy) || 1;
    const m = Math.min(58, d);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(g.tOx, g.tOy, 58, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 0.36;
    ctx.beginPath(); ctx.arc(g.tOx + (dx / d) * m, g.tOy + (dy / d) * m, 26, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#8ef7ff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(g.tOx + (dx / d) * m, g.tOy + (dy / d) * m, 26, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

function drawVignette(g: Game, ctx: CanvasRenderingContext2D) {
  const W = g.W, H = g.H;
  ctx.fillStyle = vigGrad(W, H, ctx);
  ctx.fillRect(0, 0, W, H);
}
let vigKey = '';
let vigG: CanvasGradient | null = null;
function vigGrad(w: number, h: number, ctx: CanvasRenderingContext2D) {
  const key = w + 'x' + h;
  if (key !== vigKey || !vigG) {
    vigKey = key;
    const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.62)');
    vigG = gr;
  }
  return vigG;
}

function drawFlash(g: Game, ctx: CanvasRenderingContext2D) {
  const f = g.fx.flash;
  if (!f.active) return;
  const a = (f.life / f.max) * f.power;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(0.85, a);
  ctx.fillStyle = f.color;
  ctx.fillRect(0, 0, g.W, g.H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // low HP pulse
  if (g.phase === 'playing' && g.hp / g.maxHp < 0.3) {
    ctx.globalAlpha = 0.06 + 0.05 * Math.sin(performance.now() / 200);
    ctx.fillStyle = '#ff2d55';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fmt(n: number) {
  return Math.floor(n).toLocaleString('en-US');
}
function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
