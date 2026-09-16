/* Persistent meta-progression: coins, shop upgrades, reroll tokens, cosmetics. */

export type GridKind = 'square' | 'hex' | 'diag' | 'rings' | 'none';
export type ArenaStyle = 'stars' | 'void' | 'dunes' | 'bog' | 'ice' | 'ruins' | 'hall';

export interface ThemeDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  bg: [string, string, string];
  grid: string;
  gridKind: GridKind;
  star: string;
  edge: string;
  accent: string;
  style: ArenaStyle;
  /** drifting ambient mote colour */
  mote: string;
  /** large soft background shapes */
  fog: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'nebula', name: 'Nebula', desc: 'Stardust and distant suns', cost: 0,
    bg: ['#101a34', '#0a0f22', '#05070f'], grid: 'rgba(90,140,220,0.075)', gridKind: 'square',
    star: 'rgba(180,215,255,0.5)', edge: 'rgba(56,245,224,0.16)', accent: '#38f5e0',
    style: 'stars', mote: 'rgba(140,200,255,0.5)', fog: 'rgba(60,110,220,0.10)',
  },
  {
    id: 'void', name: 'Deep Void', desc: 'Drifting debris in silence', cost: 0,
    bg: ['#161426', '#0b0a16', '#040309'], grid: 'rgba(150,120,220,0.06)', gridKind: 'none',
    star: 'rgba(210,195,255,0.45)', edge: 'rgba(167,139,250,0.18)', accent: '#a78bfa',
    style: 'void', mote: 'rgba(190,170,255,0.4)', fog: 'rgba(120,80,220,0.10)',
  },
  {
    id: 'sunset', name: 'Solar Flare', desc: 'Heat dunes and rising embers', cost: 1500,
    bg: ['#3d1c22', '#23101a', '#0d0509'], grid: 'rgba(251,146,60,0.07)', gridKind: 'diag',
    star: 'rgba(255,214,170,0.5)', edge: 'rgba(251,146,60,0.22)', accent: '#fb923c',
    style: 'dunes', mote: 'rgba(255,170,80,0.65)', fog: 'rgba(255,120,40,0.11)',
  },
  {
    id: 'toxic', name: 'Toxic Bog', desc: 'Honeycomb mire and gas bubbles', cost: 2200,
    bg: ['#12281f', '#0a1712', '#040a07'], grid: 'rgba(74,222,128,0.075)', gridKind: 'hex',
    star: 'rgba(190,255,205,0.4)', edge: 'rgba(74,222,128,0.22)', accent: '#4ade80',
    style: 'bog', mote: 'rgba(130,255,160,0.5)', fog: 'rgba(40,200,110,0.10)',
  },
  {
    id: 'ice', name: 'Cryo Field', desc: 'Ice shards and drifting snow', cost: 3000,
    bg: ['#122436', '#0a1622', '#04080f'], grid: 'rgba(125,211,252,0.085)', gridKind: 'diag',
    star: 'rgba(225,244,255,0.62)', edge: 'rgba(125,211,252,0.24)', accent: '#7dd3fc',
    style: 'ice', mote: 'rgba(225,245,255,0.75)', fog: 'rgba(90,180,255,0.10)',
  },
  {
    id: 'crimson', name: 'Crimson War', desc: 'Ruins, ash and warning sirens', cost: 4200,
    bg: ['#331017', '#1c0a10', '#0c0406'], grid: 'rgba(255,77,109,0.075)', gridKind: 'square',
    star: 'rgba(255,190,190,0.42)', edge: 'rgba(255,45,85,0.26)', accent: '#ff2d55',
    style: 'ruins', mote: 'rgba(255,140,140,0.45)', fog: 'rgba(220,40,60,0.11)',
  },
  {
    id: 'gold', name: 'Golden Hall', desc: 'Ancient rings and floating pollen', cost: 6000,
    bg: ['#2f2712', '#1a1509', '#0a0803'], grid: 'rgba(250,204,21,0.08)', gridKind: 'rings',
    star: 'rgba(255,240,190,0.6)', edge: 'rgba(250,204,21,0.3)', accent: '#facc15',
    style: 'hall', mote: 'rgba(255,225,130,0.7)', fog: 'rgba(230,180,40,0.11)',
  },
];

export interface ColorDef { id: string; name: string; hex: string; cost: number }

export const COLORS: ColorDef[] = [
  { id: 'teal',   name: 'Teal',    hex: '#38f5e0', cost: 0 },
  { id: 'sky',    name: 'Sky',     hex: '#5ce1ff', cost: 0 },
  { id: 'violet', name: 'Violet',  hex: '#a78bfa', cost: 0 },
  { id: 'lime',   name: 'Lime',    hex: '#a3e635', cost: 0 },
  { id: 'rose',   name: 'Rose',    hex: '#fb7185', cost: 400 },
  { id: 'amber',  name: 'Amber',   hex: '#fbbf24', cost: 400 },
  { id: 'coral',  name: 'Coral',   hex: '#ff7a45', cost: 400 },
  { id: 'pink',   name: 'Magenta', hex: '#f472b6', cost: 800 },
  { id: 'mint',   name: 'Mint',    hex: '#6ee7b7', cost: 800 },
  { id: 'white',  name: 'Pearl',   hex: '#f1f5f9', cost: 1200 },
  { id: 'gold',   name: 'Gold',    hex: '#ffd700', cost: 2000 },
  { id: 'crimson',name: 'Crimson', hex: '#ff2d55', cost: 2000 },
];

