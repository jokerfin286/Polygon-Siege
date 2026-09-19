import {
  SHAPES, WEAPONS, ENEMIES, BOSS_IDS, buildPool,
  type EnemyDef, type WeaponId, type UpgDef, type PoolEntry,
} from './defs';
import { FX } from './fx';
import { sfx } from './sfx';
import { saveScore, saveBest, type ScoreRow } from './storage';
import { THEMES, type ThemeDef, type StartConfig } from './meta';
import { t as tr, shapeName, enemyName, type Lang } from '../i18n';
import { adjacentMount, adjacentSlot, aimAngle, segmentDistanceSq, type WeaponMount } from './aim';

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
  // elemental status
  burn: number; burnDps: number;
  poison: number; poisonDps: number;
  marked: number; voided: number;
  enraged: boolean; auxT: number;
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

interface Helper { active: boolean; x: number; y: number; vx: number; vy: number; cd: number; life: number; dmg: number; kind: number; r: number; rot: number; color: string }

interface Mine { active: boolean; x: number; y: number; t: number; r: number; dmg: number; armed: number }

interface Hazard {
  active: boolean; x: number; y: number; r: number;
  delay: number; windup: number; life: number; dmg: number; color: string;
}

/* ------------------------------------------------------------------
   Co-op mate: a second (or third/fourth) player in the same arena.
   The host simulates every mate. Each has its own HP, XP, level,
   weapons and upgrade choices — progression is fully independent.
   ------------------------------------------------------------------ */
export interface Mate {
  slot: number;
  name: string;
  color: string;
  local: boolean;        // true for the machine's own player (host slot 0)
  active: boolean;       // participating this run
  alive: boolean;
  // transform
  x: number; y: number; vx: number; vy: number; pr: number; aim: number;
  // combat
  hp: number; maxHp: number; invuln: number; shield: number; shieldMax: number; shieldT: number;
  immortalT: number;     // boss-kill immortality reward window
  shapeId: string;
  weapons: WeaponId[];
  wcd: number[];
  hasDash: boolean; dashCd: number; dashT: number; dashDx: number; dashDy: number;
  firingTime: number;
  aimEnemy: Enemy | null;
  // progression (separate per player)
  level: number; xp: number; xpNeed: number; kills: number; score: number;
  mods: Record<string, number>;
  owned: Record<string, number>;
  stats: ReturnType<Game['computeStats']> | null;
  // level-up choice state
  choices: Choice[];
  rerolls: number;
  pendingLevels: number;
  choosing: boolean;     // this mate is mid level-up selection
  // input from the controlling client
  inMoveX: number; inMoveY: number; inDash: boolean; inAim: number; inAimSet: boolean;
}

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
  coinsEarned: number;
  coop: boolean;
  levelupName: string;      // who is choosing (co-op)
  levelupIsLocal: boolean;  // is the local player the one choosing
  mates: MateHud[];
}

export interface MateHud {
  slot: number;
  name: string;
  color: string;
  hp: number;
  maxHp: number;
  level: number;
  alive: boolean;
  local: boolean;
  immortal: boolean;
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
  // world (arena) can be larger than the viewport; a camera follows the player
  worldW = 1200; worldH = 900;
  camX = 0; camY = 0; viewScale = 1;

  // meta-progression config applied at run start
  startMods: Record<string, number> = {};
  rerollTokens = 0;
  coinMul = 1;
  coinsEarned = 0;
  playerColor: string | null = null;
  theme: ThemeDef = THEMES[0];
  lang: Lang = 'en';

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
  private aimTarget: Enemy | null = null;
  private firingTime = 0;
  private panicCd = 0;
  private interceptCd = 0;

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
  hazards: Hazard[] = [];
  private eid = 1;
  private spawnT = 0; private bossT = 150; private bossCount = 0;
  private turretT = 0; private mineT = 0; private bombT = 0;
  private sniperT = 0; private flameT = 0; private beaconT = 0;
  private bossRotation = 0;
  private effectBudget = 192;
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

