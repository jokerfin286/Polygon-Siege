import { useState } from 'react';
import { SHOP, COLORS, THEMES, shopCost, rerollCost, REROLL_MAX, type Meta } from '../game/meta';
import { sfx } from '../game/sfx';
import { t, type Lang, shopName, shopDesc, themeName, colorName, RU_THEMES } from '../i18n';
import { LangToggle } from './Screens';

function CoinPill({ coins }: { coins: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1">
      <span className="text-sm">🪙</span>
      <span className="tnum font-display text-sm font-bold text-amber-300">{coins.toLocaleString()}</span>
    </div>
  );
}

/** Miniature preview of an arena's style, drawn with plain CSS/SVG. */
function ArenaPreview({ id, accent, bg }: { id: string; accent: string; bg: [string, string, string] }) {
  const dots = (n: number, seed: number) =>
    Array.from({ length: n }).map((_, i) => {
      const x = ((i * 37 + seed * 13) % 100);
      const y = ((i * 61 + seed * 29) % 100);
      return <circle key={i} cx={x} cy={y} r={0.9 + ((i + seed) % 3) * 0.5} fill={accent} opacity={0.5} />;
    });

  let motif: React.ReactNode = null;
  if (id === 'nebula') motif = <>{dots(14, 1)}</>;
  else if (id === 'void') motif = <>
    <polygon points="18,20 30,26 24,40 12,34" fill={accent} opacity="0.18" />
    <polygon points="70,58 84,62 80,76 66,72" fill={accent} opacity="0.14" />
    {dots(6, 3)}
  </>;
  else if (id === 'sunset') motif = <>
    <circle cx="70" cy="30" r="16" fill={accent} opacity="0.32" />
    <path d="M0,68 Q25,58 50,68 T100,64 L100,100 L0,100 Z" fill={accent} opacity="0.22" />
    <path d="M0,82 Q30,74 55,82 T100,79 L100,100 L0,100 Z" fill={accent} opacity="0.16" />
  </>;
  else if (id === 'toxic') motif = <>
    {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (
      <polygon key={`${r}-${c}`}
        points={hexPts(c * 28 + (r % 2 ? 14 : 0), r * 24, 12)}
        fill="none" stroke={accent} strokeWidth="1" opacity="0.28" />
    )))}
    <circle cx="30" cy="70" r="5" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.6" />
    <circle cx="62" cy="44" r="3.4" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.6" />
  </>;
  else if (id === 'ice') motif = <>
    <polygon points="30,12 38,34 30,56 22,34" fill={accent} opacity="0.2" stroke={accent} strokeOpacity="0.4" />
    <polygon points="72,44 79,62 72,80 65,62" fill={accent} opacity="0.16" stroke={accent} strokeOpacity="0.35" />
    {dots(10, 5)}
  </>;
  else if (id === 'crimson') motif = <>
    <rect x="12" y="58" width="26" height="14" fill={accent} opacity="0.2" />
    <rect x="52" y="44" width="20" height="12" fill={accent} opacity="0.16" />
    <rect x="66" y="70" width="24" height="10" fill={accent} opacity="0.18" />
    {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x="0" y={i * 18 + 6} width="100" height="1.4" fill={accent} opacity="0.12" />)}
  </>;
  else if (id === 'gold') motif = <>
    {[18, 32, 46, 60].map((r, i) => <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={accent} strokeWidth="1" opacity={0.3 - i * 0.05} />)}
    <rect x="16" y="0" width="7" height="100" fill={accent} opacity="0.1" />
    <rect x="78" y="0" width="7" height="100" fill={accent} opacity="0.1" />
    {dots(6, 7)}
  </>;

  return (
    <svg viewBox="0 0 100 100" className="h-14 w-full rounded-lg" preserveAspectRatio="none"
      style={{ background: `linear-gradient(135deg, ${bg[0]}, ${bg[2]})` }}>
      {motif}
    </svg>
  );
}

function hexPts(cx: number, cy: number, r: number) {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    p.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return p.join(' ');
}

