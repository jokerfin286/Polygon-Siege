import { useEffect, useMemo, useRef, useState } from 'react';
import { ENEMIES, EXPANSION_UPGRADES, SHAPES, SHAPE_ORDER, UPGRADES, type EnemyDef, type UpgDef } from '../game/defs';
import { t, enemyName, enemyTactic, shapeName, upgName, upgDesc, type Lang } from '../i18n';

type Tab = 'masteries' | 'upgrades' | 'enemies' | 'bosses';
interface Entry {
  id: string; name: string; desc: string; color: string; sides: number;
  enemy?: EnemyDef; upgrade?: UpgDef;
}

function Portrait({ entry, large = false }: { entry: Entry; large?: boolean }) {
  const sides = entry.sides || 16;
  const points = Array.from({ length: sides }, (_, i) => {
    const a = i * Math.PI * 2 / sides - Math.PI / 2;
    return `${50 + Math.cos(a) * 27},${50 + Math.sin(a) * 27}`;
  }).join(' ');
  const motif = entry.enemy?.motif;
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" width={large ? 116 : 36} height={large ? 116 : 36} className={large ? 'guide-portrait' : 'shrink-0'}>
      <circle cx="50" cy="50" r="43" fill={entry.color} opacity="0.045" />
      {entry.enemy?.boss && <circle cx="50" cy="50" r="39" fill="none" stroke={entry.color} opacity="0.4" strokeDasharray="4 5" />}
      <polygon points={points} fill={`${entry.color}18`} stroke={entry.color} strokeWidth="2" />
      {motif === 'shield' ? <path d="M76 16 A43 43 0 0 1 76 84" stroke={entry.color} strokeWidth="4" fill="none" />
        : motif === 'medic' ? <path d="M50 37 V63 M37 50 H63" stroke={entry.color} strokeWidth="4" />
        : motif === 'maw' ? <path d="M20 25 L72 35 L66 42 M20 75 L72 65 L66 58" fill="none" stroke={entry.color} strokeWidth="3" />
        : <circle cx="50" cy="50" r="8" fill={entry.color} opacity="0.7" />}
      {['prism', 'brood', 'seeker'].includes(motif || '') && [0, 1, 2].map((i) => (
        <circle key={i} cx={50 + Math.cos(i * Math.PI * 2 / 3) * 37} cy={50 + Math.sin(i * Math.PI * 2 / 3) * 37} r="3" fill={entry.color} />
      ))}
      {motif === 'lance' && <path d="M12 36 L23 50 L12 64" stroke={entry.color} strokeWidth="3" fill="none" />}
      {motif === 'wings' && <path d="M13 32 L23 50 L13 68 M87 32 L77 50 L87 68" stroke={entry.color} strokeWidth="3" fill="none" />}
      {motif === 'mortar' && <circle cx="50" cy="50" r="16" fill="none" stroke={entry.color} strokeWidth="2" />}
    </svg>
  );
}

function AimDiagram({ lang }: { lang: Lang }) {
  return (
    <div className="mt-6 border-t border-white/10 pt-4">
      <p className="font-display text-[10px] tracking-wider text-cyan-200">{t(lang, 'guideAimTitle')}</p>
      <svg viewBox="0 0 300 85" className="my-2 w-full max-w-xs" aria-hidden="true">
        <circle cx="55" cy="42" r="23" fill="#38f5e010" stroke="#38f5e0" strokeWidth="1.5" />
        <path d="M74 42 H86 M69 57 H83" stroke="#bfffee" strokeWidth="4" />
        <path d="M86 42 H258 M83 57 L258 42" className="guide-trajectory" stroke="#38f5e0" strokeWidth="1.5" strokeDasharray="6 10" />
        <circle cx="265" cy="42" r="12" fill="#ff5a5a20" stroke="#ff5a5a" strokeWidth="1.5" />
        <path d="M265 24 V30 M265 54 V60 M247 42 H253 M277 42 H283" stroke="#ff5a5a" opacity="0.65" />
      </svg>
      <p className="text-xs leading-relaxed text-slate-400">{t(lang, 'guideAimText')}</p>
    </div>
  );
}

