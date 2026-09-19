import { SHAPES, WEAPONS, polyPath } from './defs';
import { t as tr, shapeName, weaponName, enemyName } from '../i18n';
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
  drawHazards(g, ctx);
  drawEnemyTelegraphs(g, ctx);
  ctx.globalCompositeOperation = 'source-over';
  drawEnemies(g, ctx);
  drawEBullets(g, ctx);
  drawHelpers(g, ctx);
  drawOrbitals(g, ctx);
  drawPeers(g, ctx, tNow);
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
  drawCountdown(g, ctx);
  drawVignette(g, ctx);
  drawFlash(g, ctx);
}

/** Big centred 3-2-1 used by the lobby start gate. */
function drawCountdown(g: Game, ctx: CanvasRenderingContext2D) {
  if (g.countdown <= 0) return;
  const n = Math.ceil(g.countdown);
  const frac = g.countdown - Math.floor(g.countdown);
  const scale = 1 + (1 - frac) * 0.35;
  ctx.save();
  ctx.translate(g.W / 2, g.H / 2);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#38f5e0';
  ctx.beginPath();
  ctx.arc(0, 0, 96, 0, 6.2832);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `900 128px ${FONT}`;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(String(n), 3, 3);
  ctx.fillStyle = '#eaf6ff';
  ctx.fillText(String(n), 0, 0);
  ctx.font = `800 15px ${FONT}`;
  ctx.fillStyle = 'rgba(160,200,240,0.85)';
  ctx.fillText(tr(g.lang, 'getReady'), 0, 82);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

const wrap = (v: number, m: number) => ((v % m) + m) % m;

function drawGrid(g: Game, ctx: CanvasRenderingContext2D, t: number, inGame: boolean) {
  const W = g.W, H = g.H;
  const th = g.theme;
  if (th.gridKind === 'none') return;
  const scale = inGame ? g.viewScale : 1;
  const ox = inGame ? -g.camX * scale : t * 6;
  const oy = inGame ? -g.camY * scale : 0;
  ctx.lineWidth = 1;
  ctx.strokeStyle = th.grid;

  if (th.gridKind === 'square') {
    const step = 64 * scale;
    const sx = wrap(ox, step), sy = wrap(oy, step);
    ctx.beginPath();
    for (let x = sx - step; x < W + step; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = sy - step; y < H + step; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  } else if (th.gridKind === 'diag') {
    const step = 74 * scale;
    const s1 = wrap(ox + oy, step);
    ctx.beginPath();
    for (let d = s1 - step; d < W + H + step; d += step) {
      ctx.moveTo(d, 0); ctx.lineTo(d - H, H);
      ctx.moveTo(d - H, 0); ctx.lineTo(d, H);
    }
    ctx.stroke();
  } else if (th.gridKind === 'hex') {
    const R = 34 * scale;               // hex radius
    const hw = Math.sqrt(3) * R;        // horizontal spacing
    const vh = 1.5 * R;                 // vertical spacing
    const sx = wrap(ox, hw), sy = wrap(oy, vh * 2);
    ctx.beginPath();
    for (let row = -1, y = sy - vh * 2; y < H + vh * 2; row++, y += vh) {
      const off = (row & 1) ? hw / 2 : 0;
      for (let x = sx - hw + off; x < W + hw; x += hw) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const hx = x + Math.cos(a) * R, hy = y + Math.sin(a) * R;
          if (k === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
      }
    }
    ctx.stroke();
  } else if (th.gridKind === 'rings') {
    // concentric rings anchored to the arena centre
    const cx = inGame ? (g.worldW / 2 - g.camX) * scale : W / 2;
    const cy = inGame ? (g.worldH / 2 - g.camY) * scale : H / 2;
    const step = 78 * scale;
    const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    ctx.beginPath();
    for (let r = step; r < maxR + step; r += step) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, 6.2832); }
    ctx.stroke();
    // radial spokes
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + t * 0.02;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Big soft colour blobs that give each arena depth. */
function drawFog(g: Game, ctx: CanvasRenderingContext2D, t: number, px: number, py: number, count: number) {
  const W = g.W, H = g.H;
  ctx.fillStyle = g.theme.fog;
  for (let i = 0; i < count; i++) {
    const r = (150 + i * 70);
    const fx = wrap(W * (0.2 + i * 0.31) + Math.sin(t * 0.05 + i) * 60 - px * 0.05, W + r * 2) - r;
    const fy = wrap(H * (0.25 + i * 0.27) + Math.cos(t * 0.04 + i * 2) * 50 - py * 0.05, H + r * 2) - r;
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, 6.2832);
    ctx.fill();
  }
}

function drawBackground(g: Game, ctx: CanvasRenderingContext2D, t: number, inGame: boolean) {
  const W = g.W, H = g.H;
  const th = g.theme;
  const scale = inGame ? g.viewScale : 1;
  const px = inGame ? g.camX * scale : 0;
  const py = inGame ? g.camY * scale : 0;
  const stars = g.stars;
  const n = stars.length;

  ctx.globalCompositeOperation = 'source-over';

  /* ---- deep background layer (per style) ---- */
  switch (th.style) {
    case 'dunes': {
      // low sun + layered heat dunes
      const sunX = W * 0.68 - px * 0.03, sunY = H * 0.30 - py * 0.03;
      const gr = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, Math.min(W, H) * 0.55);
      gr.addColorStop(0, 'rgba(255,170,70,0.30)');
      gr.addColorStop(0.45, 'rgba(255,110,50,0.09)');
      gr.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      for (let b = 0; b < 3; b++) {
        const baseY = H * (0.62 + b * 0.14) - py * (0.04 + b * 0.02);
        ctx.fillStyle = `rgba(${60 - b * 10},${22 - b * 4},${26 - b * 6},${0.55 - b * 0.12})`;
        ctx.beginPath();
        ctx.moveTo(-10, H + 10);
        for (let x = -10; x <= W + 10; x += 28) {
          const y = baseY + Math.sin((x + px * 0.3) * 0.006 + b * 1.7 + t * 0.06) * (16 + b * 9);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W + 10, H + 10);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'ice': {
      drawFog(g, ctx, t, px, py, 2);
      // large translucent ice shards
      ctx.strokeStyle = 'rgba(190,230,255,0.13)';
      ctx.fillStyle = 'rgba(150,210,255,0.055)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 7; i++) {
        const s = stars[(i * 13) % Math.max(1, n)] || { x: 0, y: 0, z: 0.5 };
        const cx = wrap(s.x * 1.7 - px * 0.10, W + 300) - 150;
        const cy = wrap(s.y * 1.7 - py * 0.10, H + 300) - 150;
        const len = 70 + s.z * 110, wdt = 16 + s.z * 22;
        const a = i * 1.1 + t * 0.03;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -len); ctx.lineTo(wdt, 0); ctx.lineTo(0, len); ctx.lineTo(-wdt, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'bog': {
      drawFog(g, ctx, t, px, py, 3);
      // murky pools
      ctx.fillStyle = 'rgba(30,90,55,0.16)';
      for (let i = 0; i < 5; i++) {
        const s = stars[(i * 23) % Math.max(1, n)] || { x: 0, y: 0, z: 0.5 };
        const cx = wrap(s.x * 2.1 - px * 0.07, W + 400) - 200;
        const cy = wrap(s.y * 2.1 - py * 0.07, H + 400) - 200;
        const r = 60 + s.z * 90;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 1.35, r * 0.72, i * 0.7, 0, 6.2832);
        ctx.fill();
      }
      break;
    }
    case 'ruins': {
      drawFog(g, ctx, t, px, py, 2);
      // shattered rubble slabs
      ctx.fillStyle = 'rgba(70,22,30,0.4)';
      ctx.strokeStyle = 'rgba(255,90,110,0.10)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) {
        const s = stars[(i * 17) % Math.max(1, n)] || { x: 0, y: 0, z: 0.5 };
        const cx = wrap(s.x * 1.9 - px * 0.09, W + 260) - 130;
        const cy = wrap(s.y * 1.9 - py * 0.09, H + 260) - 130;
        const w = 40 + s.z * 90, h = 22 + s.z * 46;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((i % 5) * 0.21 - 0.4);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
      break;
    }
    case 'hall': {
      drawFog(g, ctx, t, px, py, 2);
      // gilded columns
      for (let i = 0; i < 6; i++) {
        const cw = 46;
        const cx = wrap(i * 190 + 60 - px * 0.16, W + 240) - 120;
        const gr = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
        gr.addColorStop(0, 'rgba(250,204,21,0.015)');
        gr.addColorStop(0.5, 'rgba(250,214,90,0.075)');
        gr.addColorStop(1, 'rgba(250,204,21,0.015)');
        ctx.fillStyle = gr;
        ctx.fillRect(cx - cw / 2, 0, cw, H);
        ctx.fillStyle = 'rgba(250,214,90,0.09)';
        ctx.fillRect(cx - cw * 0.8, 0, cw * 1.6, 12);
        ctx.fillRect(cx - cw * 0.8, H - 12, cw * 1.6, 12);
      }
      break;
    }
    case 'void': {
      // slow silhouetted debris polygons
      ctx.fillStyle = 'rgba(40,30,70,0.5)';
      ctx.strokeStyle = 'rgba(180,150,255,0.09)';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 9; i++) {
        const s = stars[(i * 29) % Math.max(1, n)] || { x: 0, y: 0, z: 0.5 };
        const cx = wrap(s.x * 2.3 - px * 0.06, W + 320) - 160;
        const cy = wrap(s.y * 2.3 - py * 0.06, H + 320) - 160;
        const r = 26 + s.z * 74;
        polyPath(ctx, cx, cy, r, 3 + (i % 5), t * 0.05 * (i % 2 ? 1 : -1) + i);
        ctx.fill(); ctx.stroke();
      }
      break;
    }
    default: {
      drawFog(g, ctx, t, px, py, 3);
    }
  }

  /* ---- grid ---- */
  drawGrid(g, ctx, t, inGame);

  /* ---- ambient particle layer (per style) ---- */
  ctx.globalCompositeOperation = 'lighter';
  switch (th.style) {
    case 'dunes': {
      // embers rising
      for (let i = 0; i < n; i++) {
        const s = stars[i];
        const sx = wrap(s.x - px * 0.2 * s.z + Math.sin(t * 0.7 + i) * 14, W);
        const sy = wrap(s.y - t * (24 + s.z * 52) - py * 0.2 * s.z, H);
        ctx.globalAlpha = (0.25 + 0.55 * s.z) * (0.55 + 0.45 * Math.sin(t * 3 + i));
        ctx.fillStyle = th.mote;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.9 + s.z * 1.7, 0, 6.2832);
        ctx.fill();
      }
      break;
    }
    case 'bog': {
      // gas bubbles floating up
      ctx.lineWidth = 1.1;
      for (let i = 0; i < n; i++) {
        const s = stars[i];
        const r = 1.6 + s.z * 5.2;
        const sx = wrap(s.x - px * 0.18 * s.z + Math.sin(t * 0.9 + i * 1.7) * 11, W);
        const sy = wrap(s.y - t * (14 + s.z * 30) - py * 0.18 * s.z, H);
        ctx.globalAlpha = 0.14 + 0.3 * s.z;
        ctx.fillStyle = th.mote;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.28 + 0.34 * s.z;
        ctx.strokeStyle = th.mote;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.stroke();
      }
      break;
    }
    case 'ice': {
      // drifting snow
      for (let i = 0; i < n; i++) {
        const s = stars[i];
        const sx = wrap(s.x + t * (10 + s.z * 26) - px * 0.22 * s.z, W);
        const sy = wrap(s.y + t * (16 + s.z * 30) - py * 0.22 * s.z, H);
        ctx.globalAlpha = 0.25 + 0.5 * s.z;
        ctx.fillStyle = th.mote;
        ctx.beginPath(); ctx.arc(sx, sy, 0.8 + s.z * 1.6, 0, 6.2832); ctx.fill();
      }
      break;
    }
    case 'ruins': {
      // ash falling + scanlines
      for (let i = 0; i < n; i++) {
        const s = stars[i];
        const sx = wrap(s.x + Math.sin(t * 0.5 + i) * 18 - px * 0.2 * s.z, W);
        const sy = wrap(s.y + t * (18 + s.z * 34) - py * 0.2 * s.z, H);
        ctx.globalAlpha = 0.16 + 0.34 * s.z;
        ctx.fillStyle = th.mote;
        ctx.fillRect(sx, sy, 1.4 + s.z, 1.4 + s.z);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.045;
      ctx.fillStyle = '#ff2d55';
      for (let y = wrap(t * 26, 6); y < H; y += 6) ctx.fillRect(0, y, W, 1.5);
      ctx.globalCompositeOperation = 'lighter';
      break;
    }
    case 'hall': {
      // slow golden pollen
      for (let i = 0; i < n; i++) {
        const s = stars[i];
        const sx = wrap(s.x + Math.sin(t * 0.32 + i * 0.7) * 26 - px * 0.19 * s.z, W);
        const sy = wrap(s.y - t * (7 + s.z * 15) - py * 0.19 * s.z, H);
        ctx.globalAlpha = (0.2 + 0.5 * s.z) * (0.6 + 0.4 * Math.sin(t * 1.5 + i));
        ctx.fillStyle = th.mote;
        ctx.beginPath(); ctx.arc(sx, sy, 0.9 + s.z * 1.9, 0, 6.2832); ctx.fill();
      }
      break;
    }
    case 'void': {
      for (let i = 0; i < n; i += 2) {
        const s = stars[i];
        const sx = wrap(s.x - px * 0.1 * s.z, W);
        const sy = wrap(s.y - py * 0.1 * s.z, H);
        ctx.globalAlpha = 0.1 + 0.35 * s.z * (0.5 + 0.5 * Math.sin(t * 0.9 + i));
        ctx.fillStyle = th.star;
        ctx.fillRect(sx, sy, s.z * 1.5, s.z * 1.5);
      }
      break;
    }
    default: {
      // classic twinkling starfield
      ctx.fillStyle = th.star;
      for (let i = 0; i < n; i++) {
        const s = stars[i];
        const sx = wrap(s.x - px * 0.14 * s.z, W);
        const sy = wrap(s.y - py * 0.14 * s.z, H);
        ctx.globalAlpha = 0.15 + 0.5 * s.z * (0.6 + 0.4 * Math.sin(t * 1.6 + i));
        ctx.fillRect(sx, sy, s.z * 1.7, s.z * 1.7);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
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
  const lw = 3 / g.viewScale;
  ctx.strokeStyle = g.theme.edge;
  ctx.lineWidth = lw;
  ctx.setLineDash(g.theme.style === 'ruins' ? [34 / g.viewScale, 16 / g.viewScale] : []);
  ctx.strokeRect(0, 0, g.worldW, g.worldH);
  ctx.setLineDash([]);
  // inner accent rail
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = lw * 0.5;
  ctx.strokeStyle = g.theme.accent;
  const i = 9 / g.viewScale;
  ctx.strokeRect(i, i, g.worldW - i * 2, g.worldH - i * 2);
  ctx.globalAlpha = 1;
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
      ctx.globalAlpha = (e.enraged ? 0.65 : 0.4) + 0.15 * Math.sin(e.age * 5);
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 2;
      polyPath(ctx, e.x, e.y, e.r * 1.35, e.sides, -e.rot * 0.7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.def.motif) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.strokeStyle = e.def.color;
      ctx.fillStyle = hexA(e.def.color, 0.24);
      ctx.lineWidth = 2;
      const motif = e.def.motif;
      if (motif === 'shield') {
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, e.r + 9, e.rot - 1.12, e.rot + 1.12); ctx.stroke();
      } else if (motif === 'lance') {
        ctx.rotate(e.state > 0 ? e.ax : Math.atan2(g.py - e.y, g.px - e.x));
        for (let j = 0; j < 2; j++) {
          const x = -e.r - 5 - j * 7;
          ctx.beginPath(); ctx.moveTo(x - 4, -6); ctx.lineTo(x + 2, 0); ctx.lineTo(x - 4, 6); ctx.stroke();
        }
      } else if (motif === 'wings') {
        ctx.rotate(e.rot);
        for (const side of [-1, 1]) {
          polyPath(ctx, side * (e.r + 7), 0, 6, 3, side > 0 ? 0 : Math.PI); ctx.fill(); ctx.stroke();
        }
      } else if (motif === 'medic') {
        ctx.strokeStyle = '#ffd4e2'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(0, 0, e.r + 7, e.age, e.age + Math.PI * 1.5); ctx.stroke();
      } else if (motif === 'seeker' || motif === 'mortar') {
        ctx.rotate(e.rot);
        const rr = e.r + 6;
        for (let j = 0; j < 4; j++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath(); ctx.moveTo(rr - 2, 0); ctx.lineTo(rr + 6, 0); ctx.stroke();
        }
        if (motif === 'mortar') { ctx.beginPath(); ctx.arc(0, 0, e.r * 0.58, 0, Math.PI * 2); ctx.stroke(); }
      } else if (motif === 'prism' || motif === 'brood') {
        const count = motif === 'prism' ? 3 : 6;
        for (let j = 0; j < count; j++) {
          const a = e.age * 0.7 + j * Math.PI * 2 / count;
          const rr = e.r * 1.45;
          polyPath(ctx, Math.cos(a) * rr, Math.sin(a) * rr, motif === 'prism' ? 7 : 5, motif === 'prism' ? 4 : 3, a);
          ctx.fill(); ctx.stroke();
        }
      } else if (motif === 'maw') {
        ctx.rotate(e.state > 0 ? e.ax : e.rot);
        const open = e.state === 1 ? 10 : 3;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(-e.r * 0.4, side * (e.r + open));
          ctx.lineTo(e.r * 0.85, side * (e.r * 0.6 + open));
          ctx.lineTo(e.r * 0.65, side * (e.r * 0.2 + open));
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    // elemental status rings
    if (e.burn > 0) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(performance.now() / 80);
      ctx.strokeStyle = '#ff7a45';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.poison > 0) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (e.marked > 0) {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(e.x - e.r - 4, e.y); ctx.lineTo(e.x - e.r + 4, e.y);
      ctx.moveTo(e.x, e.y - e.r - 4); ctx.lineTo(e.x, e.y - e.r + 4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.voided > 0) {
      ctx.globalAlpha = Math.min(0.5, e.voided * 0.12);
      ctx.fillStyle = '#e879f9';
      polyPath(ctx, e.x, e.y, e.r * 0.5, e.sides, e.rot);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawEnemyTelegraphs(g: Game, ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (!e.active || e.state !== 1) continue;
    const p = Math.max(0, Math.min(1, 1 - e.windup / (e.atk === 'slam' ? 0.75 : 1.15)));
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
    } else if (e.atk === 'charge' || e.atk === 'siegeBoss') {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ax);
      ctx.globalAlpha = 0.06 + p * 0.12;
      ctx.fillStyle = e.def.color; ctx.fillRect(0, -e.r, e.ay, e.r * 2);
      ctx.globalAlpha = 0.45 + p * 0.4;
      ctx.strokeStyle = e.def.color; ctx.lineWidth = 2;
      ctx.setLineDash([9, 8]); ctx.strokeRect(0, -e.r, e.ay, e.r * 2); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(e.ay - 12, -10); ctx.lineTo(e.ay, 0); ctx.lineTo(e.ay - 12, 10); ctx.stroke();
      ctx.restore();
    } else if (e.atk === 'prismBoss') {
      const count = e.enraged ? 5 : 3;
      ctx.strokeStyle = e.def.color; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.35 + p * 0.5; ctx.setLineDash([12, 7]);
      for (let j = 0; j < count; j++) {
        const angle = e.ax + j * Math.PI * 2 / count;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(angle) * 900, e.y + Math.sin(angle) * 900); ctx.stroke();
      }
      ctx.setLineDash([]);
    } else if (e.atk === 'mend') {
      ctx.globalAlpha = 0.12 + p * 0.25;
      ctx.strokeStyle = '#ffb0ce'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, 230 * (0.3 + p * 0.7), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawHazards(g: Game, ctx: CanvasRenderingContext2D) {
  for (const h of g.hazards) {
    if (!h.active) continue;
    const progress = Math.max(0, Math.min(1, 1 - h.delay / h.windup));
    ctx.fillStyle = h.color; ctx.strokeStyle = h.color;
    ctx.globalAlpha = h.delay > 0 ? 0.06 + progress * 0.09 : h.life * 0.65;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.75; ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(h.x, h.y, Math.max(1, h.r * progress), 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h.x - 8, h.y); ctx.lineTo(h.x + 8, h.y); ctx.moveTo(h.x, h.y - 8); ctx.lineTo(h.x, h.y + 8); ctx.stroke();
  }
  ctx.globalAlpha = 1;
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
    if (b.kind === 1 || b.kind === 2) {
      polyPath(ctx, b.x, b.y, b.r * (b.kind === 2 ? 1.4 : 1), 3, b.kind === 2 ? Math.atan2(b.vy, b.vx) : b.rot);
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
    const col = h.color || '#8ef7ff';
    const lifeFade = (h.kind === 0 || h.kind === 9 || h.kind === 10 || h.kind === 11) && h.life < 4
      ? 0.35 + 0.65 * Math.abs(Math.sin(h.life * 8)) : 1;
    ctx.globalAlpha = lifeFade;

    // glow
    ctx.globalAlpha = 0.18 * lifeFade;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 2.1, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = lifeFade;

    if (h.kind === 0 || h.kind === 9) {
      // turret / sniper — diamond with barrel
      polyPath(ctx, h.x, h.y, h.r, 4, Math.PI / 4);
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x + Math.cos(h.rot) * h.r * (h.kind === 9 ? 2.2 : 1.7), h.y + Math.sin(h.rot) * h.r * (h.kind === 9 ? 2.2 : 1.7));
      ctx.stroke();
    } else if (h.kind === 10) {
      // flamethrower
      polyPath(ctx, h.x, h.y, h.r, 3, h.rot);
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = '#ffd6a5'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x + Math.cos(h.rot) * h.r * 1.8, h.y + Math.sin(h.rot) * h.r * 1.8);
      ctx.stroke();
    } else if (h.kind === 11) {
      // beacon aura
      ctx.globalAlpha = 0.12 * lifeFade;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, 160, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = lifeFade;
      polyPath(ctx, h.x, h.y, h.r, 6, h.rot);
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    } else if (h.kind === 2 || h.kind === 12 || h.kind === 13) {
      // companions
      const sides = h.kind === 12 ? 3 : h.kind === 13 ? 4 : 4;
      ctx.strokeStyle = col; ctx.lineWidth = 2.4;
      polyPath(ctx, h.x, h.y, h.r, sides, h.rot);
      ctx.stroke();
      ctx.fillStyle = hexA(col, 0.3);
      polyPath(ctx, h.x, h.y, h.r, sides, h.rot);
      ctx.fill();
    } else {
      // drones (triangle / diamond body)
      const sides = h.kind === 14 ? 4 : 3;
      ctx.fillStyle = col;
      polyPath(ctx, h.x, h.y, h.r, sides, h.rot + performance.now() / 400);
      ctx.fill();
      ctx.fillStyle = 'rgba(4,10,20,0.7)';
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.32, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** Cooperative partners: coloured shape + nameplate + HP ring. */
function drawPeers(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  if (!g.peers.length) return;
  for (const peer of g.peers) {
    const sh = SHAPES[peer.shape] || SHAPES.circle;
    const col = peer.color;
    const r = sh.size * 0.92;
    const blink = peer.invuln > 0 && Math.floor(peer.invuln * 18) % 2 === 0;

    // soft ground shadow ring so partners read as solid actors
    ctx.globalAlpha = peer.alive ? 0.22 : 0.08;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(peer.x, peer.y, r * 1.9, 0, 6.2832);
    ctx.fill();

    ctx.globalAlpha = blink ? 0.35 : peer.alive ? 1 : 0.22;
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = col;
    ctx.fillStyle = hexA(col, 0.26);
    polyPath(ctx, peer.x, peer.y, r, sh.sides, t * 0.7);
    ctx.fill();
    ctx.stroke();

    // revival halo
    if (peer.revived > 0) {
      const k = peer.revived / 3;
      ctx.globalAlpha = 0.5 * k;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(peer.x, peer.y, r + 14 + (1 - k) * 26, 0, 6.2832);
      ctx.stroke();
    }

    // nameplate + health
    ctx.globalAlpha = peer.alive ? 0.92 : 0.55;
    ctx.textAlign = 'center';
    ctx.font = `800 12px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(peer.name, peer.x + 1, peer.y - r - 16);
    ctx.fillStyle = col;
    ctx.fillText(peer.name, peer.x, peer.y - r - 17);

    const bw = 52, bh = 5, bx = peer.x - bw / 2, by = peer.y - r - 11;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = peer.alive ? (peer.hp / peer.maxHp > 0.35 ? col : '#ff6b6b') : 'rgba(255,255,255,0.2)';
    ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, peer.hp / peer.maxHp)), bh);

    if (!peer.alive) {
      ctx.globalAlpha = 0.85;
      ctx.font = `800 11px ${FONT}`;
      ctx.fillStyle = '#ff8fa3';
      ctx.fillText(tr(g.lang, 'spectating'), peer.x, peer.y + r + 18);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

function drawPlayer(g: Game, ctx: CanvasRenderingContext2D, t: number) {
  const sh = SHAPES[g.shapeId];
  const col = g.playerColor || sh.color;
  const acc = g.playerColor || sh.accent;
  // In co-op a dead player keeps drifting as a translucent spectator ghost.
  const ghost = Boolean(g.coop && g.hp <= 0);
  const inv = ghost || (g.invuln > 0 && Math.floor(g.invuln * 20) % 2 === 0);
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

  for (let wi = g.weapons.length - 1; wi >= 0; wi--) {
    const weapon = WEAPONS[g.weapons[wi]];
    if (weapon.kind === 'orbit') continue;
    const count = wi === 0 ? 1 + (g.stats?.barrels || 0) : 1;
    for (let i = count - 1; i >= 0; i--) {
      const mount = g.getWeaponMount(wi, i);
      ctx.strokeStyle = hexA(weapon.color, 0.4); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(g.px, g.py); ctx.lineTo(mount.x, mount.y); ctx.stroke();
      ctx.fillStyle = '#091421';
      ctx.beginPath(); ctx.arc(mount.x, mount.y, wi > 0 ? 4 : 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = weapon.color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mount.x, mount.y);
      ctx.lineTo(mount.x + Math.cos(mount.angle) * 9, mount.y + Math.sin(mount.angle) * 9);
      ctx.stroke();
    }
  }

  if (ghost) {
    ctx.globalAlpha = 0.75;
    ctx.textAlign = 'center';
    ctx.font = `800 12px ${FONT}`;
    ctx.fillStyle = '#ff8fa3';
    ctx.fillText(tr(g.lang, 'spectating'), g.px, g.py + r + 22);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

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

  const boss = g.enemies.find((e) => e.active && e.def.boss);
  if (boss) {
    const width = Math.min(360, W - 40), left = (W - width) / 2;
    ctx.textAlign = 'left'; ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = boss.def.color;
    ctx.fillText(enemyName(g.lang, boss.def.id, boss.def.name), left, 110, width * 0.72);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fbd9df';
    ctx.fillText(tr(g.lang, 'bossPhase', { n: boss.enraged ? 2 : 1 }), left + width, 110);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(left - 3, 116, width + 6, 9);
    ctx.fillStyle = boss.def.color; ctx.fillRect(left, 119, width * Math.max(0, boss.hp / boss.maxHp), 3);
  }

  // ---- score (top centre) ----
  ctx.textAlign = 'center';
  ctx.font = `800 34px ${MONO}`;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(fmt(g.score), W / 2 + 2, 44);
  ctx.fillStyle = '#eaf6ff';
  ctx.fillText(fmt(g.score), W / 2, 42);
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = 'rgba(160,200,240,0.75)';
  ctx.fillText(tr(g.lang, 'hud_score'), W / 2, 58);
  if (g.combo > 1) {
    const k = Math.min(1, g.comboT / (2.1 * (1 + (g.stats?.comboPow || 0) * 0.5)));
    ctx.font = `800 ${18 + Math.min(12, g.combo * 0.4)}px ${FONT}`;
    ctx.fillStyle = k > 0.35 ? '#ffe066' : '#ff9a3c';
    ctx.fillText(tr(g.lang, 'hud_combo', { n: g.combo }), W / 2, 80);
    ctx.fillStyle = 'rgba(255,224,102,0.35)';
    ctx.fillRect(W / 2 - 46, 86, 92 * k, 3);
  }

  // ---- top-left: wave + time ----
  ctx.textAlign = 'left';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = 'rgba(150,190,235,0.85)';
  ctx.fillText(tr(g.lang, 'hud_wave', { n: g.wave }), pad, pad + 14);
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = 'rgba(120,160,210,0.7)';
  ctx.fillText(`${fmtTime(g.elapsed)}   ${tr(g.lang, 'hud_lv', { n: g.level })}`, pad, pad + 32);

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
  ctx.fillStyle = g.playerColor || SHAPES[g.shapeId].color;
  ctx.fillText(shapeName(g.lang, g.shapeId, SHAPES[g.shapeId].name).toUpperCase() + '  ·  ' + g.weapons.map((w) => weaponName(g.lang, w, WEAPONS[w].name)).join(' + '), bx, by - 8);

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
    ctx.globalAlpha = 1;
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
    ctx.fillText(tr(g.lang, 'hint_dodge'), W / 2, H * 0.62);
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = 'rgba(140,180,220,0.6)';
    ctx.fillText(tr(g.lang, 'hint_controls'), W / 2, H * 0.62 + 20);
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
