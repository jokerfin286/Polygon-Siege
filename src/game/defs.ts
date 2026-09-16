/* ============================================================
   POLYGON SIEGE — definitions
   ============================================================ */

export type WeaponId =
  | 'disc' | 'laser' | 'bullet' | 'orb' | 'volley'
  | 'arc' | 'shell' | 'blades' | 'nova' | 'missile' | 'rail';

export type AtkKind = 'melee' | 'bullets' | 'laser' | 'homing' | 'radial' | 'slam' | 'spawn';

export interface ShapeDef {
  id: string;
  name: string;
  sides: number;      // 0 = circle
  hp: number;
  speed: number;      // px/s
  dmg: number;        // multiplier
  rate: number;       // multiplier
  size: number;       // radius
  weapon: WeaponId;
  color: string;
  accent: string;
  blurb: string;
}

export const SHAPES: Record<string, ShapeDef> = {
  circle:   { id: 'circle',   name: 'Circle',   sides: 0, hp: 120, speed: 262, dmg: 1.00, rate: 1.00, size: 15, weapon: 'disc',   color: '#38f5e0', accent: '#0ff9d0', blurb: 'Balanced. Throws spinning discs.' },
  triangle: { id: 'triangle', name: 'Triangle', sides: 3, hp: 100, speed: 296, dmg: 1.15, rate: 1.05, size: 16, weapon: 'laser',  color: '#5ce1ff', accent: '#38bdf8', blurb: 'Fast & sharp. Fires piercing lasers.' },
  square:   { id: 'square',   name: 'Square',   sides: 4, hp: 175, speed: 235, dmg: 1.05, rate: 1.10, size: 17, weapon: 'bullet', color: '#a78bfa', accent: '#8b5cf6', blurb: 'Sturdy. Sprays bullet volleys.' },
  pentagon: { id: 'pentagon', name: 'Pentagon', sides: 5, hp: 160, speed: 248, dmg: 1.25, rate: 1.00, size: 18, weapon: 'orb',    color: '#fde047', accent: '#facc15', blurb: 'Aggressive. Hurls homing orbs.' },
  hexagon:  { id: 'hexagon',  name: 'Hexagon',  sides: 6, hp: 200, speed: 222, dmg: 1.35, rate: 1.05, size: 19, weapon: 'volley', color: '#fb923c', accent: '#f97316', blurb: 'Fires hexagonal bolt rings.' },
  heptagon: { id: 'heptagon', name: 'Heptagon', sides: 7, hp: 230, speed: 210, dmg: 1.45, rate: 1.10, size: 20, weapon: 'arc',    color: '#f472b6', accent: '#ec4899', blurb: 'Chains lightning between foes.' },
  octagon:  { id: 'octagon',  name: 'Octagon',  sides: 8, hp: 290, speed: 152, dmg: 1.95, rate: 0.80, size: 23, weapon: 'shell',  color: '#e879f9', accent: '#c026d3', blurb: 'Colossal cannon. VERY slow.' },
};

