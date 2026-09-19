import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type PublicState, type Mate, setBestCache, getBestCache } from './game/engine';
import { render } from './game/render';
import { sfx } from './game/sfx';
import { loadScores, loadMuted, saveMuted, loadBest, type ScoreRow } from './game/storage';
import { loadMeta, saveMeta, buildStartConfig, type Meta } from './game/meta';
import { StartScreen, LevelUpScreen, PauseScreen, GameOverScreen, DashButton } from './ui/Screens';
import { ShopModal } from './ui/Shop';
import { FieldGuide } from './ui/FieldGuide';
import { loadLang, saveLang, type Lang } from './i18n';
import { Session } from './net/session';
import { RemoteView } from './net/remoteView';
import type { NetChoice, Snapshot } from './net/net';
import { UPGRADES } from './game/defs';
import {
  MultiplayerEntry, HostLobby, GuestJoin, Countdown, CoopWaitOverlay, SessionProvider,
} from './ui/Multiplayer';
import { t } from './i18n';

const INITIAL: PublicState = {
  phase: 'menu', score: 0, best: 0, level: 1, kills: 0, time: 0, hp: 100, maxHp: 100,
  shapeId: 'circle', weapons: ['disc'], choices: [], rerolls: 0, wave: 1, combo: 0, owned: {}, paused: false, coinsEarned: 0,
  coop: false, levelupName: '', levelupIsLocal: true, mates: [],
};

const NAME_KEY = 'polygon-siege-name-v1';

type MpScreen = 'none' | 'entry' | 'hostLobby' | 'guestJoin';

