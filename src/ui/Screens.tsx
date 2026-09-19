import { useEffect } from 'react';
import { SHAPES, WEAPONS, SHAPE_ORDER, ENEMIES, TOTAL_TIERS, UPGRADES, type UpgDef } from '../game/defs';
import type { PublicState } from '../game/engine';
import type { ScoreRow } from '../game/storage';
import {
  t, type Lang, shapeName, shapeBlurb, enemyName, weaponName, upgName, upgDesc,
} from '../i18n';

type OwnedEntry = { def: UpgDef; lv: number };

export const RARITY = [
  { text: 'text-slate-200', border: 'border-slate-500/50', bg: 'from-slate-500/12', glow: 'shadow-slate-900/40', dot: 'bg-slate-400' },
  { text: 'text-cyan-300', border: 'border-cyan-400/50', bg: 'from-cyan-400/14', glow: 'shadow-cyan-500/20', dot: 'bg-cyan-400' },
  { text: 'text-violet-300', border: 'border-violet-400/60', bg: 'from-violet-500/16', glow: 'shadow-violet-500/25', dot: 'bg-violet-400' },
  { text: 'text-amber-300', border: 'border-amber-400/70', bg: 'from-amber-400/18', glow: 'shadow-amber-500/30', dot: 'bg-amber-400' },
];

function ShapeIcon({ sides, color, size = 26, rot = 0 }: { sides: number; color: string; size?: number; rot?: number }) {
  const c = size / 2;
  const pts: string[] = [];
  const n = Math.max(3, sides);
  for (let i = 0; i < n; i++) {
    const a = (rot + (i / n) * Math.PI * 2) - Math.PI / 2;
    pts.push(`${(c + Math.cos(a) * (c - 2)).toFixed(1)},${(c + Math.sin(a) * (c - 2)).toFixed(1)}`);
  }
  if (sides <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={c - 2} fill={color + '33'} stroke={color} strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={pts.join(' ')} fill={color + '33'} stroke={color} strokeWidth="2" />
    </svg>
  );
}

function ShapeGlyph({ id, size = 22 }: { id: string; size?: number }) {
  const s = SHAPES[id];
  return <ShapeIcon sides={s.sides} color={s.color} size={size} />;
}