export function FieldGuide({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('masteries');
  const [shape, setShape] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('circleGyro');
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const items = panel.current?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keyboard, true);
    return () => { window.removeEventListener('keydown', keyboard, true); previous?.focus(); };
  }, [onClose]);

  const entries = useMemo<Entry[]>(() => {
    const search = query.trim().toLocaleLowerCase();
    if (tab === 'enemies' || tab === 'bosses') {
      return Object.values(ENEMIES).filter((e) => Boolean(e.boss) === (tab === 'bosses')).map((enemy) => ({
        id: enemy.id, name: enemyName(lang, enemy.id, enemy.name), desc: enemyTactic(lang, enemy.id),
        color: enemy.color, sides: enemy.sides, enemy,
      })).filter((entry) => `${entry.name} ${entry.desc}`.toLocaleLowerCase().includes(search));
    }
    return EXPANSION_UPGRADES.filter((u) => Boolean(u.forShape) === (tab === 'masteries'))
      .filter((u) => shape === 'all' || !u.forShape || u.forShape === shape)
      .map((upgrade) => ({
        id: upgrade.id, name: upgName(lang, upgrade.id, upgrade.name), desc: upgDesc(lang, upgrade.id, upgrade.desc),
        color: upgrade.forShape ? SHAPES[upgrade.forShape].color : '#a5b4fc',
        sides: upgrade.forShape ? SHAPES[upgrade.forShape].sides : 6, upgrade,
      })).filter((entry) => `${entry.name} ${entry.desc}`.toLocaleLowerCase().includes(search));
  }, [lang, tab, query, shape]);
  const active = entries.find((entry) => entry.id === selected) || entries[0];
  const requirement = active?.upgrade?.req ? UPGRADES.find((u) => u.id === active.upgrade!.req) : undefined;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#04070f]/90 p-3 backdrop-blur-md" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="guide-title" className="glass anim-in flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan-300/20 shadow-2xl">
        <header className="flex items-start justify-between gap-4 px-5 py-5 sm:px-7">
          <div>
            <p className="mb-2 font-mono text-[9px] tracking-[0.25em] text-cyan-400">POLYGON SIEGE / {t(lang, 'fieldGuide')}</p>
            <h2 id="guide-title" className="font-display text-xl font-bold text-white sm:text-2xl">{t(lang, 'guideTitle')}</h2>
            <p className="mt-2 text-sm text-slate-400">{t(lang, 'guideIntro')}</p>
          </div>
          <button onClick={onClose} aria-label={t(lang, 'guideClose')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 text-lg text-slate-300 hover:border-cyan-300/50 hover:text-white">X</button>
        </header>
        <div className="flex overflow-x-auto border-y border-white/10 px-3" role="tablist" aria-label={t(lang, 'fieldGuide')}>
          {(['masteries', 'upgrades', 'enemies', 'bosses'] as Tab[]).map((id) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setQuery(''); }} className={`shrink-0 border-b-2 px-3 py-3 font-display text-[10px] tracking-wide transition-colors sm:px-5 ${tab === id ? 'border-cyan-300 bg-cyan-300/5 text-cyan-100' : 'border-transparent text-slate-500 hover:text-white'}`}>
              {t(lang, id === 'masteries' ? 'guideMasteries' : id === 'upgrades' ? 'guideUpgrades' : id === 'enemies' ? 'guideEnemies' : 'guideBosses')}
            </button>
          ))}
        </div>
        <div className="flex gap-2 border-b border-white/10 p-3 sm:px-5">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(lang, 'guideSearch')} aria-label={t(lang, 'guideSearch')} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60" />
          {tab === 'masteries' && <select aria-label={t(lang, 'shape')} value={shape} onChange={(e) => setShape(e.target.value)} className="max-w-[45%] rounded-lg border border-white/10 bg-[#111a2b] px-2 text-xs text-cyan-100 outline-none focus:border-cyan-300/60">
            <option value="all">{t(lang, 'guideAllShapes')}</option>
            {SHAPE_ORDER.map((id) => <option key={id} value={id}>{shapeName(lang, id, SHAPES[id].name)}</option>)}
          </select>}
        </div>
        <div className="scroll-thin grid min-h-0 overflow-y-auto md:grid-cols-[0.9fr_1.1fr]">
          <div className="scroll-thin max-h-[28dvh] overflow-y-auto border-b border-white/10 md:max-h-[55dvh] md:border-r md:border-b-0">
            {entries.map((entry) => <button key={entry.id} onClick={() => setSelected(entry.id)} aria-pressed={active?.id === entry.id} className={`flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors ${active?.id === entry.id ? 'bg-cyan-300/7' : 'hover:bg-white/4'}`}>
              <Portrait entry={entry} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold" style={{ color: active?.id === entry.id ? entry.color : '#e2e8f0' }}>{entry.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{entry.upgrade?.forShape ? shapeName(lang, entry.upgrade.forShape, SHAPES[entry.upgrade.forShape].name) : entry.enemy ? t(lang, 'atk_' + entry.enemy.atk) : t(lang, 'guideEveryShape')}</p>
              </div>
              <span className="text-xs text-slate-600">&gt;</span>
            </button>)}
            {!entries.length && <p className="px-5 py-10 text-sm text-slate-400">{t(lang, 'guideNone')}</p>}
          </div>
          {active && <section key={active.id} className="anim-in p-5 sm:p-7" aria-live="polite">
            <div className="flex items-center gap-4">
              <Portrait entry={active} large />
              <div>
                <p className="mb-2 font-mono text-[9px] tracking-widest text-slate-500">{active.enemy ? t(lang, active.enemy.boss ? 'guideBosses' : 'guideEnemies') : t(lang, 'newLabel')}</p>
                <h3 className="font-display text-lg leading-snug" style={{ color: active.color }}>{active.name}</h3>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{active.desc}</p>
            {active.upgrade && <>
              <p className="mt-3 text-xs text-slate-500">{t(lang, 'guideTiers', { n: active.upgrade.max })} / {t(lang, 'rarity_' + active.upgrade.rarity)}</p>
              <p className="mt-2 text-xs" style={{ color: active.color }}>{t(lang, active.upgrade.forShape ? 'guideShapeOnly' : 'guideEveryShape')}</p>
              {requirement && <p className="mt-2 text-xs text-slate-400">{t(lang, 'guideRequirements')}: {upgName(lang, requirement.id, requirement.name)}</p>}
              <AimDiagram lang={lang} />
            </>}
            {active.enemy && <>
              <dl className="mt-6 grid grid-cols-3 gap-3 border-y border-white/10 py-4 text-xs text-slate-500">
                <div><dt>{t(lang, 'guideBaseHp')}</dt><dd className="mt-1 font-mono text-base text-white">{active.enemy.hp}</dd></div>
                <div><dt>{t(lang, 'guideDamage')}</dt><dd className="mt-1 font-mono text-base text-white">{active.enemy.dmg}</dd></div>
                <div><dt>{t(lang, 'xpShort')}</dt><dd className="mt-1 font-mono text-base text-emerald-300">{active.enemy.xp}</dd></div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-slate-400">{active.enemy.boss ? t(lang, 'guideBossRule') : t(lang, 'guideAppear', { n: active.enemy.spawnAfter })}</p>
            </>}
          </section>}
        </div>
      </div>
    </div>
  );
}