/** Convert engine Choice objects into a compact form sent to guests. */
function toNetChoices(m: Mate): NetChoice[] {
  return m.choices.map((c) => ({
    key: c.key, name: c.def.name, desc: c.def.desc, rarity: c.def.rarity, kind: c.def.kind,
    icon: c.def.icon, level: c.level, max: c.def.max, weapon: c.def.weapon, shape: c.def.shape || c.def.forShape,
  }));
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const viewRef = useRef<RemoteView | null>(null);
  const dashRing = useRef<SVGCircleElement | null>(null);
  const dashFill = useRef<HTMLDivElement | null>(null);
  const ptrId = useRef<number | null>(null);

  const [st, setSt] = useState<PublicState>(INITIAL);
  const [scores, setScores] = useState<ScoreRow[]>(() => loadScores());
  const [muted, setMuted] = useState<boolean>(() => loadMuted());
  const [highlight, setHighlight] = useState(-1);
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [shopOpen, setShopOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const metaRef = useRef<Meta>(meta);
  metaRef.current = meta;

  // ---- multiplayer state ----
  const [mpScreen, setMpScreen] = useState<MpScreen>('none');
  const [mpName, setMpName] = useState<string>(() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } });
  const [mpTick, setMpTick] = useState(0);            // bumped to re-render lobby
  const [role, setRole] = useState<'solo' | 'host' | 'guest'>('solo');
  const [countdown, setCountdown] = useState<number | null>(null);
  const sessionRef = useRef<Session | null>(null);
  // guest-side reactive state
  const [guestSnap, setGuestSnap] = useState<Snapshot | null>(null);
  const [guestPhase, setGuestPhase] = useState<'lobby' | 'playing' | 'over'>('lobby');
  const [guestLevelUp, setGuestLevelUp] = useState<{ name: string; choices: NetChoice[]; rerolls: number } | null>(null);
  const roleRef = useRef(role); roleRef.current = role;
  const overlayRef = useRef(false);
  overlayRef.current = shopOpen || guideOpen || mpScreen !== 'none';

  /* ---------------- boot: game + loop + input ---------------- */
  useEffect(() => {
    setBestCache(loadBest());
    try { document.documentElement.lang = loadLang(); } catch { /* ignore */ }
    const canvas = canvasRef.current!;
    let lastPhase: PublicState['phase'] = 'menu';
    const g = new Game(canvas, (s) => {
      if (s.phase !== lastPhase) {
        lastPhase = s.phase;
        if (s.phase === 'dead') {
          const rows = loadScores();
          setScores(rows);
          setHighlight(rows.findIndex((r) => r.score === s.score && r.time === s.time && r.kills === s.kills));
          if (s.coinsEarned > 0) {
            setMeta((prev) => {
              const nm = { ...prev, coins: prev.coins + s.coinsEarned };
              saveMeta(nm);
              return nm;
            });
          }
          // host: notify guests the run ended
          sessionRef.current?.sendGameOver();
        } else if (s.phase === 'menu') {
          setScores(loadScores());
        }
      }
      setSt(s);
    });
    gameRef.current = g;
    viewRef.current = new RemoteView(canvas);
    g.onSpendReroll = () => {
      setMeta((prev) => {
        const nm = { ...prev, rerollStock: Math.max(0, (prev.rerollStock || 0) - 1) };
        saveMeta(nm);
        return nm;
      });
    };
    // host: when a mate needs to choose, forward its cards to that guest.
    g.onMateLevelUp = (m: Mate) => {
      const s = sessionRef.current;
      if (!s || m.local) return;
      s.sendLevelUp(m.slot, m.name, toNetChoices(m), m.rerolls);
    };
    g.lang = loadLang();
    g.applyMeta(buildStartConfig(metaRef.current));
    sfx.setMuted(loadMuted());

    let raf = 0;
    let last = performance.now();
    const loop = (tNow: number) => {
      const dt = (tNow - last) / 1000;
      last = tNow;
      if (roleRef.current === 'guest') {
        // guest: draw the streamed snapshot only
        viewRef.current?.render(Math.min(0.05, dt));
      } else {
        g.frame(dt);
        render(g, tNow / 1000);
        // dash UI (direct DOM for 60fps smoothness)
        if (dashRing.current) {
          const cd = g.dashCd;
          const max = 1.5 * (g.stats?.dashCdMul || 1);
          const C = 2 * Math.PI * 26;
          const f = cd > 0 ? 1 - Math.min(1, cd / max) : 1;
          dashRing.current.style.strokeDashoffset = String(C * (1 - f));
          dashRing.current.style.opacity = f >= 1 ? '1' : '0.45';
        }
        if (dashFill.current) {
          const f = g.dashCd > 0 ? 0 : 1;
          dashFill.current.style.transform = `scale(${f})`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    /* ---- keyboard ---- */
    const kd = (e: KeyboardEvent) => {
      if (overlayRef.current) return;
      const physical: Record<string, string> = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyP: 'p', KeyM: 'm' };
      const k = physical[e.code] || e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (roleRef.current === 'guest') {
        if (k === ' ' || k === 'shift') { guestKeys.current.dash = true; return; }
        guestKeys.current.set.add(k);
        return;
      }
      if (k === 'escape' || k === 'p') { if (!e.repeat && !g.coop) g.togglePause(); return; }
      if (k === 'm') { if (!e.repeat) setMuted((m) => { saveMuted(!m); sfx.setMuted(!m); return !m; }); return; }
      if (k === ' ') { g.tryDash(); return; }
      if (k === 'shift') { g.tryDash(); return; }
      g.keys.add(k);
    };
    const ku = (e: KeyboardEvent) => {
      const physical: Record<string, string> = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' };
      const key = physical[e.code] || e.key.toLowerCase();
      g.keys.delete(key);
      guestKeys.current.set.delete(key);
    };
    const blur = () => { g.keys.clear(); g.touchActive = false; ptrId.current = null; guestKeys.current.set.clear(); };
    window.addEventListener('keydown', kd, { passive: false });
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);

    /* ---- pointer (touch joystick / mouse drag) ---- */
    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pd = (e: PointerEvent) => {
      if (ptrId.current !== null) return;
      if (roleRef.current === 'guest') {
        if (guestPhaseRef.current !== 'playing') return;
        ptrId.current = e.pointerId;
        const p = local(e);
        guestKeys.current.tOx = p.x; guestKeys.current.tOy = p.y; guestKeys.current.tX = p.x; guestKeys.current.tY = p.y; guestKeys.current.touch = true;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (g.phase !== 'playing') return;
      ptrId.current = e.pointerId;
      const p = local(e);
      g.touchActive = true; g.tOx = p.x; g.tOy = p.y; g.tX = p.x; g.tY = p.y;
      canvas.setPointerCapture(e.pointerId);
    };
    const pm = (e: PointerEvent) => {
      if (ptrId.current !== e.pointerId) return;
      const p = local(e);
      if (roleRef.current === 'guest') { guestKeys.current.tX = p.x; guestKeys.current.tY = p.y; return; }
      g.tX = p.x; g.tY = p.y;
    };
    const pu = (e: PointerEvent) => {
      if (ptrId.current !== e.pointerId) return;
      ptrId.current = null;
      g.touchActive = false;
      guestKeys.current.touch = false;
    };
    canvas.addEventListener('pointerdown', pd);
    canvas.addEventListener('pointermove', pm);
    canvas.addEventListener('pointerup', pu);
    canvas.addEventListener('pointercancel', pu);

    /* ---- guest input sender (20/s) ---- */
    const inputTimer = setInterval(() => {
      if (roleRef.current !== 'guest') return;
      const s = sessionRef.current;
      if (!s || guestPhaseRef.current !== 'playing') return;
      const gk = guestKeys.current;
      let mx = 0, my = 0;
      if (gk.set.has('a') || gk.set.has('arrowleft')) mx -= 1;
      if (gk.set.has('d') || gk.set.has('arrowright')) mx += 1;
      if (gk.set.has('w') || gk.set.has('arrowup')) my -= 1;
      if (gk.set.has('s') || gk.set.has('arrowdown')) my += 1;
      if (gk.touch) {
        const dx = gk.tX - gk.tOx, dy = gk.tY - gk.tOy;
        const d = Math.hypot(dx, dy);
        if (d > 6) { const m2 = Math.min(1, d / 62); mx = (dx / d) * m2; my = (dy / d) * m2; }
      }
      s.guestInput(mx, my, gk.dash, 0);
      gk.dash = false;
    }, 50);

    /* ---- resize ---- */
    const onResize = () => { g.resize(); viewRef.current?.resize(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const vis = () => { if (document.hidden && !g.coop && roleRef.current === 'solo') g.pause(); };
    document.addEventListener('visibilitychange', vis);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(inputTimer);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('pointerdown', pd);
      canvas.removeEventListener('pointermove', pm);
      canvas.removeEventListener('pointerup', pu);
      canvas.removeEventListener('pointercancel', pu);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      ro.disconnect();
      document.removeEventListener('visibilitychange', vis);
      sessionRef.current?.leave();
      gameRef.current = null;
    };
  }, []);

  // refs the render/input loop reads without re-subscribing
  const guestKeys = useRef({ set: new Set<string>(), dash: false, touch: false, tOx: 0, tOy: 0, tX: 0, tY: 0 });
  const guestPhaseRef = useRef<'lobby' | 'playing' | 'over'>('lobby');
  guestPhaseRef.current = guestPhase;

  /* ---------------- solo actions ---------------- */
  const play = useCallback(() => {
    sfx.resume();
    sfx.select();
    setHighlight(-1);
    setRole('solo');
    const g = gameRef.current;
    if (g) { g.clearCoop(); g.applyMeta(buildStartConfig(metaRef.current)); g.reset(); }
  }, []);

  const updateMeta = useCallback((m: Meta) => {
    saveMeta(m); setMeta(m);
    const g = gameRef.current;
    if (g) { g.applyMeta(buildStartConfig(m)); g.push(); }
  }, []);

  const changeLang = useCallback((l: Lang) => {
    saveLang(l); setLang(l);
    try { document.documentElement.lang = l; } catch { /* ignore */ }
    const g = gameRef.current;
    if (g) { g.lang = l; g.push(); }
    sfx.select();
  }, []);

  const openShop = useCallback(() => { sfx.resume(); sfx.select(); setShopOpen(true); }, []);
  const closeShop = useCallback(() => { setShopOpen(false); }, []);
  const openGuide = useCallback(() => { gameRef.current?.keys.clear(); sfx.select(); setGuideOpen(true); }, []);
  const closeGuide = useCallback(() => setGuideOpen(false), []);

  const resume = useCallback(() => { sfx.select(); gameRef.current?.resume(); }, []);
  const pause = useCallback(() => { sfx.select(); if (!gameRef.current?.coop) gameRef.current?.pause(); }, []);
  const quit = useCallback(() => {
    sfx.select();
    const g = gameRef.current;
    sessionRef.current?.leave();
    setRole('solo');
    if (g) { g.clearCoop(); g.phase = 'menu'; g.push(); }
  }, []);

  const pick = useCallback((k: string) => {
    if (roleRef.current === 'guest') { sessionRef.current?.guestPick(k); setGuestLevelUp(null); return; }
    gameRef.current?.pick(k);
  }, []);
  const reroll = useCallback(() => {
    if (roleRef.current === 'guest') { sessionRef.current?.guestReroll(); return; }
    gameRef.current?.reroll();
  }, []);
  const dash = useCallback(() => {
    if (roleRef.current === 'guest') { guestKeys.current.dash = true; return; }
    gameRef.current?.tryDash();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => { saveMuted(!m); sfx.setMuted(!m); return !m; });
  }, []);

  /* ---------------- multiplayer wiring ---------------- */
  const ensureSession = useCallback(() => {
    if (sessionRef.current) return sessionRef.current;
    const s = new Session({
      meta: () => metaRef.current,
      game: () => gameRef.current,
      view: () => viewRef.current,
      cb: {
        onChange: () => setMpTick((v) => v + 1),
        onStart: (players) => {
          const g = gameRef.current;
          if (!g) return;
          g.playerName = mpNameRef.current || 'YOU';
          g.applyMeta(buildStartConfig(metaRef.current));
          g.setupCoop(players);
          g.reset();
          setRole('host');
          setMpScreen('none');
          setCountdown(null);
        },
        onSnapshot: (snap) => {
          setGuestPhase('playing');
          if (viewRef.current) viewRef.current.mySlot = sessionRef.current?.mySlot ?? 0;
          setGuestSnap(snap);
        },
        onGuestLevelUp: (name, choices, rerolls) => { sfx.levelUp(); setGuestLevelUp({ name, choices, rerolls }); },
        onGuestLevelUpEnd: () => setGuestLevelUp(null),
        onGuestGameOver: () => setGuestPhase('over'),
        onToMenu: () => {
          setRole('solo'); setMpScreen('none'); setCountdown(null);
          setGuestSnap(null); setGuestLevelUp(null); setGuestPhase('lobby');
          const g = gameRef.current;
          if (g) { g.clearCoop(); g.phase = 'menu'; g.push(); }
        },
      },
    });
    sessionRef.current = s;
    return s;
  }, []);

  const mpNameRef = useRef(mpName); mpNameRef.current = mpName;

  const openCoop = useCallback(() => { sfx.resume(); sfx.select(); setMpScreen('entry'); }, []);
  const setName = useCallback((n: string) => {
    setMpName(n);
    try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ }
  }, []);
  const hostLobby = useCallback(() => {
    sfx.select();
    const s = ensureSession();
    s.createLobby(mpNameRef.current);
    setRole('host');
    setMpScreen('hostLobby');
  }, [ensureSession]);
  const joinLobby = useCallback(() => {
    sfx.select();
    const s = ensureSession();
    s.myName = mpNameRef.current;
    setRole('guest');
    setGuestPhase('lobby');
    setMpScreen('guestJoin');
  }, [ensureSession]);
  const leaveMp = useCallback(() => {
    sfx.select();
    sessionRef.current?.leave();
    sessionRef.current = null;
    setRole('solo'); setMpScreen('none'); setCountdown(null);
    setGuestSnap(null); setGuestLevelUp(null); setGuestPhase('lobby');
  }, []);

  // reflect session countdown into UI
  const session = sessionRef.current;
  useEffect(() => {
    if (!session) return;
    if (session.phase === 'countdown') setCountdown(session.countdown);
    else setCountdown(null);
    // host: when the run started, drop the lobby screen
    if (session.phase === 'playing' && role === 'host') setMpScreen('none');
  }, [mpTick, session, role]);

  const inGame = st.phase !== 'menu' || role === 'guest';
  const coopLevelupOther = st.coop && st.phase === 'levelup' && !st.levelupIsLocal;

  /* ---------------- render ---------------- */
  const guestActive = role === 'guest' && guestPhase !== 'lobby';

  return (
    <SessionProvider value={sessionRef.current}>
      <div className="relative h-full w-full overflow-hidden bg-[#05070f]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* top-right controls */}
        {(inGame && st.phase !== 'dead') && (
          <div className="absolute right-3 top-3 z-20 flex gap-2">
            <button onClick={toggleMute} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-black/45 text-sm text-slate-300 backdrop-blur-sm active:scale-95" aria-label="Mute">
              {muted ? '🔇' : '🔊'}
            </button>
            {role === 'solo' && (
              <button onClick={pause} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-black/45 text-sm text-slate-300 backdrop-blur-sm active:scale-95" aria-label="Pause">❚❚</button>
            )}
            {role !== 'solo' && (
              <button onClick={quit} className="flex h-9 items-center justify-center rounded-xl border border-white/12 bg-black/45 px-2.5 text-[11px] font-bold text-slate-300 backdrop-blur-sm active:scale-95">✕</button>
            )}
          </div>
        )}

        {!inGame && (
          <button onClick={toggleMute} className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-black/45 text-sm text-slate-300 backdrop-blur-sm active:scale-95" aria-label="Mute">
            {muted ? '🔇' : '🔊'}
          </button>
        )}

        {/* co-op HUD: mate roster */}
        {st.coop && role === 'host' && st.mates.length > 1 && st.phase !== 'dead' && (
          <div className="absolute left-1/2 top-16 z-10 flex -translate-x-1/2 gap-2">
            {st.mates.map((m) => (
              <div key={m.slot} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 backdrop-blur-sm ${m.alive ? 'border-white/15 bg-black/40' : 'border-rose-500/40 bg-rose-950/40 opacity-70'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color, boxShadow: m.immortal ? '0 0 8px #ffe066' : undefined }} />
                <span className="text-[10px] font-bold" style={{ color: m.alive ? m.color : '#f87171' }}>{m.name}{m.local ? '' : ''}</span>
                <span className="text-[9px] text-slate-400">L{m.level}{m.alive ? '' : ' ☠'}</span>
              </div>
            ))}
          </div>
        )}

        {/* dash button when playing */}
        {((role !== 'guest' && st.phase === 'playing') || (role === 'guest' && guestPhase === 'playing')) && (
          <DashButton onPress={dash} ringRef={dashRing} fillRef={dashFill} />
        )}

        {/* ---- solo/host menu ---- */}
        {role === 'solo' && st.phase === 'menu' && mpScreen === 'none' && !shopOpen && !guideOpen && (
          <StartScreen lang={lang} best={getBestCache()} scores={scores} coins={meta.coins}
            onPlay={play} onShop={openShop} onLang={changeLang} onGuide={openGuide} onCoop={openCoop} />
        )}
        {st.phase === 'menu' && shopOpen && (
          <ShopModal lang={lang} meta={meta} onChange={updateMeta} onClose={closeShop} onLang={changeLang} />
        )}

        {/* ---- multiplayer lobby screens ---- */}
        {mpScreen === 'entry' && (
          <MultiplayerEntry lang={lang} name={mpName} onName={setName} onHost={hostLobby} onJoin={joinLobby} onBack={() => setMpScreen('none')} />
        )}
        {mpScreen === 'hostLobby' && sessionRef.current && (
          <HostLobby lang={lang} session={sessionRef.current} tick={mpTick} onLeave={leaveMp} />
        )}
        {mpScreen === 'guestJoin' && sessionRef.current && (
          <GuestJoin lang={lang} session={sessionRef.current} tick={mpTick} onLeave={leaveMp} />
        )}

        {/* ---- countdown ---- */}
        {countdown !== null && <Countdown lang={lang} value={countdown} />}

        {/* ---- level up (host / solo) ---- */}
        {role !== 'guest' && st.phase === 'levelup' && st.levelupIsLocal && (
          <LevelUpScreen lang={lang} st={st} onPick={pick} onReroll={reroll} />
        )}
        {role !== 'guest' && coopLevelupOther && <CoopWaitOverlay lang={lang} name={st.levelupName} />}

        {/* ---- level up (guest) ---- */}
        {role === 'guest' && guestLevelUp && (
          <GuestLevelUp lang={lang} data={guestLevelUp} onPick={pick} onReroll={reroll} />
        )}
        {role === 'guest' && !guestLevelUp && guestActive && (
          <GuestWaitingBanner lang={lang} />
        )}

        {/* ---- pause / game over ---- */}
        {role === 'solo' && st.phase === 'paused' && !guideOpen && (
          <PauseScreen lang={lang} st={st} onResume={resume} onRestart={play} onQuit={quit} onGuide={openGuide} />
        )}
        {guideOpen && <FieldGuide lang={lang} onClose={closeGuide} />}
        {role !== 'guest' && st.phase === 'dead' && (
          <GameOverScreen lang={lang} st={st} scores={scores} onRestart={role === 'host' ? quit : play} onQuit={quit} highlight={highlight} />
        )}
        {role === 'guest' && guestPhase === 'over' && (
          <GuestGameOver lang={lang} onQuit={quit} snap={guestSnap} />
        )}
      </div>
    </SessionProvider>
  );
}

