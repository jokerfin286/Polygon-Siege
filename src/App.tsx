import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type PublicState, setBestCache, getBestCache } from './game/engine';
import { render } from './game/render';
import { sfx } from './game/sfx';
import { loadScores, loadMuted, saveMuted, loadBest, type ScoreRow } from './game/storage';
import { loadMeta, saveMeta, buildStartConfig, type Meta } from './game/meta';
import { StartScreen, LevelUpScreen, PauseScreen, GameOverScreen, DashButton } from './ui/Screens';
import { ShopModal } from './ui/Shop';
import { FieldGuide } from './ui/FieldGuide';
import { LobbyScreen, PartnerPicker } from './ui/Lobby';
import { Session, makeCode, PEER_COLORS, MAX_PLAYERS, type RosterEntry } from './net/net';
import { loadLang, saveLang, t, type Lang } from './i18n';

const INITIAL: PublicState = {
  phase: 'menu', score: 0, best: 0, level: 1, kills: 0, time: 0, hp: 100, maxHp: 100,
  shapeId: 'circle', weapons: ['disc'], choices: [], rerolls: 0, wave: 1, combo: 0, owned: {}, paused: false, coinsEarned: 0,
  coop: false, isHost: true, netKind: 'solo', picker: null, partnerScore: 0,
  selfId: 'local', countdown: 0, chooserId: '', chooserName: '', xp: 0, xpNeed: 8, peers: [],
};

