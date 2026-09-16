import {
  SHAPES, WEAPONS, ENEMIES, UPGRADES, buildPool,
  type EnemyDef, type WeaponId, type UpgDef, type PoolEntry,
} from './defs';
import { FX } from './fx';
import { sfx } from './sfx';
import { saveScore, saveBest, type ScoreRow } from './storage';

export type Phase = 'menu' | 'playing' | 'paused' | 'levelup' | 'dead';

export interface Choice { key: string; def: UpgDef; level: number }

interface Enemy {
  active: boolean; id: number;
  x: number; y: number; vx: number; vy: number;
  r: number; sides: number; hp: number; maxHp: number;
  dmg: number; speed: number; xp: number; score: number;
  rot: number; spin: number; flash: number;
  atk: EnemyDef['atk']; atkT: number; windup: number; state: number;
  ax: number; ay: number;
  slow: number; frozen: number; scale: number; def: EnemyDef;
  hitCd: number; age: number;
}

interface Proj {
  active: boolean;
  x: number; y: number; vx: number; vy: number;
  r: number; dmg: number; pierce: number; life: number;
  kind: WeaponDef_kind; color: string; rot: number; spin: number;
  homing: number; aoe: number; crit: boolean;
  hits: number[]; bounced: number; split: number; trail: number;
}
type WeaponDef_kind = 'disc' | 'bullet' | 'orb' | 'ring' | 'shell' | 'missile';

interface EBullet {
  active: boolean;
  x: number; y: number; vx: number; vy: number;
  r: number; dmg: number; life: number; color: string; kind: number; rot: number;
}

interface Pickup { active: boolean; x: number; y: number; vx: number; vy: number; v: number; life: number; heal: boolean }

interface Orbital { active: boolean; angle: number; dist: number; r: number; dmg: number; color: string; kind: number; spin: number; x: number; y: number }

interface Helper { active: boolean; x: number; y: number; vx: number; vy: number; cd: number; life: number; dmg: number; kind: number; r: number; rot: number }

interface Mine { active: boolean; x: number; y: number; t: number; r: number; dmg: number; armed: number }

export interface PublicState {
  phase: Phase;
  score: number;
  best: number;
  level: number;
  kills: number;
  time: number;
  hp: number;
  maxHp: number;
  shapeId: string;
  weapons: WeaponId[];
  choices: Choice[];
  rerolls: number;
  wave: number;
  combo: number;
  owned: Record<string, number>;
  paused: boolean;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = x1 + t * dx, cy = y1 + t * dy;
  const ex = px - cx, ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  fx = new FX();
  W = 800; H = 600; dpr = 1;

  phase: Phase = 'menu';
  onState: (s: PublicState) => void;
  private stateT = 0;

  // player
  px = 0; py = 0; pvx = 0; pvy = 0;
  pr = 15; hp = 100; maxHp = 100;
  invuln = 0; shield = 0; shieldMax = 0; shieldT = 0;
  shapeId = 'circle';
  weapons: WeaponId[] = [];
  wcd: number[] = [];
  dashCd = 0; dashT = 0; dashDx = 0; dashDy = 0; hasDash = false;
  aimA = 0;

  // progression
  score = 0; level = 1; xp = 0; xpNeed = 8; kills = 0; elapsed = 0;
  combo = 0; comboT = 0; bestCombo = 0;
  mods: Record<string, number> = {};
  owned: Record<string, number> = {};
  pool: PoolEntry[] = buildPool();
  choices: Choice[] = []; rerolls = 0; pendingLevels = 0;
  stats: ReturnType<Game['computeStats']> | null = null;

  // entities
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  ebullets: EBullet[] = [];
  pickups: Pickup[] = [];
  orbitals: Orbital[] = [];
  helpers: Helper[] = [];
  mines: Mine[] = [];
  private eid = 1;
  private spawnT = 0; private bossT = 150; private bossCount = 0;
  private turretT = 0; private mineT = 0; private bombT = 0;
  wave = 1;

  // input
  keys = new Set<string>();
  touchActive = false; tOx = 0; tOy = 0; tX = 0; tY = 0;
  moveX = 0; moveY = 0;
  wantDash = false;
  timeScale = 1; slowT = 0;
  bannerText = ''; bannerT = 0;

  // background
  stars: { x: number; y: number; z: number }[] = [];