/* ---- guest level-up: a picker rendered purely from NetChoices ---- */
function GuestLevelUp({ lang, data, onPick, onReroll }: {
  lang: Lang; data: { name: string; choices: NetChoice[]; rerolls: number }; onPick: (k: string) => void; onReroll: () => void;
}) {
  const RAR = ['border-slate-500/50', 'border-cyan-400/50', 'border-violet-400/60', 'border-amber-400/70'];
  const RTX = ['text-slate-200', 'text-cyan-300', 'text-violet-300', 'text-amber-300'];
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-y-auto bg-[#04070f]/85 px-3 py-4 backdrop-blur-[3px]">
      <div className="anim-slam text-center">
        <div className="font-display text-[10px] tracking-[0.5em] text-cyan-300/70">{data.name} · {t(lang, 'evolve')}</div>
        <h2 className="font-display title-shine text-3xl font-black sm:text-4xl">{t(lang, 'evolve')}</h2>
      </div>
      <div className="mt-4 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {data.choices.map((c, i) => {
          const def = UPGRADES.find((u) => u.id === c.key.split(':')[0]);
          const nm = localizedUpg(lang, c.key, c.name, def?.name);
          const ds = localizedUpg(lang, c.key, c.desc, def?.desc, true);
          return (
            <button key={c.key} onClick={() => onPick(c.key)} style={{ animationDelay: `${i * 60}ms` }}
              className={`anim-card group relative flex flex-col overflow-hidden rounded-2xl border ${RAR[c.rarity]} bg-gradient-to-b from-white/10 to-black/60 p-4 text-left shadow-lg transition active:scale-[0.97] hover:brightness-125`}>
              <div className="flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${RAR[c.rarity]} bg-black/40 text-2xl`}>{c.icon}</div>
                <div className={`font-display text-[9px] tracking-[0.2em] ${RTX[c.rarity]}`}>{t(lang, 'rarity_' + c.rarity)}</div>
              </div>
              <h3 className="mt-2.5 font-display text-lg font-bold leading-tight text-white">{nm}</h3>
              <p className="mt-1 flex-1 text-[13px] leading-snug text-slate-300/90">{ds}</p>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-slate-500">
                <span>{t(lang, 'lv')} {c.level}/{c.max}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-300">[{i + 1}]</span>
              </div>
            </button>
          );
        })}
      </div>
      <button onClick={onReroll} disabled={data.rerolls <= 0}
        className="mt-4 flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/15 px-5 py-2 text-xs font-bold tracking-widest text-violet-200 disabled:opacity-40">
        {t(lang, 'reroll')} ({data.rerolls})
      </button>
    </div>
  );
}