  /* ---- co-op ---- */
  coop = false;              // true when more than one player is in the run
  mates: Mate[] = [];        // index 0 is always the local player (host)
  localSlot = 0;
  onMateLevelUp: ((m: Mate) => void) | null = null;   // host callback for guest picker
  playerName = 'YOU';
  /** When a mate is choosing an upgrade the whole run pauses (shared pause). */
  levelupSlot = -1;

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
    for (let i = 0; i < 60; i++) this.helpers.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, cd: 0, life: 0, dmg: 1, kind: 0, r: 8, rot: 0, color: '#fff' });
    for (let i = 0; i < 30; i++) this.mines.push({ active: false, x: 0, y: 0, t: 0, r: 0, dmg: 0, armed: 0 });
    for (let i = 0; i < 36; i++) this.hazards.push({ active: false, x: 0, y: 0, r: 0, delay: 0, windup: 1, life: 0, dmg: 0, color: '#ff6b6b' });
    this.resize();
  }

  private blankEnemy(): Enemy {
    return {
      active: false, id: 0, x: 0, y: 0, vx: 0, vy: 0, r: 12, sides: 0, hp: 1, maxHp: 1,
      dmg: 1, speed: 50, xp: 1, score: 1, rot: 0, spin: 0, flash: 0,
      atk: 'melee', atkT: 1, windup: 0, state: 0, ax: 0, ay: 0, slow: 0, frozen: 0, scale: 1, hitCd: 0, age: 0,
      burn: 0, burnDps: 0, poison: 0, poisonDps: 0, marked: 0, voided: 0,
      enraged: false, auxT: 1,
      def: ENEMIES.ecircle,
    };
  }

  applyMeta(cfg: StartConfig) {
    this.startMods = { ...cfg.mods };
    this.rerollTokens = cfg.rerollTokens;
    this.coinMul = cfg.coinMul;
    this.playerColor = cfg.color;
    this.theme = cfg.theme;
  }

  resize() {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth));
    const h = Math.max(320, Math.round(rect.height || window.innerHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.W === w && this.H === h && this.canvas.width === Math.floor(w * this.dpr)) return;
    c.width = Math.floor(w * this.dpr);
    c.height = Math.floor(h * this.dpr);
    this.W = w; this.H = h;

    // Zoom out on small screens so there is room to manoeuvre; the world is
    // always noticeably larger than the visible slice and a camera follows you.
    const smallSide = Math.min(w, h);
    const zoom = clamp(smallSide / 900, 0.6, 1);
    this.viewScale = zoom;
    const viewW = w / zoom, viewH = h / zoom;
    this.worldW = Math.round(Math.max(1200, viewW * 1.85));
    this.worldH = Math.round(Math.max(900, viewH * 1.85));

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.stars = [];
    const n = Math.floor((w * h) / 8500);
    for (let i = 0; i < n; i++) this.stars.push({ x: Math.random() * w, y: Math.random() * h, z: rnd(0.3, 1) });
    this.px = clamp(this.px, 30, this.worldW - 30); this.py = clamp(this.py, 30, this.worldH - 30);
    this.centerCamera();
  }

  private centerCamera() {
    const viewW = this.W / this.viewScale, viewH = this.H / this.viewScale;
    this.camX = clamp(this.px - viewW / 2, 0, Math.max(0, this.worldW - viewW));
    this.camY = clamp(this.py - viewH / 2, 0, Math.max(0, this.worldH - viewH));
  }

  private updateCamera(dt: number) {
    const viewW = this.W / this.viewScale, viewH = this.H / this.viewScale;
    let fx = this.px, fy = this.py;
    if (this.coop) {
      // follow the centroid of living players
      let sx = 0, sy = 0, n = 0;
      for (const m of this.mates) { if (m.active && m.alive) { sx += m.x; sy += m.y; n++; } }
      if (n > 0) { fx = sx / n; fy = sy / n; }
    }
    const tx = clamp(fx - viewW / 2, 0, Math.max(0, this.worldW - viewW));
    const ty = clamp(fy - viewH / 2, 0, Math.max(0, this.worldH - viewH));
    const k = Math.min(1, dt * 9);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
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
    for (const h of this.hazards) h.active = false;
    this.shapeId = 'circle';
    this.weapons = ['disc'];
    this.wcd = [0];
    this.mods = { ...this.startMods };
    this.owned = {};
    this.coinsEarned = 0;
    this.px = this.worldW / 2; this.py = this.worldH / 2;
    this.pvx = this.pvy = 0;
    this.keys.clear(); this.touchActive = false; this.wantDash = false;
    this.aimTarget = null; this.firingTime = 0; this.panicCd = 0; this.interceptCd = 0;
    this._dmgDepth = 0; this.effectBudget = 192;
    this.score = 0; this.level = 1; this.xp = 0; this.xpNeed = 8;
    this.kills = 0; this.elapsed = 0; this.combo = 0; this.comboT = 0; this.bestCombo = 0;
    this.spawnT = 0.5; this.bossT = 150; this.bossCount = 0; this.wave = 1;
    this.bossRotation = Math.floor(Math.random() * BOSS_IDS.length);
    this.invuln = 1; this.dashCd = 0; this.dashT = 0; this.hasDash = false;
    this.pendingLevels = 0; this.choices = []; this.rerolls = this.rerollTokens;
    this.timeScale = 1; this.slowT = 0;
    this.turretT = 0; this.mineT = 0; this.bombT = 0;
    this.sniperT = 0; this.flameT = 0; this.beaconT = 0;
    this.recompute();
    this.hp = this.maxHp;
    this.shield = this.shieldMax; this.shieldT = 0;
    this.levelupSlot = -1;

    // Position co-op mates in a small ring around the arena centre and give
    // each their own fresh build. mate[local] mirrors the host player fields.
    if (this.coop && this.mates.length) {
      const cx = this.worldW / 2, cy = this.worldH / 2;
      const n = this.mates.length;
      this.mates.forEach((m, i) => {
        const a = (i / n) * Math.PI * 2;
        m.active = true; m.alive = true; m.immortalT = 0;
        m.x = cx + Math.cos(a) * (n > 1 ? 90 : 0);
        m.y = cy + Math.sin(a) * (n > 1 ? 90 : 0);
        m.vx = m.vy = 0; m.aim = 0;
        m.shapeId = 'circle'; m.weapons = ['disc']; m.wcd = [0];
        m.hasDash = false; m.dashCd = 0; m.dashT = 0; m.firingTime = 0; m.aimEnemy = null;
        m.level = 1; m.xp = 0; m.xpNeed = 8; m.kills = 0; m.score = 0;
        m.mods = { ...this.startMods }; m.owned = {};
        m.choices = []; m.rerolls = this.rerollTokens; m.pendingLevels = 0; m.choosing = false;
        m.inMoveX = m.inMoveY = 0; m.inDash = false; m.inAimSet = false;
        m.invuln = 1; m.shield = 0; m.shieldT = 0;
        this.recomputeMate(m);
        m.hp = m.maxHp; m.shield = m.shieldMax;
      });
      const local = this.localMate;
      if (local) {
        this.px = local.x; this.py = local.y;
        this.syncMateToLocal();
        this.recompute();
        this.hp = this.maxHp; this.shield = this.shieldMax;
      }
    }

    this.centerCamera();
    this.phase = 'playing';
    this.banner(tr(this.lang, 'bnr_survive'), 1.6);
    this.push();
  }

  banner(text: string, t: number) { this.bannerText = text; this.bannerT = t; }

  /* ------------------------------------------------ co-op mates */

  private blankMate(slot: number): Mate {
    return {
      slot, name: 'P' + (slot + 1), color: '#38f5e0', local: false, active: false, alive: false,
      x: 0, y: 0, vx: 0, vy: 0, pr: 15, aim: 0,
      hp: 100, maxHp: 100, invuln: 0, shield: 0, shieldMax: 0, shieldT: 0, immortalT: 0,
      shapeId: 'circle', weapons: ['disc'], wcd: [0],
      hasDash: false, dashCd: 0, dashT: 0, dashDx: 0, dashDy: 0,
      firingTime: 0, aimEnemy: null,
      level: 1, xp: 0, xpNeed: 8, kills: 0, score: 0,
      mods: {}, owned: {}, stats: null,
      choices: [], rerolls: 0, pendingLevels: 0, choosing: false,
      inMoveX: 0, inMoveY: 0, inDash: false, inAim: 0, inAimSet: false,
    };
  }

  /** Configure a co-op run before reset(). players[0] must be the local host. */
  setupCoop(players: { slot: number; name: string; color: string; local: boolean }[]) {
    this.coop = players.length > 1;
    this.mates = players.map((p) => {
      const m = this.blankMate(p.slot);
      m.name = p.name; m.color = p.color; m.local = p.local; m.active = true;
      return m;
    });
    this.localSlot = players.find((p) => p.local)?.slot ?? 0;
  }

  clearCoop() {
    this.coop = false;
    this.mates = [];
    this.localSlot = 0;
    this.levelupSlot = -1;
  }

  private mateBySlot(slot: number): Mate | undefined {
    return this.mates.find((m) => m.slot === slot);
  }

  get localMate(): Mate | undefined {
    return this.mates.find((m) => m.local);
  }

  /** How many mates are still alive (co-op). */
  aliveCount(): number {
    return this.mates.reduce((n, m) => n + (m.active && m.alive ? 1 : 0), 0);
  }

  /** Compute stats for a specific mate's build (shape + mods). */
  private mateStats(m: Mate): ReturnType<Game['computeStats']> {
    const prevShape = this.shapeId, prevMods = this.mods, prevWeapons = this.weapons;
    this.shapeId = m.shapeId; this.mods = m.mods; this.weapons = m.weapons;
    const s = this.computeStats();
    this.shapeId = prevShape; this.mods = prevMods; this.weapons = prevWeapons;
    return s;
  }

  private recomputeMate(m: Mate) {
    m.stats = this.mateStats(m);
    const sh = SHAPES[m.shapeId];
    m.pr = sh.size;
    const newMax = m.stats.maxHp;
    if (newMax > m.maxHp) m.hp += newMax - m.maxHp;
    m.maxHp = newMax;
    m.hp = Math.min(m.hp, m.maxHp);
    m.shieldMax = Math.floor((m.mods.shieldmax || 0)) + m.stats.heptagonCharge + Math.floor(m.stats.shieldDrone);
    if (m.shield > m.shieldMax) m.shield = m.shieldMax;
  }

  /** Sync the authoritative host player fields into mate[local]. */
  private syncLocalToMate() {
    const m = this.localMate;
    if (!m) return;
    m.x = this.px; m.y = this.py; m.vx = this.pvx; m.vy = this.pvy; m.pr = this.pr; m.aim = this.aimA;
    m.hp = this.hp; m.maxHp = this.maxHp; m.invuln = this.invuln;
    m.shield = this.shield; m.shieldMax = this.shieldMax; m.shieldT = this.shieldT;
    m.shapeId = this.shapeId; m.weapons = this.weapons; m.wcd = this.wcd;
    m.hasDash = this.hasDash; m.dashCd = this.dashCd; m.dashT = this.dashT;
    m.level = this.level; m.xp = this.xp; m.xpNeed = this.xpNeed; m.kills = this.kills;
    m.score = this.score; m.mods = this.mods; m.owned = this.owned; m.stats = this.stats;
    m.alive = this.phase !== 'dead' && this.hp > 0;
  }

  private syncMateToLocal() {
    const m = this.localMate;
    if (!m) return;
    this.px = m.x; this.py = m.y; this.pvx = m.vx; this.pvy = m.vy; this.aimA = m.aim;
    this.hp = m.hp; this.maxHp = m.maxHp; this.invuln = m.invuln;
    this.shield = m.shield; this.shieldMax = m.shieldMax; this.shieldT = m.shieldT;
    this.dashCd = m.dashCd; this.dashT = m.dashT;
  }

  recompute() {
    this.stats = this.computeStats();
    const m = this.mods;
    const sh = SHAPES[this.shapeId];
    this.pr = sh.size;
    const newMax = this.stats.maxHp;
    if (newMax > this.maxHp) this.hp += newMax - this.maxHp;
    this.maxHp = newMax;
    this.hp = Math.min(this.hp, this.maxHp);
    this.shieldMax = Math.floor(m.shieldmax || 0) + this.stats.heptagonCharge + Math.floor(this.stats.shieldDrone);
    if (this.shield > this.shieldMax) this.shield = this.shieldMax;
    this.rebuildOrbitals();
  }

  computeStats() {
    const m = this.mods;
    const sh = SHAPES[this.shapeId];
    const g = m.glass || 0;
    const extra = Math.max(0, this.weapons.length - 1);
    const syn = 1 + (m.wpower || 0) * extra;
    const rank = (shape: string, id: string) => this.shapeId === shape ? (m[id] || 0) : 0;
    const circleFlow = rank('circle', 'circleFlow');
    const triangleSlip = rank('triangle', 'triangleSlip');
    const squareFortress = rank('square', 'squareFortress');
    const hexagonGuard = rank('hexagon', 'hexagonGuard');
    const octagonTreads = rank('octagon', 'octagonTreads');
    const pentagonVenom = rank('pentagon', 'pentagonVenom');
    const relay = rank('heptagon', 'heptagonRelay');
    const squad = 1 + (m.formation || 0);
    return {
      dmg: sh.dmg * (1 + (m.dmg || 0)) * syn * (1 + 0.35 * g),
      rate: sh.rate * (1 + (m.rate || 0)) * (1 + (m.haste || 0)),
      cdRed: Math.min(0.55, m.cd || 0),
      speed: sh.speed * (1 + (m.spd || 0) + circleFlow * 0.08 + triangleSlip * 0.08 + octagonTreads * 0.10) * (1 + (m.haste || 0)),
      pspd: 1 + (m.pspd || 0) + (m.focus || 0),
      psize: 1 + (m.psize || 0),
      crit: Math.min(0.95, 0.05 + (m.crit || 0) + triangleSlip * 0.05),
      critd: 1.6 + (m.critd || 0),
      pickup: 265 * (1 + (m.pickup || 0)),
      xpMul: 1 + (m.xpm || 0),
      armor: (m.armor || 0) + squareFortress + octagonTreads,
      regen: (m.regen || 0) + circleFlow * 0.5,
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
      slowfield: Math.min(0.75, m.slowfield || 0),
      bombs: m.bombdrop || 0,
      mines: m.mine || 0,
      turret: m.turret || 0,
      drones: m.drone || 0,
      droneDmg: (1 + (m.droneDmg || 0)) * squad,
      droneRate: (1 + (m.droneRate || 0)) * squad,
      orbit: (m.orbit || 0) + hexagonGuard,
      orbitSpd: 1 + (m.shieldorbs || 0),
      orbitDmg: 1 + (m.shieldorbs || 0),
      companion: m.companion || 0,
      companionDmg: (1 + (m.companionDmg || 0)) * squad,
      // specialised helpers
      laserDrone: m.laserDrone || 0,
      frostDrone: m.frostDrone || 0,
      fireDrone: m.fireDrone || 0,
      shockDrone: m.shockDrone || 0,
      healDrone: m.healDrone || 0,
      shieldDrone: m.shieldDrone || 0,
      sniper: m.sniper || 0,
      flamethrower: m.flamethrower || 0,
      beacon: m.beacon || 0,
      wolf: m.wolf || 0,
      golem: m.golem || 0,
      prism: m.prism || 0,
      // perimeter multi-barrel
      barrels: Math.min(4, Math.floor(m.barrels || 0)), // +0..4 → total 1..5
      focus: m.focus || 0,
      // elemental infusions
      fire: m.fire || 0,
      firedmg: 1 + (m.firedmg || 0),
      frost: m.frost || 0,
      frostpow: 1 + (m.frostpow || 0),
      shock: m.shock || 0,
      shockpow: 1 + (m.shockpow || 0),
      poison: Math.max(m.poison || 0, pentagonVenom > 0 ? 1 : 0),
      poisonMul: 1 + (m.toxinCatalyst || 0) + pentagonVenom * 0.25,
      voidMark: m.void || 0,
      overheat: m.overheat || 0,
      mark: m.mark || 0,
      regenkill: m.regenkill || 0,
      timewarp: m.timewarp || 0,
      xpwave: m.xpwave || 0,
      comboPow: m.combo || 0,
      lucky: m.lucky || 0,
      wslot: 1 + (m.wslot || 0),
      aux: m.aux || 0,
      secondwind: m.secondwind || 0,
      circleGyro: rank('circle', 'circleGyro'),
      trianglePrism: rank('triangle', 'trianglePrism'),
      squareBelt: rank('square', 'squareBelt'),
      pentagonSeek: rank('pentagon', 'pentagonSeek'),
      hexagonBurst: rank('hexagon', 'hexagonBurst'),
      heptagonRelay: relay,
      heptagonCharge: rank('heptagon', 'heptagonCharge'),
      octagonSiege: rank('octagon', 'octagonSiege'),
      chainRange: 1 + (m.chainReach || 0) + relay * 0.15,
      bossHunter: m.bossHunter || 0,
      damageReduction: Math.min(0.6, m.bastion || 0),
      invulnBonus: m.secondSkin || 0,
      fieldMedicine: m.fieldMedicine || 0,
      panicPulse: m.panicPulse || 0,
      levelRepair: m.levelRepair || 0,
      combustion: m.combustion || 0,
      shatter: m.shatter || 0,
      interceptor: m.interceptor || 0,
      dashCdMul: 1 - Math.min(0.6, m.dashcd || 0),
      shieldReg: 1 - Math.min(0.7, m.shieldreg || 0),
      maxHp: Math.max(1, Math.round(sh.hp * (1 - 0.12 * g)) + (m.hp || 0) + squareFortress * 20 + hexagonGuard * 25),
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
      if (d.forShape && d.forShape !== this.shapeId) continue;
      if (d.id === 'shatter' && !(lv.frost || lv.freeze || lv.frostDrone)) continue;
      if (d.id === 'toxinCatalyst' && !this.stats!.poison) continue;
      if (d.id === 'chainReach' && !(lv.shock || lv.chainhit || this.weapons.includes('arc'))) continue;
      if (d.id === 'aux' && this.weapons.length < 2) continue;
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
    this.choices = picked;
  }

  /** Called when a reroll token is consumed so the shell can persist the loss. */
  onSpendReroll: (() => void) | null = null;

  reroll() {
    if (this.coop) { if (this.levelupSlot >= 0) this.rerollForSlot(this.levelupSlot); return; }
    if (this.phase !== 'levelup' || this.rerolls <= 0) return;
    this.rerolls--;
    this.rerollTokens = this.rerolls;
    this.onSpendReroll?.();
    this.rollChoices();
    this.fx.burst(this.px, this.py, 14, '#c4b5fd', { spd: 240, size: 3, life: 0.4 });
    sfx.select();
    this.push();
  }

  pick(key: string) {
    // In co-op, only the player who is actually choosing may pick.
    if (this.coop) { if (this.levelupSlot >= 0) this.pickForSlot(this.levelupSlot, key); return; }
    if (this.phase !== 'levelup') return;
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
    if ((this.owned[d.id] || 0) >= d.max) return;
    if (d.forShape && d.forShape !== this.shapeId) return;
    if (d.kind === 'weapon' && d.weapon && (this.weapons.includes(d.weapon) || this.weapons.length >= this.stats!.wslot)) return;
    this.owned[d.id] = (this.owned[d.id] || 0) + 1;
    if ((d.kind === 'stat' || d.kind === 'helper') && d.stat) {
      this.mods[d.stat] = (this.mods[d.stat] || 0) + (d.per || 0);
    } else if (d.kind === 'weapon' && d.weapon) {
      this.weapons.push(d.weapon);
      this.wcd.push(0);
    } else if (d.kind === 'shape' && d.shape) {
      this.shapeId = d.shape;
      const sh = SHAPES[d.shape];
      const alreadyEquipped = this.weapons.includes(sh.weapon);
      const keep = alreadyEquipped || this.weapons.length < this.stats!.wslot ? this.weapons : this.weapons.slice(1);
      this.weapons = [sh.weapon, ...keep.filter((w) => w !== sh.weapon)].slice(0, this.stats!.wslot);
      this.wcd = this.weapons.map(() => 0);
      this.fx.burst(this.px, this.py, 40, sh.color, { spd: 320, size: 4, life: 0.7 });
      this.fx.ring(this.px, this.py, 10, 130, 0.5, 6, sh.color);
      this.fx.addShake(10);
      this.banner(tr(this.lang, 'bnr_core', { name: shapeName(this.lang, sh.id, sh.name).toUpperCase() }), 1.4);
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
    this.effectBudget = 192;
    this.elapsed += dt;
    const newWave = Math.floor(this.elapsed / 30) + 1;
    if (newWave !== this.wave) {
      this.wave = newWave;
      this.banner(tr(this.lang, 'bnr_wave', { n: this.wave }), 1.3);
      sfx.buy();
    }
    if (this.bannerT > 0) this.bannerT -= dt;

    this.updatePlayer(dt);
    if (this.coop) this.syncLocalToMate();
    this.spawnDirector(dt);
    this.updateEnemies(dt);
    if (this.phase !== 'playing') return;
    this.updateHazards(dt);
    if (this.phase !== 'playing') return;
    this.updateProjs(dt);
    this.updateEBullets(dt);
    if (this.phase !== 'playing') return;
    this.updatePickups(dt);
    if (this.phase !== 'playing') { this.updateCamera(dt); return; }
    this.updateOrbitals(dt);
    this.updateHelpers(dt);
    this.updateMines(dt);
    this.updateWeapons(dt);
    if (this.coop) this.updateMates(dt);
    this.updateCamera(dt);

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
    this.panicCd = Math.max(0, this.panicCd - dt);
    this.interceptCd = Math.max(0, this.interceptCd - dt);
    if (this.stats!.interceptor > 0 && this.interceptCd <= 0) {
      const shot = this.ebullets.find((b) => b.active && Math.hypot(b.x - this.px, b.y - this.py) < 140);
      if (shot) {
        shot.active = false;
        this.interceptCd = 2 / this.stats!.interceptor;
        this.fx.lightning(this.px, this.py, shot.x, shot.y, '#9df7de');
        this.fx.burst(shot.x, shot.y, 4, '#9df7de', { spd: 100, life: 0.2 });
      }
    }
  }

  /* ------------------------------------------------ player */

  private updatePlayer(dt: number) {
    const st = this.stats!;
    // Spectating: local player is dead but the run continues via a mate.
    if (this.coop && this.localMate && !this.localMate.alive) {
      // gently drift the camera toward a living ally
      const ally = this.mates.find((m) => m.active && m.alive);
      if (ally) { this.px += (ally.x - this.px) * Math.min(1, dt * 3); this.py += (ally.y - this.py) * Math.min(1, dt * 3); }
      if (this.invuln > 0) this.invuln -= dt;
      return;
    }
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
    if (this.px > this.worldW - pad) { this.px = this.worldW - pad; this.pvx *= -0.35; }
    if (this.py < pad) { this.py = pad; this.pvy *= -0.35; }
    if (this.py > this.worldH - pad) { this.py = this.worldH - pad; this.pvy *= -0.35; }

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
    this.aimTarget = tgt;
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
          h.active = true; h.kind = 0; h.r = 13; h.color = '#fbbf24';
          h.x = clamp(this.px + Math.cos(a) * 60, 20, this.worldW - 20);
          h.y = clamp(this.py + Math.sin(a) * 60, 20, this.worldH - 20);
          h.cd = 0; h.life = 26; h.dmg = 9 * st.droneDmg; h.rot = 0;
          this.fx.ring(h.x, h.y, 4, 30, 0.4, 3, '#fbbf24');
        }
      }
    }
  }

  tryDash() { this.wantDash = true; }

  /* ---- guest input: apply to the mate controlled by that slot ---- */
  setMateInput(slot: number, mx: number, my: number, dash: boolean, aim: number) {
    const m = this.mateBySlot(slot);
    if (!m || m.local) return;
    m.inMoveX = mx; m.inMoveY = my; m.inAim = aim; m.inAimSet = true;
    if (dash) m.inDash = true;
  }

  /** Simulate every non-local mate: movement, auto-fire, upkeep. */
  private updateMates(dt: number) {
    for (const m of this.mates) {
      if (!m.active || m.local || !m.alive) continue;
      const st = m.stats!;
      // ----- movement from that client's input -----
      let ix = m.inMoveX, iy = m.inMoveY;
      const mag = Math.hypot(ix, iy);
      if (mag > 1) { ix /= mag; iy /= mag; }
      if (m.dashT > 0) {
        const ds = st.speed * 3.1;
        m.vx = m.dashDx * ds; m.vy = m.dashDy * ds;
        this.fx.burst(m.x, m.y, 1, m.color, { spd: 90, size: 3, life: 0.3, drag: 0.86 });
      } else {
        const accel = 2600;
        m.vx += (ix * st.speed - m.vx) * Math.min(1, (accel / st.speed) * dt * 0.6);
        m.vy += (iy * st.speed - m.vy) * Math.min(1, (accel / st.speed) * dt * 0.6);
      }
      m.x += m.vx * dt; m.y += m.vy * dt;
      const pad = m.pr + 4;
      if (m.x < pad) { m.x = pad; m.vx *= -0.35; }
      if (m.x > this.worldW - pad) { m.x = this.worldW - pad; m.vx *= -0.35; }
      if (m.y < pad) { m.y = pad; m.vy *= -0.35; }
      if (m.y > this.worldH - pad) { m.y = this.worldH - pad; m.vy *= -0.35; }

      // aim toward nearest enemy, else movement dir, else supplied aim
      const tgt = this.nearestEnemy(m.x, m.y, 2400);
      m.aimEnemy = tgt;
      if (tgt) m.aim = Math.atan2(tgt.y - m.y, tgt.x - m.x);
      else if (mag > 0.1) m.aim = Math.atan2(iy, ix);
      else if (m.inAimSet) m.aim = m.inAim;

      // dash
      if (m.inDash) {
        m.inDash = false;
        if (m.hasDash && m.dashCd <= 0) {
          let dx = ix, dy = iy;
          if (Math.hypot(dx, dy) < 0.1) { dx = Math.cos(m.aim); dy = Math.sin(m.aim); }
          const l = Math.hypot(dx, dy) || 1;
          m.dashDx = dx / l; m.dashDy = dy / l;
          m.dashT = 0.15; m.dashCd = 1.5 * st.dashCdMul;
          m.invuln = Math.max(m.invuln, 0.28);
          this.fx.ring(m.x, m.y, 8, 62, 0.28, 4, m.color);
          this.fx.burst(m.x, m.y, 12, '#ffffff', { spd: 300, size: 3, life: 0.32 });
        }
      }

      // upkeep timers
      if (m.invuln > 0) m.invuln -= dt;
      if (m.immortalT > 0) m.immortalT -= dt;
      if (m.dashCd > 0) m.dashCd -= dt;
      if (m.dashT > 0) m.dashT -= dt;
      if (st.regen > 0 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + st.regen * dt);
      if (m.shield < m.shieldMax) {
        m.shieldT += dt;
        if (m.shieldT > 9 * st.shieldReg) { m.shield++; m.shieldT = 0; }
      }

      // ----- weapons: reuse the host firing logic by field-swapping -----
      this.withMate(m, () => {
        m.firingTime = tgt ? Math.min(8, m.firingTime + dt) : 0;
        this.firingTime = m.firingTime;
        for (let wi = 0; wi < m.weapons.length; wi++) {
          const w = WEAPONS[m.weapons[wi]];
          if (w.kind === 'orbit') continue;
          m.wcd[wi] -= dt;
          if (m.wcd[wi] > 0) continue;
          const at = this.nearestEnemy(m.x, m.y, 1600);
          if (!at) continue;
          this.aimTarget = at;
          this.aimA = Math.atan2(at.y - m.y, at.x - m.x);
          m.aim = this.aimA;
          m.wcd[wi] = this.cooldownFor(w, wi);
          this.fireWeapon(w, wi);
        }
      });
    }
  }

  /** Run `fn` with the host player fields temporarily set to a mate's,
      so all the existing combat helpers operate on that mate. */
  private withMate(m: Mate, fn: () => void) {
    const s = this;
    const save = {
      px: s.px, py: s.py, pvx: s.pvx, pvy: s.pvy, pr: s.pr, aimA: s.aimA,
      hp: s.hp, maxHp: s.maxHp, invuln: s.invuln, shield: s.shield, shieldMax: s.shieldMax,
      shapeId: s.shapeId, weapons: s.weapons, wcd: s.wcd, mods: s.mods, owned: s.owned,
      stats: s.stats, level: s.level, xp: s.xp, xpNeed: s.xpNeed, kills: s.kills,
      score: s.score, combo: s.combo, comboT: s.comboT, firingTime: s.firingTime,
      aimTarget: s.aimTarget, hasDash: s.hasDash, dashCd: s.dashCd, dashT: s.dashT,
    };
    s.px = m.x; s.py = m.y; s.pvx = m.vx; s.pvy = m.vy; s.pr = m.pr; s.aimA = m.aim;
    s.hp = m.hp; s.maxHp = m.maxHp; s.invuln = m.invuln; s.shield = m.shield; s.shieldMax = m.shieldMax;
    s.shapeId = m.shapeId; s.weapons = m.weapons; s.wcd = m.wcd; s.mods = m.mods; s.owned = m.owned;
    s.stats = m.stats; s.level = m.level; s.xp = m.xp; s.xpNeed = m.xpNeed; s.kills = m.kills;
    s.score = m.score; s.firingTime = m.firingTime; s.hasDash = m.hasDash; s.dashCd = m.dashCd; s.dashT = m.dashT;
    try {
      fn();
    } finally {
      // pull mutated combat/progress values back into the mate
      m.x = s.px; m.y = s.py; m.vx = s.pvx; m.vy = s.pvy; m.aim = s.aimA;
      m.hp = s.hp; m.maxHp = s.maxHp; m.invuln = s.invuln; m.shield = s.shield; m.shieldMax = s.shieldMax;
      m.level = s.level; m.xp = s.xp; m.xpNeed = s.xpNeed; m.kills = s.kills; m.score = s.score;
      m.mods = s.mods; m.owned = s.owned; m.stats = s.stats; m.weapons = s.weapons; m.wcd = s.wcd;
      m.shapeId = s.shapeId; m.hasDash = s.hasDash; m.dashCd = s.dashCd; m.dashT = s.dashT;
      m.firingTime = s.firingTime;
      // restore host fields
      Object.assign(s, save);
    }
  }

  private hurtPlayer(dmg: number, sx: number, sy: number) {
    if (this.phase !== 'playing') return;
    // In co-op, route the hit to the closest living player to its source so
    // that enemy attacks can threaten either partner.
    if (this.coop) {
      let best: Mate | null = null, bestD = Infinity;
      for (const m of this.mates) {
        if (!m.active || !m.alive) continue;
        const d = Math.hypot(m.x - sx, m.y - sy);
        if (d < bestD) { bestD = d; best = m; }
      }
      if (best) this.hurtMate(best, dmg, sx, sy);
      return;
    }
    if (this.invuln > 0) return;
    const st = this.stats!;
    let d = Math.max(1, (dmg - st.armor) * (1 - st.damageReduction));
    if (this.shield > 0) {
      this.shield--;
      this.shieldT = 0;
      d = 0;
      this.fx.ring(this.px, this.py, 26, 70, 0.35, 5, '#7dd3fc');
      this.fx.burst(this.px, this.py, 14, '#7dd3fc', { spd: 240, size: 3 });
      this.invuln = 0.6 + st.invulnBonus;
      this.fx.addShake(6);
      sfx.hit();
      this.push();
      return;
    }
    this.hp -= d;
    this.invuln = 0.62 + st.invulnBonus;
    this.combo = 0; this.comboT = 0;
    this.fx.addShake(9 + Math.min(10, d * 0.25));
    this.fx.doFlash('#ff3b5c', 0.36, 0.16);
    this.fx.hitStop = 0.055;
    this.fx.burst(this.px, this.py, 18, '#ff5a72', { spd: 260, size: 3.6 });
    this.fx.text(this.px, this.py - 26, '-' + Math.round(d), '#ff6b81', 16);
    const a = Math.atan2(this.py - sy, this.px - sx);
    this.pvx += Math.cos(a) * 190; this.pvy += Math.sin(a) * 190;
    sfx.hurt();
    if (st.panicPulse && this.panicCd <= 0) {
      this.panicCd = 8;
      const radius = 120 + st.panicPulse * 35;
      for (const b of this.ebullets) {
        if (b.active && Math.hypot(b.x - this.px, b.y - this.py) < radius) b.active = false;
      }
      for (const e of this.enemies) {
        if (!e.active || Math.hypot(e.x - this.px, e.y - this.py) > radius) continue;
        const angle = Math.atan2(e.y - this.py, e.x - this.px);
        e.vx += Math.cos(angle) * 400; e.vy += Math.sin(angle) * 400;
      }
      this.fx.ring(this.px, this.py, 15, radius, 0.45, 5, '#9df7de');
    }
    if (this.hp <= 0) {
      if (st.secondwind > 0) {
        this.mods.secondwind = 0;
        this.recompute();
        this.hp = this.maxHp * 0.5;
        this.invuln = 2.2;
        this.fx.doFlash('#ffffff', 0.8, 0.5);
        this.fx.ring(this.px, this.py, 10, 300, 0.7, 8, '#ffffff');
        this.fx.addShake(22);
        this.banner(tr(this.lang, 'bnr_secondwind'), 1.6);
        for (const e of this.enemies) {
          if (!e.active) continue;
          const dd = Math.hypot(e.x - this.px, e.y - this.py);
          if (dd < 260) this.damageEnemy(e, 300, false, 0, 0);
        }
      } else if (this.coop) {
        // The local host player fell — become a spectator if a mate lives on.
        const m = this.localMate;
        if (m) { m.alive = false; m.hp = 0; }
        this.fx.doFlash('#ffffff', 0.6, 0.4);
        this.fx.addShake(20);
        this.fx.burst(this.px, this.py, 70, SHAPES[this.shapeId].color, { spd: 480, size: 5, life: 1 });
        sfx.dead();
        this.banner(tr(this.lang, 'mp_down', { name: this.playerName }), 2);
        if (this.aliveCount() === 0) this.die();
      } else {
        this.die();
      }
    }
    this.push();
  }

  private die() {
    this.hp = 0;
    this.phase = 'dead';
    this.coinsEarned = Math.max(1, Math.floor((this.score / 100 + this.kills * 0.5) * this.coinMul));
    this.fx.doFlash('#ffffff', 0.9, 0.5);
    this.fx.addShake(30);
    this.fx.burst(this.px, this.py, 90, SHAPES[this.shapeId].color, { spd: 520, size: 5, life: 1.1 });
    this.fx.ring(this.px, this.py, 10, 380, 0.9, 9, SHAPES[this.shapeId].color);
    sfx.dead();
    const row: ScoreRow = {
      name: 'YOU', score: Math.floor(this.score), level: this.level, time: this.elapsed,
      shape: this.shapeId, kills: this.kills, date: Date.now(),
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

  private cooldownFor(w: typeof WEAPONS[WeaponId], wi: number) {
    const st = this.stats!;
    const mastery = w.id === 'disc' ? st.circleGyro * 0.15 : w.id === 'volley' ? st.hexagonBurst * 0.10 : 0;
    const auxiliary = wi > 0 ? st.aux * 0.15 : 0;
    const heat = Math.min(0.4, this.firingTime * 0.06 * st.overheat);
    return w.cd / (st.rate * (1 + mastery + auxiliary + heat)) * (1 - st.cdRed);
  }

  private updateWeapons(dt: number) {
    this.aimTarget = this.nearestEnemy(this.px, this.py, 1600);
    this.firingTime = this.aimTarget ? Math.min(8, this.firingTime + dt) : 0;
    for (let wi = 0; wi < this.weapons.length; wi++) {
      const w = WEAPONS[this.weapons[wi]];
      if (w.kind === 'orbit') continue; // handled by orbitals
      this.wcd[wi] -= dt;
      if (this.wcd[wi] > 0) continue;
      if (!this.aimTarget?.active) this.aimTarget = this.nearestEnemy(this.px, this.py, 1600);
      if (!this.aimTarget) continue;
      this.aimA = Math.atan2(this.aimTarget.y - this.py, this.aimTarget.x - this.px);
      this.wcd[wi] = this.cooldownFor(w, wi);
      this.fireWeapon(w, wi);
    }
  }

  private weaponSpeed(w: typeof WEAPONS[WeaponId]) {
    const st = this.stats!;
    const seeker = w.id === 'orb' || w.id === 'missile' ? 1 + st.pentagonSeek * 0.25 : 1;
    return w.speed * st.pspd * seeker;
  }

  // Rendering and simulation share this geometry, including secondary weapons.
  getWeaponMount(weaponIndex: number, barrelIndex = 0): WeaponMount {
    const target = this.aimTarget?.active ? this.aimTarget : {
      x: this.px + Math.cos(this.aimA) * 400,
      y: this.py + Math.sin(this.aimA) * 400,
    };
    const w = WEAPONS[this.weapons[weaponIndex] || 'disc'];
    const speed = w.kind === 'beam' || w.kind === 'chain' ? 0 : this.weaponSpeed(w);
    return adjacentMount(this.px, this.py, this.pr, this.aimA,
      weaponIndex, barrelIndex, 1 + (this.stats?.barrels || 0), target, speed);
  }

  private elementalColor(base: string): string {
    const st = this.stats!;
    if (st.fire > 0 && st.frost <= 0 && st.shock <= 0) return '#ff7a45';
    if (st.frost > 0 && st.fire <= 0) return '#7dd3fc';
    if (st.shock > 0 && st.fire <= 0) return '#c4b5fd';
    if (st.poison > 0) return '#a3e635';
    if (st.voidMark > 0) return '#e879f9';
    return base;
  }

  private fireWeapon(w: typeof WEAPONS[WeaponId], wi: number) {
    const st = this.stats!;
    const target = this.aimTarget;
    if (!target?.active) return;
    const aim = { x: target.x, y: target.y, vx: target.vx, vy: target.vy };
    let damageMul = 1;
    if (w.kind === 'beam') damageMul += st.trianglePrism * 0.2 + st.focus;
    if (w.id === 'bullet') damageMul += st.squareBelt * 0.15;
    if (w.id === 'orb' || w.id === 'missile') damageMul += st.pentagonSeek * 0.2;
    if (w.id === 'arc') damageMul += st.heptagonCharge * 0.15;
    if (w.id === 'shell') damageMul += st.octagonSiege * 0.2;
    const dmgBase = w.dmg * st.dmg * damageMul;
    const count = Math.min(18, w.count + st.multi + (w.kind === 'ring' ? st.hexagonBurst * 2 : 0));
    const barrels = wi === 0 ? 1 + st.barrels : 1;
    const col = this.elementalColor(w.color);

    for (let barrel = 0; barrel < barrels; barrel++) {
      const mount = this.getWeaponMount(wi, barrel);
      const { x: ox, y: oy } = mount;
      const baseA = aimAngle(ox, oy, aim, w.kind === 'beam' || w.kind === 'chain' ? 0 : this.weaponSpeed(w));
      if (w.kind === 'beam') {
        const range = Math.max(this.worldW, this.worldH) * 1.3;
        const bw = w.radius * st.psize * (1 + st.trianglePrism * 0.15);
        const x2 = ox + Math.cos(baseA) * range;
        const y2 = oy + Math.sin(baseA) * range;
        this.fx.beam(ox, oy, x2, y2, bw, col, 0.16);
        for (const e of this.enemies) {
          if (!e.active || segmentDistanceSq(e.x, e.y, ox, oy, x2, y2) > (e.r + bw) ** 2) continue;
          const crit = Math.random() < st.crit;
          this.damageEnemy(e, dmgBase * (crit ? st.critd : 1), crit, Math.cos(baseA) * 40 * st.knock, Math.sin(baseA) * 40 * st.knock);
        }
      } else if (w.kind === 'chain') {
        const visited = new Set<number>();
        let fx = ox, fy = oy;
        const jumps = Math.min(9, w.count + Math.floor(st.multi * 0.5) + st.heptagonRelay);
        for (let j = 0; j < jumps; j++) {
          const next = this.nearestNotIn(fx, fy, (j === 0 ? 580 : 260) * st.chainRange, visited);
          if (!next) break;
          const nx = next.x, ny = next.y;
          visited.add(next.id);
          this.fx.lightning(fx, fy, nx, ny, col);
          this.damageEnemy(next, dmgBase * Math.pow(0.88, j), false, 0, 0, j === 0 ? 0 : 1);
          fx = nx; fy = ny;
        }
      } else if (w.kind === 'nova') {
        const radius = w.radius * st.aoe;
        this.explode(ox, oy, radius, dmgBase, col);
      } else {
        for (let i = 0; i < count; i++) {
          const p = this.freeProj();
          if (!p) break;
          const sp = this.weaponSpeed(w);
          const lateral = w.kind === 'ring' ? 0 : adjacentSlot(i) * 3;
          const mx = ox - Math.sin(this.aimA) * lateral;
          const my = oy + Math.cos(this.aimA) * lateral;
          const a = w.kind === 'ring'
            ? baseA + (i / count) * Math.PI * 2
            : aimAngle(mx, my, aim, sp);
          p.active = true;
          p.x = mx; p.y = my;
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
          p.r = w.radius * st.psize;
          p.dmg = dmgBase;
          p.pierce = w.pierce === 99 ? 999 : w.pierce + st.pierce + (w.id === 'bullet' ? st.squareBelt : 0);
          p.life = (w.id === 'disc' ? 1.5 : w.id === 'orb' ? 2.2 : 1.15) * st.life;
          p.kind = w.kind as Proj['kind'];
          p.color = col;
          p.rot = a; p.spin = w.kind === 'disc' ? 22 : 6;
          p.homing = w.kind === 'orb' || w.kind === 'missile' ? 4.2 + st.homing : st.homing * 1.6;
          p.aoe = (w.aoe || 0) * st.aoe * (w.id === 'shell' ? 1 + st.octagonSiege * 0.20 : 1);
          p.crit = Math.random() < st.crit;
          if (p.crit) p.dmg *= st.critd;
          p.hits.length = 0; p.bounced = st.ricochet + (w.id === 'disc' ? st.circleGyro : 0); p.split = st.bloom;
          p.trail = 0;
        }
      }
      this.fx.burst(ox, oy, w.id === 'shell' ? 6 : 2, col, { spd: 140, size: 2.4, life: 0.16, dir: baseA, spread: 0.7 });
    }
    this.fx.addShake(w.id === 'shell' ? 4 : w.kind === 'beam' ? 1.8 : 0.35);
    sfx.shoot(w.kind === 'beam' ? 'beam' : w.id);
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
      const oldX = p.x, oldY = p.y;
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
      const off = p.x < -60 || p.x > this.worldW + 60 || p.y < -60 || p.y > this.worldH + 60;
      if (!dead) {
        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j];
          if (!e.active || p.hits.indexOf(e.id) >= 0) continue;
          const rr = e.r + p.r;
          if (segmentDistanceSq(e.x, e.y, oldX, oldY, p.x, p.y) <= rr * rr) {
            const hitId = e.id;
            const a = Math.atan2(p.vy, p.vx);
            this.damageEnemy(e, p.dmg, p.crit, Math.cos(a) * 120 * st.knock, Math.sin(a) * 120 * st.knock);
            p.hits.push(hitId);
            this.fx.burst(p.x, p.y, 4, p.color, { spd: 190, size: 2.6, life: 0.24, dir: a + Math.PI, spread: 1.6 });
            if (p.aoe > 0) { this.explode(p.x, p.y, p.aoe, p.dmg * 0.85, p.color); dead = true; break; }
            if (p.pierce > 0) { p.pierce--; }
            else { dead = true; break; }
          }
        }
      }

      if (off) dead = true;
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
    if (this._dmgDepth >= Game.MAX_CASCADE || this.effectBudget <= 0) return;
    this.fx.ring(x, y, r * 0.2, r, 0.3, 6, color);
    this.fx.burst(x, y, 16, color, { spd: r * 3.4, size: 3.4, life: 0.4, drag: 0.84 });
    this.fx.addShake(4);
    sfx.explode();
    this._dmgDepth++;
    try {
      for (const e of this.enemies) {
        if (!e.active) continue;
        const dx = e.x - x, dy = e.y - y;
        if (Math.hypot(dx, dy) < r + e.r) {
          const a = Math.atan2(dy, dx);
          this.damageEnemy(e, dmg, false, Math.cos(a) * 200, Math.sin(a) * 200, 1);
        }
      }
    } finally {
      this._dmgDepth--;
    }
  }

  /* ------------------------------------------------ enemies */

  private updateEBullets(dt: number) {
    for (let i = 0; i < this.ebullets.length; i++) {
      const b = this.ebullets[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.kind === 2 && b.life > 3.2) {
        const desired = Math.atan2(this.py - b.y, this.px - b.x);
        const current = Math.atan2(b.vy, b.vx);
        const delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
        const angle = current + clamp(delta, -dt * 0.85, dt * 0.85);
        const speed = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
      }
      const oldX = b.x, oldY = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.rot += dt * 6;
      if (b.life <= 0 || b.x < -40 || b.x > this.worldW + 40 || b.y < -40 || b.y > this.worldH + 40) { b.active = false; continue; }
      const blocker = this.helpers.find((h) => h.active && h.kind === 13 && segmentDistanceSq(h.x, h.y, oldX, oldY, b.x, b.y) < (h.r + b.r) ** 2);
      if (blocker) { b.active = false; this.fx.burst(b.x, b.y, 3, blocker.color, { spd: 110, life: 0.2 }); continue; }
      const rr = this.pr + b.r;
      if (segmentDistanceSq(this.px, this.py, oldX, oldY, b.x, b.y) <= rr * rr) {
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

  private addHazard(x: number, y: number, r: number, dmg: number, delay = 1.1, color = '#ff795d') {
    const h = this.hazards.find((item) => !item.active);
    if (!h) return;
    h.active = true; h.x = clamp(x, r, this.worldW - r); h.y = clamp(y, r, this.worldH - r);
    h.r = r; h.dmg = dmg; h.color = color; h.delay = h.windup = delay; h.life = 0.3;
  }

  private updateHazards(dt: number) {
    for (const h of this.hazards) {
      if (!h.active) continue;
      if (h.delay > 0) {
        h.delay -= dt;
        if (h.delay > 0) continue;
        this.fx.ring(h.x, h.y, h.r * 0.25, h.r, 0.35, 6, h.color);
        this.fx.burst(h.x, h.y, 14, h.color, { spd: 270, size: 3, life: 0.4 });
        this.fx.addShake(4);
        sfx.explode();
        if (Math.hypot(this.px - h.x, this.py - h.y) <= h.r + this.pr) this.hurtPlayer(h.dmg, h.x, h.y);
      } else {
        h.life -= dt;
        if (h.life <= 0) h.active = false;
      }
    }
  }

  private updateSpecialEnemy(e: Enemy, dt: number, speed: number, ux: number, uy: number, dist: number) {
    const steer = (desired: number, orbit = 0) => {
      const radial = dist > desired + 35 ? 1 : dist < desired - 35 ? -0.65 : 0;
      const response = Math.min(1, dt * 3.5);
      e.vx += (speed * (ux * radial - uy * orbit) - e.vx) * response;
      e.vy += (speed * (uy * radial + ux * orbit) - e.vy) * response;
    };
    const attackDt = dt * (e.frozen > 0 ? 0.3 : 1);
    const bossRate = e.enraged ? 1.35 : 1;
    switch (e.atk) {
      case 'charge':
      case 'siegeBoss': {
        const boss = e.atk === 'siegeBoss';
        const dashSpeed = boss ? 440 : 510;
        if (e.state === 0) {
          steer(280);
          if (e.atkT <= 0 && dist < 640) {
            e.state = 1; e.windup = boss ? 1.05 : 0.75;
            e.ax = Math.atan2(uy, ux); e.ay = Math.min(boss ? 450 : 340, dist + 70);
          }
        } else if (e.state === 1) {
          e.vx *= Math.exp(-dt * 12); e.vy *= Math.exp(-dt * 12);
          e.windup -= attackDt;
          if (e.windup <= 0) { e.state = 2; e.windup = e.ay / dashSpeed; }
        } else {
          e.vx = Math.cos(e.ax) * dashSpeed * (e.frozen > 0 ? 0.3 : 1);
          e.vy = Math.sin(e.ax) * dashSpeed * (e.frozen > 0 ? 0.3 : 1);
          e.windup -= attackDt;
          if (e.windup <= 0) {
            e.state = 0; e.atkT = e.def.atkCd / bossRate; e.vx *= 0.12; e.vy *= 0.12;
            if (boss) {
              this.addHazard(e.x, e.y, 140, e.dmg * 0.8, 0.85, e.def.color);
              if (e.enraged) {
                for (let i = -1; i <= 1; i += 2) this.addHazard(this.px + i * 130, this.py, 76, e.dmg * 0.65, 1.15, e.def.color);
              }
            }
          }
        }
        break;
      }
      case 'skirmish': {
        steer(255, e.id % 2 ? 0.9 : -0.9);
        if (e.atkT <= 0 && dist < 570) {
          e.atkT = e.def.atkCd;
          const aim = Math.atan2(this.py + this.pvy * 0.2 - e.y, this.px + this.pvx * 0.2 - e.x);
          for (let i = -1; i <= 1; i++) this.eShoot(e.x, e.y, aim + i * 0.14, 230, e.dmg * 0.5, 4.5, e.def.color);
        }
        break;
      }
      case 'bulwark': {
        steer(200);
        const desired = Math.atan2(uy, ux);
        const delta = Math.atan2(Math.sin(desired - e.rot), Math.cos(desired - e.rot));
        e.rot += clamp(delta, -dt * 0.8, dt * 0.8);
        if (e.atkT <= 0 && dist < 490) {
          e.atkT = e.def.atkCd;
          for (let i = -1; i <= 1; i++) this.eShoot(e.x, e.y, e.rot + i * 0.24, 185, e.dmg * 0.45, 6, e.def.color);
        }
        break;
      }
      case 'homing': {
        steer(330, 0.2);
        if (e.atkT <= 0 && dist < 630) {
          e.atkT = e.def.atkCd;
          const aim = Math.atan2(uy, ux);
          for (let i = -1; i <= 1; i++) this.eShoot(e.x, e.y, aim + i * 0.38, 170, e.dmg * 0.55, 6.5, e.def.color, 2);
          this.fx.ring(e.x, e.y, e.r, e.r + 20, 0.3, 2, e.def.color);
        }
        break;
      }
      case 'mend': {
        steer(390, -0.25);
        if (e.state === 0 && e.atkT <= 0) { e.state = 1; e.windup = 0.85; }
        if (e.state === 1) {
          e.windup -= attackDt;
          if (e.windup <= 0) {
            e.state = 0; e.atkT = e.def.atkCd;
            let healed = 0;
            for (const ally of this.enemies) {
              if (!ally.active || ally.id === e.id || ally.hp >= ally.maxHp || Math.hypot(ally.x - e.x, ally.y - e.y) > 230) continue;
              ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * (ally.def.boss ? 0.012 : 0.08));
              this.fx.beam(e.x, e.y, ally.x, ally.y, 2, '#ffb0ce', 0.3);
              if (++healed >= 4) break;
            }
            this.fx.ring(e.x, e.y, e.r, 230, 0.45, 2, e.def.color);
          }
        }
        break;
      }
      case 'mortar': {
        steer(490);
        if (e.atkT <= 0 && dist < 720) {
          e.atkT = e.def.atkCd;
          this.addHazard(this.px + this.pvx * 0.3, this.py + this.pvy * 0.3, 85, e.dmg, 1.25, e.def.color);
          this.fx.ring(e.x, e.y, e.r, e.r + 18, 0.25, 3, e.def.color);
        }
        break;
      }
      case 'prismBoss': {
        if (e.state === 0) {
          steer(340, 0.3);
          if (e.atkT <= 0 && dist < 740) { e.state = 1; e.windup = 1.15; e.ax = Math.atan2(uy, ux); }
        } else {
          e.vx *= Math.exp(-dt * 9); e.vy *= Math.exp(-dt * 9);
          e.windup -= attackDt;
          if (e.state === 1 && e.windup <= 0) {
            e.state = 2; e.windup = 0.22;
            const count = e.enraged ? 5 : 3;
            for (let i = 0; i < count; i++) {
              const a = e.ax + i * Math.PI * 2 / count;
              const x2 = e.x + Math.cos(a) * 900, y2 = e.y + Math.sin(a) * 900;
              this.fx.beam(e.x, e.y, x2, y2, 7, e.def.color, 0.22);
              if (segmentDistanceSq(this.px, this.py, e.x, e.y, x2, y2) < (this.pr + 7) ** 2) this.hurtPlayer(e.dmg, e.x, e.y);
            }
            this.fx.addShake(5); sfx.shoot('beam');
          } else if (e.state === 2 && e.windup <= 0) {
            e.state = 0; e.atkT = e.def.atkCd / bossRate;
          }
        }
        break;
      }
      case 'broodBoss': {
        steer(360, 0.18);
        e.auxT -= attackDt * bossRate;
        if (e.auxT <= 0 && dist < 850) {
          e.auxT = 0.4;
          const count = e.enraged ? 4 : 3;
          for (let i = 0; i < count; i++) this.eShoot(e.x, e.y, e.age * 1.2 + i * Math.PI * 2 / count, 155, e.dmg * 0.42, 5, e.def.color, 1);
        }
        if (e.atkT <= 0 && dist < 800) {
          e.atkT = e.def.atkCd / bossRate;
          for (let i = 0; i < (e.enraged ? 3 : 2); i++) {
            const angle = e.rot + i * Math.PI;
            const id = i === 2 ? 'eharrier' : i === 1 ? 'elancer' : 'ecircle';
            this.spawnEnemy(id, e.x + Math.cos(angle) * 68, e.y + Math.sin(angle) * 68, 0.65);
          }
          this.fx.ring(e.x, e.y, e.r, e.r + 50, 0.5, 4, e.def.color);
        }
        break;
      }
    }
  }

  private updateEnemies(dt: number) {
    const st = this.stats!;
    const slowField = st.slowfield;
    // In co-op, temporarily point the "player" fields at the nearest living
    // mate so every existing attack targets whoever is closest.
    const coopSave = this.coop ? { px: this.px, py: this.py, pr: this.pr } : null;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active) continue;
      if (coopSave) {
        let best: Mate | null = null, bd = Infinity;
        for (const m of this.mates) {
          if (!m.active || !m.alive) continue;
          const d = (m.x - e.x) ** 2 + (m.y - e.y) ** 2;
          if (d < bd) { bd = d; best = m; }
        }
        if (best) { this.px = best.x; this.py = best.y; this.pr = best.pr; }
      }
      const oldX = e.x, oldY = e.y;
      if (e.frozen > 0) { e.frozen -= dt; }
      const slowed = (slowField > 0 && Math.hypot(e.x - this.px, e.y - this.py) < 165) ? 1 - slowField : 1;
      const spd = e.speed * slowed * (e.frozen > 0 ? 0.12 : 1);
      const dx = this.px - e.x, dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      e.rot += e.spin * dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.hitCd > 0) e.hitCd -= dt;
      // elemental DoTs
      if (e.burn > 0) {
        e.burn -= dt;
        e.hp -= e.burnDps * dt;
        if (Math.random() < dt * 8) this.fx.burst(e.x, e.y, 1, '#ff7a45', { spd: 40, size: 2, life: 0.25, drag: 0.9 });
        if (e.hp <= 0) { this.killEnemy(e); continue; }
      }
      if (e.poison > 0) {
        e.poison -= dt;
        e.hp -= e.poisonDps * dt;
        if (Math.random() < dt * 5) this.fx.burst(e.x, e.y, 1, '#a3e635', { spd: 30, size: 2.2, life: 0.3, drag: 0.92 });
        if (e.hp <= 0) { this.killEnemy(e); continue; }
      }
      if (e.marked > 0) e.marked -= dt;
      if (e.voided > 0) e.voided = Math.max(0, e.voided - dt * 0.15);
      if (e.def.boss && !e.enraged && e.hp < e.maxHp * 0.5) {
        e.enraged = true;
        // A phase change starts a fresh warning instead of adding surprise rays
        // to an attack whose telegraph is already about to finish.
        e.state = 0; e.windup = 0; e.atkT = 0.9; e.auxT = 0.8;
        e.vx *= 0.25; e.vy *= 0.25;
        this.fx.ring(e.x, e.y, e.r, e.r * 2.6, 0.65, 5, e.def.color);
        this.banner(tr(this.lang, 'bnr_enraged', { name: enemyName(this.lang, e.def.id, e.def.name) }), 1.8);
      }
      e.atkT -= dt * (e.frozen > 0 ? 0.3 : 1);

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
            e.atkT = e.def.atkCd / (e.enraged ? 1.35 : 1);
            const n = e.def.boss ? (e.enraged ? 22 : 16) : 9;
            const off = e.age * 0.7;
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
          if (e.state === 0 && e.atkT <= 0 && dist < 170) { e.state = 1; e.windup = 0.75; }
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
          this.updateSpecialEnemy(e, dt, spd, ux, uy, dist);
        }
      }

      e.age += dt;
      e.x += e.vx * dt; e.y += e.vy * dt;

      // push off arena walls (skipped while still entering)
      if (e.age > 1.2) {
        const pad = e.r;
        if (e.x < pad) { e.x = pad; e.vx = Math.abs(e.vx); }
        if (e.x > this.worldW - pad) { e.x = this.worldW - pad; e.vx = -Math.abs(e.vx); }
        if (e.y < pad) { e.y = pad; e.vy = Math.abs(e.vy); }
        if (e.y > this.worldH - pad) { e.y = this.worldH - pad; e.vy = -Math.abs(e.vy); }
      } else {
        const pad = e.r + 30;
        if (e.x < -pad) e.x = -pad;
        if (e.x > this.worldW + pad) e.x = this.worldW + pad;
        if (e.y < -pad) e.y = -pad;
        if (e.y > this.worldH + pad) e.y = this.worldH + pad;
      }

      // contact with player
      const cr = e.r + this.pr - 3;
      if (segmentDistanceSq(this.px, this.py, oldX, oldY, e.x, e.y) < cr * cr) {
        if (e.hitCd <= 0) {
          e.hitCd = 0.55;
          this.hurtPlayer(e.dmg, e.x, e.y);
          if (st.thorns > 0) this.damageEnemy(e, st.thorns, false, -ux * 200, -uy * 200);
          const a = Math.atan2(e.y - this.py, e.x - this.px);
          e.vx += Math.cos(a) * 210; e.vy += Math.sin(a) * 210;
        }
      }
    }
    if (coopSave) { this.px = coopSave.px; this.py = coopSave.py; this.pr = coopSave.pr; }

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

  private _dmgDepth = 0;
  private static readonly MAX_CASCADE = 4;

  private nearestNotIn(x: number, y: number, max: number, set: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bd = max * max;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active || e.hp <= 0 || set.has(e.id)) continue;
      const dx = e.x - x, dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, kx: number, ky: number, chainDepth = 0) {
    if (!e.active || e.hp <= 0 || !Number.isFinite(dmg) || dmg <= 0) return;
    if (chainDepth > 0 && this.effectBudget-- <= 0) return;
    const st = this.stats!;
    const primary = chainDepth === 0;
    const sourceId = e.id, sourceX = e.x, sourceY = e.y;
    let d = dmg;
    if (primary) {
      if (e.hp / e.maxHp < 0.35) d *= 1 + st.exec;
      if (e.r >= 21) d *= 1 + st.giant;
      if (e.r <= 14) d *= 1 + st.swarm;
      if (e.marked > 0) d *= 1.25;
      if (e.voided > 0) d *= 1 + 0.12 * e.voided;
      if (e.burn > 0) d *= 1 + st.combustion;
      if (e.frozen > 0) d *= 1 + st.shatter;
    }
    if (e.def.boss) d *= 1 + st.bossHunter;
    if (primary && e.atk === 'bulwark' && Math.hypot(kx, ky) > 0) {
      const incoming = (kx * Math.cos(e.rot) + ky * Math.sin(e.rot)) / Math.hypot(kx, ky);
      if (incoming < -0.35) d *= 0.35;
    }
    const dealt = Math.min(e.hp, d);
    e.hp -= d;
    e.flash = 0.14;
    e.vx += kx; e.vy += ky;
    if (st.leech > 0) this.hp = Math.min(this.maxHp, this.hp + dealt * st.leech);
    if (primary && st.fire > 0) {
      e.burn = Math.max(e.burn, (1.6 + st.fire * 0.5) * st.firedmg);
      e.burnDps = Math.max(e.burnDps, d * 0.18 * st.firedmg * st.fire);
      this.fx.burst(e.x, e.y, 2, '#ff7a45', { spd: 80, size: 2.2, life: 0.25 });
    }
    if (primary && (st.frost > 0 || st.freeze > 0)) {
      const chance = Math.min(0.85, 0.22 * (st.frost || 0) * st.frostpow + (st.freeze || 0));
      if (Math.random() < chance) {
        const duration = (0.7 + 0.35 * Math.max(1, st.frost) * st.frostpow) * (e.def.boss ? 0.4 : 1);
        e.frozen = Math.max(e.frozen, duration);
        this.fx.burst(e.x, e.y, 3, '#7dd3fc', { spd: 90, size: 2.4, life: 0.3 });
      }
    }
    if (primary && st.poison > 0) {
      e.poison = Math.max(e.poison, 2.4 + st.poison * 0.6);
      e.poisonDps = Math.max(e.poisonDps, d * 0.12 * st.poison * st.poisonMul);
    }
    if (primary && st.voidMark > 0) {
      e.voided = Math.min(5, e.voided + 0.5 * st.voidMark);
    }
    if (primary && st.mark > 0 && e.marked <= 0) {
      e.marked = 3.5;
      this.fx.ring(e.x, e.y, e.r, e.r + 18, 0.3, 2, '#ffe066');
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

    // Secondary hits cannot start fresh proc trees. Each lightning cast visits
    // an enemy only once, and all secondary work shares a bounded frame budget.
    if (!primary) return;
    if (st.explode > 0 && Math.random() < 0.15 * st.explode) this.explode(sourceX, sourceY, 46 * st.aoe, d * 0.6, '#ffb347');
    if (st.shock > 0 || st.chainhit > 0) {
      const visited = new Set<number>([sourceId]);
      const jumps = Math.min(8, st.shock + st.chainhit + st.heptagonRelay);
      const range = (180 + 30 * st.shockpow) * st.chainRange;
      let x = sourceX, y = sourceY;
      for (let i = 0; i < jumps && this.effectBudget > 0; i++) {
        const next = this.nearestNotIn(x, y, range, visited);
        if (!next) break;
        visited.add(next.id);
        const nx = next.x, ny = next.y;
        this.fx.lightning(x, y, nx, ny, '#c4b5fd');
        const power = d * 0.45 * st.shockpow * (1 + st.heptagonCharge * 0.15) * Math.pow(0.75, i);
        this.damageEnemy(next, power, false, 0, 0, 1);
        x = nx; y = ny;
      }
    }
  }

  private killEnemy(enemy: Enemy) {
    if (!enemy.active) return;
    // Snapshot before freeing the pool slot: death effects can spawn new foes.
    const e = { ...enemy };
    enemy.active = false;
    enemy.hp = 0;
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
      this.banner(tr(this.lang, 'bnr_bossDown', { name: enemyName(this.lang, e.def.id, e.def.name) }), 1.8);
      for (const b of this.ebullets) b.active = false;
      for (const h of this.hazards) h.active = false;
      // Co-op reward: killing a boss grants every living player a short
      // window of immortality to celebrate & clean up.
      if (this.coop) {
        for (const m of this.mates) {
          if (m.active && m.alive) { m.immortalT = Math.max(m.immortalT, 3); }
        }
        this.invuln = Math.max(this.invuln, 3);
        this.banner(tr(this.lang, 'mp_bossReward'), 2);
      }
    } else {
      this.fx.addShake(Math.min(4, 1 + e.r * 0.08));
      sfx.kill();
    }
    if (gain >= 60) this.fx.text(e.x, e.y - e.r - 10, '+' + Math.round(gain), '#7dfcd6', 14);

    // Loot: green XP + heal orbs drop only sometimes, never from every foe.
    if (e.def.boss) {
      // bosses always shower loot
      const shards = 10;
      const per = (e.xp * st.xpMul) / shards;
      for (let i = 0; i < shards; i++) {
        const a = (i / shards) * Math.PI * 2;
        this.dropPickup(e.x + Math.cos(a) * 22, e.y + Math.sin(a) * 22, per, false);
      }
      for (let i = 0; i < 3; i++) this.dropPickup(e.x + rnd(-34, 34), e.y + rnd(-34, 34), 0, true);
    } else {
      // XP orb: ~38% of kills, carries the enemy's full XP value
      if (Math.random() < 0.38) this.dropPickup(e.x, e.y, e.xp * st.xpMul, false);
      // Heal orb: rare, slightly more likely from bigger shapes
      const healChance = 0.038 + Math.min(0.05, e.r * 0.0016);
      if (Math.random() < healChance) this.dropPickup(e.x, e.y, 0, true);
    }

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
      // XP gems no longer expire and vanish — they persist until collected so
      // progress can never be lost by walking away for a moment. (Rare heal
      // orbs still fade so the field stays readable.)
      p.active = true; p.x = x; p.y = y; p.v = v; p.heal = heal;
      p.life = heal ? 26 : 1e9;
      const a = Math.random() * 6.28;
      p.vx = Math.cos(a) * rnd(30, 110); p.vy = Math.sin(a) * rnd(30, 110);
      return;
    }
  }

  private updatePickups(dt: number) {
    const st = this.stats!;
    // In co-op every alive player magnetises and can pick up orbs, and their
    // XP goes into that player's own pool. Solo keeps the original path.
    if (this.coop) { this.updatePickupsCoop(dt); return; }
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
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.12 * (1 + st.fieldMedicine));
          this.fx.text(this.px, this.py - 28, '+' + tr(this.lang, 'hp'), '#7dfcd6', 15);
          this.fx.ring(this.px, this.py, 10, 50, 0.3, 3, '#7dfcd6');
        } else {
          this.gainXP(p.v);
          if (p.v >= 30) {
            this.fx.text(this.px, this.py - 30, '+' + Math.round(p.v) + ' ' + tr(this.lang, 'xpShort'), '#5ef07a', 14);
            this.fx.ring(this.px, this.py, 8, 44, 0.26, 3, '#5ef07a');
          }
        }
        this.fx.burst(p.x, p.y, 3, p.heal ? '#8affc0' : '#5ef07a', { spd: 110, size: 2.4, life: 0.24 });
        sfx.pickup();
      }
    }
  }

  private updatePickupsCoop(dt: number) {
    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      // magnetise toward the nearest living player within their pickup radius
      let best: Mate | null = null, bestD = Infinity;
      for (const m of this.mates) {
        if (!m.active || !m.alive || !m.stats) continue;
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d < m.stats.pickup && d < bestD) { bestD = d; best = m; }
      }
      if (best) {
        const dx = best.x - p.x, dy = best.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = 1 - d / best.stats!.pickup;
        const acc = 700 + k * k * 3800;
        p.vx += (dx / d) * acc * dt; p.vy += (dy / d) * acc * dt;
      }
      p.vx *= Math.pow(0.92, dt * 60); p.vy *= Math.pow(0.92, dt * 60);
      p.x += p.vx * dt; p.y += p.vy * dt;
      // collection: any player whose body overlaps the orb
      for (const m of this.mates) {
        if (!m.active || !m.alive || !m.stats) continue;
        if (Math.hypot(m.x - p.x, m.y - p.y) >= m.pr + 8) continue;
        p.active = false;
        if (p.heal) {
          m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.12 * (1 + m.stats.fieldMedicine));
          this.fx.text(m.x, m.y - 28, '+' + tr(this.lang, 'hp'), '#7dfcd6', 15);
          this.fx.ring(m.x, m.y, 10, 50, 0.3, 3, '#7dfcd6');
        } else {
          this.grantXP(m, p.v);
          if (p.v >= 30) {
            this.fx.text(m.x, m.y - 30, '+' + Math.round(p.v) + ' ' + tr(this.lang, 'xpShort'), '#5ef07a', 14);
            this.fx.ring(m.x, m.y, 8, 44, 0.26, 3, '#5ef07a');
          }
        }
        this.fx.burst(p.x, p.y, 3, p.heal ? '#8affc0' : '#5ef07a', { spd: 110, size: 2.4, life: 0.24 });
        sfx.pickup();
        if (m.local) this.syncMateToLocal();
        break;
      }
    }
  }

  /** Grant XP to a specific mate; triggers that mate's level-up. */
  private grantXP(m: Mate, v: number) {
    m.xp += v;
    m.score += v * 2 * (m.stats?.scoreMul || 1);
    while (m.xp >= m.xpNeed) {
      m.xp -= m.xpNeed;
      m.level++;
      m.xpNeed = Math.floor(8 + m.level * 4.5 + Math.pow(m.level, 1.6));
      this.mateLevelUp(m);
    }
    if (m.local) { this.xp = m.xp; this.level = m.level; this.xpNeed = m.xpNeed; this.score = m.score; }
  }

  private mateLevelUp(m: Mate) {
    this.fx.ring(m.x, m.y, 14, 230, 0.6, 6, '#ffe066');
    this.fx.burst(m.x, m.y, 30, '#ffe066', { spd: 330, size: 3.4, life: 0.7 });
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * (0.06 + (m.stats?.levelRepair || 0)));
    if (m.choosing) { m.pendingLevels++; return; }
    this.openMateChoice(m);
  }

  /** Begin a mate's upgrade selection. The whole run pauses (shared pause):
      the level-up overlay shows only the choosing player's cards; others watch. */
  private openMateChoice(m: Mate) {
    this.rollMateChoices(m);
    if (m.choices.length === 0) { m.score += 250 * (m.stats?.scoreMul || 1); return; }
    m.choosing = true;
    this.levelupSlot = m.slot;
    sfx.levelUp();
    this.phase = 'levelup';
    if (m.local) {
      // reflect into host player choice fields so the local picker shows it
      this.choices = m.choices; this.rerolls = m.rerolls;
    } else {
      this.onMateLevelUp?.(m);
    }
    this.push();
  }

  private rollMateChoices(m: Mate) {
    const savedShape = this.shapeId, savedMods = this.mods, savedOwned = this.owned,
      savedWeapons = this.weapons, savedStats = this.stats, savedChoices = this.choices,
      savedRerolls = this.rerolls;
    this.shapeId = m.shapeId; this.mods = m.mods; this.owned = m.owned;
    this.weapons = m.weapons; this.stats = m.stats;
    this.rerolls = m.rerolls;
    this.rollChoices();
    m.choices = this.choices; m.rerolls = this.rerolls;
    this.shapeId = savedShape; this.mods = savedMods; this.owned = savedOwned;
    this.weapons = savedWeapons; this.stats = savedStats; this.choices = savedChoices;
    this.rerolls = savedRerolls;
  }

  /** Apply an upgrade choice for the mate that is currently choosing. */
  pickForSlot(slot: number, key: string) {
    const m = this.mateBySlot(slot);
    if (!m || !m.choosing) return;
    const c = m.choices.find((x) => x.key === key);
    if (!c) return;
    this.withMate(m, () => { this.applyUpgrade(c.def); });
    this.recomputeMate(m);
    if (m.local) { this.recompute(); this.syncMateToLocal(); }
    m.choices = [];
    sfx.buy();
    if (m.pendingLevels > 0) {
      m.pendingLevels--;
      this.rollMateChoices(m);
      if (m.choices.length > 0) {
        if (m.local) { this.choices = m.choices; this.rerolls = m.rerolls; }
        else this.onMateLevelUp?.(m);
        this.push();
        return;
      }
    }
    m.choosing = false;
    m.pendingLevels = 0;
    this.levelupSlot = -1;
    this.phase = 'playing';
    this.choices = [];
    this.push();
  }

  rerollForSlot(slot: number) {
    const m = this.mateBySlot(slot);
    if (!m || !m.choosing || m.rerolls <= 0) return;
    m.rerolls--;
    this.rerollTokens = m.rerolls;
    this.onSpendReroll?.();
    this.rollMateChoices(m);
    if (m.local) { this.choices = m.choices; this.rerolls = m.rerolls; }
    else this.onMateLevelUp?.(m);
    this.fx.burst(m.x, m.y, 14, '#c4b5fd', { spd: 240, size: 3, life: 0.4 });
    sfx.select();
    this.push();
  }

  /** Damage a specific mate (enemy contact / bullets in co-op). */
  private hurtMate(m: Mate, dmg: number, sx: number, sy: number) {
    if (!m.alive || m.invuln > 0 || m.immortalT > 0) return;
    const st = m.stats!;
    let d = Math.max(1, (dmg - st.armor) * (1 - st.damageReduction));
    if (m.shield > 0) {
      m.shield--; m.shieldT = 0; m.invuln = 0.6 + st.invulnBonus;
      this.fx.ring(m.x, m.y, 26, 70, 0.35, 5, '#7dd3fc');
      this.fx.burst(m.x, m.y, 14, '#7dd3fc', { spd: 240, size: 3 });
      if (m.local) this.syncMateToLocal();
      return;
    }
    m.hp -= d;
    m.invuln = 0.62 + st.invulnBonus;
    this.fx.burst(m.x, m.y, 14, '#ff5a72', { spd: 240, size: 3.4 });
    this.fx.text(m.x, m.y - 26, '-' + Math.round(d), '#ff6b81', 15);
    const a = Math.atan2(m.y - sy, m.x - sx);
    m.vx += Math.cos(a) * 180; m.vy += Math.sin(a) * 180;
    if (m.hp <= 0) {
      if ((m.mods.secondwind || 0) > 0) {
        m.mods.secondwind = 0; this.recomputeMate(m);
        m.hp = m.maxHp * 0.5; m.invuln = 2.2;
        this.fx.ring(m.x, m.y, 10, 300, 0.7, 8, '#ffffff');
        this.banner(m.name + ': ' + tr(this.lang, 'bnr_secondwind'), 1.6);
      } else {
        this.mateDies(m);
      }
    }
    if (m.local) this.syncMateToLocal();
  }

  private mateDies(m: Mate) {
    m.alive = false; m.hp = 0;
    this.fx.doFlash('#ffffff', 0.6, 0.4);
    this.fx.addShake(20);
    this.fx.burst(m.x, m.y, 70, m.color, { spd: 480, size: 5, life: 1 });
    this.fx.ring(m.x, m.y, 10, 340, 0.8, 8, m.color);
    sfx.dead();
    this.banner(tr(this.lang, 'mp_down', { name: m.name }), 2);
    // If nobody is left alive, the whole run ends.
    if (this.aliveCount() === 0) this.die();
    else this.push();
  }

  private gainXP(v: number) {
    this.xp += v;
    this.score += v * 2 * this.stats!.scoreMul;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.xpNeed = Math.floor(8 + this.level * 4.5 + Math.pow(this.level, 1.6));
      this.levelUp();
    }
  }

  private levelUp() {
    sfx.levelUp();
    this.fx.ring(this.px, this.py, 14, 230, 0.6, 6, '#ffe066');
    this.fx.burst(this.px, this.py, 30, '#ffe066', { spd: 330, size: 3.4, life: 0.7 });
    this.fx.doFlash('#ffe066', 0.22, 0.24);
    this.fx.addShake(5);
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * (0.06 + this.stats!.levelRepair));
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
    const wantBlades = this.weapons.includes('blades') ? 2 + (this.weapons[0] === 'blades' ? st.barrels : 0) : 0;
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
    // ---- ensure desired permanent helpers exist ----
    // kind map:
    // 0 turret, 1 basic drone, 2 companion,
    // 3 laser drone, 4 frost drone, 5 fire drone, 6 shock drone,
    // 7 heal drone, 8 shield drone, 9 sniper, 10 flamethrower,
    // 11 beacon, 12 wolf, 13 golem, 14 prism
    const wants: { kind: number; n: number; r: number; dmg: number; col: string }[] = [
      { kind: 1,  n: Math.floor(st.drones),      r: 9,  dmg: 7 * st.droneDmg, col: '#8ef7ff' },
      { kind: 2,  n: Math.floor(st.companion),   r: 13 * st.companionDmg, dmg: 12 * st.companionDmg, col: '#7dfcd6' },
      { kind: 3,  n: Math.floor(st.laserDrone),  r: 10, dmg: 11 * st.droneDmg, col: '#5ce1ff' },
      { kind: 4,  n: Math.floor(st.frostDrone),  r: 9,  dmg: 6 * st.droneDmg,  col: '#7dd3fc' },
      { kind: 5,  n: Math.floor(st.fireDrone),   r: 9,  dmg: 7 * st.droneDmg,  col: '#ff7a45' },
      { kind: 6,  n: Math.floor(st.shockDrone),  r: 9,  dmg: 8 * st.droneDmg,  col: '#c4b5fd' },
      { kind: 7,  n: Math.floor(st.healDrone),   r: 10, dmg: 0,                 col: '#6ee7b7' },
      { kind: 8,  n: Math.floor(st.shieldDrone), r: 11, dmg: 0,                 col: '#7dd3fc' },
      { kind: 12, n: Math.floor(st.wolf),        r: 12, dmg: 14 * st.companionDmg, col: '#fb923c' },
      { kind: 13, n: Math.floor(st.golem),       r: 18, dmg: 18 * st.companionDmg, col: '#a8a29e' },
      { kind: 14, n: Math.floor(st.prism),       r: 10, dmg: 10 * st.droneDmg,  col: '#fde047' },
    ];
    for (const w of wants) {
      let have = 0;
      for (const h of this.helpers) {
        if (!h.active || h.kind !== w.kind) continue;
        h.dmg = w.dmg; h.r = w.r;
        if (have++ >= w.n) h.active = false;
      }
      for (let i = have; i < w.n; i++) {
        const h = this.freeHelper();
        if (!h) break;
        h.active = true; h.kind = w.kind; h.r = w.r; h.life = Infinity; h.cd = rnd(0, 0.6);
        h.dmg = w.dmg; h.color = w.col; h.x = this.px + rnd(-20, 20); h.y = this.py + rnd(-20, 20);
        h.vx = h.vy = 0; h.rot = 0;
      }
    }
    // drop temporary turrets / snipers / flamethrowers / beacons periodically
    if (st.sniper > 0) {
      this.sniperT -= dt;
      if (this.sniperT <= 0) {
        this.sniperT = 20;
        for (let i = 0; i < st.sniper; i++) {
          const h = this.freeHelper(); if (!h) break;
          const a = Math.random() * 6.28;
          h.active = true; h.kind = 9; h.r = 12; h.life = 20; h.color = '#e2e8f0';
          h.x = clamp(this.px + Math.cos(a) * 70, 20, this.worldW - 20);
          h.y = clamp(this.py + Math.sin(a) * 70, 20, this.worldH - 20);
          h.cd = 0; h.dmg = 22 * st.droneDmg; h.rot = 0;
          this.fx.ring(h.x, h.y, 4, 28, 0.35, 3, '#e2e8f0');
        }
      }
    }
    if (st.flamethrower > 0) {
      this.flameT -= dt;
      if (this.flameT <= 0) {
        this.flameT = 16;
        for (let i = 0; i < st.flamethrower; i++) {
          const h = this.freeHelper(); if (!h) break;
          const a = Math.random() * 6.28;
          h.active = true; h.kind = 10; h.r = 14; h.life = 14; h.color = '#ff7a45';
          h.x = clamp(this.px + Math.cos(a) * 55, 20, this.worldW - 20);
          h.y = clamp(this.py + Math.sin(a) * 55, 20, this.worldH - 20);
          h.cd = 0; h.dmg = 9 * st.droneDmg; h.rot = 0;
          this.fx.ring(h.x, h.y, 4, 28, 0.35, 3, '#ff7a45');
        }
      }
    }
    if (st.beacon > 0) {
      this.beaconT -= dt;
      if (this.beaconT <= 0) {
        this.beaconT = 22;
        for (let i = 0; i < st.beacon; i++) {
          const h = this.freeHelper(); if (!h) break;
          const a = Math.random() * 6.28;
          h.active = true; h.kind = 11; h.r = 16; h.life = 18; h.color = '#fde047';
          h.x = clamp(this.px + Math.cos(a) * 80, 20, this.worldW - 20);
          h.y = clamp(this.py + Math.sin(a) * 80, 20, this.worldH - 20);
          h.cd = 0; h.dmg = 0; h.rot = 0;
          this.fx.ring(h.x, h.y, 6, 40, 0.4, 3, '#fde047');
        }
      }
    }

    // ---- tick helpers ----
    let orbitIdx = 0;
    let nearBeacon = false;
    for (const h of this.helpers) {
      if (!h.active) continue;
      // temporary helpers expire
      if (h.kind === 0 || h.kind === 9 || h.kind === 10 || h.kind === 11) {
        h.dmg = (h.kind === 9 ? 22 : h.kind === 11 ? 0 : 9) * st.droneDmg;
        h.life -= dt;
        if (h.life <= 0) {
          h.active = false;
          this.fx.burst(h.x, h.y, 8, h.kind === 10 ? '#ff7a45' : '#fbbf24', { spd: 140, size: 3, life: 0.35 });
          continue;
        }
      }

      // orbiting drones (1,3,4,5,6,7,8,14)
      if ([1, 3, 4, 5, 6, 7, 8, 14].includes(h.kind)) {
        orbitIdx++;
        const a = this.elapsed * 1.5 * st.orbitSpd + orbitIdx * 0.9;
        const R = 50 + (orbitIdx % 3) * 16 + (h.kind === 14 ? 20 : 0);
        const tx = this.px + Math.cos(a) * R, ty = this.py + Math.sin(a) * R;
        h.x += (tx - h.x) * Math.min(1, dt * 8);
        h.y += (ty - h.y) * Math.min(1, dt * 8);
        h.rot = a;
        h.cd -= dt * st.droneRate;

        if (h.kind === 7) {
          // medic: heal player
          if (h.cd <= 0) {
            h.cd = 1.4;
            if (this.hp < this.maxHp) {
              this.hp = Math.min(this.maxHp, this.hp + 4 + st.droneDmg * 2);
              this.fx.beam(h.x, h.y, this.px, this.py, 2, '#6ee7b7', 0.2);
              this.fx.burst(this.px, this.py, 3, '#6ee7b7', { spd: 60, size: 2, life: 0.3 });
            }
          }
        } else if (h.kind === 8) {
          // aegis: recharge shield
          if (h.cd <= 0) {
            h.cd = 5.5;
            if (this.shield < this.shieldMax) {
              this.shield++;
              this.fx.ring(this.px, this.py, 16, 50, 0.35, 3, '#7dd3fc');
              this.fx.beam(h.x, h.y, this.px, this.py, 2.4, '#7dd3fc', 0.25);
            }
          }
        } else if (h.kind === 14) {
          // prism: fires refracted beams at nearest foe
          if (h.cd <= 0) {
            const t = this.nearestEnemy(h.x, h.y, 480);
            if (t) {
              h.cd = 0.85;
              const ang = Math.atan2(t.y - h.y, t.x - h.x);
              for (let k = -1; k <= 1; k++) {
                const aa = ang + k * 0.18;
                const x2 = h.x + Math.cos(aa) * 520, y2 = h.y + Math.sin(aa) * 520;
                this.fx.beam(h.x, h.y, x2, y2, 2.2, h.color || '#fde047', 0.12);
                for (const e of this.enemies) {
                  if (!e.active) continue;
                  if (segDist(e.x, e.y, h.x, h.y, x2, y2) < e.r + 4) {
                    this.damageEnemy(e, h.dmg * st.dmg * 0.7, false, 0, 0);
                  }
                }
              }
            } else h.cd = 0.2;
          }
        } else if (h.cd <= 0) {
          const t = this.nearestEnemy(h.x, h.y, h.kind === 6 ? 440 * st.chainRange : 440);
          if (t) {
            h.cd = h.kind === 3 ? 0.95 : 0.7;
            const ang = Math.atan2(t.y - h.y, t.x - h.x);
            if (h.kind === 3) {
              // laser beam
              const x2 = h.x + Math.cos(ang) * 600, y2 = h.y + Math.sin(ang) * 600;
              this.fx.beam(h.x, h.y, x2, y2, 3, '#5ce1ff', 0.14);
              for (const e of this.enemies) {
                if (!e.active) continue;
                if (segDist(e.x, e.y, h.x, h.y, x2, y2) < e.r + 5) {
                  this.damageEnemy(e, h.dmg * st.dmg, Math.random() < st.crit, 0, 0);
                }
              }
              sfx.shoot('beam');
            } else if (h.kind === 6) {
              // shock arc
              this.fx.beam(h.x, h.y, t.x, t.y, 2.6, '#c4b5fd', 0.16);
              this.damageEnemy(t, h.dmg * st.dmg, false, 0, 0);
              const t2 = this.nearestEnemy(t.x, t.y, 180 * st.chainRange, t.id);
              if (t2) {
                this.fx.beam(t.x, t.y, t2.x, t2.y, 2, '#c4b5fd', 0.12);
                this.damageEnemy(t2, h.dmg * st.dmg * 0.55, false, 0, 0);
              }
              sfx.shoot('arc');
            } else {
              // projectile drone (basic / frost / fire)
              const p = this.freeProj();
              if (p) {
                p.active = true; p.x = h.x; p.y = h.y;
                p.vx = Math.cos(ang) * 520; p.vy = Math.sin(ang) * 520;
                p.r = 3.6; p.dmg = h.dmg * st.dmg; p.pierce = h.kind === 5 ? 1 : 0; p.life = 1.1;
                p.kind = 'bullet';
                p.color = h.kind === 4 ? '#7dd3fc' : h.kind === 5 ? '#ff7a45' : '#8ef7ff';
                p.rot = ang; p.spin = 8;
                p.homing = st.homing + (h.kind === 4 ? 1.5 : 0); p.aoe = h.kind === 5 ? 22 : 0;
                p.crit = Math.random() < st.crit;
                if (p.crit) p.dmg *= st.critd;
                p.hits.length = 0; p.bounced = st.ricochet; p.split = 0; p.trail = 0;
              }
              // frost drone applies freeze via a direct touch
              if (h.kind === 4) t.frozen = Math.max(t.frozen, 0.55);
              if (h.kind === 5) { t.burn = Math.max(t.burn, 1.2); t.burnDps = Math.max(t.burnDps, h.dmg * 0.3); }
              sfx.shoot('bullet');
            }
          } else h.cd = 0.2;
        }
      } else if (h.kind === 0 || h.kind === 9) {
        // auto turret / sniper
        h.cd -= dt * st.droneRate;
        if (h.cd <= 0) {
          const range = h.kind === 9 ? 720 : 460;
          const t = this.nearestEnemy(h.x, h.y, range);
          if (t) {
            h.cd = h.kind === 9 ? 1.1 : 0.42;
            const ang = Math.atan2(t.y - h.y, t.x - h.x);
            h.rot = ang;
            if (h.kind === 9) {
              const x2 = h.x + Math.cos(ang) * range, y2 = h.y + Math.sin(ang) * range;
              this.fx.beam(h.x, h.y, x2, y2, 2.4, '#e2e8f0', 0.12);
              for (const e of this.enemies) {
                if (!e.active) continue;
                if (segDist(e.x, e.y, h.x, h.y, x2, y2) < e.r + 4) {
                  this.damageEnemy(e, h.dmg * st.dmg, Math.random() < st.crit, 0, 0);
                }
              }
              sfx.shoot('beam');
            } else {
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
            }
          } else h.cd = 0.2;
        }
      } else if (h.kind === 10) {
        // flamethrower — cone of fire
        h.cd -= dt * st.droneRate;
        const t = this.nearestEnemy(h.x, h.y, 180);
        if (t) h.rot = Math.atan2(t.y - h.y, t.x - h.x);
        if (h.cd <= 0) {
          h.cd = 0.12;
          const ang = h.rot;
          // spray particles + damage cone
          this.fx.burst(h.x + Math.cos(ang) * 14, h.y + Math.sin(ang) * 14, 3, '#ff7a45', {
            spd: 220, size: 3.5, life: 0.28, dir: ang, spread: 0.7, drag: 0.86,
          });
          for (const e of this.enemies) {
            if (!e.active) continue;
            const dx = e.x - h.x, dy = e.y - h.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 150 + e.r) continue;
            const ea = Math.atan2(dy, dx);
            let da = ea - ang;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            if (Math.abs(da) < 0.55) {
              this.damageEnemy(e, h.dmg * st.dmg * 0.35, false, Math.cos(ea) * 30, Math.sin(ea) * 30);
              e.burn = Math.max(e.burn, 1.4); e.burnDps = Math.max(e.burnDps, h.dmg * 0.4);
            }
          }
        }
      } else if (h.kind === 11) {
        // aura beacon — buffs player fire rate when nearby
        h.rot += dt * 1.5;
        const d = Math.hypot(h.x - this.px, h.y - this.py);
        if (d < 160) {
          nearBeacon = true;
          if (Math.random() < dt * 6) this.fx.burst(h.x, h.y, 1, '#fde047', { spd: 40, size: 2, life: 0.4 });
        }
      } else if (h.kind === 2 || h.kind === 12 || h.kind === 13) {
        // companion / wolf / golem
        const t = this.nearestEnemy(h.x, h.y, 900);
        const speed = h.kind === 12 ? 320 : h.kind === 13 ? 140 : 250;
        const tx = t ? t.x : this.px + Math.cos(this.elapsed) * 70;
        const ty = t ? t.y : this.py + Math.sin(this.elapsed) * 70;
        // golem prefers to stay between player and nearest threat
        let ax = tx, ay = ty;
        if (h.kind === 13 && t) {
          ax = this.px + (t.x - this.px) * 0.4;
          ay = this.py + (t.y - this.py) * 0.4;
        }
        const a = Math.atan2(ay - h.y, ax - h.x);
        h.vx += (Math.cos(a) * speed - h.vx) * Math.min(1, dt * 3);
        h.vy += (Math.sin(a) * speed - h.vy) * Math.min(1, dt * 3);
        h.x += h.vx * dt; h.y += h.vy * dt;
        h.rot += dt * (h.kind === 12 ? 5 : 2.5);
        h.cd -= dt * st.droneRate;
        // body damage on contact for wolf/golem
        if (t && Math.hypot(t.x - h.x, t.y - h.y) < t.r + h.r) {
          if (h.cd <= 0) {
            h.cd = h.kind === 12 ? 0.35 : 0.55;
            const ang = Math.atan2(t.y - h.y, t.x - h.x);
            this.damageEnemy(t, h.dmg * st.dmg * (h.kind === 13 ? 1.3 : 0.9), false,
              Math.cos(ang) * (h.kind === 13 ? 260 : 160), Math.sin(ang) * (h.kind === 13 ? 260 : 160));
            this.fx.burst(h.x, h.y, 4, h.kind === 12 ? '#fb923c' : '#a8a29e', { spd: 140, size: 2.5, life: 0.25 });
          }
        } else if (h.kind === 2 && h.cd <= 0 && t) {
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
    // beacon haste buff
    if (nearBeacon) {
      // temporary fire-rate bump via timeScale-like effect on weapon CDs
      for (let i = 0; i < this.wcd.length; i++) this.wcd[i] -= dt * 0.35;
    }
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
    const bossActive = this.enemies.some((e) => e.active && e.def.boss);
    this.spawnT -= dt;
    const interval = Math.max(0.22, 1.35 - t * 0.0036) * (bossActive ? 1.45 : 1);
    const budget = Math.min(bossActive ? 2 : 5, 1 + Math.floor(t / 48));
    if (this.spawnT <= 0) {
      this.spawnT = interval;
      for (let i = 0; i < budget; i++) {
        const id = this.pickEnemyType(t);
        if (id) this.spawnAtEdge(id);
      }
    }
    if (t >= this.bossT && !bossActive) {
      this.bossT = t + 90;
      this.spawnBoss();
      this.bossCount++;
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

  // spawn just outside the visible viewport, around the player, clamped to world
  private offscreenPoint(extra = 60): { x: number; y: number } {
    const viewW = this.W / this.viewScale, viewH = this.H / this.viewScale;
    const rad = Math.hypot(viewW, viewH) * 0.5 + extra;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const x = this.px + Math.cos(a) * rad;
      const y = this.py + Math.sin(a) * rad;
      if (x > 20 && x < this.worldW - 20 && y > 20 && y < this.worldH - 20) return { x, y };
    }
    // fallback: clamp onto a world edge
    return {
      x: clamp(this.px + (Math.random() < 0.5 ? -rad : rad), 20, this.worldW - 20),
      y: clamp(this.py + (Math.random() < 0.5 ? -rad : rad), 20, this.worldH - 20),
    };
  }

  private spawnAtEdge(id: string) {
    const p = this.offscreenPoint(50);
    this.spawnEnemy(id, p.x, p.y, 1);
  }

  spawnEnemy(id: string, x: number, y: number, hpMul: number) {
    const d = ENEMIES[id];
    if (!d) return;
    if (!d.boss && this.enemies.filter((e) => e.active).length >= this.enemies.length - 4) return;
    const e = this.freeEnemy();
    if (!e) return;
    e.active = true;
    e.id = this.eid++;
    e.def = d;
    e.x = clamp(x, -50, this.worldW + 50); e.y = clamp(y, -50, this.worldH + 50);
    e.r = d.r; e.sides = d.sides;
    e.hp = e.maxHp = (d.boss ? d.hp * (1 + this.elapsed / 900) : this.scaleHP(d.hp)) * hpMul;
    e.dmg = d.dmg * (1 + this.elapsed / 400);
    e.speed = d.speed * (1 + Math.min(0.4, this.elapsed / 600));
    e.xp = d.xp; e.score = d.score;
    e.rot = d.atk === 'bulwark' ? Math.atan2(this.py - y, this.px - x) : Math.random() * 6.28;
    e.spin = d.atk === 'bulwark' ? 0 : d.boss ? 0.5 : rnd(-1.4, 1.4);
    e.flash = 0; e.atk = d.atk; e.atkT = d.atkCd * rnd(0.5, 1.2);
    e.windup = 0; e.state = 0; e.slow = 0; e.frozen = 0; e.hitCd = 0; e.age = 0;
    e.burn = 0; e.burnDps = 0; e.poison = 0; e.poisonDps = 0; e.marked = 0; e.voided = 0;
    e.enraged = false; e.auxT = 1; e.ax = 0; e.ay = 0;
    e.vx = e.vy = 0;
    if (d.boss) {
      this.fx.addShake(16);
      this.fx.doFlash(d.color, 0.22, 0.4);
      this.banner(tr(this.lang, 'bnr_bossIn', { name: enemyName(this.lang, d.id, d.name) }), 2.2);
      sfx.boss();
    }
    return e;
  }

  private spawnBoss() {
    const p = this.offscreenPoint(35);
    const id = BOSS_IDS[(this.bossRotation + this.bossCount) % BOSS_IDS.length];
    this.spawnEnemy(id, p.x, p.y, 1 + Math.floor(this.bossCount / BOSS_IDS.length) * 0.5);
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
      coinsEarned: this.coinsEarned,
      coop: this.coop,
      levelupName: this.levelupSlot >= 0 ? (this.mateBySlot(this.levelupSlot)?.name ?? '') : '',
      levelupIsLocal: this.levelupSlot >= 0 ? !!this.mateBySlot(this.levelupSlot)?.local : true,
      mates: this.coop ? this.mates.map((m) => ({
        slot: m.slot, name: m.name, color: m.color, hp: Math.max(0, m.hp), maxHp: m.maxHp,
        level: m.level, alive: m.alive, local: m.local, immortal: m.immortalT > 0,
      })) : [],
    });
  }

  /* ------------------------------------------------ snapshot (host -> guests) */

  buildSnapshot(): import('../net/net').Snapshot {
    const mates = this.mates.filter((m) => m.active).map((m) => ({
      slot: m.slot, name: m.name, x: Math.round(m.x), y: Math.round(m.y),
      hp: Math.round(m.hp), maxHp: Math.round(m.maxHp), shape: m.shapeId, color: m.color,
      alive: m.alive, level: m.level, xp: Math.round(m.xp), xpNeed: Math.round(m.xpNeed),
      invuln: +(m.invuln > 0 || m.immortalT > 0 ? 1 : 0), aim: +m.aim.toFixed(2), shield: m.shield,
    }));
    const enemies: import('../net/net').SnapEntity[] = [];
    for (const e of this.enemies) {
      if (!e.active) continue;
      enemies.push({ x: Math.round(e.x), y: Math.round(e.y), r: e.r, sides: e.sides, c: e.def.color, rot: +e.rot.toFixed(2), kind: e.def.boss ? 1 : 0 });
    }
    const projs: import('../net/net').SnapEntity[] = [];
    for (const p of this.projs) {
      if (!p.active) continue;
      projs.push({ x: Math.round(p.x), y: Math.round(p.y), r: p.r, sides: 0, c: p.color, rot: +p.rot.toFixed(2), kind: 0 });
    }
    const ebullets: import('../net/net').SnapEntity[] = [];
    for (const b of this.ebullets) {
      if (!b.active) continue;
      ebullets.push({ x: Math.round(b.x), y: Math.round(b.y), r: b.r, sides: 0, c: b.color, rot: 0, kind: b.kind });
    }
    const pickups: { x: number; y: number; heal: boolean; big: boolean }[] = [];
    for (const p of this.pickups) {
      if (!p.active) continue;
      pickups.push({ x: Math.round(p.x), y: Math.round(p.y), heal: p.heal, big: p.v >= 30 });
    }
    const bossE = this.enemies.find((e) => e.active && e.def.boss);
    return {
      t: this.elapsed,
      worldW: this.worldW, worldH: this.worldH, theme: this.theme.id,
      mates, enemies, projs, ebullets, pickups,
      banner: this.bannerT > 0 ? this.bannerText : '', bannerT: this.bannerT,
      wave: this.wave, score: Math.floor(this.score),
      boss: bossE ? { name: enemyName(this.lang, bossE.def.id, bossE.def.name), hp: bossE.hp, maxHp: bossE.maxHp, color: bossE.def.color, phase: bossE.enraged ? 2 : 1 } : undefined,
      flash: this.fx.flash.active ? { color: this.fx.flash.color, power: this.fx.flash.power * (this.fx.flash.life / this.fx.flash.max) } : undefined,
      shake: this.fx.shake,
    };
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
