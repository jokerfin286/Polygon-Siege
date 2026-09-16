import { useState } from 'react';
import { SHOP, COLORS, THEMES, shopCost, type Meta } from '../game/meta';
import { sfx } from '../game/sfx';

function CoinPill({ coins }: { coins: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1">
      <span className="text-sm">🪙</span>
      <span className="tnum font-display text-sm font-bold text-amber-300">{coins.toLocaleString()}</span>
    </div>
  );
}

export function ShopModal({ meta, onChange, onClose }: {
  meta: Meta; onChange: (m: Meta) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<'shop' | 'color' | 'location'>('shop');
  const [flash, setFlash] = useState('');

  const buyUpgrade = (id: string) => {
    const def = SHOP.find((s) => s.id === id)!;
    const lv = meta.upgrades[id] || 0;
    if (lv >= def.max) return;
    const cost = shopCost(def, lv);
    if (meta.coins < cost) { sfx.select(); setFlash(id); setTimeout(() => setFlash(''), 300); return; }
    sfx.buy();
    onChange({ ...meta, coins: meta.coins - cost, upgrades: { ...meta.upgrades, [id]: lv + 1 } });
  };

  const selectColor = (id: string) => {
    const def = COLORS.find((c) => c.id === id)!;
    const unlocked = meta.unlockedColors.includes(id);
    if (unlocked) { sfx.select(); onChange({ ...meta, colorId: id }); return; }
    if (meta.coins < def.cost) { sfx.select(); setFlash(id); setTimeout(() => setFlash(''), 300); return; }
    sfx.buy();
    onChange({ ...meta, coins: meta.coins - def.cost, unlockedColors: [...meta.unlockedColors, id], colorId: id });
  };

  const selectTheme = (id: string) => {
    const def = THEMES.find((t) => t.id === id)!;
    const unlocked = meta.unlockedThemes.includes(id);
    if (unlocked) { sfx.select(); onChange({ ...meta, themeId: id }); return; }
    if (meta.coins < def.cost) { sfx.select(); setFlash(id); setTimeout(() => setFlash(''), 300); return; }
    sfx.buy();
    onChange({ ...meta, coins: meta.coins - def.cost, unlockedThemes: [...meta.unlockedThemes, id], themeId: id });
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04070f]/85 px-3 py-4 backdrop-blur-md">
      <div className="glass anim-in flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-cyan-400/25 shadow-[0_0_80px_rgba(56,245,224,0.12)]">
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="font-display text-xl font-black tracking-widest text-cyan-100">ARMORY</h2>
          <div className="flex items-center gap-3">
            <CoinPill coins={meta.coins} />
            <button onClick={() => { sfx.select(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 active:scale-95">✕</button>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-white/10 px-3 pt-2">
          {([['shop', 'UPGRADES'], ['color', 'COLOR'], ['location', 'LOCATION']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { sfx.select(); setTab(id); }}
              className={`rounded-t-lg px-4 py-2 font-display text-xs font-bold tracking-widest transition ${tab === id ? 'bg-white/8 text-cyan-200' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {label}
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
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-sm font-bold text-white">{s.name}</h3>
                          <div className="flex gap-0.5">
                            {Array.from({ length: s.max }).map((_, k) => (
                              <span key={k} className={`h-1.5 w-1.5 rounded-full ${k < lv ? 'bg-cyan-400' : 'bg-white/15'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-slate-400">{s.desc}</p>
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
                      {maxed ? 'MAXED' : <>🪙 {cost.toLocaleString()} · LV {lv + 1}</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'color' && (
            <>
              <p className="mb-3 text-center text-[12px] text-slate-400">Choose your shape's colour. Unlock premium tints with coins.</p>
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
                      <span className="text-[11px] font-bold text-slate-200">{c.name}</span>
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
              <p className="mb-3 text-center text-[12px] text-slate-400">Pick your battleground. Each location restyles the whole arena.</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {THEMES.map((th) => {
                  const unlocked = meta.unlockedThemes.includes(th.id);
                  const selected = meta.themeId === th.id;
                  return (
                    <button
                      key={th.id}
                      onClick={() => selectTheme(th.id)}
                      className={`relative overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.98] ${selected ? 'border-white' : 'border-white/10 hover:border-white/25'} ${flash === th.id ? 'animate-pulse border-rose-500/60' : ''}`}
                      style={{ background: `linear-gradient(135deg, ${th.bg[0]}, ${th.bg[2]})` }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm font-bold" style={{ color: th.accent }}>{th.name}</span>
                        {selected ? <span className="text-[11px] text-cyan-200">✓ ACTIVE</span>
                          : unlocked ? <span className="text-[10px] text-slate-400">SELECT</span>
                          : <span className="text-[11px] font-bold text-amber-300">🪙 {th.cost}</span>}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        {[th.accent, th.star, th.edge].map((c, i) => (
                          <span key={i} className="h-3 w-8 rounded-full" style={{ background: c }} />
                        ))}
                      </div>
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