  constructor(canvas: HTMLCanvasElement, onState: (s: PublicState) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.onState = onState;
    for (let i = 0; i < 500; i++) this.projs.push({
      active: false, x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 1, pierce: 0, life: 0,
      kind: 'bullet', color: '#fff', rot: 0, spin: 0, homing: 0, aoe: 0, crit: false, hits: [], bounced: 0, split: 0, trail: 0,
    });
    for (let i = 0; i < 320; i++) this.ebullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 1, life: 0, color: '#f87171', kind: 0, rot: 0 });
    for (let i = 0; i < 130; i++) this.enemies.push(this.blankEnemy());
    for (let i = 0; i < 260; i++) this.pickups.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, v: 1, life: 0, heal: false });
    for (let i = 0; i < 26; i++) this.orbitals.push({ active: false, angle: 0, dist: 0, r: 10, dmg: 1, color: '#fff', kind: 0, spin: 0, x: 0, y: 0 });
    for (let i = 0; i < 30; i++) this.helpers.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, cd: 0, life: 0, dmg: 1, kind: 0, r: 8, rot: 0 });
    for (let i = 0; i < 30; i++) this.mines.push({ active: false, x: 0, y: 0, t: 0, r: 0, dmg: 0, armed: 0 });
    this.resize();
  }

  private blankEnemy(): Enemy {
    return {
      active: false, id: 0, x: 0, y: 0, vx: 0, vy: 0, r: 12, sides: 0, hp: 1, maxHp: 1,
      dmg: 1, speed: 50, xp: 1, score: 1, rot: 0, spin: 0, flash: 0,
      atk: 'melee', atkT: 1, windup: 0, state: 0, ax: 0, ay: 0, slow: 0, frozen: 0, scale: 1, hitCd: 0, age: 0,
      def: ENEMIES.ecircle,
    };
  }

  resize() {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth));
    const h = Math.max(320, Math.round(rect.height || window.innerHeight));
    if (this.W === w && this.H === h && this.canvas.width === Math.floor(w * this.dpr)) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.floor(w * this.dpr);
    c.height = Math.floor(h * this.dpr);
    this.W = w; this.H = h;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.stars = [];
    const n = Math.floor((w * h) / 9000);
    for (let i = 0; i < n; i++) this.stars.push({ x: Math.random() * w, y: Math.random() * h, z: rnd(0.3, 1) });
    this.px = clamp(this.px, 30, w - 30); this.py = clamp(this.py, 30, h - 30);
  }

  /* ------------------------------------------------ setup */

  reset() {
    this.fx.reset();
    for (const e of this.enemies) e.active = false;
    for (const p of this.projs) p.active = false;
    for (const b of this.ebullets) b.active = false;
    for (const p of this.pickups) p.active = false;
    for (const o of this.orbitals) o.active = false;
    for (const h of this.helpers) h.active = false;
    for (const m of this.mines) m.active = false;
    this.shapeId = 'circle';
    this.weapons = ['disc'];
    this.wcd = [0];
    this.mods = {};
    this.owned = {};
    this.px = this.W / 2; this.py = this.H / 2;
    this.pvx = this.pvy = 0;
    this.score = 0; this.level = 1; this.xp = 0; this.xpNeed = 8;
    this.kills = 0; this.elapsed = 0; this.combo = 0; this.comboT = 0; this.bestCombo = 0;
    this.spawnT = 0.5; this.bossT = 150; this.bossCount = 0; this.wave = 1;
    this.invuln = 1; this.dashCd = 0; this.dashT = 0; this.hasDash = false;
    this.pendingLevels = 0; this.choices = []; this.rerolls = 0;
    this.timeScale = 1; this.slowT = 0;
    this.turretT = 0; this.mineT = 0; this.bombT = 0;
    this.recompute();
    this.hp = this.maxHp;
    this.shield = this.shieldMax; this.shieldT = 0;
    this.phase = 'playing';
    this.banner('SURVIVE', 1.6);
    this.push();
  }

  banner(text: string, t: number) { this.bannerText = text; this.bannerT = t; }

  recompute() {
    this.stats = this.computeStats();
    const m = this.mods;
    const newMax = this.stats.maxHp;
    if (newMax > this.maxHp) this.hp += newMax - this.maxHp;
    this.maxHp = newMax;
    this.hp = Math.min(this.hp, this.maxHp);
    this.shieldMax = Math.floor(m.shieldmax || 0);
    if (this.shield > this.shieldMax) this.shield = this.shieldMax;
    this.rebuildOrbitals();
  }

  computeStats() {
    const m = this.mods;
    const sh = SHAPES[this.shapeId];
    const g = m.glass || 0;
    const extra = Math.max(0, this.weapons.length - 1);
    const syn = 1 + (m.wpower || 0) * extra;
    return {
      dmg: sh.dmg * (1 + (m.dmg || 0)) * syn * (1 + 0.35 * g),
      rate: sh.rate * (1 + (m.rate || 0)) * (1 + (m.haste || 0)),
      cdRed: Math.min(0.55, m.cd || 0),
      speed: sh.speed * (1 + (m.spd || 0)) * (1 + (m.haste || 0)),
      pspd: 1 + (m.pspd || 0),
      psize: 1 + (m.psize || 0),
      crit: 0.05 + (m.crit || 0),
      critd: 1.6 + (m.critd || 0),
      pickup: 265 * (1 + (m.pickup || 0)),
      xpMul: 1 + (m.xpm || 0),
      armor: m.armor || 0,
      regen: m.regen || 0,
      pierce: m.pierce || 0,
      multi: m.multi || 0,
      knock: 1 + (m.knock || 0),
      thorns: m.thorns || 0,
      leech: m.leech || 0,
      scoreMul: 1 + (m.score || 0),
      life: 1 + (m.lifespan || 0),
      aoe: 1 + (m.aoe || 0),
      homing: m.homing || 0,
      ricochet: m.ricochet || 0,
      explode: m.explode || 0,
      chainhit: m.chainhit || 0,
      exec: m.exec || 0,
      giant: m.giant || 0,
      swarm: m.swarm || 0,
      deathbomb: m.deathbomb || 0,
      bloom: m.bloom || 0,
      freeze: m.freeze || 0,
      slowfield: m.slowfield || 0,
      bombs: m.bombdrop || 0,
      mines: m.mine || 0,
      turret: m.turret || 0,
      drones: m.drone || 0,
      droneDmg: 1 + (m.droneDmg || 0),
      droneRate: 1 + (m.droneRate || 0),
      orbit: m.orbit || 0,
      orbitSpd: 1 + (m.shieldorbs || 0),
      orbitDmg: 1 + (m.shieldorbs || 0),
      companion: m.companion || 0,
      companionDmg: 1 + (m.companionDmg || 0),
      regenkill: m.regenkill || 0,
      timewarp: m.timewarp || 0,
      xpwave: m.xpwave || 0,
      comboPow: m.combo || 0,
      lucky: m.lucky || 0,
      wslot: 1 + (m.wslot || 0),
      aux: m.aux || 0,
      secondwind: m.secondwind || 0,
      dashCdMul: 1 - Math.min(0.6, m.dashcd || 0),
      shieldReg: 1 - Math.min(0.7, m.shieldreg || 0),
      maxHp: Math.round(sh.hp * (1 - 0.12 * g)) + (m.hp || 0),
      synergy: syn,
    };
  }

  /* ------------------------------------------------ upgrades */

  private defLevels(): Record<string, number> {
    return this.owned;
  }

  availableChoices(): Choice[] {
    const lv = this.defLevels();
    const out: Choice[] = [];
    for (const p of this.pool) {
      const d = p.def;
      if ((lv[d.id] || 0) !== p.level - 1) continue;
      if (d.req && !lv[d.req]) continue;
      if (d.kind === 'weapon' && d.weapon) {
        if (this.weapons.includes(d.weapon)) continue;
        if (this.weapons.length >= this.stats!.wslot) continue;
      }
      out.push(p);
    }
    return out;
  }

  rollChoices() {
    const avail = this.availableChoices();
    const lucky = this.stats?.lucky || 0;
    const wgt = [100, 58, 26 * (1 + 0.4 * lucky), 9 * (1 + 0.6 * lucky)];
    const picked: Choice[] = [];
    const bag = avail.slice();
    const n = Math.min(3, bag.length);
    for (let i = 0; i < n; i++) {
      let total = 0;
      for (const b of bag) total += wgt[b.def.rarity];
      let r = Math.random() * total;
      let idx = 0;
      for (let j = 0; j < bag.length; j++) {
        r -= wgt[bag[j].def.rarity];
        if (r <= 0) { idx = j; break; }
      }
      const c = bag.splice(idx, 1)[0];
      picked.push({ key: c.key, def: c.def, level: c.level });
    }
    // guarantee at least one pick if anything exists
    if (picked.length === 0) {
      picked.push({ key: 'hp:1', def: UPGRADES.find((u) => u.id === 'hp')!, level: 1 });
    }
    this.choices = picked;
    this.rerolls = lucky;
  }

  reroll() {
    if (this.rerolls <= 0) return;
    this.rerolls--;
    this.rollChoices();
    sfx.select();
    this.push();
  }

  pick(key: string) {
    const c = this.choices.find((x) => x.key === key);
    if (!c) return;
    this.applyUpgrade(c.def);
    this.choices = [];
    sfx.buy();
    if (this.pendingLevels > 0 && this.availableChoices().length > 0) {
      this.pendingLevels--;
      this.rollChoices();
      this.phase = 'levelup';
      this.push();
    } else {
      this.pendingLevels = 0;
      this.phase = 'playing';
      this.push();
    }
  }

  applyUpgrade(d: UpgDef) {
    this.owned[d.id] = (this.owned[d.id] || 0) + 1;
    if (d.kind === 'stat' && d.stat) {
      this.mods[d.stat] = (this.mods[d.stat] || 0) + (d.per || 0);
      if (d.stat === 'hp') this.recompute();
    } else if (d.kind === 'weapon' && d.weapon) {
      this.weapons.push(d.weapon);
      this.wcd.push(0);
    } else if (d.kind === 'shape' && d.shape) {
      this.shapeId = d.shape;
      const sh = SHAPES[d.shape];
      if (!this.weapons.includes(sh.weapon)) {
        if (this.weapons.length < this.stats!.wslot) {
          this.weapons.push(sh.weapon);
          this.wcd.push(0);
        } else {
          this.weapons[0] = sh.weapon;
          this.wcd[0] = 0;
        }
      }
      this.fx.burst(this.px, this.py, 40, sh.color, { spd: 320, size: 4, life: 0.7 });
      this.fx.ring(this.px, this.py, 10, 130, 0.5, 6, sh.color);
      this.fx.addShake(10);
      this.banner(sh.name.toUpperCase() + ' CORE', 1.4);
    } else if (d.kind === 'special' && d.id === 'dash') {
      this.hasDash = true;
    }
    this.recompute();
  }

  /* ------------------------------------------------ loop */

  frame(dtRaw: number) {
    const dt = Math.min(0.05, dtRaw);
    if (this.phase === 'playing') {
      let ts = 1;
      if (this.slowT > 0) { ts = 0.35; this.slowT -= dt; }
      if (this.stats?.timewarp && this.hp < this.maxHp * 0.3) ts = Math.min(ts, 0.55);
      this.timeScale += (ts - this.timeScale) * Math.min(1, dt * 12);
      const sdt = dt * this.timeScale;
      if (this.fx.hitStop > 0) { this.fx.hitStop -= dt; }
      else this.update(sdt);
      this.fx.update(dt);
      this.stateT += dt;
      if (this.stateT > 0.2) { this.stateT = 0; this.push(); }
    } else {
      this.fx.update(dt * 0.35);
      if (this.phase === 'dead' || this.phase === 'menu') {
        // keep world simmering for visual interest
      }
    }
  }

  private update(dt: number) {
    this.elapsed += dt;
    const newWave = Math.floor(this.elapsed / 30) + 1;
    if (newWave !== this.wave) {
      this.wave = newWave;
      this.banner('WAVE ' + this.wave, 1.3);
      sfx.buy();
    }
    if (this.bannerT > 0) this.bannerT -= dt;

    this.updatePlayer(dt);
    this.spawnDirector(dt);
    this.updateEnemies(dt);
    this.updateProjs(dt);
    this.updateEBullets(dt);
    this.updatePickups(dt);
    this.updateOrbitals(dt);
    this.updateHelpers(dt);
    this.updateMines(dt);
    this.updateWeapons(dt);

    // combo decay
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) { this.combo = 0; }
    }
    if (this.stats!.regen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.stats!.regen * dt);
    }
    if (this.shield < this.shieldMax) {
      this.shieldT += dt;
      const need = 9 * this.stats!.shieldReg;
      if (this.shieldT > need) { this.shield++; this.shieldT = 0; this.fx.ring(this.px, this.py, 20, 44, 0.3, 3, '#7dd3fc'); }
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.dashT > 0) this.dashT -= dt;
  }

  /* ------------------------------------------------ player */

  private updatePlayer(dt: number) {
    const st = this.stats!;
    let ix = 0, iy = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) ix -= 1;
    if (k.has('d') || k.has('arrowright')) ix += 1;
    if (k.has('w') || k.has('arrowup')) iy -= 1;
    if (k.has('s') || k.has('arrowdown')) iy += 1;
    if (this.touchActive) {
      const dx = this.tX - this.tOx, dy = this.tY - this.tOy;
      const d = Math.hypot(dx, dy);
      if (d > 6) { const m = Math.min(1, d / 62); ix = (dx / d) * m; iy = (dy / d) * m; }
    }
    const mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; }
    this.moveX = ix; this.moveY = iy;

    const accel = 2600;
    const targetVx = ix * st.speed, targetVy = iy * st.speed;
    if (this.dashT > 0) {
      const ds = st.speed * 3.1;
      this.pvx = this.dashDx * ds; this.pvy = this.dashDy * ds;
      if (Math.random() < 0.9) {
        this.fx.burst(this.px, this.py, 2, SHAPES[this.shapeId].accent, { spd: 90, size: 3.4, life: 0.3, drag: 0.86 });
      }
    } else {
      this.pvx += (targetVx - this.pvx) * Math.min(1, (accel / st.speed) * dt * 0.6);
      this.pvy += (targetVy - this.pvy) * Math.min(1, (accel / st.speed) * dt * 0.6);
    }
    this.px += this.pvx * dt;
    this.py += this.pvy * dt;

    const pad = this.pr + 4;
    if (this.px < pad) { this.px = pad; this.pvx *= -0.35; }
    if (this.px > this.W - pad) { this.px = this.W - pad; this.pvx *= -0.35; }
    if (this.py < pad) { this.py = pad; this.pvy *= -0.35; }
    if (this.py > this.H - pad) { this.py = this.H - pad; this.pvy *= -0.35; }

    if (this.wantDash) {
      this.wantDash = false;
      if (this.hasDash && this.dashCd <= 0 && this.phase === 'playing') {
        let dx = this.moveX, dy = this.moveY;
        if (Math.hypot(dx, dy) < 0.1) { dx = Math.cos(this.aimA); dy = Math.sin(this.aimA); }
        const l = Math.hypot(dx, dy) || 1;
        this.dashDx = dx / l; this.dashDy = dy / l;
        this.dashT = 0.15; this.dashCd = 1.5 * st.dashCdMul;
        this.invuln = Math.max(this.invuln, 0.28);
        this.fx.ring(this.px, this.py, 8, 62, 0.28, 4, SHAPES[this.shapeId].color);
        this.fx.burst(this.px, this.py, 16, '#ffffff', { spd: 300, size: 3, life: 0.32 });
        this.fx.addShake(3);
        sfx.dash();
      }
    }

    // aim
    const tgt = this.nearestEnemy(this.px, this.py, 2400);
    if (tgt) this.aimA = Math.atan2(tgt.y - this.py, tgt.x - this.px);
    else if (mag > 0.1) this.aimA = Math.atan2(iy, ix);

    // mines trail
    if (st.mines > 0) {
      this.mineT -= dt;
      const moving = Math.hypot(this.pvx, this.pvy) > 40;
      if (this.mineT <= 0 && moving) {
        this.mineT = 0.7;
        this.dropMine(this.px, this.py);
      }
    }
    if (st.bombs > 0) {
      this.bombT -= dt;
      if (this.bombT <= 0) {
        this.bombT = 3.4 - st.bombs * 0.5;
        for (let i = 0; i < st.bombs; i++) {
          const a = (i / st.bombs) * Math.PI * 2 + this.elapsed;
          this.dropMine(this.px + Math.cos(a) * 46, this.py + Math.sin(a) * 46, 0.5);
        }
      }
    }
    if (st.turret > 0) {
      this.turretT -= dt;
      if (this.turretT <= 0) {
        this.turretT = 26;
        for (let i = 0; i < st.turret; i++) {
          const h = this.freeHelper();
          if (!h) break;
          const a = Math.random() * 6.28;
          h.active = true; h.kind = 0; h.r = 13;
          h.x = clamp(this.px + Math.cos(a) * 60, 20, this.W - 20);
          h.y = clamp(this.py + Math.sin(a) * 60, 20, this.H - 20);
          h.cd = 0; h.life = 26; h.dmg = 9 * st.droneDmg; h.rot = 0;
          this.fx.ring(h.x, h.y, 4, 30, 0.4, 3, '#fbbf24');
        }
      }
    }
  }

  tryDash() { this.wantDash = true; }

  private hurtPlayer(dmg: number, sx: number, sy: number) {
    if (this.invuln > 0 || this.phase !== 'playing') return;
    const st = this.stats!;
    let d = Math.max(1, dmg - st.armor);
    if (this.shield > 0) {
      this.shield--;
      this.shieldT = 0;
      d = 0;
      this.fx.ring(this.px, this.py, 26, 70, 0.35, 5, '#7dd3fc');
      this.fx.burst(this.px, this.py, 14, '#7dd3fc', { spd: 240, size: 3 });
      this.invuln = 0.6;
      this.fx.addShake(6);
      sfx.hit();
      this.push();
      return;
    }
    this.hp -= d;
    this.invuln = 0.62;
    this.combo = 0; this.comboT = 0;
    this.fx.addShake(9 + Math.min(10, d * 0.25));
    this.fx.doFlash('#ff3b5c', 0.36, 0.16);
    this.fx.hitStop = 0.055;
    this.fx.burst(this.px, this.py, 18, '#ff5a72', { spd: 260, size: 3.6 });
    this.fx.text(this.px, this.py - 26, '-' + Math.round(d), '#ff6b81', 16);
    const a = Math.atan2(this.py - sy, this.px - sx);
    this.pvx += Math.cos(a) * 190; this.pvy += Math.sin(a) * 190;
    sfx.hurt();
    if (this.hp <= 0) {
      if (st.secondwind > 0) {
        this.mods.secondwind = 0;
        this.recompute();
        this.hp = this.maxHp * 0.5;
        this.invuln = 2.2;
        this.fx.doFlash('#ffffff', 0.8, 0.5);
        this.fx.ring(this.px, this.py, 10, 300, 0.7, 8, '#ffffff');
        this.fx.addShake(22);
        this.banner('SECOND WIND!', 1.6);
        for (const e of this.enemies) {
          if (!e.active) continue;
          const dd = Math.hypot(e.x - this.px, e.y - this.py);
          if (dd < 260) this.damageEnemy(e, 300, false, 0, 0);
        }
      } else {
        this.die();
      }
    }
    this.push();
  }

  private die() {
    this.hp = 0;
    this.phase = 'dead';
    this.fx.doFlash('#ffffff', 0.9, 0.5);
    this.fx.addShake(30);
    this.fx.burst(this.px, this.py, 90, SHAPES[this.shapeId].color, { spd: 520, size: 5, life: 1.1 });
    this.fx.ring(this.px, this.py, 10, 380, 0.9, 9, SHAPES[this.shapeId].color);
    sfx.dead();
    const row: ScoreRow = {
      name: 'YOU', score: Math.floor(this.score), level: this.level, time: this.elapsed,
      shape: SHAPES[this.shapeId].name, kills: this.kills, date: Date.now(),
    };
    saveScore(row);
    if (Math.floor(this.score) > getBestCache()) { setBestCache(Math.floor(this.score)); saveBest(Math.floor(this.score)); }
    this.push();
  }

  /* ------------------------------------------------ weapons */

  private nearestEnemy(x: number, y: number, max: number, skip?: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = max * max;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active || e.id === skip) continue;
      const dx = e.x - x, dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private cooldownFor(base: number) {
    return base / this.stats!.rate * (1 - this.stats!.cdRed);
  }

  private updateWeapons(dt: number) {
    const st = this.stats!;
    const nFire = st.aux > 0 ? this.weapons.length : 1;
    for (let wi = 0; wi < Math.min(nFire, this.weapons.length); wi++) {
      const w = WEAPONS[this.weapons[wi]];
      if (w.kind === 'orbit') continue; // handled by orbitals
      this.wcd[wi] -= dt;
      if (this.wcd[wi] > 0) continue;
      this.wcd[wi] = this.cooldownFor(w.cd);
      this.fireWeapon(w, wi);
    }
  }

  private fireWeapon(w: typeof WEAPONS[WeaponId], wi: number) {
    const st = this.stats!;
    const dmgBase = w.dmg * st.dmg;
    const count = w.count + (w.kind === 'beam' || w.kind === 'chain' || w.kind === 'nova' || w.kind === 'orbit' ? 0 : st.multi);
    const spread = w.spread;
    let fired = false;

    if (w.kind === 'beam') {
      const range = Math.max(this.W, this.H) * 1.3;
      const a = this.aimA;
      const x2 = this.px + Math.cos(a) * range, y2 = this.py + Math.sin(a) * range;
      const bw = w.radius * st.psize;
      this.fx.beam(this.px, this.py, x2, y2, bw, w.color, 0.16);
      this.fx.burst(this.px, this.py, 5, w.color, { spd: 150, size: 3, life: 0.25, dir: a, spread: 0.9 });
      this.fx.addShake(w.id === 'rail' ? 7 : 3);
      for (const e of this.enemies) {
        if (!e.active) continue;
        if (segDist(e.x, e.y, this.px, this.py, x2, y2) < e.r + bw) {
          this.damageEnemy(e, dmgBase, Math.random() < st.crit, Math.cos(a) * 40 * st.knock, Math.sin(a) * 40 * st.knock);
        }
      }
      sfx.shoot(w.id === 'rail' ? 'beam' : 'beam');
      fired = true;
    } else if (w.kind === 'chain') {
      let src = this.nearestEnemy(this.px, this.py, 420);
      if (!src) return;
      let fx = this.px, fy = this.py;
      let lastId = 0;
      const jumps = w.count + Math.floor(st.multi * 0.5);
      for (let j = 0; j < jumps; j++) {
        const t = this.nearestEnemy(fx, fy, 260, lastId);
        if (!t) break;
        this.fx.beam(fx, fy, t.x, t.y, 3.4, w.color, 0.2);
        this.fx.burst(t.x, t.y, 5, w.color, { spd: 130, size: 2.6, life: 0.3 });
        this.damageEnemy(t, dmgBase * (1 - j * 0.12), Math.random() < st.crit, 0, 0);
        fx = t.x; fy = t.y; lastId = t.id;
      }
      sfx.shoot('arc');
      fired = true;
    } else if (w.kind === 'nova') {
      const R = w.radius * st.aoe;
      this.fx.ring(this.px, this.py, 12, R, 0.42, 7, w.color);
      this.fx.burst(this.px, this.py, 22, w.color, { spd: R * 2.4, size: 3.4, life: 0.4, drag: 0.86 });
      this.fx.addShake(5);
      for (const e of this.enemies) {
        if (!e.active) continue;
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < R + e.r) {
          const a = Math.atan2(e.y - this.py, e.x - this.px);
          this.damageEnemy(e, dmgBase, Math.random() < st.crit, Math.cos(a) * 320 * st.knock, Math.sin(a) * 320 * st.knock);
        }
      }
      sfx.shoot('nova');
      fired = true;
    } else {
      const baseA = this.aimA;
      for (let i = 0; i < count; i++) {
        let a: number;
        if (w.kind === 'ring') {
          a = baseA + (i / count) * Math.PI * 2;
        } else if (count === 1) {
          a = baseA + rnd(-spread, spread) * 0.5;
        } else {
          const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
          a = baseA + t * spread * 2 + rnd(-0.03, 0.03);
        }
        const sp = w.speed * st.pspd;
        const p = this.freeProj();
        if (!p) break;
        p.active = true;
        p.x = this.px + Math.cos(a) * (this.pr + 6);
        p.y = this.py + Math.sin(a) * (this.pr + 6);
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        p.r = w.radius * st.psize;
        p.dmg = dmgBase;
        p.pierce = w.pierce === 99 ? 999 : w.pierce + st.pierce;
        p.life = (w.id === 'disc' ? 1.5 : w.id === 'orb' ? 2.2 : 1.15) * st.life;
        p.kind = w.kind as Proj['kind'];
        p.color = w.color;
        p.rot = a; p.spin = w.kind === 'disc' ? 22 : 6;
        p.homing = w.kind === 'orb' ? 4.2 + st.homing : st.homing * 1.6;
        p.aoe = (w.aoe || 0) * st.aoe;
        p.crit = Math.random() < st.crit;
        if (p.crit) p.dmg *= st.critd;
        p.hits.length = 0; p.bounced = st.ricochet; p.split = st.bloom;
        p.trail = 0;
      }
      // muzzle
      this.fx.burst(this.px + Math.cos(baseA) * this.pr, this.py + Math.sin(baseA) * this.pr,
        w.id === 'shell' ? 10 : 3, w.color, { spd: 150, size: 2.4, life: 0.18, dir: baseA, spread: 0.7, drag: 0.82 });
      this.fx.addShake(w.id === 'shell' ? 5 : w.id === 'bullet' ? 0.5 : 1.2);
      sfx.shoot(w.id);
      fired = true;
    }
    if (fired && wi > 0) { /* aux weapon fired */ }
  }

  private freeProj(): Proj | null {
    for (let i = 0; i < this.projs.length; i++) if (!this.projs[i].active) return this.projs[i];
    return null;
  }
  private freeEB(): EBullet | null {
    for (let i = 0; i < this.ebullets.length; i++) if (!this.ebullets[i].active) return this.ebullets[i];
    return null;
  }
  private freeHelper() {
    for (const h of this.helpers) if (!h.active) return h;
    return null;
  }
  private freeMine() {
    for (const m of this.mines) if (!m.active) return m;
    return null;
  }

  /* ------------------------------------------------ projectiles */

  private updateProjs(dt: number) {
    const st = this.stats!;
    for (let i = 0; i < this.projs.length; i++) {
      const p = this.projs[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.homing > 0) {
        const t = this.nearestEnemy(p.x, p.y, 420);
        if (t) {
          const want = Math.atan2(t.y - p.y, t.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const na = cur + clamp(d, -p.homing * dt, p.homing * dt);
          const sp = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;

      if (p.trail > 0) p.trail -= dt;
      else {
        p.trail = 0.03;
        if (p.kind === 'orb' || p.kind === 'missile' || p.kind === 'shell') {
          this.fx.burst(p.x, p.y, 1, p.color, { spd: 26, size: p.r * 0.7, life: 0.28, drag: 0.85 });
        }
      }

      let dead = p.life <= 0;
      const off = p.x < -60 || p.x > this.W + 60 || p.y < -60 || p.y > this.H + 60;
      if (off) dead = true;

      if (!dead) {
        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j];
          if (!e.active || p.hits.indexOf(e.id) >= 0) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          const rr = e.r + p.r;
          if (dx * dx + dy * dy <= rr * rr) {
            const a = Math.atan2(dy, dx);
            this.damageEnemy(e, p.dmg, p.crit, Math.cos(a) * 120 * st.knock, Math.sin(a) * 120 * st.knock);
            p.hits.push(e.id);
            this.fx.burst(p.x, p.y, 4, p.color, { spd: 190, size: 2.6, life: 0.24, dir: a + Math.PI, spread: 1.6 });
            if (p.aoe > 0) { this.explode(p.x, p.y, p.aoe, p.dmg * 0.85, p.color); dead = true; break; }
            if (p.pierce > 0) { p.pierce--; }
            else { dead = true; break; }
          }
        }
      }

      if (dead) {
        if (p.aoe > 0 && p.life <= 0) this.explode(p.x, p.y, p.aoe, p.dmg * 0.85, p.color);
        if (p.split > 0 && !off) {
          p.split--;
          for (let k = 0; k < 4; k++) {
            const np = this.freeProj();
            if (!np) break;
            const a = (k / 4) * Math.PI * 2 + Math.random();
            np.active = true;
            np.x = p.x; np.y = p.y;
            np.vx = Math.cos(a) * 300; np.vy = Math.sin(a) * 300;
            np.r = Math.max(3, p.r * 0.55); np.dmg = p.dmg * 0.5;
            np.pierce = 0; np.life = 0.4; np.kind = 'bullet'; np.color = p.color;
            np.rot = a; np.spin = 10; np.homing = st.homing; np.aoe = 0; np.crit = false;
            np.hits.length = 0; np.bounced = 0; np.split = 0; np.trail = 0;
          }
        }
        if (p.bounced > 0 && !off) {
          const t = this.nearestEnemy(p.x, p.y, 340, p.hits[p.hits.length - 1]);
          if (t) {
            p.bounced--;
            const a = Math.atan2(t.y - p.y, t.x - p.x);
            const sp = Math.hypot(p.vx, p.vy);
            p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
            p.hits.length = 0;
            p.life = Math.max(p.life, 0.6);
            dead = false;
          }
        }
        if (dead) p.active = false;
      }
    }
  }

  private explode(x: number, y: number, r: number, dmg: number, color: string) {
    this.fx.ring(x, y, r * 0.2, r, 0.3, 6, color);
    this.fx.burst(x, y, 16, color, { spd: r * 3.4, size: 3.4, life: 0.4, drag: 0.84 });
    this.fx.addShake(4);
    sfx.explode();
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = e.x - x, dy = e.y - y;
      const d = Math.hypot(dx, dy);
      if (d < r + e.r) {
        const a = Math.atan2(dy, dx);
        this.damageEnemy(e, dmg, false, Math.cos(a) * 200, Math.sin(a) * 200);
      }
    }
  }

  /* ------------------------------------------------ enemies */

  private updateEBullets(dt: number) {
    for (let i = 0; i < this.ebullets.length; i++) {
      const b = this.ebullets[i];
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.rot += dt * 6;
      if (b.life <= 0 || b.x < -40 || b.x > this.W + 40 || b.y < -40 || b.y > this.H + 40) { b.active = false; continue; }
      const dx = this.px - b.x, dy = this.py - b.y;
      const rr = this.pr + b.r;
      if (dx * dx + dy * dy <= rr * rr) {
        b.active = false;
        this.hurtPlayer(b.dmg, b.x, b.y);
        this.fx.burst(b.x, b.y, 6, b.color, { spd: 180, size: 2.6, life: 0.25 });
      }
    }
  }

  private eShoot(x: number, y: number, a: number, sp: number, dmg: number, r: number, color: string, kind = 0) {
    const b = this.freeEB();
    if (!b) return;
    b.active = true;
    b.x = x; b.y = y;
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
    b.dmg = dmg; b.r = r; b.color = color; b.kind = kind; b.rot = a;
    b.life = 5;
  }

  private updateEnemies(dt: number) {
    const st = this.stats!;
    const slowField = st.slowfield;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active) continue;
      if (e.frozen > 0) { e.frozen -= dt; }
      const slowed = (slowField > 0 && Math.hypot(e.x - this.px, e.y - this.py) < 165) ? 1 - slowField : 1;
      const spd = e.speed * slowed * (e.frozen > 0 ? 0.12 : 1);
      const dx = this.px - e.x, dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      e.rot += e.spin * dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.hitCd > 0) e.hitCd -= dt;
      e.atkT -= dt;

      switch (e.atk) {
        case 'melee': {
          e.vx += (ux * spd - e.vx) * Math.min(1, dt * 5);
          e.vy += (uy * spd - e.vy) * Math.min(1, dt * 5);
          break;
        }
        case 'bullets': {
          const want = 240;
          const dir = dist > want + 40 ? 1 : dist < want - 40 ? -1 : 0;
          e.vx += (ux * spd * dir - e.vx) * Math.min(1, dt * 3);
          e.vy += (uy * spd * dir - e.vy) * Math.min(1, dt * 3);
          e.vx += -uy * spd * 0.45 * dt * 3; e.vy += ux * spd * 0.45 * dt * 3;
          if (e.atkT <= 0 && dist < 520) {
            e.atkT = e.def.atkCd;
            const a0 = Math.atan2(dy, dx);
            for (let s = -1; s <= 1; s++) this.eShoot(e.x, e.y, a0 + s * 0.19, 240, e.dmg * 0.55, 5.5, e.def.color);
            this.fx.burst(e.x, e.y, 4, e.def.color, { spd: 120, size: 2.4, life: 0.22 });
          }
          break;
        }
        case 'laser': {
          const want = 300;
          const dir = dist > want ? 1 : -0.4;
          e.vx += (ux * spd * dir - e.vx) * Math.min(1, dt * 3);
          e.vy += (uy * spd * dir - e.vy) * Math.min(1, dt * 3);
          if (e.state === 0) {
            if (e.atkT <= 0 && dist < 560) { e.state = 1; e.windup = 0.62; e.ax = ux; e.ay = uy; }
          } else if (e.state === 1) {
            e.windup -= dt;
            e.ax += (ux - e.ax) * Math.min(1, dt * 1.6);
            e.ay += (uy - e.ay) * Math.min(1, dt * 1.6);
            if (e.windup <= 0) {
              e.state = 0; e.atkT = e.def.atkCd;
              const range = 900;
              const x2 = e.x + e.ax * range, y2 = e.y + e.ay * range;
              this.fx.beam(e.x, e.y, x2, y2, 6, '#ff9a3c', 0.22);
              this.fx.addShake(2);
              sfx.shoot('beam');
              if (segDist(this.px, this.py, e.x, e.y, x2, y2) < this.pr + 5) this.hurtPlayer(e.dmg, e.x, e.y);
            }
          }
          break;
        }
        case 'radial': {
          const want = 270;
          const dir = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
          e.vx += (ux * spd * dir - e.vx) * Math.min(1, dt * 3);
          e.vy += (uy * spd * dir - e.vy) * Math.min(1, dt * 3);
          if (e.atkT <= 0 && dist < 620) {
            e.atkT = e.def.atkCd;
            const n = e.def.boss ? 16 : 9;
            const off = Math.random() * 6.28;
            for (let s = 0; s < n; s++) {
              this.eShoot(e.x, e.y, off + (s / n) * Math.PI * 2, 195, e.dmg * 0.45, 6, e.def.color, 1);
            }
            this.fx.ring(e.x, e.y, e.r, e.r + 40, 0.3, 3, e.def.color);
            sfx.shoot('ring');
          }
          break;
        }
        case 'slam': {
          e.vx += (ux * spd - e.vx) * Math.min(1, dt * 3);
          e.vy += (uy * spd - e.vy) * Math.min(1, dt * 3);
          if (e.state === 0 && dist < 170) { e.state = 1; e.windup = 0.75; }
          if (e.state === 1) {
            e.windup -= dt;
            e.vx *= 0.9; e.vy *= 0.9;
            if (e.windup <= 0) {
              e.state = 0; e.atkT = e.def.atkCd;
              const R = 175;
              this.fx.ring(e.x, e.y, 20, R, 0.45, 8, e.def.color);
              this.fx.addShake(11);
              this.fx.burst(e.x, e.y, 26, e.def.color, { spd: 380, size: 4, life: 0.5, drag: 0.85 });
              sfx.explode();
              if (Math.hypot(this.px - e.x, this.py - e.y) < R + this.pr) this.hurtPlayer(e.dmg, e.x, e.y);
            }
          }
          break;
        }
        case 'spawn': {
          e.vx += (ux * spd - e.vx) * Math.min(1, dt * 3);
          e.vy += (uy * spd - e.vy) * Math.min(1, dt * 3);
          if (e.atkT <= 0 && dist < 620) {
            e.atkT = e.def.atkCd;
            for (let s = 0; s < 2; s++) {
              const a = Math.random() * 6.28;
              this.spawnEnemy('ecircle', e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, 0.6);
            }
            this.fx.ring(e.x, e.y, e.r, e.r + 34, 0.35, 3, e.def.color);
          }
          break;
        }
        default: {
          e.vx += (ux * spd - e.vx) * Math.min(1, dt * 5);
          e.vy += (uy * spd - e.vy) * Math.min(1, dt * 5);
        }
      }

      e.age += dt;
      e.x += e.vx * dt; e.y += e.vy * dt;

      // push off arena walls (skipped while still entering)
      if (e.age > 1.2) {
        const pad = e.r;
        if (e.x < pad) { e.x = pad; e.vx = Math.abs(e.vx); }
        if (e.x > this.W - pad) { e.x = this.W - pad; e.vx = -Math.abs(e.vx); }
        if (e.y < pad) { e.y = pad; e.vy = Math.abs(e.vy); }
        if (e.y > this.H - pad) { e.y = this.H - pad; e.vy = -Math.abs(e.vy); }
      } else {
        const pad = e.r + 30;
        if (e.x < -pad) e.x = -pad;
        if (e.x > this.W + pad) e.x = this.W + pad;
        if (e.y < -pad) e.y = -pad;
        if (e.y > this.H + pad) e.y = this.H + pad;
      }

      // contact with player
      const cr = e.r + this.pr - 3;
      if (dx * dx + dy * dy < cr * cr) {
        if (e.hitCd <= 0) {
          e.hitCd = 0.55;
          this.hurtPlayer(e.dmg, e.x, e.y);
          if (st.thorns > 0) this.damageEnemy(e, st.thorns, false, -ux * 200, -uy * 200);
          const a = Math.atan2(e.y - this.px, e.x - this.px);
          e.vx += Math.cos(a) * 210; e.vy += Math.sin(a) * 210;
        }
      }
    }

    // soft enemy separation (grid-free, sampled)
    for (let i = 0; i < this.enemies.length; i += 1) {
      const a = this.enemies[i];
      if (!a.active) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (!b.active) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = (a.r + b.r) * 0.86;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = ((rr - d) / d) * 0.28;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
        }
      }
    }
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, kx: number, ky: number) {
    if (!e.active) return;
    const st = this.stats!;
    let d = dmg;
    const hpFrac = e.hp / e.maxHp;
    if (hpFrac < 0.35) d *= 1 + st.exec;
    if (e.r >= 21) d *= 1 + st.giant;
    if (e.r <= 14) d *= 1 + st.swarm;
    if (crit) d *= 1.0;
    e.hp -= d;
    e.flash = 0.14;
    e.vx += kx; e.vy += ky;
    if (st.leech > 0) this.hp = Math.min(this.maxHp, this.hp + d * st.leech);
    if (st.freeze > 0 && Math.random() < st.freeze) e.frozen = Math.max(e.frozen, 0.9);
    if (st.explode > 0 && Math.random() < 0.15 * st.explode) this.explode(e.x, e.y, 46 * st.aoe, d * 0.6, '#ffb347');
    if (st.chainhit > 0) {
      const t = this.nearestEnemy(e.x, e.y, 180, e.id);
      if (t) {
        this.fx.beam(e.x, e.y, t.x, t.y, 2.4, '#bff7ff', 0.14);
        this.damageEnemy(t, d * 0.45, false, 0, 0);
      }
    }
    if (crit) {
      this.fx.text(e.x, e.y - e.r - 6, Math.round(d).toString(), '#ffe066', 17);
      this.fx.burst(e.x, e.y, 7, '#ffe066', { spd: 240, size: 3, life: 0.3 });
      this.fx.addShake(2.4);
    } else if (d >= 24) {
      this.fx.text(e.x, e.y - e.r - 4, Math.round(d).toString(), '#ffffff', 13);
    }
    sfx.hit();
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.active = false;
    const st = this.stats!;
    this.kills++;
    const comboMul = 1 + Math.min(5, this.combo * 0.06 * (1 + st.comboPow * 0.5));
    const gain = e.score * comboMul * st.scoreMul;
    this.score += gain;
    this.combo++;
    this.comboT = 2.1 * (1 + st.comboPow * 0.5);
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;

    this.fx.burst(e.x, e.y, e.def.boss ? 60 : 8 + Math.floor(e.r * 0.5), e.def.color, {
      spd: 220 + e.r * 8, size: 2 + e.r * 0.16, life: 0.5, sides: e.sides,
    });
    this.fx.ring(e.x, e.y, e.r * 0.4, e.r * 2.3, 0.28, 3, e.def.color);
    if (e.def.boss) {
      this.fx.addShake(24);
      this.fx.doFlash('#ffffff', 0.5, 0.35);
      this.fx.hitStop = 0.14;
      sfx.explode();
      this.banner('TYRANT DOWN', 1.8);
    } else {
      this.fx.addShake(Math.min(4, 1 + e.r * 0.08));
      sfx.kill();
    }
    if (gain >= 60) this.fx.text(e.x, e.y - e.r - 10, '+' + Math.round(gain), '#7dfcd6', 14);

    // xp
    const gems = e.def.boss ? 12 : e.xp > 6 ? 3 : 1;
    const per = (e.xp * st.xpMul) / gems;
    for (let i = 0; i < gems; i++) this.dropPickup(e.x, e.y, per, false);
    if (e.def.boss) for (let i = 0; i < 3; i++) this.dropPickup(e.x + rnd(-30, 30), e.y + rnd(-30, 30), 0, true);

    if (st.regenkill > 0) this.hp = Math.min(this.maxHp, this.hp + st.regenkill);
    if (st.deathbomb > 0) this.explode(e.x, e.y, 60 * st.deathbomb * st.aoe, e.maxHp * 0.18 + 8, '#ff9a3c');

    if (e.def.id === 'epentagon') {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * 6.28;
        this.spawnEnemy('ecircle', e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, 0.7);
      }
    }
  }

  private dropPickup(x: number, y: number, v: number, heal: boolean) {
    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      if (p.active) continue;
      p.active = true; p.x = x; p.y = y; p.v = v; p.heal = heal; p.life = 22;
      const a = Math.random() * 6.28;
      p.vx = Math.cos(a) * rnd(30, 110); p.vy = Math.sin(a) * rnd(30, 110);
      return;
    }
  }

  private updatePickups(dt: number) {
    const st = this.stats!;
    const pr = st.pickup;
    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      const dx = this.px - p.x, dy = this.py - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < pr) {
        const k = 1 - d / pr;
        const acc = 700 + k * k * 3800;
        p.vx += (dx / d) * acc * dt;
        p.vy += (dy / d) * acc * dt;
      }
      p.vx *= Math.pow(0.92, dt * 60); p.vy *= Math.pow(0.92, dt * 60);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (d < this.pr + 8) {
        p.active = false;
        if (p.heal) {
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.12);
          this.fx.text(this.px, this.py - 28, '+HP', '#7dfcd6', 15);
          this.fx.ring(this.px, this.py, 10, 50, 0.3, 3, '#7dfcd6');
        } else {
          this.gainXP(p.v);
        }
        this.fx.burst(p.x, p.y, 2, p.heal ? '#7dfcd6' : '#9ef7ff', { spd: 90, size: 2, life: 0.2 });
        sfx.pickup();
      }
    }
  }

  private gainXP(v: number) {
    this.xp += v;
    this.score += v * 2 * this.stats!.scoreMul;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.xpNeed = Math.floor(6 + this.level * 3.5 + Math.pow(this.level, 1.45));
      this.levelUp();
    }
  }

  private levelUp() {
    sfx.levelUp();
    this.fx.ring(this.px, this.py, 14, 230, 0.6, 6, '#ffe066');
    this.fx.burst(this.px, this.py, 30, '#ffe066', { spd: 330, size: 3.4, life: 0.7 });
    this.fx.doFlash('#ffe066', 0.22, 0.24);
    this.fx.addShake(5);
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.06);
    if (this.stats!.xpwave > 0) {
      for (let i = 0; i < 6 * this.stats!.xpwave; i++) {
        const a = Math.random() * 6.28;
        this.dropPickup(this.px, this.py, 1.5 * this.stats!.xpMul, false);
        void a;
      }
    }
    if (this.phase === 'levelup') { this.pendingLevels++; return; }
    this.rollChoices();
    if (this.choices.length === 0) { this.score += 250 * this.stats!.scoreMul; return; }
    this.phase = 'levelup';
    this.push();
  }

  /* ------------------------------------------------ orbitals / helpers / mines */

  private rebuildOrbitals() {
    const st = this.stats!;
    const wantBlades = this.weapons.filter((w) => WEAPONS[w].kind === 'orbit').length * 2 + (WEAPONS[this.weapons[0]]?.kind === 'orbit' ? 0 : 0);
    const wantGuards = Math.floor(st.orbit);
    const total = wantBlades + wantGuards;
    let count = 0;
    for (const o of this.orbitals) {
      if (count >= total) { o.active = false; continue; }
      o.active = true;
      if (count < wantBlades) {
        o.kind = 1; o.r = 13 * st.psize; o.dist = 78;
        o.dmg = WEAPONS.blades.dmg * st.dmg * 1.1 * st.orbitDmg;
        o.color = WEAPONS.blades.color;
      } else {
        o.kind = 0; o.r = 11; o.dist = 100;
        o.dmg = 9 * st.dmg * st.orbitDmg;
        o.color = '#7dd3fc';
      }
      count++;
    }
  }

  private updateOrbitals(dt: number) {
    const st = this.stats!;
    let base = this.elapsed * 2.1 * st.orbitSpd;
    let idx = 0;
    for (const o of this.orbitals) {
      if (!o.active) continue;
      idx++;
      o.angle = base + (idx / 6) * Math.PI * 2 + idx * 0.4;
      o.spin += dt * 12;
      o.x = 0; o.y = 0;
      const ox = this.px + Math.cos(o.angle) * o.dist;
      const oy = this.py + Math.sin(o.angle) * o.dist;
      o.x = ox; o.y = oy;
      void dt;
      for (const e of this.enemies) {
        if (!e.active || e.hitCd > 0) continue;
        const dx = e.x - ox, dy = e.y - oy;
        const rr = e.r + o.r;
        if (dx * dx + dy * dy <= rr * rr) {
          e.hitCd = 0.28;
          const a = Math.atan2(dy, dx);
          this.damageEnemy(e, o.dmg, Math.random() < st.crit, Math.cos(a) * 180 * st.knock, Math.sin(a) * 180 * st.knock);
          this.fx.burst(ox, oy, 3, o.color, { spd: 150, size: 2.4, life: 0.22 });
        }
      }
    }
  }

  private updateHelpers(dt: number) {
    const st = this.stats!;
    // drones
    const wantDrones = Math.floor(st.drones);
    let dc = 0;
    for (const h of this.helpers) {
      if (h.active && h.kind === 1) dc++;
    }
    // assign drone slots
    let di = 0;
    for (const h of this.helpers) {
      if (!h.active && di < wantDrones) {
        h.active = true; h.kind = 1; h.r = 9; h.life = Infinity; h.cd = 0;
        h.dmg = 7 * st.droneDmg;
        di++;
      }
    }
    let dIdx = 0;
    for (const h of this.helpers) {
      if (!h.active) continue;
      if (h.kind === 1) {
        dIdx++;
        const a = this.elapsed * 1.5 * st.orbitSpd + (dIdx / Math.max(1, wantDrones)) * Math.PI * 2;
        const R = 54 + (dIdx % 2) * 16;
        const tx = this.px + Math.cos(a) * R, ty = this.py + Math.sin(a) * R;
        h.x += (tx - h.x) * Math.min(1, dt * 8);
        h.y += (ty - h.y) * Math.min(1, dt * 8);
        h.cd -= dt * st.droneRate;
        if (h.cd <= 0) {
          const t = this.nearestEnemy(h.x, h.y, 430);
          if (t) {
            h.cd = 0.75;
            const ang = Math.atan2(t.y - h.y, t.x - h.x);
            const p = this.freeProj();
            if (p) {
              p.active = true; p.x = h.x; p.y = h.y;
              p.vx = Math.cos(ang) * 520; p.vy = Math.sin(ang) * 520;
              p.r = 3.6; p.dmg = h.dmg * st.dmg; p.pierce = 0; p.life = 1.1;
              p.kind = 'bullet'; p.color = '#8ef7ff'; p.rot = ang; p.spin = 8;
              p.homing = st.homing; p.aoe = 0; p.crit = Math.random() < st.crit;
              if (p.crit) p.dmg *= st.critd;
              p.hits.length = 0; p.bounced = st.ricochet; p.split = 0; p.trail = 0;
            }
            sfx.shoot('bullet');
          } else h.cd = 0.2;
        }
      } else if (h.kind === 0) {
        // turret
        h.life -= dt;
        if (h.life <= 0) { h.active = false; this.fx.burst(h.x, h.y, 10, '#fbbf24', { spd: 160, size: 3, life: 0.4 }); continue; }
        h.rot += dt * 2;
        h.cd -= dt * st.droneRate;
        if (h.cd <= 0) {
          const t = this.nearestEnemy(h.x, h.y, 460);
          if (t) {
            h.cd = 0.42;
            const ang = Math.atan2(t.y - h.y, t.x - h.x);
            h.rot = ang;
            const p = this.freeProj();
            if (p) {
              p.active = true; p.x = h.x + Math.cos(ang) * 12; p.y = h.y + Math.sin(ang) * 12;
              p.vx = Math.cos(ang) * 640; p.vy = Math.sin(ang) * 640;
              p.r = 4; p.dmg = h.dmg * st.dmg; p.pierce = 1; p.life = 1.1;
              p.kind = 'bullet'; p.color = '#fbbf24'; p.rot = ang; p.spin = 8;
              p.homing = st.homing; p.aoe = 0; p.crit = Math.random() < st.crit;
              if (p.crit) p.dmg *= st.critd;
              p.hits.length = 0; p.bounced = st.ricochet; p.split = 0; p.trail = 0;
            }
          } else h.cd = 0.2;
        }
      } else if (h.kind === 2) {
        // companion
        const t = this.nearestEnemy(h.x, h.y, 900);
        const tx = t ? t.x : this.px + Math.cos(this.elapsed) * 70;
        const ty = t ? t.y : this.py + Math.sin(this.elapsed) * 70;
        const a = Math.atan2(ty - h.y, tx - h.x);
        h.vx += (Math.cos(a) * 250 - h.vx) * Math.min(1, dt * 3);
        h.vy += (Math.sin(a) * 250 - h.vy) * Math.min(1, dt * 3);
        h.x += h.vx * dt; h.y += h.vy * dt;
        h.rot += dt * 3;
        h.cd -= dt;
        if (h.cd <= 0 && t) {
          h.cd = 0.5;
          const ang = Math.atan2(t.y - h.y, t.x - h.x);
          const p = this.freeProj();
          if (p) {
            p.active = true; p.x = h.x; p.y = h.y;
            p.vx = Math.cos(ang) * 560; p.vy = Math.sin(ang) * 560;
            p.r = 4.6; p.dmg = h.dmg * st.dmg; p.pierce = 1; p.life = 1.3;
            p.kind = 'disc'; p.color = '#7dfcd6'; p.rot = ang; p.spin = 18;
            p.homing = st.homing; p.aoe = 0; p.crit = Math.random() < st.crit;
            if (p.crit) p.dmg *= st.critd;
            p.hits.length = 0; p.bounced = st.ricochet; p.split = 0; p.trail = 0;
          }
        }
      }
    }
    // companions
    const wantComp = Math.floor(st.companion);
    let ci = 0;
    for (const h of this.helpers) {
      if (!h.active && ci < wantComp) {
        h.active = true; h.kind = 2; h.r = 13 * st.companionDmg; h.life = Infinity;
        h.cd = 0; h.dmg = 12 * st.companionDmg; h.x = this.px; h.y = this.py; h.vx = h.vy = 0;
        ci++;
      }
    }
    void dc;
  }

  private dropMine(x: number, y: number, delay = 0.35) {
    const m = this.freeMine();
    if (!m) return;
    m.active = true; m.x = x; m.y = y; m.t = 0; m.armed = delay;
    m.r = 52 * this.stats!.aoe; m.dmg = 20 * this.stats!.dmg;
    this.fx.burst(x, y, 4, '#ffd166', { spd: 70, size: 2.4, life: 0.3 });
  }

  private updateMines(dt: number) {
    for (const m of this.mines) {
      if (!m.active) continue;
      if (m.armed > 0) { m.armed -= dt; continue; }
      m.t += dt;
      for (const e of this.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - m.x, e.y - m.y) < e.r + 16) {
          this.explode(m.x, m.y, m.r, m.dmg, '#ffd166');
          m.active = false;
          break;
        }
      }
      if (m.t > 9) m.active = false;
    }
  }

  /* ------------------------------------------------ spawning */

  private spawnDirector(dt: number) {
    const t = this.elapsed;
    this.spawnT -= dt;
    const interval = Math.max(0.17, 1.35 - t * 0.0036);
    const budget = Math.min(5, 1 + Math.floor(t / 48));
    if (this.spawnT <= 0) {
      this.spawnT = interval;
      for (let i = 0; i < budget; i++) {
        const id = this.pickEnemyType(t);
        if (id) this.spawnAtEdge(id);
      }
    }
    if (t >= this.bossT) {
      this.bossT += 90;
      this.bossCount++;
      this.spawnBoss();
    }
  }

  private pickEnemyType(t: number): string | null {
    let total = 0;
    const list: { id: string; w: number }[] = [];
    for (const key in ENEMIES) {
      const d = ENEMIES[key];
      if (d.boss || d.weight <= 0) continue;
      if (t < d.spawnAfter) continue;
      let w = d.weight;
      // shift weight away from weakest over time
      if (d.id === 'ecircle') w *= Math.max(0.25, 1 - t / 260);
      if (d.id === 'etriangle') w *= Math.min(1.5, 0.6 + t / 200);
      total += w;
      list.push({ id: d.id, w });
    }
    if (!list.length) return null;
    let r = Math.random() * total;
    for (const l of list) { r -= l.w; if (r <= 0) return l.id; }
    return list[list.length - 1].id;
  }

  private freeEnemy(): Enemy | null {
    for (let i = 0; i < this.enemies.length; i++) if (!this.enemies[i].active) return this.enemies[i];
    return null;
  }

  private scaleHP(base: number) {
    const t = this.elapsed;
    return base * (1 + (t / 72) * 0.30 + Math.pow(t / 118, 1.6) * 0.72);
  }

  private spawnAtEdge(id: string) {
    const d = ENEMIES[id];
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    const m = 40;
    if (side === 0) { x = rnd(0, this.W); y = -m; }
    else if (side === 1) { x = this.W + m; y = rnd(0, this.H); }
    else if (side === 2) { x = rnd(0, this.W); y = this.H + m; }
    else { x = -m; y = rnd(0, this.H); }
    this.spawnEnemy(id, x, y, 1);
    void d;
  }

  spawnEnemy(id: string, x: number, y: number, hpMul: number) {
    const e = this.freeEnemy();
    if (!e) return;
    const d = ENEMIES[id];
    e.active = true;
    e.id = this.eid++;
    e.def = d;
    e.x = clamp(x, -50, this.W + 50); e.y = clamp(y, -50, this.H + 50);
    e.r = d.r; e.sides = d.sides; e.hp = e.maxHp = this.scaleHP(d.hp) * hpMul;
    e.dmg = d.dmg * (1 + this.elapsed / 400);
    e.speed = d.speed * (1 + Math.min(0.4, this.elapsed / 600));
    e.xp = d.xp; e.score = d.score;
    e.rot = Math.random() * 6.28;
    e.spin = d.boss ? 0.5 : rnd(-1.4, 1.4);
    e.flash = 0; e.atk = d.atk; e.atkT = d.atkCd * rnd(0.5, 1.2);
    e.windup = 0; e.state = 0; e.slow = 0; e.frozen = 0; e.hitCd = 0; e.age = 0;
    e.vx = e.vy = 0;
    if (d.boss) {
      this.fx.addShake(16);
      this.fx.doFlash('#ff2d55', 0.3, 0.4);
      this.banner('⚠ TYRANT INBOUND', 2.2);
      sfx.boss();
    }
  }

  private spawnBoss() {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (side === 0) { x = rnd(100, this.W - 100); y = -60; }
    else if (side === 1) { x = this.W + 60; y = rnd(100, this.H - 100); }
    else if (side === 2) { x = rnd(100, this.W - 100); y = this.H + 60; }
    else { x = -60; y = rnd(100, this.H - 100); }
    this.spawnEnemy('edecagon', x, y, 1 + this.bossCount * 0.55);
  }

  /* ------------------------------------------------ state push */

  push() {
    this.onState({
      phase: this.phase,
      score: Math.floor(this.score),
      best: bestCache,
      level: this.level,
      kills: this.kills,
      time: this.elapsed,
      hp: Math.max(0, this.hp),
      maxHp: this.maxHp,
      shapeId: this.shapeId,
      weapons: this.weapons.slice(),
      choices: this.choices,
      rerolls: this.rerolls,
      wave: this.wave,
      combo: this.combo,
      owned: this.owned,
      paused: this.phase === 'paused',
    });
  }

  pause() {
    if (this.phase === 'playing') { this.phase = 'paused'; this.push(); }
  }
  resume() {
    if (this.phase === 'paused') { this.phase = 'playing'; this.push(); }
  }
  togglePause() {
    if (this.phase === 'playing') this.pause();
    else if (this.phase === 'paused') this.resume();
  }
}

let bestCache = 0;
export function setBestCache(v: number) { bestCache = v; }
export function getBestCache() { return bestCache; }