const NICK_KEY = 'polygon-siege-nick-v1';
const loadNick = (): string => {
  try {
    return (localStorage.getItem(NICK_KEY) || '').slice(0, 14) || 'PLAYER';
  } catch {
    return 'PLAYER';
  }
};
const saveNick = (value: string) => {
  try { localStorage.setItem(NICK_KEY, value.slice(0, 14)); } catch { /* ignore */ }
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
  const [guideOpen, setGuideOpen] = useState(false);
  const overlayRef = useRef(false);
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const metaRef = useRef<Meta>(meta);
  metaRef.current = meta;

  /* ---------------- cooperative multiplayer ---------------- */
  const [nickname, setNickname] = useState<string>(loadNick);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [lobbyStep, setLobbyStep] = useState<'entry' | 'inside'>('entry');
  const [code, setCode] = useState('');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [lobbyError, setLobbyError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [transport, setTransport] = useState<'net' | 'local'>('net');
  const [ping, setPing] = useState(0);
  const pingRef = useRef(0);

  const sessRef = useRef<Session | null>(null);
  const rosterRef = useRef<RosterEntry[]>([]);
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;
  const startedRef = useRef(false);
  const pendingStart = useRef(false);

  const applyRoster = useCallback((list: RosterEntry[]) => {
    rosterRef.current = list;
    setRoster(list);
  }, []);

  const detachNet = useCallback(() => {
    const g = gameRef.current;
    if (g) { g.onNet = null; if (g.coop) g.endCoop(); }
  }, []);

  const leaveSession = useCallback(() => {
    try { sessRef.current?.close(); } catch { /* ignore */ }
    sessRef.current = null;
    startedRef.current = false;
    pendingStart.current = false;
    applyRoster([]);
    detachNet();
    setLobbyOpen(false);
    setLobbyStep('entry');
    setCode('');
    setLobbyError('');
    setConnecting(false);
  }, [applyRoster, detachNet]);

  /** Both sides enter the match; only the host keeps world authority. */
  const beginMatch = useCallback((isHost: boolean, selfId: string) => {
    const g = gameRef.current;
    const sess = sessRef.current;
    if (!g || !sess) { pendingStart.current = true; return; }
    const me = rosterRef.current.find((r) => r.id === selfId);
    g.attachNet(sess.kind, (type, payload) => {
      try { sess.send(type, payload); } catch { /* transport gone */ }
    });
    g.beginCoop({
      selfId: selfId || sess.selfId,
      selfName: (me?.name || nicknameRef.current || 'PLAYER').slice(0, 14),
      selfColor: me?.color || PEER_COLORS[isHost ? 0 : 1],
      isHost,
    });
    if (isHost) {
      g.syncPeers(rosterRef.current
        .filter((r) => !r.host)
        .map((r) => ({ id: r.id, name: r.name, color: r.color })));
      g.startCountdown(3);
    }
    setLobbyOpen(false);
    setLobbyStep('entry');
    sfx.resume();
    sfx.levelUp();
  }, []);

  /** Host: once every partner is ready the countdown starts by itself. */
  const hostStart = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    try { sessRef.current?.startRun(); } catch { /* ignore */ }
    beginMatch(true, sessRef.current?.selfId || '');
    window.setTimeout(() => { startedRef.current = false; }, 1500);
  }, [beginMatch]);

  const watchRoster = useCallback((list: RosterEntry[]) => {
    applyRoster(list);
    const sess = sessRef.current;
    if (!sess?.isHost) return;
    const partners = list.filter((r) => !r.host);
    if (partners.length > 0 && list.every((r) => r.ready)) hostStart();
  }, [applyRoster, hostStart]);

  const openSession = useCallback(async (role: 'host' | 'guest', value: string) => {
    try { sessRef.current?.close(); } catch { /* ignore */ }
    sessRef.current = null;
    applyRoster([]);
    setLobbyError('');
    setConnecting(true);
    startedRef.current = false;
    pendingStart.current = false;
    const nick = (nicknameRef.current || 'PLAYER').trim().slice(0, 14) || 'PLAYER';
    try {
      const sess = await Session.connect(role, value, nick, {
        onRoster: watchRoster,
        onStart: () => {
          if (sessRef.current?.isHost) return;
          beginMatch(false, sessRef.current?.selfId || '');
        },
        onEnd: () => {
          setLobbyError('lost');
          leaveSession();
        },
        onStatus: (state, message) => {
          if (state === 'connecting') return;
          if (state === 'live') { setConnecting(false); return; }
          setConnecting(false);
          if (message) setLobbyError(message);
        },
        onPing: (ms) => { pingRef.current = ms; setPing(ms); },
        onData: (type, payload, from) => {
          try { gameRef.current?.applyMessage(type, payload, from); } catch { /* ignore */ }
        },
      });
      sessRef.current = sess;
      setTransport(sess.kind);
      setConnecting(false);
      if (pendingStart.current) { pendingStart.current = false; beginMatch(false, sess.selfId); }
      setLobbyStep('inside');
    } catch (err) {
      setConnecting(false);
      setLobbyStep('entry');
      setLobbyError(err instanceof Error ? err.message : 'Could not reach that lobby');
    }
  }, [applyRoster, beginMatch, leaveSession, watchRoster]);

  const createLobby = useCallback(() => {
    const fresh = makeCode();
    setCode(fresh);
    void openSession('host', fresh);
  }, [openSession]);

  const joinLobby = useCallback((value: string) => {
    const clean = value.trim().toUpperCase();
    if (clean.length < 4) { setLobbyError('short'); return; }
    setCode(clean);
    void openSession('guest', clean);
  }, [openSession]);

  const toggleReady = useCallback(() => {
    const sess = sessRef.current;
    if (!sess) return;
    const me = rosterRef.current.find((r) => r.id === sess.selfId);
    sess.setReady(!me?.ready);
    if (sess.isHost) watchRoster(rosterRef.current);
    sfx.select();
  }, [watchRoster]);

  const setNick = useCallback((value: string) => {
    const clean = value.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 14);
    setNickname(clean);
    saveNick(clean);
    nicknameRef.current = clean;
  }, []);

  const openLobby = useCallback(() => {
    sfx.resume();
    sfx.select();
    setLobbyError('');
    setLobbyStep('entry');
    setLobbyOpen(true);
  }, []);

  overlayRef.current = shopOpen || guideOpen || lobbyOpen;

  /* clean the wire up when the app unmounts */
  useEffect(() => () => {
    try { sessRef.current?.close(); } catch { /* ignore */ }
  }, []);

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
        } else if (s.phase === 'menu') {
          setScores(loadScores());
        }
      }
      setSt(s);
    });
    gameRef.current = g;
    g.onSpendReroll = () => {
      setMeta((prev) => {
        const nm = { ...prev, rerollStock: Math.max(0, (prev.rerollStock || 0) - 1) };
        saveMeta(nm);
        return nm;
      });
    };
    g.lang = loadLang();
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
      if (overlayRef.current) return;
      const physical: Record<string, string> = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyP: 'p', KeyM: 'm' };
      const k = physical[e.code] || e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (k === 'escape' || k === 'p') { if (!e.repeat) g.togglePause(); return; }
      if (k === 'm') { if (!e.repeat) setMuted((m) => { saveMuted(!m); sfx.setMuted(!m); return !m; }); return; }
      if (k === ' ') { g.tryDash(); return; }
      if (k === 'shift') { g.tryDash(); return; }
      g.keys.add(k);
    };
    const ku = (e: KeyboardEvent) => {
      const physical: Record<string, string> = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' };
      g.keys.delete(physical[e.code] || e.key.toLowerCase());
    };
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
    // starting from the menu is always a fresh solo run
    leaveSession();
    const g = gameRef.current;
    if (g) {
      if (g.coop) g.endCoop();
      g.applyMeta(buildStartConfig(metaRef.current));
      g.reset();
    }
  }, [leaveSession]);

  const updateMeta = useCallback((m: Meta) => {
    saveMeta(m);
    setMeta(m);
    // live-apply cosmetics so the menu reflects the choice immediately
    const g = gameRef.current;
    if (g) { g.applyMeta(buildStartConfig(m)); g.push(); }
  }, []);

  const changeLang = useCallback((l: Lang) => {
    saveLang(l);
    setLang(l);
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
  const pause = useCallback(() => { sfx.select(); gameRef.current?.pause(); }, []);
  const quit = useCallback(() => {
    sfx.select();
    const g = gameRef.current;
    leaveSession();
    if (g) {
      if (g.coop) g.endCoop();
      g.phase = 'menu';
      g.push();
    }
    setLobbyOpen(false);
    setLobbyStep('entry');
  }, [leaveSession]);

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

      {st.coop && st.peers.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-[72px] z-10 flex -translate-x-1/2 flex-wrap justify-center gap-2">
          {st.peers.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-xl border bg-black/50 px-2.5 py-1.5 backdrop-blur-sm"
              style={{ borderColor: `${p.color}55` }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.alive ? p.color : '#64748b' }} />
              <span className="font-display text-[11px] font-bold" style={{ color: p.color }}>{p.name}</span>
              {ping > 0 && (
                <span className={`tnum text-[9.5px] font-bold ${ping < 90 ? 'text-emerald-300/80' : ping < 220 ? 'text-amber-300/80' : 'text-rose-300/80'}`}>{ping}ms</span>
              )}
              <span className="tnum text-[10.5px] text-white/70">Lv{p.level}</span>
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full transition-[width] duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100))}%`, background: p.color }} />
              </span>
              <span className="tnum text-[10.5px] text-white/55">{p.score.toLocaleString()}</span>
              {!p.alive && <span className="text-[9.5px] font-bold tracking-wider text-rose-300">{t(lang, 'spectating')}</span>}
            </div>
          ))}
        </div>
      )}

      {st.phase === 'menu' && !shopOpen && !guideOpen && !lobbyOpen && (
        <StartScreen lang={lang} best={getBestCache()} scores={scores} coins={meta.coins} onPlay={play} onShop={openShop} onLang={changeLang} onGuide={openGuide} onMultiplayer={openLobby} />
      )}
      {lobbyOpen && (
        <LobbyScreen
          lang={lang}
          step={lobbyStep}
          nickname={nickname}
          code={code}
          roster={roster}
          selfId={sessRef.current?.selfId || ''}
          isHost={Boolean(sessRef.current?.isHost)}
          maxPlayers={MAX_PLAYERS}
          transport={transport}
          ping={ping}
          connecting={connecting}
          error={lobbyError}
          onNickname={setNick}
          onCreate={createLobby}
          onConnect={joinLobby}
          onReady={toggleReady}
          onStart={hostStart}
          onLeave={leaveSession}
        />
      )}
      {st.phase === 'menu' && shopOpen && (
        <ShopModal lang={lang} meta={meta} onChange={updateMeta} onClose={closeShop} onLang={changeLang} />
      )}
      {st.phase === 'levelup' && st.coop && st.picker && st.chooserId !== st.selfId && (
        <PartnerPicker lang={lang} picker={st.picker} />
      )}
      {st.phase === 'levelup' && !(st.coop && st.chooserId && st.chooserId !== st.selfId) && (
        <LevelUpScreen lang={lang} st={st} onPick={pick} onReroll={reroll} />
      )}
      {st.phase === 'paused' && !guideOpen && <PauseScreen lang={lang} st={st} onResume={resume} onRestart={play} onQuit={quit} onGuide={openGuide} />}
      {guideOpen && <FieldGuide lang={lang} onClose={closeGuide} />}
      {st.phase === 'dead' && (
        <GameOverScreen lang={lang} st={st} scores={scores} onRestart={play} onQuit={quit} highlight={highlight} />
      )}
    </div>
  );
}
