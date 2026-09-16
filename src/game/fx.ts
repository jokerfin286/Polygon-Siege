/* Pooled particle / floaty-text / ring systems. Fixed-size arrays, zero GC churn. */

export interface Particle {
  active: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  size: number;
  color: string;
  drag: number;
  spin: number;
  rot: number;
  glow: boolean;
  sides: number;
}

export interface Ring {
  active: boolean;
  x: number; y: number;
  r: number; r2: number;
  life: number; max: number;
  w: number;
  color: string;
}

export interface Floater {
  active: boolean;
  x: number; y: number; vy: number;
  life: number; max: number;
  text: string;
  color: string;
  size: number;
}

export interface Beam {
  active: boolean;
  x1: number; y1: number; x2: number; y2: number;
  life: number; max: number;
  w: number; color: string;
}

export interface Flash {
  active: boolean;
  life: number; max: number;
  color: string;
  power: number;
}

const MAX_P = 1400;
const MAX_R = 90;
const MAX_F = 60;
const MAX_B = 40;

export class FX {
  parts: Particle[] = [];
  rings: Ring[] = [];
  floats: Floater[] = [];
  beams: Beam[] = [];
  flash: Flash = { active: false, life: 0, max: 1, color: '#fff', power: 0 };
  shake = 0;
  shakeX = 0;
  shakeY = 0;
  hitStop = 0;
  private pi = 0;
  private ri = 0;
  private fi = 0;
  private bi = 0;

  constructor() {
    for (let i = 0; i < MAX_P; i++)
      this.parts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', drag: 0.9, spin: 0, rot: 0, glow: false, sides: 0 });
    for (let i = 0; i < MAX_R; i++)
      this.rings.push({ active: false, x: 0, y: 0, r: 0, r2: 0, life: 0, max: 1, w: 2, color: '#fff' });
    for (let i = 0; i < MAX_F; i++)
      this.floats.push({ active: false, x: 0, y: 0, vy: 0, life: 0, max: 1, text: '', color: '#fff', size: 12 });
    for (let i = 0; i < MAX_B; i++)
      this.beams.push({ active: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0, max: 1, w: 2, color: '#fff' });
  }

  reset() {
    for (const p of this.parts) p.active = false;
    for (const r of this.rings) r.active = false;
    for (const f of this.floats) f.active = false;
    for (const b of this.beams) b.active = false;
    this.shake = 0; this.hitStop = 0; this.flash.active = false;
  }

  private nextP(): Particle {
    for (let i = 0; i < MAX_P; i++) {
      this.pi = (this.pi + 1) % MAX_P;
      if (!this.parts[this.pi].active) return this.parts[this.pi];
    }
    return this.parts[this.pi];
  }

  burst(x: number, y: number, n: number, color: string, opts?: {
    spd?: number; size?: number; life?: number; spread?: number; dir?: number; drag?: number; sides?: number; glow?: boolean;
  }) {
    const spd = opts?.spd ?? 200;
    const size = opts?.size ?? 3;
    const life = opts?.life ?? 0.45;
    const spread = opts?.spread ?? Math.PI * 2;
    const dir = opts?.dir ?? 0;
    const drag = opts?.drag ?? 0.90;
    for (let i = 0; i < n; i++) {
      const p = this.nextP();
      const a = dir + (Math.random() - 0.5) * spread;
      const s = spd * (0.35 + Math.random() * 0.9);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = p.life = life * (0.6 + Math.random() * 0.7);
      p.size = size * (0.5 + Math.random() * 0.9);
      p.color = color;
      p.drag = drag;
      p.rot = Math.random() * 6.28;
      p.spin = (Math.random() - 0.5) * 12;
      p.sides = opts?.sides ?? 0;
      p.glow = opts?.glow ?? false;
    }
  }

  ring(x: number, y: number, r: number, r2: number, life: number, w: number, color: string) {
    for (let i = 0; i < MAX_R; i++) {
      this.ri = (this.ri + 1) % MAX_R;
      const g = this.rings[this.ri];
      if (!g.active) {
        g.active = true; g.x = x; g.y = y; g.r = r; g.r2 = r2; g.max = g.life = life; g.w = w; g.color = color;
        return;
      }
    }
    const g = this.rings[this.ri];
    g.active = true; g.x = x; g.y = y; g.r = r; g.r2 = r2; g.max = g.life = life; g.w = w; g.color = color;
  }

  beam(x1: number, y1: number, x2: number, y2: number, w: number, color: string, life: number) {
    for (let i = 0; i < MAX_B; i++) {
      this.bi = (this.bi + 1) % MAX_B;
      const b = this.beams[this.bi];
      if (!b.active) {
        b.active = true; b.x1 = x1; b.y1 = y1; b.x2 = x2; b.y2 = y2; b.w = w; b.color = color; b.max = b.life = life;
        return;
      }
    }
  }

  text(x: number, y: number, text: string, color: string, size = 13) {
    for (let i = 0; i < MAX_F; i++) {
      this.fi = (this.fi + 1) % MAX_F;
      const f = this.floats[this.fi];
      if (!f.active) {
        f.active = true; f.x = x; f.y = y; f.vy = -46 - Math.random() * 22;
        f.max = f.life = 0.7; f.text = text; f.color = color; f.size = size;
        return;
      }
    }
  }

  doFlash(color: string, power: number, dur = 0.18) {
    this.flash.active = true;
    this.flash.color = color;
    this.flash.power = power;
    this.flash.max = this.flash.life = dur;
  }

  addShake(v: number) {
    this.shake = Math.min(34, this.shake + v);
  }

  update(dt: number) {
    // shake decay
    this.shake *= Math.pow(0.0016, dt);
    if (this.shake < 0.05) this.shake = 0;
    const s = this.shake;
    this.shakeX = (Math.random() - 0.5) * s * 2;
    this.shakeY = (Math.random() - 0.5) * s * 2;

    if (this.flash.active) {
      this.flash.life -= dt;
      if (this.flash.life <= 0) this.flash.active = false;
    }

    const ps = this.parts;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }

    const rs = this.rings;
    for (let i = 0; i < rs.length; i++) {
      const g = rs[i];
      if (!g.active) continue;
      g.life -= dt;
      if (g.life <= 0) { g.active = false; continue; }
      g.r += (g.r2 - g.r) * Math.min(1, dt * 9);
    }

    const bs = this.beams;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) b.active = false;
    }

    const fs = this.floats;
    for (let i = 0; i < fs.length; i++) {
      const f = fs[i];
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) { f.active = false; continue; }
      f.y += f.vy * dt;
      f.vy *= Math.pow(0.94, dt * 60);
    }
  }
}