export function LangToggle({ lang, onChange, className = '' }: { lang: Lang; onChange: (l: Lang) => void; className?: string }) {
  return (
    <div className={`flex overflow-hidden rounded-xl border border-white/12 bg-black/45 backdrop-blur-sm ${className}`}>
      {(['en', 'ru'] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-2.5 py-1.5 font-display text-[11px] font-bold tracking-wider transition ${
            lang === l ? 'bg-cyan-400/25 text-cyan-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {l === 'en' ? 'EN' : 'RU'}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- */

export function StartScreen({ lang, best, scores, coins, onPlay, onShop, onLang, onGuide, onCoop }: {
  lang: Lang; best: number; scores: ScoreRow[]; coins: number;
  onPlay: () => void; onShop: () => void; onLang: (l: Lang) => void; onGuide: () => void; onCoop: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.repeat || (e.target instanceof HTMLElement && e.target.closest('button, input, select'))) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); onPlay(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onPlay]);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-3 py-4">
      <div className="glass scroll-thin anim-in max-h-full w-full max-w-4xl overflow-y-auto rounded-3xl border border-cyan-400/20 p-5 shadow-[0_0_80px_rgba(56,245,224,0.12)] sm:p-8">
        <div className="text-center">
          <div className="mb-1 font-display text-[10px] tracking-[0.35em] text-cyan-300/70">
            {t(lang, 'tagline', { n: TOTAL_TIERS })}
          </div>
          <h1 className="font-display title-shine text-4xl font-black leading-none sm:text-6xl">{t(lang, 'title1')}</h1>
          <h1 className="font-display title-shine -mt-1 text-4xl font-black leading-none sm:text-6xl">{t(lang, 'title2')}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-300/80 sm:text-base">{t(lang, 'intro')}</p>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3">
          <button
            onClick={onPlay}
            className="anim-pulse group relative w-full max-w-xs rounded-2xl border border-cyan-300/60 bg-gradient-to-b from-cyan-400/25 to-cyan-600/10 px-8 py-4 font-display text-xl font-black tracking-widest text-cyan-100 transition active:scale-[0.97] hover:from-cyan-300/35"
          >
            {t(lang, 'play')}
            <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.3em] text-cyan-200/60">
              {best > 0 ? t(lang, 'best', { n: best.toLocaleString() }) : t(lang, 'firstRun')}
            </span>
          </button>
          <button
            onClick={onCoop}
            className="w-full max-w-xs rounded-2xl border border-violet-300/50 bg-gradient-to-b from-violet-500/25 to-violet-700/10 px-8 py-3 font-display text-base font-black tracking-widest text-violet-100 transition active:scale-[0.97] hover:from-violet-400/35"
          >
            🛰 {t(lang, 'mp_online')}
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={onShop}
              className="flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-2.5 font-display text-sm font-bold tracking-widest text-amber-200 transition active:scale-95 hover:bg-amber-400/20"
            >
              {t(lang, 'armory')}
            </button>
            <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5">
              <span className="text-base">🪙</span>
              <span className="tnum font-display text-sm font-bold text-amber-300">{coins.toLocaleString()}</span>
            </div>
            <LangToggle lang={lang} onChange={onLang} />
          </div>
          <button onClick={onGuide} className="border-b border-cyan-400/30 pb-1 font-display text-[11px] tracking-widest text-cyan-200/80 transition hover:border-cyan-200 hover:text-white">
            {t(lang, 'fieldGuide')} &gt;
          </button>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">WASD</kbd> / <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">↑↓←→</kbd> {t(lang, 'move')}</span>
            <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">SPACE</kbd> {t(lang, 'dash')}</span>
            <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">ESC</kbd> {t(lang, 'pause')}</span>
            <span className="text-cyan-300/80">{t(lang, 'touchHint')}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <h3 className="font-display text-xs tracking-[0.25em] text-cyan-300/80">{t(lang, 'yourCores')}</h3>
            <div className="mt-3 space-y-1.5">
              {SHAPE_ORDER.map((id) => {
                const s = SHAPES[id];
                return (
                  <div key={id} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-2 py-1.5">
                    <ShapeGlyph id={id} size={22} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-tight" style={{ color: s.color }}>{shapeName(lang, id, s.name)}</div>
                      <div className="truncate text-[10.5px] leading-tight text-slate-400">{shapeBlurb(lang, id, s.blurb)}</div>
                    </div>
                    <div className="shrink-0 text-right text-[9.5px] leading-tight text-slate-500">
                      <div>{t(lang, 'hp')} {s.hp}</div>
                      <div>{s.speed.toFixed(0)} {t(lang, 'spd')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <h3 className="font-display text-xs tracking-[0.25em] text-rose-300/80">{t(lang, 'theRedSiege')}</h3>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {Object.values(ENEMIES).slice(0, 8).map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5">
                    <ShapeIcon sides={e.sides} color={e.color} size={20} />
                    <div className="min-w-0">
                      <div className="truncate text-[11.5px] font-bold leading-tight" style={{ color: e.color }}>{enemyName(lang, e.id, e.name)}</div>
                      <div className="text-[9.5px] leading-tight text-slate-500">{t(lang, 'atk_' + e.atk)}</div>
                      <div className="flex items-center gap-0.5 text-[9.5px] font-bold leading-tight text-emerald-400">
                        <span className="inline-block h-1.5 w-1.5 rotate-45 bg-emerald-400" />
                        {e.xp} {t(lang, 'xpShort')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={onGuide} className="mt-3 w-full border-t border-white/10 pt-3 text-left text-xs text-rose-200 hover:text-white">
                {t(lang, 'guideEnemies')} / {t(lang, 'guideBosses')} &gt;
              </button>
            </div>
            <HighScores lang={lang} scores={scores} />
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] text-slate-500">{t(lang, 'footer')}</p>
      </div>
    </div>
  );
}

export function HighScores({ lang, scores, highlight = -1 }: { lang: Lang; scores: ScoreRow[]; highlight?: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xs tracking-[0.25em] text-amber-300/80">{t(lang, 'highScores')}</h3>
        <span className="text-[10px] text-slate-500">{t(lang, 'local')}</span>
      </div>
      {scores.length === 0 ? (
        <p className="mt-3 text-center text-xs text-slate-500">{t(lang, 'noRuns')}</p>
      ) : (
        <div className="scroll-thin mt-2 max-h-44 overflow-y-auto pr-1">
          <table className="w-full text-[11.5px]">
            <tbody>
              {scores.slice(0, 8).map((s, i) => (
                <tr key={i} className={`border-b border-white/5 last:border-0 ${i === highlight ? 'text-amber-300' : 'text-slate-300'}`}>
                  <td className="w-6 py-1 font-mono text-slate-500">{i + 1}</td>
                  <td className="py-1"><span className="tnum font-bold">{s.score.toLocaleString()}</span></td>
                  <td className="py-1 text-right text-slate-400">{t(lang, 'lv')}{s.level}</td>
                  <td className="py-1 pl-2 text-right text-slate-500">{SHAPES[s.shape] ? shapeName(lang, s.shape, SHAPES[s.shape].name) : s.shape}</td>
                  <td className="py-1 pl-2 text-right font-mono text-slate-500">{Math.floor(s.time / 60)}:{String(Math.floor(s.time % 60)).padStart(2, '0')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------- */

export function LevelUpScreen({ lang, st, onPick, onReroll }: {
  lang: Lang; st: PublicState; onPick: (k: string) => void; onReroll: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key >= '1' && e.key <= '3') {
        const i = parseInt(e.key, 10) - 1;
        if (st.choices[i]) onPick(st.choices[i].key);
      }
      if ((e.code === 'KeyR' || e.key.toLowerCase() === 'r') && st.rerolls > 0) onReroll();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [st.choices, st.rerolls, onPick, onReroll]);

  return (
    <div className="scroll-thin absolute inset-0 flex flex-col items-center overflow-y-auto bg-[#04070f]/90 px-3 py-4 backdrop-blur-[3px] sm:justify-center">
      <div className="anim-slam text-center">
        <div className="font-display text-[10px] tracking-[0.5em] text-cyan-300/70">{t(lang, 'levelN', { n: st.level })}</div>
        <h2 className="font-display title-shine text-3xl font-black sm:text-4xl">{t(lang, 'evolve')}</h2>
      </div>
      <div className="mt-4 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3" key={st.choices.map((c) => c.key).join('|')}>
        {st.choices.map((c, i) => {
          const r = RARITY[c.def.rarity];
          const glyphShape = c.def.forShape || (c.def.kind === 'shape' ? c.def.shape : undefined);
          const w = c.def.weapon ? WEAPONS[c.def.weapon] : null;
          return (
            <button
              key={c.key}
              onClick={() => onPick(c.key)}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`anim-card group relative flex flex-col overflow-hidden rounded-2xl border ${r.border} bg-gradient-to-b ${r.bg} to-black/60 p-4 text-left shadow-lg ${r.glow} transition active:scale-[0.97] hover:brightness-125`}
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${r.border} bg-black/40 text-2xl`}>
                  {glyphShape
                    ? <ShapeGlyph id={glyphShape} size={30} />
                    : w
                      ? <span style={{ color: w.color }}>{w.icon}</span>
                      : <span>{c.def.icon}</span>}
                </div>
                <div className="text-right">
                  <div className={`font-display text-[9px] tracking-[0.2em] ${r.text}`}>{t(lang, 'rarity_' + c.def.rarity)}</div>
                  <div className="mt-1 flex justify-end gap-0.5">
                    {Array.from({ length: c.def.max }).map((_, k) => (
                      <span key={k} className={`h-1.5 w-1.5 rounded-full ${k < c.level ? r.dot : 'bg-white/15'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 font-display text-[9px] tracking-[0.16em] text-slate-400">{t(lang, c.def.forShape ? 'kind_mastery' : 'kind_' + c.def.kind)}</div>
              <h3 className="font-display text-lg font-bold leading-tight text-white">{upgName(lang, c.def.id, c.def.name)}</h3>
              <p className="mt-1 flex-1 text-[13px] leading-snug text-slate-300/90">{upgDesc(lang, c.def.id, c.def.desc)}</p>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-slate-500">
                <span>{t(lang, 'lv')} {c.level}/{c.def.max}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-300">[{i + 1}]</span>
              </div>
            </button>
          );
        })}
      </div>
      <button
        onClick={onReroll}
        disabled={st.rerolls <= 0}
        className="mt-4 flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/15 px-5 py-2 text-xs font-bold tracking-widest text-violet-200 transition enabled:hover:bg-violet-500/25 disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
      >
        {st.rerolls > 0 ? (
          <>
            {t(lang, 'reroll')}
            <span className="flex gap-0.5">
              {Array.from({ length: st.rerolls }).map((_, k) => (
                <span key={k} className="h-2 w-2 rounded-full bg-violet-300" />
              ))}
            </span>
          </>
        ) : t(lang, 'rerollEmpty')}
      </button>
    </div>
  );
}

/* ------------------------------------------------------- */

const UPG_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

const KIND_ORDER: { kind: string; color: string }[] = [
  { kind: 'mastery', color: 'text-cyan-200' },
  { kind: 'stat', color: 'text-slate-200' },
  { kind: 'weapon', color: 'text-cyan-300' },
  { kind: 'shape', color: 'text-violet-300' },
  { kind: 'helper', color: 'text-emerald-300' },
  { kind: 'special', color: 'text-amber-300' },
];

export function UpgradeList({ lang, owned, maxRows, shapeId }: { lang: Lang; owned: Record<string, number>; maxRows?: number; shapeId?: string }) {
  const entries: OwnedEntry[] = Object.entries(owned)
    .map(([id, lv]) => ({ def: UPG_BY_ID.get(id) as UpgDef, lv }))
    .filter((e) => e.def && e.lv > 0)
    .sort((a, b) => (b.def.rarity - a.def.rarity) || a.def.name.localeCompare(b.def.name));

  if (entries.length === 0) {
    return <p className="py-3 text-center text-xs text-slate-500">{t(lang, 'noUpgradesYet')}</p>;
  }

  let shown = entries;
  if (maxRows && entries.length > maxRows) shown = entries.slice(0, maxRows);

  return (
    <div className="space-y-2.5">
      {KIND_ORDER.map(({ kind, color }) => {
        const group = shown.filter((e) => kind === 'mastery' ? Boolean(e.def.forShape) : !e.def.forShape && e.def.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind}>
            <div className={`font-display text-[9.5px] tracking-[0.22em] ${color}`}>{t(lang, 'grp_' + kind)}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {group.map(({ def, lv }) => (
                <div
                  key={def.id}
                  title={upgDesc(lang, def.id, def.desc) + (def.forShape && def.forShape !== shapeId ? ` (${t(lang, 'masteryInactive', { name: shapeName(lang, def.forShape, SHAPES[def.forShape].name) })})` : '')}
                  className={`flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 ${def.forShape && shapeId && def.forShape !== shapeId ? 'opacity-45' : ''}`}
                >
                  {def.forShape || (def.kind === 'shape' && def.shape)
                    ? <ShapeGlyph id={def.forShape || def.shape!} size={15} />
                    : def.weapon
                      ? <span style={{ color: WEAPONS[def.weapon].color }} className="text-[13px] leading-none">{WEAPONS[def.weapon].icon}</span>
                      : <span className="text-[12px] leading-none">{def.icon}</span>}
                  <span className="text-[11.5px] font-bold leading-none text-slate-100">{upgName(lang, def.id, def.name)}</span>
                  {def.max > 1 && (
                    <span className="rounded bg-white/10 px-1 font-mono text-[9.5px] leading-tight text-slate-300">{lv}/{def.max}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {entries.length > shown.length && (
        <div className="text-center text-[10px] text-slate-500">{t(lang, 'more', { n: entries.length - shown.length })}</div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="text-[9.5px] tracking-[0.18em] text-slate-500">{label}</div>
      <div className="font-display text-lg font-bold tnum" style={{ color: color || '#e8f4ff' }}>{value}</div>
    </div>
  );
}

export function PauseScreen({ lang, st, onResume, onRestart, onQuit, onGuide }: {
  lang: Lang; st: PublicState; onResume: () => void; onRestart: () => void; onQuit: () => void; onGuide: () => void;
}) {
  const totalTiers = Object.values(st.owned).reduce((a, b) => a + b, 0);
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#04070f]/85 px-3 py-4 backdrop-blur-[3px]">
      <div className="anim-in glass scroll-thin max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-cyan-400/25 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-black tracking-widest text-cyan-100">{t(lang, 'paused')}</h2>
          <span className="font-mono text-[10px] tracking-widest text-slate-500">{t(lang, 'escResume')}</span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <Row label={t(lang, 'score')} value={st.score.toLocaleString()} />
          <Row label={t(lang, 'level')} value={st.level} />
          <Row label={t(lang, 'kills')} value={st.kills} />
          <Row label={t(lang, 'tiers')} value={totalTiers} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <span className="text-[9.5px] tracking-[0.18em] text-slate-500">{t(lang, 'shape')}</span>
          <ShapeGlyph id={st.shapeId} size={18} />
          <span className="font-display text-sm font-bold" style={{ color: SHAPES[st.shapeId].color }}>
            {shapeName(lang, st.shapeId, SHAPES[st.shapeId].name)}
          </span>
          <span className="ml-auto text-[10px] text-slate-500">{t(lang, 'hp')} {Math.ceil(st.hp)}/{Math.round(st.maxHp)}</span>
        </div>

        {st.rerolls > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-1.5">
            <span className="text-[13px]">⟳</span>
            <span className="text-[11px] font-bold text-violet-200">{t(lang, 'rerollStock')}: {st.rerolls}</span>
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-baseline justify-between border-b border-white/10 pb-1">
            <h3 className="font-display text-xs tracking-[0.25em] text-cyan-300/80">{t(lang, 'yourBuild')}</h3>
            <span className="text-[10px] text-slate-500">{t(lang, 'picked', { n: Object.keys(st.owned).length })}</span>
          </div>
          <div className="mt-2.5">
            <UpgradeList lang={lang} owned={st.owned} shapeId={st.shapeId} />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <button onClick={onResume} className="w-full rounded-xl border border-cyan-300/50 bg-cyan-400/20 py-3 font-display font-bold tracking-widest text-cyan-100 active:scale-[0.98]">{t(lang, 'resume')}</button>
          <button onClick={onGuide} className="w-full rounded-xl border border-white/15 py-2.5 text-xs tracking-widest text-cyan-200 hover:bg-white/5">{t(lang, 'fieldGuide')}</button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onRestart} className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold tracking-wider text-slate-200 active:scale-[0.98]">{t(lang, 'restart')}</button>
            <button onClick={onQuit} className="w-full rounded-xl border border-white/10 py-2.5 text-sm font-semibold tracking-wider text-slate-400 active:scale-[0.98]">{t(lang, 'menu')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GameOverScreen({ lang, st, scores, onRestart, onQuit, highlight }: {
  lang: Lang; st: PublicState; scores: ScoreRow[]; onRestart: () => void; onQuit: () => void; highlight: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.repeat || (e.target instanceof HTMLElement && e.target.closest('button, input, select'))) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyR') { e.preventDefault(); onRestart(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onRestart]);

  const isRecord = highlight === 0;
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#0a0410]/82 px-3 py-4 backdrop-blur-[3px]">
      <div className="glass scroll-thin anim-in max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-rose-500/30 p-6 shadow-[0_0_80px_rgba(255,45,85,0.15)]">
        <div className="text-center">
          <div className="font-display text-[10px] tracking-[0.45em] text-rose-300/70">{t(lang, 'runTerminated')}</div>
          <h2 className="font-display anim-slam mt-1 text-3xl font-black text-rose-400 sm:text-4xl">{t(lang, 'shattered')}</h2>
          <div className="mt-4 font-display text-5xl font-black tnum text-white">{st.score.toLocaleString()}</div>
          <div className="text-[10px] tracking-[0.3em] text-slate-500">{t(lang, 'finalScore')}</div>
          {isRecord && (
            <div className="mt-2 inline-block rounded-full border border-amber-400/50 bg-amber-400/15 px-3 py-1 font-display text-[10px] tracking-[0.25em] text-amber-300">
              {t(lang, 'newBest')}
            </div>
          )}
          {st.coinsEarned > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1">
              <span className="text-sm">🪙</span>
              <span className="tnum font-display text-sm font-bold text-amber-300">{t(lang, 'coinsEarned', { n: st.coinsEarned.toLocaleString() })}</span>
            </div>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Row label={t(lang, 'level')} value={st.level} />
          <Row label={t(lang, 'kills')} value={st.kills} />
          <Row label={t(lang, 'wave')} value={st.wave} />
          <Row label={t(lang, 'time')} value={`${Math.floor(st.time / 60)}:${String(Math.floor(st.time % 60)).padStart(2, '0')}`} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-slate-400">{t(lang, 'fellAs')}</span>
          <ShapeGlyph id={st.shapeId} size={18} />
          <span className="font-bold" style={{ color: SHAPES[st.shapeId].color }}>{shapeName(lang, st.shapeId, SHAPES[st.shapeId].name)}</span>
          <span className="text-slate-500">· {st.weapons.map((w) => weaponName(lang, w, WEAPONS[w].name)).join(' + ')}</span>
        </div>
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
          <h3 className="font-display text-[10px] tracking-[0.25em] text-cyan-300/80">{t(lang, 'finalBuild')}</h3>
          <div className="mt-2">
            <UpgradeList lang={lang} owned={st.owned} maxRows={14} shapeId={st.shapeId} />
          </div>
        </div>
        <div className="mt-4">
          <HighScores lang={lang} scores={scores} highlight={highlight} />
        </div>
        <div className="mt-4 space-y-2">
          <button onClick={onRestart} className="w-full rounded-xl border border-cyan-300/50 bg-gradient-to-b from-cyan-400/25 to-cyan-600/10 py-3.5 font-display text-lg font-black tracking-widest text-cyan-100 active:scale-[0.98]">
            {t(lang, 'retry')} <span className="text-[10px] font-semibold tracking-normal text-cyan-300/60">{t(lang, 'spaceKey')}</span>
          </button>
          <button onClick={onQuit} className="w-full rounded-xl border border-white/10 py-2 text-xs font-semibold tracking-wider text-slate-400 active:scale-[0.98]">{t(lang, 'mainMenu')}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- */

export function DashButton({ onPress, ringRef, fillRef }: {
  onPress: () => void; ringRef: React.RefObject<SVGCircleElement | null>; fillRef: React.RefObject<HTMLDivElement | null>;
}) {
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onPress(); }}
      className="absolute bottom-[92px] right-4 z-20 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/40 bg-black/45 backdrop-blur-sm active:scale-95"
      aria-label="Dash"
    >
      <div ref={fillRef} className="absolute inset-0 rounded-full bg-cyan-400/15" style={{ transform: 'scale(0)', transition: 'transform 120ms linear' }} />
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <circle ref={ringRef} cx="32" cy="32" r={R} fill="none" stroke="#7dd3fc" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C} />
      </svg>
      <span className="relative font-display text-2xl font-black text-cyan-200">»</span>
    </button>
  );
}