export interface ShopDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  stat: string;   // maps to engine mods
  per: number;    // amount added per level
  max: number;
  base: number;   // base cost
  suffix?: string;
}

export const SHOP: ShopDef[] = [
  { id: 's_dmg',    name: 'Warhead',     icon: '⚔', stat: 'dmg',    per: 0.08, max: 8, base: 260, desc: 'Start each run with +8% damage', suffix: '%' },
  { id: 's_hp',     name: 'Bulwark',     icon: '🛡', stat: 'hp',     per: 20,   max: 8, base: 240, desc: 'Start with +20 max HP' },
  { id: 's_regen',  name: 'Nanoblood',   icon: '✚', stat: 'regen',  per: 0.5,  max: 6, base: 320, desc: 'Start with +0.5 HP/sec regen' },
  { id: 's_spd',    name: 'Overdrive',   icon: '⛸', stat: 'spd',    per: 0.05, max: 6, base: 270, desc: 'Start with +5% move speed', suffix: '%' },
  { id: 's_crit',   name: 'Targeting',   icon: '✦', stat: 'crit',   per: 0.03, max: 6, base: 360, desc: 'Start with +3% crit chance', suffix: '%' },
  { id: 's_rate',   name: 'Autoloader',  icon: '⚡', stat: 'rate',   per: 0.06, max: 6, base: 360, desc: 'Start with +6% fire rate', suffix: '%' },
  { id: 's_pickup', name: 'Magnet Coil', icon: '🧲', stat: 'pickup', per: 0.25, max: 5, base: 210, desc: 'Start with +25% gem magnet', suffix: '%' },
  { id: 's_xp',     name: 'Neural Link', icon: '📘', stat: 'xpm',    per: 0.08, max: 6, base: 300, desc: 'Start with +8% XP gain', suffix: '%' },
  { id: 's_armor',  name: 'Ablative',    icon: '🧱', stat: 'armor',  per: 1,    max: 5, base: 420, desc: 'Start with +1 armor (flat block)' },
  { id: 's_luck',   name: 'Fortune',     icon: '🍀', stat: 'lucky',  per: 0.35, max: 3, base: 650, desc: 'Better upgrade rarities appear' },
  { id: 's_coin',   name: 'Investor',    icon: '💰', stat: 'coinmul',per: 0.15, max: 5, base: 480, desc: '+15% coins earned per run', suffix: '%' },
];

/* ---------------- reroll tokens (consumable) ---------------- */

/** You may never hold more than this many tokens. */
export const REROLL_MAX = 5;
/** Price of the next token climbs with how many you already hold. */
export function rerollCost(stock: number): number {
  return 300 + Math.max(0, stock) * 120;   // 300 / 420 / 540 / 660 / 780
}

export interface Meta {
  coins: number;
  colorId: string;
  themeId: string;
  unlockedColors: string[];
  unlockedThemes: string[];
  upgrades: Record<string, number>;
  /** consumable reroll tokens, capped at REROLL_MAX */
  rerollStock: number;
}

const KEY = 'polygon-siege-meta-v1';

export function loadMeta(): Meta {
  const def: Meta = {
    coins: 0, colorId: 'teal', themeId: 'nebula',
    unlockedColors: COLORS.filter((c) => c.cost === 0).map((c) => c.id),
    unlockedThemes: THEMES.filter((t) => t.cost === 0).map((t) => t.id),
    upgrades: {},
    rerollStock: 0,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const m = JSON.parse(raw);
    const upgrades: Record<string, number> = { ...(m.upgrades || {}) };
    // migration: the old permanent "Dice Bay" upgrade is gone — refund as tokens
    let migrated = 0;
    if (upgrades.s_reroll) { migrated = Math.min(REROLL_MAX, upgrades.s_reroll); delete upgrades.s_reroll; }
    return {
      coins: Math.max(0, Math.floor(m.coins || 0)),
      colorId: m.colorId || 'teal',
      themeId: m.themeId || 'nebula',
      unlockedColors: Array.from(new Set([...def.unlockedColors, ...(m.unlockedColors || [])])),
      unlockedThemes: Array.from(new Set([...def.unlockedThemes, ...(m.unlockedThemes || [])])),
      upgrades,
      rerollStock: Math.max(0, Math.min(REROLL_MAX, Math.floor(m.rerollStock ?? migrated))),
    };
  } catch { return def; }
}

export function saveMeta(m: Meta) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

export function shopCost(def: ShopDef, level: number): number {
  return Math.round(def.base * Math.pow(1.62, level));
}

export function getTheme(m: Meta): ThemeDef {
  return THEMES.find((t) => t.id === m.themeId) || THEMES[0];
}

export function getColor(m: Meta): string {
  return (COLORS.find((c) => c.id === m.colorId) || COLORS[0]).hex;
}

export interface StartConfig {
  mods: Record<string, number>;
  /** tokens carried into the run — consumed permanently when used */
  rerollTokens: number;
  coinMul: number;
  color: string;
  theme: ThemeDef;
}

export function buildStartConfig(m: Meta): StartConfig {
  const mods: Record<string, number> = {};
  let coinMul = 1;
  for (const def of SHOP) {
    const lv = m.upgrades[def.id] || 0;
    if (lv <= 0) continue;
    const amt = def.per * lv;
    if (def.stat === 'coinmul') coinMul += amt;
    else mods[def.stat] = (mods[def.stat] || 0) + amt;
  }
  return {
    mods,
    rerollTokens: Math.max(0, Math.min(REROLL_MAX, m.rerollStock || 0)),
    coinMul,
    color: getColor(m),
    theme: getTheme(m),
  };
}
