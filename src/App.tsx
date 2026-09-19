import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type PublicState, setBestCache, getBestCache } from './game/engine';
import { render } from './game/render';
import { sfx } from './game/sfx';
import { loadScores, loadMuted, saveMuted, loadBest, type ScoreRow } from './game/storage';
import { loadMeta, saveMeta, buildStartConfig, type Meta } from './game/meta';
import { StartScreen, LevelUpScreen, PauseScreen, GameOverScreen, DashButton } from './ui/Screens';
import { ShopModal } from './ui/Shop';
import { FieldGuide } from './ui/FieldGuide';
import { LobbyScreen, PartnerChoosingOverlay, type LobbyStep } from './ui/Lobby';
import { Bus, LOBBY_TOPIC, runTopic, makeCode, PEER_COLORS, type PeerInfo } from './net/net';
import { loadLang, saveLang, t, type Lang } from './i18n';

const INITIAL: PublicState = {
  phase: 'menu', score: 0, best: 0, level: 1, kills: 0, time: 0, hp: 100, maxHp: 100,
  shapeId: 'circle', weapons: ['disc'], choices: [], rerolls: 0, wave: 1, combo: 0, owned: {}, paused: false, coinsEarned: 0,
  coop: false, isGuest: false, selfId: 'local', countdown: 0,
  chooserId: '', chooserName: '', xp: 0, xpNeed: 8, peers: [],
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
  const [lobbyStep, setLobbyStep] = useState<LobbyStep>('entry');
  const [lobbyCode, setLobbyCode] = useState('');
  const [lobbyPeers, setLobbyPeers] = useState<PeerInfo[]>([]);
  const [lobbyError, setLobbyError] = useState('');
  const [lobbyBusy, setLobbyBusy] = useState(false);

  const selfNetId = useRef('');
  const lobbyBus = useRef<Bus | null>(null);
  const runBus = useRef<Bus | null>(null);
  const hostFlag = useRef(false);
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;
  const codeRef = useRef('');
  const peersRef = useRef<PeerInfo[]>([]);
  const advertiseTimer = useRef<number | null>(null);
  const inputTimer = useRef<number | null>(null);

  const publishPeers = useCallback((next: PeerInfo[]) => {
    peersRef.current = next;
    setLobbyPeers(next);
  }, []);

  const stopNet = useCallback(() => {
    if (advertiseTimer.current) { window.clearInterval(advertiseTimer.current); advertiseTimer.current = null; }
    if (inputTimer.current) { window.clearInterval(inputTimer.current); inputTimer.current = null; }
    runBus.current?.close();
    lobbyBus.current?.close();
    runBus.current = null;
    lobbyBus.current = null;
    hostFlag.current = false;
    codeRef.current = '';
    publishPeers([]);
  }, [publishPeers]);

  const leaveLobby = useCallback(() => {
    if (lobbyBus.current && codeRef.current) {
      lobbyBus.current.send('bye', { code: codeRef.current, id: selfNetId.current });
    }
    gameRef.current?.endCoop();
    stopNet();
    setLobbyCode('');
    setLobbyStep('entry');
    setLobbyError('');
    setLobbyOpen(false);
  }, [stopNet]);

  /** Wire the per-run channel used for snapshots, movement and picks. */
  const openRunChannel = useCallback((code: string, asHost: boolean) => {
    runBus.current?.close();
    const bus = new Bus(runTopic(code));
    runBus.current = bus;

    if (asHost) {
      bus.on((msg) => {
        const g = gameRef.current;
        if (!g) return;
        if (msg.type === 'input') {
          const peer = g.peers.find((p) => p.id === msg.who);
          if (peer && typeof msg.x === 'number' && typeof msg.y === 'number') {
            peer.tx = msg.x;
            peer.ty = msg.y;
            peer.lastSeen = g.elapsed;
          }
        } else if (msg.type === 'pick' && typeof msg.key === 'string') {
          g.pick(msg.key);
        }
      });
      const g = gameRef.current;
      if (g) {
        g.onSnapshot = (snap) => bus.send('snap', { snap });
      }
    } else {
      bus.on((msg) => {
        const g = gameRef.current;
        if (!g || msg.type !== 'snap') return;
        g.applySnapshot(msg.snap as never);
      });
      inputTimer.current = window.setInterval(() => {
        const g = gameRef.current;
        if (!g || !runBus.current) return;
        runBus.current.send('input', {
          who: selfNetId.current,
          x: Math.round(g.px),
          y: Math.round(g.py),
        });
      }, 110);
    }
  }, []);

  const startAsHost = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.beginCoop({
      selfId: selfNetId.current,
      selfName: nicknameRef.current,
      selfColor: PEER_COLORS[0],
      isGuest: false,
    });
    // beginCoop resets the peer list, so the roster is applied afterwards
    const roster = peersRef.current.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    g.syncPeers(roster);
    openRunChannel(codeRef.current, true);
    lobbyBus.current?.send('start', { code: codeRef.current });
    if (advertiseTimer.current) { window.clearInterval(advertiseTimer.current); advertiseTimer.current = null; }
    setLobbyOpen(false);
    setLobbyStep('entry');
    g.startCountdown(3);
    sfx.resume();
    sfx.levelUp();
  }, [openRunChannel]);

  /** Once everyone in the lobby is ready, the 3-2-1 gate starts itself. */
  const startedRef = useRef(false);
  const startRef = useRef<() => void>(() => {});
  startRef.current = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    startAsHost();
    window.setTimeout(() => { startedRef.current = false; }, 1200);
  };

  const maybeAutoStart = useCallback(() => {
    const list = peersRef.current;
    if (list.length > 1 && list.every((p) => p.ready)) {
      window.setTimeout(() => startRef.current(), 320);
    }
  }, []);

  const createLobby = useCallback(() => {
    if (typeof BroadcastChannel === 'undefined') {
      setLobbyError(t(lang, 'invalidCode'));
      return;
    }
    stopNet();
    setLobbyBusy(true);
    setLobbyError('');
    const code = makeCode();
    const bus = new Bus(LOBBY_TOPIC);
    lobbyBus.current = bus;
    selfNetId.current = bus.id;
    hostFlag.current = true;
    codeRef.current = code;
    setLobbyCode(code);

    const me: PeerInfo = {
      id: bus.id, name: nicknameRef.current || 'PLAYER',
      ready: false, host: true, color: PEER_COLORS[0], shape: 'circle',
    };
    publishPeers([me]);

    bus.on((msg) => {
      if (msg.type === 'join' && msg.code === codeRef.current) {
        const list = peersRef.current;
        if (list.length >= 4) {
          bus.send('full', { to: msg.from, code: codeRef.current });
          return;
        }
        if (list.some((p) => p.id === msg.from)) return;
        const peer: PeerInfo = {
          id: String(msg.from),
          name: String(msg.name || 'PLAYER').slice(0, 14),
          ready: false,
          host: false,
          color: PEER_COLORS[list.length % PEER_COLORS.length],
          shape: 'circle',
        };
        const next = [...list, peer];
        publishPeers(next);
        bus.send('joined', {
          to: msg.from,
          code: codeRef.current,
          peers: next,
          you: peer,
        });
        bus.send('roster', { code: codeRef.current, peers: next });
      } else if (msg.type === 'ready' && msg.code === codeRef.current) {
        const next = peersRef.current.map((p) => (p.id === msg.from ? { ...p, ready: Boolean(msg.ready) } : p));
        publishPeers(next);
        bus.send('roster', { code: codeRef.current, peers: next });
        maybeAutoStart();
      } else if (msg.type === 'bye' && msg.code === codeRef.current) {
        const next = peersRef.current.filter((p) => p.id !== msg.from);
        publishPeers(next);
        bus.send('roster', { code: codeRef.current, peers: next });
      }
    });

    advertiseTimer.current = window.setInterval(() => {
      bus.send('advertise', {
        code: codeRef.current,
        hostName: nicknameRef.current,
        count: peersRef.current.length,
        max: 4,
      });
    }, 1400);

    setLobbyStep('inside');
    setLobbyBusy(false);
  }, [lang, maybeAutoStart, publishPeers, stopNet]);

  const joinLobby = useCallback((rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (code.length < 3) { setLobbyError(t(lang, 'invalidCode')); return; }
    if (typeof BroadcastChannel === 'undefined') { setLobbyError(t(lang, 'invalidCode')); return; }

    stopNet();
    setLobbyBusy(true);
    setLobbyError('');
    setLobbyStep('joining');

    const bus = new Bus(LOBBY_TOPIC);
    lobbyBus.current = bus;
    selfNetId.current = bus.id;
    hostFlag.current = false;
    codeRef.current = code;
    setLobbyCode(code);

    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setLobbyBusy(false);
        setLobbyError(t(lang, 'invalidCode'));
        setLobbyStep('entry');
        stopNet();
      }
    }, 4500);

    bus.on((msg) => {
      if (msg.type === 'joined' && msg.to === bus.id) {
        settled = true;
        window.clearTimeout(timeout);
        publishPeers(Array.isArray(msg.peers) ? (msg.peers as PeerInfo[]) : []);
        setLobbyStep('inside');
        setLobbyBusy(false);
      } else if (msg.type === 'full' && msg.to === bus.id) {
        settled = true;
        window.clearTimeout(timeout);
        setLobbyBusy(false);
        setLobbyError(t(lang, 'lobbyFull'));
        setLobbyStep('entry');
      } else if (msg.type === 'roster' && msg.code === code) {
        publishPeers(Array.isArray(msg.peers) ? (msg.peers as PeerInfo[]) : []);
      } else if (msg.type === 'start' && msg.code === code) {
        settled = true;
        window.clearTimeout(timeout);
        const g = gameRef.current;
        if (!g) return;
        g.beginCoop({
          selfId: bus.id,
          selfName: nicknameRef.current,
          selfColor: PEER_COLORS[1 % PEER_COLORS.length],
          isGuest: true,
        });
        openRunChannel(code, false);
        setLobbyOpen(false);
        setLobbyStep('entry');
        sfx.resume();
        sfx.levelUp();
      } else if (msg.type === 'advertise' && msg.code === code && !settled) {
        // host is alive — nudge the join in case the first one was missed
        bus.send('join', { code, name: nicknameRef.current });
      }
    });

    bus.send('join', { code, name: nicknameRef.current });
  }, [lang, openRunChannel, publishPeers, stopNet]);

  const toggleReady = useCallback(() => {
    const bus = lobbyBus.current;
    if (!bus) return;
    const me = peersRef.current.find((p) => p.id === bus.id);
    const nextReady = !me?.ready;

    if (hostFlag.current) {
      const next = peersRef.current.map((p) => (p.id === bus.id ? { ...p, ready: nextReady } : p));
      publishPeers(next);
      bus.send('roster', { code: codeRef.current, peers: next });
    } else {
      publishPeers(peersRef.current.map((p) => (p.id === bus.id ? { ...p, ready: nextReady } : p)));
      bus.send('ready', { code: codeRef.current, ready: nextReady });
    }
    sfx.select();
  }, [publishPeers]);

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

  /* tear the network buses down when the app unmounts */
  useEffect(() => () => {
    runBus.current?.close();
    lobbyBus.current?.close();
  }, []);

  /* guest: forward upgrade choices to the host over the run channel */
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    g.onPickRequest = (key: string) => {
      runBus.current?.send('pick', { key, who: selfNetId.current });
    };
    return () => { g.onPickRequest = null; };
  }, [lobbyOpen]);

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
    if (lobbyBus.current && codeRef.current) {
      lobbyBus.current.send('bye', { code: codeRef.current, id: selfNetId.current });
    }
    stopNet();
    setLobbyOpen(false);
    setLobbyStep('entry');
    const g = gameRef.current;
    if (g) {
      if (g.coop) g.endCoop();
      g.applyMeta(buildStartConfig(metaRef.current));
      g.reset();
    }
  }, [stopNet]);

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
    if (lobbyBus.current && codeRef.current) {
      lobbyBus.current.send('bye', { code: codeRef.current, id: selfNetId.current });
    }
    if (g) {
      if (g.coop) g.endCoop();
      g.phase = 'menu';
      g.push();
    }
    stopNet();
    setLobbyOpen(false);
    setLobbyStep('entry');
  }, [stopNet]);

  const pick = useCallback((k: string) => {
    const g = gameRef.current;
    if (!g) return;
    if (g.coop && g.isGuest) g.requestPick(k);
    else g.pick(k);
  }, []);
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

      {st.phase === 'menu' && !shopOpen && !guideOpen && !lobbyOpen && (
        <StartScreen lang={lang} best={getBestCache()} scores={scores} coins={meta.coins} onPlay={play} onShop={openShop} onLang={changeLang} onGuide={openGuide} onMultiplayer={openLobby} />
      )}
      {lobbyOpen && (
        <LobbyScreen
          lang={lang}
          step={lobbyStep}
          nickname={nickname}
          code={lobbyCode}
          peers={lobbyPeers}
          selfId={selfNetId.current}
          maxPlayers={4}
          error={lobbyError}
          busy={lobbyBusy}
          onNickname={setNick}
          onCreate={createLobby}
          onConnect={joinLobby}
          onReady={toggleReady}
          onStart={startAsHost}
          onLeave={leaveLobby}
          onBack={leaveLobby}
        />
      )}
      {st.phase === 'menu' && shopOpen && (
        <ShopModal lang={lang} meta={meta} onChange={updateMeta} onClose={closeShop} onLang={changeLang} />
      )}
      {st.phase === 'levelup' && st.coop && st.chooserId && st.chooserId !== st.selfId && (
        <PartnerChoosingOverlay lang={lang} name={st.chooserName || '—'} />
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