export const SHAPE_ORDER = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'heptagon', 'octagon'];

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  desc: string;
  cd: number;
  dmg: number;
  count: number;
  speed: number;
  pierce: number;
  spread: number;
  kind: 'disc' | 'bullet' | 'orb' | 'ring' | 'beam' | 'chain' | 'shell' | 'orbit' | 'nova' | 'missile';
  color: string;
  radius: number;
  aoe?: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  disc:    { id: 'disc',    name: 'Discs',     icon: '◎', desc: 'Spinning discs that punch through 2 foes.', cd: 0.42, dmg: 15, count: 1, speed: 570, pierce: 3, spread: 0,    kind: 'disc',   color: '#38f5e0', radius: 9 },
  laser:   { id: 'laser',   name: 'Laser',     icon: '╱', desc: 'Instant beam, pierces everything in line.', cd: 0.72, dmg: 17, count: 1, speed: 0,   pierce: 99, spread: 0,    kind: 'beam',   color: '#5ce1ff', radius: 5 },
  bullet:  { id: 'bullet',  name: 'Bullets',   icon: '•', desc: 'Twin rapid-fire bullets. Never stops.',      cd: 0.15, dmg: 5.2, count: 2, speed: 780, pierce: 0, spread: 0.12, kind: 'bullet', color: '#a78bfa', radius: 4 },
  orb:     { id: 'orb',     name: 'Orbs',      icon: '❍', desc: 'Heavy homing orbs that hunt targets down.',  cd: 0.85, dmg: 26, count: 1, speed: 235, pierce: 3, spread: 0,    kind: 'orb',    color: '#fde047', radius: 10 },
  volley:  { id: 'volley',  name: 'Volley',    icon: '✳', desc: 'A ring of six bolts in every direction.',    cd: 1.05, dmg: 13, count: 6, speed: 430, pierce: 1, spread: 0,    kind: 'ring',   color: '#fb923c', radius: 6 },
  arc:     { id: 'arc',     name: 'Arc',       icon: '⚡', desc: 'Lightning that chains between enemies.',     cd: 0.78, dmg: 15, count: 3, speed: 0,   pierce: 0, spread: 0,    kind: 'chain',  color: '#f472b6', radius: 4 },
  shell:   { id: 'shell',   name: 'Shell',     icon: '⬣', desc: 'Slow cannon shell with a huge blast.',       cd: 1.30, dmg: 46, count: 1, speed: 390, pierce: 0, spread: 0,    kind: 'shell',  color: '#e879f9', radius: 13, aoe: 78 },
  blades:  { id: 'blades',  name: 'Blades',    icon: '✥', desc: 'Orbiting blades shred anything close.',      cd: 0.30, dmg: 9,  count: 2, speed: 2.6, pierce: 99, spread: 0,   kind: 'orbit',  color: '#7dd3fc', radius: 12 },
  nova:    { id: 'nova',    name: 'Nova',      icon: '◉', desc: 'Pulsing shockwave blasts around you.',       cd: 2.10, dmg: 24, count: 1, speed: 0,   pierce: 99, spread: 0,   kind: 'nova',   color: '#67e8f9', radius: 135 },
  missile: { id: 'missile', name: 'Missiles',  icon: '➤', desc: 'Swarm missiles that explode on impact.',     cd: 0.95, dmg: 19, count: 2, speed: 330, pierce: 0, spread: 0.6,  kind: 'missile',color: '#fca5a5', radius: 7, aoe: 46 },
  rail:    { id: 'rail',    name: 'Railgun',   icon: '⇶', desc: 'Charged slug, obliterates a whole row.',     cd: 1.55, dmg: 58, count: 1, speed: 1500, pierce: 99, spread: 0,   kind: 'beam',   color: '#c4b5fd', radius: 9 },
};

export interface EnemyDef {
  id: string;
  name: string;
  sides: number;
  hp: number;
  speed: number;
  dmg: number;
  r: number;
  xp: number;
  score: number;
  atk: AtkKind;
  atkCd: number;
  color: string;
  boss?: boolean;
  spawnAfter: number; // seconds
  weight: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  ecircle:   { id: 'ecircle',   name: 'Dot',        sides: 0, hp: 9,   speed: 86,  dmg: 8,  r: 12, xp: 1, score: 10,  atk: 'melee',  atkCd: 0.8, color: '#ff5a5a', spawnAfter: 0,    weight: 40 },
  etriangle: { id: 'etriangle', name: 'Wedge',      sides: 3, hp: 17,  speed: 70,  dmg: 11, r: 14, xp: 2, score: 22,  atk: 'laser',  atkCd: 2.4, color: '#ff7a45', spawnAfter: 22,   weight: 26 },
  esquare:   { id: 'esquare',   name: 'Block',      sides: 4, hp: 34,  speed: 62,  dmg: 15, r: 16, xp: 3, score: 38,  atk: 'bullets',atkCd: 2.0, color: '#ff4d6d', spawnAfter: 48,   weight: 22 },
  epentagon: { id: 'epentagon', name: 'Brute',      sides: 5, hp: 78,  speed: 70,  dmg: 22, r: 19, xp: 5, score: 75,  atk: 'melee',  atkCd: 0.9, color: '#e0347a', spawnAfter: 78,   weight: 18 },
  ehexagon:  { id: 'ehexagon',  name: 'Hive',       sides: 6, hp: 120, speed: 48,  dmg: 24, r: 22, xp: 8, score: 120, atk: 'spawn',  atkCd: 3.4, color: '#c026a3', spawnAfter: 105,  weight: 13 },
  eheptagon: { id: 'eheptagon', name: 'Spinner',    sides: 7, hp: 165, speed: 54,  dmg: 26, r: 23, xp: 10,score: 170, atk: 'radial', atkCd: 2.6, color: '#a21caf', spawnAfter: 132,  weight: 11 },
  eoctagon:  { id: 'eoctagon',  name: 'Colossus',   sides: 8, hp: 380, speed: 27,  dmg: 46, r: 30, xp: 18,score: 340, atk: 'slam',   atkCd: 2.8, color: '#7e22ce', spawnAfter: 160,  weight: 8 },
  edecagon:  { id: 'edecagon',  name: 'TYRANT',     sides: 10,hp: 2600,speed: 34,  dmg: 55, r: 46, xp: 90,score: 2200,atk: 'radial', atkCd: 1.5, color: '#ff2d55', boss: true, spawnAfter: 190, weight: 0 },
};