export function ShopModal({ lang, meta, onChange, onClose, onLang }: {
  lang: Lang; meta: Meta; onChange: (m: Meta) => void; onClose: () => void; onLang: (l: Lang) => void;
}) {
  const [tab, setTab] = useState<'shop' | 'reroll' | 'color' | 'location'>('shop');
  const [flash, setFlash] = useState('');

  const deny = (id: string) => { sfx.select(); setFlash(id); setTimeout(() => setFlash(''), 320); };

  const buyUpgrade = (id: string) => {
    const def = SHOP.find((s) => s.id === id)!;
    const lv = meta.upgrades[id] || 0;
    if (lv >= def.max) return;
    const cost = shopCost(def, lv);
    if (meta.coins < cost) return deny(id);
    sfx.buy();
    onChange({ ...meta, coins: meta.coins - cost, upgrades: { ...meta.upgrades, [id]: lv + 1 } });
  };

  const buyReroll = () => {
    const stock = meta.rerollStock || 0;
    if (stock >= REROLL_MAX) return;
    const cost = rerollCost(stock);
    if (meta.coins < cost) return deny('reroll');
    sfx.buy();
    onChange({ ...meta, coins: meta.coins - cost, rerollStock: stock + 1 });
  };

  const selectColor = (id: string) => {
    const def = COLORS.find((c) => c.id === id)!;
    if (meta.unlockedColors.includes(id)) { sfx.select(); onChange({ ...meta, colorId: id }); return; }
    if (meta.coins < def.cost) return deny(id);
    sfx.buy();
    onChange({ ...meta, coins: meta.coins - def.cost, unlockedColors: [...meta.unlockedColors, id], colorId: id });
  };

  const selectTheme = (id: string) => {
    const def = THEMES.find((th) => th.id === id)!;
    if (meta.unlockedThemes.includes(id)) { sfx.select(); onChange({ ...meta, themeId: id }); return; }
    if (meta.coins < def.cost) return deny(id);
    sfx.buy();
    onChange({ ...meta, coins: meta.coins - def.cost, unlockedThemes: [...meta.unlockedThemes, id], themeId: id });
  };

  const stock = meta.rerollStock || 0;
  const nextCost = rerollCost(stock);
  const full = stock >= REROLL_MAX;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04070f]/85 px-3 py-4 backdrop-blur-md">
      <div className="glass anim-in flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-cyan-400/25 shadow-[0_0_80px_rgba(56,245,224,0.12)]">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 className="font-display text-lg font-black tracking-widest text-cyan-100 sm:text-xl">{t(lang, 'shopTitle')}</h2>
          <div className="flex items-center gap-2">
            <CoinPill coins={meta.coins} />
            <LangToggle lang={lang} onChange={onLang} />
            <button onClick={() => { sfx.select(); onClose(); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 active:scale-95">✕</button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 pt-2">
          {(['shop', 'reroll', 'color', 'location'] as const).map((id) => (
            <button
              key={id}
              onClick={() => { sfx.select(); setTab(id); }}
              className={`shrink-0 rounded-t-lg px-3.5 py-2 font-display text-[11px] font-bold tracking-widest transition ${tab === id ? 'bg-white/8 text-cyan-200' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {t(lang, 'tab_' + id)}
              {id === 'reroll' && stock > 0 && (
                <span className="ml-1.5 rounded-full bg-violet-500/30 px-1.5 text-[10px] text-violet-200">{stock}</span>
              )}
            </button>
          ))}
        </div>

        <div className="scroll-thin overflow-y-auto p-4">
          {tab === 'shop' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {SHOP.map((s) => {
                const lv = meta.upgrades[s.id] || 0;
                const maxed = lv >= s.max;
                const cost = shopCost(s, lv);
                const afford = meta.coins >= cost;
                return (
                  <div key={s.id} className={`rounded-2xl border ${maxed ? 'border-amber-400/40' : 'border-white/10'} bg-white/[0.03] p-3 ${flash === s.id ? 'animate-pulse border-rose-500/60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-xl">{s.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-sm font-bold text-white">{shopName(lang, s.id, s.name)}</h3>
                          <div className="flex shrink-0 gap-0.5">
                            {Array.from({ length: s.max }).map((_, k) => (
                              <span key={k} className={`h-1.5 w-1.5 rounded-full ${k < lv ? 'bg-cyan-400' : 'bg-white/15'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-slate-400">{shopDesc(lang, s.id, s.desc)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => buyUpgrade(s.id)}
                      disabled={maxed}
                      className={`mt-2.5 w-full rounded-xl py-2 text-xs font-bold tracking-wider transition active:scale-[0.98] ${
                        maxed ? 'cursor-default border border-amber-400/40 bg-amber-400/10 text-amber-300'
                        : afford ? 'border border-cyan-300/50 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25'
                        : 'border border-white/10 bg-white/5 text-slate-500'
                      }`}
                    >
                      {maxed ? t(lang, 'maxed') : <>🪙 {cost.toLocaleString()} · {t(lang, 'buyLv', { n: lv + 1 })}</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'reroll' && (
            <div className="mx-auto max-w-md">
              <div className={`rounded-2xl border p-5 text-center ${flash === 'reroll' ? 'animate-pulse border-rose-500/60' : 'border-violet-400/30'} bg-violet-500/[0.07]`}>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/40 bg-black/40 text-3xl text-violet-200">⟳</div>
                <h3 className="mt-3 font-display text-lg font-black tracking-widest text-violet-100">{t(lang, 'rerollTitle')}</h3>
                <p className="mt-2 text-[12.5px] leading-snug text-slate-400">{t(lang, 'rerollDesc')}</p>

                <div className="mt-4 flex items-center justify-center gap-2">
                  {Array.from({ length: REROLL_MAX }).map((_, k) => (
                    <span
                      key={k}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm transition ${
                        k < stock
                          ? 'border-violet-300/70 bg-violet-400/25 text-violet-100 shadow-[0_0_14px_rgba(167,139,250,0.4)]'
                          : 'border-white/10 bg-white/[0.03] text-slate-600'
                      }`}
                    >⟳</span>
                  ))}
                </div>
                <div className="mt-2 font-display text-[11px] tracking-[0.2em] text-slate-400">
                  {t(lang, 'rerollStock')} {stock} / {REROLL_MAX}
                </div>

                <button
                  onClick={buyReroll}
                  disabled={full}
                  className={`mt-4 w-full rounded-xl py-3 font-display text-sm font-bold tracking-widest transition active:scale-[0.98] ${
                    full ? 'cursor-default border border-amber-400/40 bg-amber-400/10 text-amber-300'
                    : meta.coins >= nextCost ? 'border border-violet-300/60 bg-violet-500/25 text-violet-50 hover:bg-violet-500/35'
                    : 'border border-white/10 bg-white/5 text-slate-500'
                  }`}
                >
                  {full ? t(lang, 'rerollFull') : <>🪙 {nextCost.toLocaleString()} · {t(lang, 'rerollBuy')}</>}
                </button>
                <p className="mt-2 text-[10.5px] text-slate-500">{t(lang, 'rerollNote', { n: REROLL_MAX })}</p>
              </div>
            </div>
          )}

          {tab === 'color' && (
            <>
              <p className="mb-3 text-center text-[12px] text-slate-400">{t(lang, 'colorHint')}</p>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {COLORS.map((c) => {
                  const unlocked = meta.unlockedColors.includes(c.id);
                  const selected = meta.colorId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectColor(c.id)}
                      className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition active:scale-95 ${selected ? 'border-white bg-white/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'} ${flash === c.id ? 'animate-pulse border-rose-500/60' : ''}`}
                    >
                      <span className="h-9 w-9 rounded-full shadow-lg" style={{ background: c.hex, boxShadow: `0 0 16px ${c.hex}` }} />
                      <span className="text-[11px] font-bold text-slate-200">{colorName(lang, c.id, c.name)}</span>
                      {!unlocked && <span className="text-[10px] font-bold text-amber-300">🪙 {c.cost}</span>}
                      {selected && <span className="absolute right-1.5 top-1.5 text-[11px] text-cyan-300">✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'location' && (
            <>
              <p className="mb-3 text-center text-[12px] text-slate-400">{t(lang, 'locationHint')}</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {THEMES.map((th) => {
                  const unlocked = meta.unlockedThemes.includes(th.id);
                  const selected = meta.themeId === th.id;
                  const desc = lang === 'ru' ? (RU_THEMES[th.id]?.desc ?? th.desc) : th.desc;
                  return (
                    <button
                      key={th.id}
                      onClick={() => selectTheme(th.id)}
                      className={`relative overflow-hidden rounded-2xl border p-2.5 text-left transition active:scale-[0.98] ${selected ? 'border-white' : 'border-white/10 hover:border-white/30'} ${flash === th.id ? 'animate-pulse border-rose-500/60' : ''}`}
                    >
                      <ArenaPreview id={th.id} accent={th.accent} bg={th.bg} />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold" style={{ color: th.accent }}>{themeName(lang, th.id, th.name)}</span>
                        {selected ? <span className="shrink-0 text-[10px] text-cyan-200">{t(lang, 'active')}</span>
                          : unlocked ? <span className="shrink-0 text-[10px] text-slate-400">{t(lang, 'select')}</span>
                          : <span className="shrink-0 text-[11px] font-bold text-amber-300">🪙 {th.cost.toLocaleString()}</span>}
                      </div>
                      <p className="mt-0.5 text-[10.5px] leading-snug text-slate-400">{desc}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