function GuestWaitingBanner({ lang }: { lang: Lang }) {
  void lang;
  return null;
}

function GuestGameOver({ lang, onQuit, snap }: { lang: Lang; onQuit: () => void; snap: Snapshot | null }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0410]/85 px-4 backdrop-blur-[3px]">
      <div className="glass anim-in w-full max-w-sm rounded-3xl border border-rose-500/30 p-6 text-center">
        <div className="font-display text-[10px] tracking-[0.45em] text-rose-300/70">{t(lang, 'runTerminated')}</div>
        <h2 className="font-display anim-slam mt-1 text-3xl font-black text-rose-400">{t(lang, 'shattered')}</h2>
        {snap && <div className="mt-4 font-display text-4xl font-black text-white">{snap.score.toLocaleString()}</div>}
        <div className="text-[10px] tracking-[0.3em] text-slate-500">{t(lang, 'finalScore')}</div>
        <button onClick={onQuit} className="mt-6 w-full rounded-xl border border-cyan-300/50 bg-cyan-400/15 py-3 font-display font-bold tracking-widest text-cyan-100 active:scale-[0.98]">
          {t(lang, 'mainMenu')}
        </button>
      </div>
    </div>
  );
}

/* guest choices carry English text; localize via the upgrade table when RU */
import { upgName, upgDesc } from './i18n';
function localizedUpg(lang: Lang, key: string, fallbackName: string, defName?: string, desc = false): string {
  const id = key.split(':')[0];
  if (lang !== 'ru') return desc ? fallbackName : (defName || fallbackName);
  return desc ? upgDesc(lang, id, fallbackName) : upgName(lang, id, defName || fallbackName);
}