/* ---------------- Upgrade pool (180+ tiers) ---------------- */

export type UpgKind = 'stat' | 'weapon' | 'shape' | 'helper' | 'special';

export interface UpgDef {
  id: string;
  name: string;
  kind: UpgKind;
  max: number;
  rarity: 0 | 1 | 2 | 3;
  icon: string;
  desc: string;
  stat?: string;
  per?: number;
  weapon?: WeaponId;
  shape?: string;
  req?: string;
}

const S = (
  id: string, name: string, stat: string, per: number, max: number,
  rarity: 0 | 1 | 2 | 3, icon: string, desc: string
): UpgDef => ({ id, name, kind: 'stat', stat, per, max, rarity, icon, desc });

export const UPGRADES: UpgDef[] = [
  // ---- core stats ----
  S('dmg',    'Damage Amp',   'dmg',    0.16, 5, 1, '⚔', '+16% damage on every weapon'),
  S('rate',   'Rapid Fire',   'rate',   0.13, 5, 1, '⚡', '+13% fire rate'),
  S('hp',     'Reinforce',    'hp',     22,   5, 0, '🛡', '+22 max HP (and heals it)'),
  S('spd',    'Thrusters',    'spd',    0.08, 5, 0, '⛸', '+8% movement speed'),
  S('pspd',   'Ballistics',   'pspd',   0.12, 5, 0, '➹', '+12% projectile speed'),
  S('crit',   'Precision',    'crit',   0.05, 5, 1, '✦', '+5% critical chance'),
  S('critd',  'Brutality',    'critd',  0.25, 4, 2, '☄', '+25% critical damage'),
  S('pickup', 'Magnetize',    'pickup', 0.35, 4, 0, '🧲', '+35% gem magnet radius'),
  S('xpm',    'Insight',      'xpm',    0.15, 4, 1, '📘', '+15% XP gained'),
  S('armor',  'Plating',      'armor',  1,    5, 1, '🧱', '-1 damage from every hit'),
  S('regen',  'Nanorepair',   'regen',  0.6,  5, 1, '✚', '+0.6 HP regenerated / sec'),
  S('psize',  'Big Shot',     'psize',  0.10, 4, 0, '◉', '+10% projectile size'),
  S('pierce', 'Piercer',      'pierce', 1,    4, 2, '⤍', '+1 pierce on projectiles'),
  S('multi',  'Splitfire',    'multi',  1,    3, 3, '⦻', '+1 projectile per shot'),
  S('cd',     'Overclock',    'cd',     0.06, 5, 2, '⏱', '-6% cooldown on everything'),
  S('knock',  'Impact',       'knock',  0.35, 3, 0, '💥', '+35% knockback force'),
  S('thorns', 'Spikes',       'thorns', 4,    4, 1, '🌵', 'Reflect 4 damage on contact'),
  S('leech',  'Vampirism',    'leech',  0.012,3, 2, '🩸', 'Heal 1.2% of damage dealt'),
  S('score',  'Fame',         'score',  0.10, 5, 0, '★', '+10% score from all sources'),
  S('lifespan','Long Shot',   'lifespan',0.20,3, 0, '⌇', '+20% projectile lifetime'),
  S('aoe',    'Blast Radius', 'aoe',    0.15, 4, 2, '✺', '+15% explosion sizes'),
  S('haste',  'Adrenaline',   'haste',  0.08, 4, 1, '🌬', '+8% move & fire speed'),

  // ---- weapons ----
  { id: 'w_disc',    name: 'Discs',    kind: 'weapon', max: 1, rarity: 2, icon: '◎', weapon: 'disc',    desc: 'Equip: spinning piercing discs' },
  { id: 'w_laser',   name: 'Laser',    kind: 'weapon', max: 1, rarity: 2, icon: '╱', weapon: 'laser',   desc: 'Equip: instant piercing beam' },
  { id: 'w_bullet',  name: 'Bullets',  kind: 'weapon', max: 1, rarity: 2, icon: '•', weapon: 'bullet',  desc: 'Equip: rapid twin bullets' },
  { id: 'w_orb',     name: 'Orbs',     kind: 'weapon', max: 1, rarity: 2, icon: '❍', weapon: 'orb',     desc: 'Equip: heavy homing orbs' },
  { id: 'w_volley',  name: 'Volley',   kind: 'weapon', max: 1, rarity: 2, icon: '✳', weapon: 'volley',  desc: 'Equip: 6-bolt ring shot' },
  { id: 'w_arc',     name: 'Arc',      kind: 'weapon', max: 1, rarity: 2, icon: '⚡', weapon: 'arc',     desc: 'Equip: chaining lightning' },
  { id: 'w_shell',   name: 'Shell',    kind: 'weapon', max: 1, rarity: 2, icon: '⬣', weapon: 'shell',   desc: 'Equip: explosive cannon shell' },
  { id: 'w_blades',  name: 'Blades',   kind: 'weapon', max: 1, rarity: 2, icon: '✥', weapon: 'blades',  desc: 'Equip: orbiting shredder blades' },
  { id: 'w_nova',    name: 'Nova',     kind: 'weapon', max: 1, rarity: 2, icon: '◉', weapon: 'nova',    desc: 'Equip: pulsing shockwaves' },
  { id: 'w_missile', name: 'Missiles', kind: 'weapon', max: 1, rarity: 2, icon: '➤', weapon: 'missile', desc: 'Equip: exploding homing swarm' },
  { id: 'w_rail',    name: 'Railgun',  kind: 'weapon', max: 1, rarity: 3, icon: '⇶', weapon: 'rail',    desc: 'Equip: row-erasing charged slug' },
  { id: 'wslot',     name: 'Weapon Bay', kind: 'stat', max: 3, rarity: 3, icon: '🧰', stat: 'wslot', per: 1, desc: '+1 weapon slot (carry more weapons)' },
  { id: 'wpower',    name: 'Synergy',  kind: 'stat', stat: 'wpower', per: 0.15, max: 4, rarity: 2, icon: '🔗', desc: '+15% damage per extra weapon' },
  { id: 'aux',       name: 'Auxiliary Fire', kind: 'stat', stat: 'aux', per: 1, max: 2, rarity: 3, icon: ' ⟳', desc: 'Secondary weapons fire automatically too' },

  // ---- shape cores ----
  { id: 'shape_triangle', name: 'Core: Triangle', kind: 'shape', shape: 'triangle', max: 1, rarity: 2, icon: '▲', desc: 'Become a Triangle — fast, fragile, lasers' },
  { id: 'shape_square',   name: 'Core: Square',   kind: 'shape', shape: 'square',   max: 1, rarity: 2, icon: '■', desc: 'Become a Square — tanky bullet sprayer' },
  { id: 'shape_pentagon', name: 'Core: Pentagon', kind: 'shape', shape: 'pentagon', max: 1, rarity: 2, icon: '⬟', req: 'shape_triangle', desc: 'Become a Pentagon — homing orbs, +DMG' },
  { id: 'shape_hexagon',  name: 'Core: Hexagon',  kind: 'shape', shape: 'hexagon',  max: 1, rarity: 3, icon: '⬢', req: 'shape_square',   desc: 'Become a Hexagon — bolt volleys, +HP' },
  { id: 'shape_heptagon', name: 'Core: Heptagon', kind: 'shape', shape: 'heptagon', max: 1, rarity: 3, icon: '⬡', req: 'shape_pentagon', desc: 'Become a Heptagon — chain lightning' },
  { id: 'shape_octagon',  name: 'Core: Octagon',  kind: 'shape', shape: 'octagon',  max: 1, rarity: 3, icon: '8', req: 'shape_hexagon',  desc: 'Become an Octagon — cannon. Slow but devastating' },

  // ---- helpers ----
  S('drone',     'Helper Drone',  'drone',     1,    5, 1, '👾', '+1 orbiting drone that shoots for you'),
  S('droneDmg',  'Drone Ammo',    'droneDmg',  0.25, 4, 1, '🔩', '+25% drone & turret damage'),
  S('droneRate', 'Drone Servos',  'droneRate', 0.15, 3, 1, '⚙', '+15% drone fire rate'),
  S('orbit',     'Orbit Guard',   'orbit',     1,    4, 2, '◌', '+1 orbiting guard orb (blocks & hurts)'),
  S('turret',    'Sentinel Kit',  'turret',    1,    4, 2, '🗼', 'Drop an extra auto-turret each wave'),
  S('mine',      'Mine Layer',    'mine',      1,    4, 1, '⚓', 'Drop mines behind you as you move'),
  S('companion', 'Ally Shape',    'companion', 1,    3, 3, '◈', 'A friendly shape fights at your side'),
  S('companionDmg','Ally Power',  'companionDmg', 0.30, 3, 2, '💠', '+30% ally damage & size'),
  S('shieldorbs','Guard Frenzy',  'shieldorbs',0.20, 3, 1, '🌀', '+20% orbit speed & orbit damage'),

  // ---- mobility & defence ----
  { id: 'dash',    name: 'Dash Drive', kind: 'special', max: 1, rarity: 2, icon: '»', desc: 'UNLOCK DASH — burst forward (Space / button)' },
  S('dashcd',   'Dash Coils',    'dashcd',   0.25, 3, 1, '⇴', '-25% dash cooldown'),
  S('shieldmax','Barrier',       'shieldmax',1,    3, 2, '⬤', '+1 shield charge that blocks a hit'),
  S('shieldreg','Barrier Coil',  'shieldreg',0.35, 3, 2, '⟲', '-35% shield recharge time'),
  S('secondwind','Second Wind',  'secondwind',1,    1, 3, '♥', 'Revive once at 50% HP'),
  S('regenkill','Kill Repair',   'regenkill',0.35, 3, 1, '⊕', 'Heal 0.35 HP per kill'),

  // ---- offensive specials ----
  S('homing',   'Homing Field',  'homing',   0.5,  3, 2, '🧭', 'Projectiles curve toward enemies'),
  S('ricochet', 'Ricochet',      'ricochet', 1,    3, 3, '⤡', 'Projectiles bounce to a new target'),
  S('explode',  'Volatile Hits', 'explode',  1,    3, 2, '🧨', '15% chance hits explode'),
  S('chainhit', 'Chain Reaction','chainhit', 1,    3, 2, '⛓', 'Hits arc to 1 nearby enemy'),
  S('exec',     'Executioner',   'exec',     0.18, 3, 1, '☠', '+18% damage to enemies below 35% HP'),
  S('giant',    'Giant Slayer',  'giant',    0.22, 3, 1, '🗡', '+22% damage to large enemies'),
  S('swarm',    'Swarm Slayer',  'swarm',    0.25, 3, 1, '🐝', '+25% damage to small enemies'),
  S('deathbomb','Corpse Burst',  'deathbomb',1,    3, 1, '☄', 'Enemies explode on death'),
  S('bloom',    'Bullet Bloom',  'bloom',    1,    3, 1, '✹', 'Projectiles split once on expiry'),
  S('freeze',   'Cryo Hits',     'freeze',   0.25, 3, 2, '❄', '25% chance to freeze enemies'),
  S('slowfield','Gravity Well',  'slowfield',0.22, 3, 2, '◎', 'Nearby enemies are slowed 22%'),
  S('bombdrop', 'Carpet Bomb',   'bombdrop', 1,    3, 2, '💣', 'Auto-drop bombs around you'),
  S('glass',    'Glass Cannon',  'glass',    1,    3, 2, '🔮', '+35% damage, -12% max HP'),
  S('timewarp', 'Time Dilation', 'timewarp', 1,    2, 2, '⌛', 'Time slows when you are below 30% HP'),
  S('xpwave',   'Wisdom Burst',  'xpwave',   1,    2, 1, '✧', 'Level-ups blast XP gems outward'),
  S('combo',    'Combo Engine',  'combo',    0.5,  3, 2, '🔥', '+50% combo window & score scaling'),
  S('lucky',    'Lucky Draw',    'lucky',    0.4,  3, 1, '🍀', 'Better upgrade rarities appear'),
];

function countTiers(): number {
  let n = 0;
  for (const u of UPGRADES) n += u.max;
  return n;
}
export const TOTAL_TIERS = countTiers();

export interface PoolEntry {
  key: string;
  def: UpgDef;
  level: number; // 1-based tier
}

export function buildPool(): PoolEntry[] {
  const pool: PoolEntry[] = [];
  for (const def of UPGRADES) {
    for (let l = 1; l <= def.max; l++) pool.push({ key: def.id + ':' + l, def, level: l });
  }
  return pool;
}

/* ---------------- helpers ---------------- */

export function polyPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sides: number, rot: number) {
  ctx.beginPath();
  if (sides <= 2) {
    ctx.arc(x, y, r, 0, Math.PI * 2);
    return;
  }
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function shapeVertices(x: number, y: number, r: number, sides: number, rot: number) {
  const v: number[] = [];
  if (sides <= 2) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      v.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    return v;
  }
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    v.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  return v;
}
