/* ============================================================
   Guest-side renderer. A guest has no local simulation; it draws
   the latest snapshot streamed by the host, interpolating entity
   positions between snapshots for smoothness.
   ============================================================ */

import { SHAPES, polyPath } from '../game/defs';
import { THEMES, type ThemeDef } from '../game/meta';
import type { Snapshot } from './net';

const wrap = (v: number, m: number) => ((v % m) + m) % m;

export class RemoteView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W = 800; H = 600; dpr = 1; viewScale = 1;
  camX = 0; camY = 0;
  mySlot = 0;
  private prev: Snapshot | null = null;
  private cur: Snapshot | null = null;
  private prevT = 0; private curT = 0;
  private stars: { x: number; y: number; z: number }[] = [];
  private t = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth));
    const h = Math.max(320, Math.round(rect.height || window.innerHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.W = w; this.H = h;
    this.viewScale = Math.max(0.6, Math.min(1, Math.min(w, h) / 900));
    this.stars = [];
    const n = Math.floor((w * h) / 8500);
    for (let i = 0; i < n; i++) this.stars.push({ x: Math.random() * w, y: Math.random() * h, z: 0.3 + Math.random() * 0.7 });
  }

  push(snap: Snapshot) {
    this.prev = this.cur; this.prevT = this.curT;
    this.cur = snap; this.curT = performance.now();
  }

  private theme(): ThemeDef {
    return THEMES.find((th) => th.id === this.cur?.theme) || THEMES[0];
  }

  render(dt: number) {
    this.t += dt;
    const ctx = this.ctx;
    const snap = this.cur;
    const th = this.theme();
    // camera follows my own mate (or centroid if I'm dead)
    if (snap) {
      const me = snap.mates.find((m) => m.slot === this.mySlot && m.alive)
        || snap.mates.find((m) => m.alive) || snap.mates[0];
      const viewW = this.W / this.viewScale, viewH = this.H / this.viewScale;
      const tx = clamp(me ? me.x - viewW / 2 : 0, 0, Math.max(0, snap.worldW - viewW));
      const ty = clamp(me ? me.y - viewH / 2 : 0, 0, Math.max(0, snap.worldH - viewH));
      this.camX += (tx - this.camX) * Math.min(1, dt * 9);
      this.camY += (ty - this.camY) * Math.min(1, dt * 9);
    }

    const shakeAmt = snap ? Math.min(20, snap.shake) : 0;
    const shx = (Math.random() - 0.5) * shakeAmt * 2;
    const shy = (Math.random() - 0.5) * shakeAmt * 2;

    // background
    ctx.setTransform(this.dpr, 0, 0, this.dpr, shx * this.dpr, shy * this.dpr);
    const gr = ctx.createRadialGradient(this.W / 2, this.H / 2, 40, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.82);
    gr.addColorStop(0, th.bg[0]); gr.addColorStop(0.55, th.bg[1]); gr.addColorStop(1, th.bg[2]);
    ctx.fillStyle = gr;
    ctx.fillRect(-40, -40, this.W + 80, this.H + 80);
    this.drawGrid(ctx, th);
    this.drawStars(ctx, th);

    if (!snap) { ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); return; }

    // world
    const s = this.viewScale * this.dpr;
    ctx.setTransform(s, 0, 0, s, (shx - this.camX * this.viewScale) * this.dpr, (shy - this.camY * this.viewScale) * this.dpr);

    // interpolation factor between prev and cur snapshot
    const span = Math.max(1, this.curT - this.prevT);
    const alpha = Math.min(1, (performance.now() - this.curT) / span + 0.5);

    // pickups
    ctx.globalCompositeOperation = 'lighter';
    for (const p of snap.pickups) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = p.heal ? '#8affc0' : '#5ef07a';
      const r = p.big ? 6 : 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // enemies
    for (const e of snap.enemies) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = e.c;
      polyPath(ctx, e.x, e.y, e.r * (e.kind ? 1.5 : 1.75), e.sides, e.rot);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = e.kind ? 4 : 2.2;
      ctx.strokeStyle = e.c;
      ctx.fillStyle = hexA(e.c, 0.2);
      polyPath(ctx, e.x, e.y, e.r, e.sides, e.rot);
      ctx.fill(); ctx.stroke();
    }

    // enemy bullets
    for (const b of snap.ebullets) {
      ctx.fillStyle = b.c;
      if (b.kind === 1 || b.kind === 2) { polyPath(ctx, b.x, b.y, b.r * (b.kind === 2 ? 1.4 : 1), 3, b.rot); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill(); }
    }

    // player projectiles
    for (const p of snap.projs) {
      ctx.globalAlpha = 0.25; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    }

    // mates
    const prevMates = new Map((this.prev?.mates || []).map((m) => [m.slot, m]));
    for (const m of snap.mates) {
      if (!m.alive) continue;
      const pm = prevMates.get(m.slot);
      const x = pm ? pm.x + (m.x - pm.x) * alpha : m.x;
      const y = pm ? pm.y + (m.y - pm.y) * alpha : m.y;
      const sh = SHAPES[m.shape] || SHAPES.circle;
      const r = sh.size;
      const mine = m.slot === this.mySlot;
      if (m.invuln) {
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 8);
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r + 12, 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 0.18; ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hexA(m.color, 0.28);
      ctx.strokeStyle = mine ? '#ffffff' : m.color;
      ctx.lineWidth = mine ? 3.5 : 3;
      polyPath(ctx, x, y, r, sh.sides, this.t * 0.7);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = m.color;
      polyPath(ctx, x, y, r * 0.42, sh.sides, -this.t);
      ctx.fill();
      // aim tick
      ctx.strokeStyle = hexA(m.color, 0.6); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(m.aim) * (r + 3), y + Math.sin(m.aim) * (r + 3));
      ctx.lineTo(x + Math.cos(m.aim) * (r + 14), y + Math.sin(m.aim) * (r + 14));
      ctx.stroke();
      // name + hp
      ctx.save();
      ctx.font = `700 ${Math.round(12 / this.viewScale)}px Rajdhani, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = mine ? '#ffffff' : m.color;
      ctx.fillText(mine ? m.name + ' (you)' : m.name, x, y - r - 14 / this.viewScale);
      ctx.restore();
      const bw = r * 2.4;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - bw / 2, y - r - 9, bw, 3.5);
      ctx.fillStyle = m.hp / m.maxHp > 0.3 ? '#5ef07a' : '#ff5a72';
      ctx.fillRect(x - bw / 2, y - r - 9, bw * Math.max(0, m.hp / m.maxHp), 3.5);
    }

    // arena edge
    ctx.strokeStyle = th.edge; ctx.lineWidth = 3 / this.viewScale;
    ctx.strokeRect(0, 0, snap.worldW, snap.worldH);

    // HUD
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawHud(ctx, snap);
    if (snap.flash) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.8, snap.flash.power);
      ctx.fillStyle = snap.flash.color;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D, snap: Snapshot) {
    ctx.textAlign = 'center';
    ctx.font = '800 30px "SF Mono", ui-monospace, monospace';
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText(snap.score.toLocaleString(), this.W / 2, 40);

    // boss bar
    if (snap.boss) {
      const width = Math.min(360, this.W - 40), left = (this.W - width) / 2;
      ctx.font = '700 12px Rajdhani, sans-serif';
      ctx.textAlign = 'left'; ctx.fillStyle = snap.boss.color;
      ctx.fillText(snap.boss.name, left, 92);
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(left - 3, 98, width + 6, 9);
      ctx.fillStyle = snap.boss.color;
      ctx.fillRect(left, 101, width * Math.max(0, snap.boss.hp / snap.boss.maxHp), 3);
    }

    // my stat card
    const me = snap.mates.find((m) => m.slot === this.mySlot);
    if (me) {
      const bw = Math.min(240, this.W * 0.42), bx = 14, by = this.H - 32;
      ctx.fillStyle = 'rgba(4,10,20,0.72)'; ctx.fillRect(bx - 3, by - 3, bw + 6, 21);
      const frac = Math.max(0, me.hp / me.maxHp);
      ctx.fillStyle = frac > 0.5 ? '#38f5e0' : frac > 0.25 ? '#ffd166' : '#ff4d6d';
      ctx.fillRect(bx, by, bw * frac, 15);
      ctx.font = '800 12px "SF Mono", monospace'; ctx.fillStyle = '#03121a'; ctx.textAlign = 'left';
      ctx.fillText(`${Math.ceil(me.hp)}/${Math.round(me.maxHp)}`, bx + 6, by + 11);
      ctx.font = '700 11px Rajdhani, sans-serif'; ctx.fillStyle = '#8ef7ff';
      ctx.fillText(`${me.name}  LV ${me.level}${me.alive ? '' : '  — SPECTATING'}`, bx, by - 8);
      // xp
      const xf = Math.min(1, me.xp / me.xpNeed);
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, this.H - 4, this.W, 4);
      ctx.fillStyle = '#7dfcd6'; ctx.fillRect(0, this.H - 4, this.W * xf, 4);
    }

    // banner
    if (snap.banner && snap.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, snap.bannerT * 2.2);
      ctx.textAlign = 'center'; ctx.font = '800 28px Rajdhani, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(snap.banner, this.W / 2, this.H * 0.28);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  private drawGrid(ctx: CanvasRenderingContext2D, th: ThemeDef) {
    if (th.gridKind === 'none') return;
    const step = 64 * this.viewScale;
    const ox = wrap(-this.camX * this.viewScale, step), oy = wrap(-this.camY * this.viewScale, step);
    ctx.lineWidth = 1; ctx.strokeStyle = th.grid;
    ctx.beginPath();
    for (let x = ox - step; x < this.W + step; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, this.H); }
    for (let y = oy - step; y < this.H + step; y += step) { ctx.moveTo(0, y); ctx.lineTo(this.W, y); }
    ctx.stroke();
  }

  private drawStars(ctx: CanvasRenderingContext2D, th: ThemeDef) {
    ctx.fillStyle = th.star;
    const px = this.camX * this.viewScale, py = this.camY * this.viewScale;
    for (let i = 0; i < this.stars.length; i++) {
      const st = this.stars[i];
      const sx = wrap(st.x - px * 0.14 * st.z, this.W);
      const sy = wrap(st.y - py * 0.14 * st.z, this.H);
      ctx.globalAlpha = 0.15 + 0.5 * st.z * (0.6 + 0.4 * Math.sin(this.t * 1.6 + i));
      ctx.fillRect(sx, sy, st.z * 1.7, st.z * 1.7);
    }
    ctx.globalAlpha = 1;
  }
}

function clamp(v: number, a: number, b: number) { return v < a ? a : v > b ? b : v; }
function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)},${a})`;
}
