/* Persistent meta-progression: coins, shop upgrades, cosmetics (colour + locations). */

export interface ThemeDef {
  id: string;
  name: string;
  cost: number;
  bg: [string, string, string];
  grid: string;
  star: string;
  edge: string;
  accent: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'nebula',  name: 'Nebula',      cost: 0,    bg: ['#101a34', '#0a0f22', '#05070f'], grid: 'rgba(90,140,220,0.075)', star: 'rgba(180,215,255,0.5)', edge: 'rgba(56,245,224,0.16)', accent: '#38f5e0' },
  { id: 'void',    name: 'Deep Void',   cost: 0,    bg: ['#161426', '#0b0a16', '#040309'], grid: 'rgba(150,120,220,0.07)', star: 'rgba(210,195,255,0.5)', edge: 'rgba(167,139,250,0.18)', accent: '#a78bfa' },
  { id: 'sunset',  name: 'Solar Flare', cost: 400,  bg: ['#33172a', '#1e0f1c', '#0d0509'], grid: 'rgba(251,146,60,0.08)',  star: 'rgba(255,220,190,0.55)',edge: 'rgba(251,146,60,0.2)',  accent: '#fb923c' },
  { id: 'toxic',   name: 'Toxic Bog',   cost: 600,  bg: ['#12281f', '#0a1712', '#040a07'], grid: 'rgba(74,222,128,0.08)',  star: 'rgba(200,255,210,0.5)', edge: 'rgba(74,222,128,0.2)',  accent: '#4ade80' },
  { id: 'ice',     name: 'Cryo Field',  cost: 800,  bg: ['#122436', '#0a1622', '#04080f'], grid: 'rgba(125,211,252,0.09)', star: 'rgba(220,240,255,0.6)', edge: 'rgba(125,211,252,0.22)',accent: '#7dd3fc' },
  { id: 'crimson', name: 'Crimson War', cost: 1200, bg: ['#301019', '#1c0a10', '#0c0406'], grid: 'rgba(255,77,109,0.08)',   star: 'rgba(255,200,210,0.55)',edge: 'rgba(255,45,85,0.25)',  accent: '#ff2d55' },
  { id: 'gold',    name: 'Golden Hall', cost: 2000, bg: ['#2b2410', '#1a1509', '#0a0803'], grid: 'rgba(250,204,21,0.09)',   star: 'rgba(255,245,200,0.6)', edge: 'rgba(250,204,21,0.28)', accent: '#facc15' },
];

export interface ColorDef { id: string; name: string; hex: string; cost: number }

