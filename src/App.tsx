import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type PublicState, setBestCache, getBestCache } from './game/engine';
import { render } from './game/render';
import { sfx } from './game/sfx';
import { loadScores, loadMuted, saveMuted, loadBest, type ScoreRow } from './game/storage';
import { loadMeta, saveMeta, buildStartConfig, type Meta } from './game/meta';
import { StartScreen, LevelUpScreen, PauseScreen, GameOverScreen, DashButton } from './ui/Screens';
import { ShopModal } from './ui/Shop';

const INITIAL: PublicState = {
  phase: 'menu', score: 0, best: 0, level: 1, kills: 0, time: 0, hp: 100, maxHp: 100,
  shapeId: 'circle', weapons: ['disc'], choices: [], rerolls: 0, wave: 1, combo: 0, owned: {}, paused: false, coinsEarned: 0,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const dashRing = useRef<SVGCircleElement | null>(null);
  const dashFill = useRef<HTMLDivElement | null>(null);
  const ptrId = useRef<number | null>(null);

  const [st, setSt] = useState<PublicState>(INITIAL);
  const [scores, setScores] = useState<ScoreRow[]>(() => loadScores());
  const [muted, setMuted] = useState<boolean>(() => loadMuted());
  const [highlight, setHighlight] = useState(-1);
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [shopOpen, setShopOpen] = useState(false);
  const metaRef = useRef<Meta>(meta);
  metaRef.current = meta;

  /* ---------------- boot: game + loop + input ---------------- */
  useEffect(() => {
    setBestCache(loadBest());
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
        } else if (s.phase === 'menu') {
          setScores(loadScores());
        }
      }
      setSt(s);
    });
    gameRef.current = g;
    g.applyMeta(buildStartConfig(metaRef.current));
    sfx.setMuted(loadMuted());

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      g.frame(dt);
      render(g, t / 1000);
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
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    /* ---- keyboard ---- */
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (k === 'escape' || k === 'p') { g.togglePause(); return; }
      if (k === 'm') { setMuted((m) => { saveMuted(!m); sfx.setMuted(!m); return !m; }); return; }
      if (k === ' ') { g.tryDash(); return; }
      if (k === 'shift') { g.tryDash(); return; }
      g.keys.add(k);
    };
    const ku = (e: KeyboardEvent) => { g.keys.delete(e.key.toLowerCase()); };
    const blur = () => { g.keys.clear(); g.touchActive = false; ptrId.current = null; };
    window.addEventListener('keydown', kd, { passive: false });
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);

    /* ---- pointer (touch joystick / mouse drag) ---- */
    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pd = (e: PointerEvent) => {
      if (g.phase !== 'playing') return;
      if (ptrId.current !== null) return;
      ptrId.current = e.pointerId;
      const p = local(e);
      g.touchActive = true; g.tOx = p.x; g.tOy = p.y; g.tX = p.x; g.tY = p.y;
      canvas.setPointerCapture(e.pointerId);
    };
    const pm = (e: PointerEvent) => {
      if (ptrId.current !== e.pointerId) return;
      const p = local(e);
      g.tX = p.x; g.tY = p.y;
    };
    const pu = (e: PointerEvent) => {
      if (ptrId.current !== e.pointerId) return;
      ptrId.current = null;
      g.touchActive = false;
    };
    canvas.addEventListener('pointerdown', pd);
    canvas.addEventListener('pointermove', pm);
    canvas.addEventListener('pointerup', pu);
    canvas.addEventListener('pointercancel', pu);

    /* ---- resize ---- */
    const onResize = () => g.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const vis = () => { if (document.hidden) g.pause(); };
    document.addEventListener('visibilitychange', vis);

    return () => {
      cancelAnimationFrame(raf);
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
      gameRef.current = null;
    };
  }, []);

  /* ---------------- actions ---------------- */
  const play = useCallback(() => {
    sfx.resume();
    sfx.select();
    setHighlight(-1);
    const g = gameRef.current;
    if (g) { g.applyMeta(buildStartConfig(metaRef.current)); g.reset(); }
  }, []);

  const updateMeta = useCallback((m: Meta) => {
    saveMeta(m);
    setMeta(m);
    // live-apply cosmetics so the menu reflects the choice immediately
    const g = gameRef.current;
    if (g) { g.applyMeta(buildStartConfig(m)); g.push(); }
  }, []);

  const openShop = useCallback(() => { sfx.resume(); sfx.select(); setShopOpen(true); }, []);
  const closeShop = useCallback(() => { setShopOpen(false); }, []);

  const resume = useCallback(() => { sfx.select(); gameRef.current?.resume(); }, []);
  const pause = useCallback(() => { sfx.select(); gameRef.current?.pause(); }, []);
  const quit = useCallback(() => {
    sfx.select();
    const g = gameRef.current;
    if (g) { g.phase = 'menu'; g.push(); }
  }, []);

  const pick = useCallback((k: string) => { gameRef.current?.pick(k); }, []);
  const reroll = useCallback(() => { gameRef.current?.reroll(); }, []);
  const dash = useCallback(() => { gameRef.current?.tryDash(); }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => { saveMuted(!m); sfx.setMuted(!m); return !m; });
  }, []);

  const inGame = st.phase !== 'menu';

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05070f]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* top-right controls */}
      {inGame && st.phase !== 'dead' && (
        <div className="absolute right-3 top-3 z-20 flex gap-2">
          <button
            onClick={toggleMute}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-black/45 text-sm text-slate-300 backdrop-blur-sm active:scale-95"
            aria-label="Mute"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={pause}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-black/45 text-sm text-slate-300 backdrop-blur-sm active:scale-95"
            aria-label="Pause"
          >
            ❚❚
          </button>
        </div>
      )}

      {!inGame && (
        <button
          onClick={toggleMute}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-black/45 text-sm text-slate-300 backdrop-blur-sm active:scale-95"
          aria-label="Mute"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}

      {st.phase === 'playing' && <DashButton onPress={dash} ringRef={dashRing} fillRef={dashFill} />}

      {st.phase === 'menu' && !shopOpen && (
        <StartScreen best={getBestCache()} scores={scores} coins={meta.coins} onPlay={play} onShop={openShop} />
      )}
      {st.phase === 'menu' && shopOpen && (
        <ShopModal meta={meta} onChange={updateMeta} onClose={closeShop} />
      )}
      {st.phase === 'levelup' && <LevelUpScreen st={st} onPick={pick} onReroll={reroll} />}
      {st.phase === 'paused' && <PauseScreen st={st} onResume={resume} onRestart={play} onQuit={quit} />}
      {st.phase === 'dead' && (
        <GameOverScreen st={st} scores={scores} onRestart={play} onQuit={quit} highlight={highlight} />
      )}
    </div>
  );
}