export const COLORS: ColorDef[] = [
  { id: 'teal',   name: 'Teal',    hex: '#38f5e0', cost: 0 },
  { id: 'sky',    name: 'Sky',     hex: '#5ce1ff', cost: 0 },
  { id: 'violet', name: 'Violet',  hex: '#a78bfa', cost: 0 },
  { id: 'lime',   name: 'Lime',    hex: '#a3e635', cost: 0 },
  { id: 'rose',   name: 'Rose',    hex: '#fb7185', cost: 150 },
  { id: 'amber',  name: 'Amber',   hex: '#fbbf24', cost: 150 },
  { id: 'coral',  name: 'Coral',   hex: '#ff7a45', cost: 150 },
  { id: 'pink',   name: 'Magenta', hex: '#f472b6', cost: 300 },
  { id: 'mint',   name: 'Mint',    hex: '#6ee7b7', cost: 300 },
  { id: 'white',  name: 'Pearl',   hex: '#f1f5f9', cost: 500 },
  { id: 'gold',   name: 'Gold',    hex: '#ffd700', cost: 900 },
  { id: 'crimson',name: 'Crimson', hex: '#ff2d55', cost: 900 },
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
  { id: 's_dmg',    name: 'Warhead',     icon: '⚔', stat: 'dmg',    per: 0.08, max: 8, base: 90,  desc: 'Start each run with +8% damage', suffix: '%' },
  { id: 's_hp',     name: 'Bulwark',     icon: '🛡', stat: 'hp',     per: 20,   max: 8, base: 80,  desc: 'Start with +20 max HP' },
  { id: 's_regen',  name: 'Nanoblood',   icon: '✚', stat: 'regen',  per: 0.5,  max: 6, base: 110, desc: 'Start with +0.5 HP/sec regen' },
  { id: 's_spd',    name: 'Overdrive',   icon: '⛸', stat: 'spd',    per: 0.05, max: 6, base: 90,  desc: 'Start with +5% move speed', suffix: '%' },
  { id: 's_crit',   name: 'Targeting',   icon: '✦', stat: 'crit',   per: 0.03, max: 6, base: 120, desc: 'Start with +3% crit chance', suffix: '%' },
  { id: 's_rate',   name: 'Autoloader',  icon: '⚡', stat: 'rate',   per: 0.06, max: 6, base: 120, desc: 'Start with +6% fire rate', suffix: '%' },
  { id: 's_pickup', name: 'Magnet Coil', icon: '🧲', stat: 'pickup', per: 0.25, max: 5, base: 70,  desc: 'Start with +25% gem magnet', suffix: '%' },
  { id: 's_xp',     name: 'Neural Link', icon: '📘', stat: 'xpm',    per: 0.08, max: 6, base: 100, desc: 'Start with +8% XP gain', suffix: '%' },
  { id: 's_armor',  name: 'Ablative',    icon: '🧱', stat: 'armor',  per: 1,    max: 5, base: 140, desc: 'Start with +1 armor (flat block)' },
  { id: 's_reroll', name: 'Dice Bay',    icon: '⟳', stat: 'reroll', per: 1,    max: 4, base: 180, desc: '+1 reroll on every level-up' },
  { id: 's_luck',   name: 'Fortune',     icon: '🍀', stat: 'lucky',  per: 0.35, max: 3, base: 220, desc: 'Better upgrade rarities appear' },
  { id: 's_coin',   name: 'Investor',    icon: '💰', stat: 'coinmul',per: 0.15, max: 5, base: 160, desc: '+15% coins earned per run', suffix: '%' },
];

export interface Meta {
  coins: number;
  colorId: string;
  themeId: string;
  unlockedColors: string[];
  unlockedThemes: string[];
  upgrades: Record<string, number>;
}

const KEY = 'polygon-siege-meta-v1';

export function loadMeta(): Meta {
  const def: Meta = {
    coins: 0, colorId: 'teal', themeId: 'nebula',
    unlockedColors: COLORS.filter((c) => c.cost === 0).map((c) => c.id),
    unlockedThemes: THEMES.filter((t) => t.cost === 0).map((t) => t.id),
    upgrades: {},
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const m = JSON.parse(raw);
    return {
      coins: Math.max(0, Math.floor(m.coins || 0)),
      colorId: m.colorId || 'teal',
      themeId: m.themeId || 'nebula',
      unlockedColors: Array.from(new Set([...def.unlockedColors, ...(m.unlockedColors || [])])),
      unlockedThemes: Array.from(new Set([...def.unlockedThemes, ...(m.unlockedThemes || [])])),
      upgrades: m.upgrades || {},
    };
  } catch { return def; }
}

export function saveMeta(m: Meta) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

export function shopCost(def: ShopDef, level: number): number {
  return Math.round(def.base * Math.pow(1.55, level));
}

export function getTheme(m: Meta): ThemeDef {
  return THEMES.find((t) => t.id === m.themeId) || THEMES[0];
}

export function getColor(m: Meta): string {
  return (COLORS.find((c) => c.id === m.colorId) || COLORS[0]).hex;
}

export interface StartConfig {
  mods: Record<string, number>;
  bonusRerolls: number;
  coinMul: number;
  color: string;
  theme: ThemeDef;
}

export function buildStartConfig(m: Meta): StartConfig {
  const mods: Record<string, number> = {};
  let bonusRerolls = 0;
  let coinMul = 1;
  for (const def of SHOP) {
    const lv = m.upgrades[def.id] || 0;
    if (lv <= 0) continue;
    const amt = def.per * lv;
    if (def.stat === 'reroll') bonusRerolls += amt;
    else if (def.stat === 'coinmul') coinMul += amt;
    else mods[def.stat] = (mods[def.stat] || 0) + amt;
  }
  return { mods, bonusRerolls, coinMul, color: getColor(m), theme: getTheme(m) };
}
