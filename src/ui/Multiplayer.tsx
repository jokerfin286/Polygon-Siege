import { useEffect, useRef, useState } from 'react';
import { t, type Lang } from '../i18n';
import { sfx } from '../game/sfx';
import type { Session, LobbySlot } from '../net/session';
import type { LobbyPlayerNet } from '../net/net';

/* ---- code copy/paste field ---- */
function CodeField({ label, value, lang }: { label: string; value: string; lang: Lang }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
    setCopied(true); sfx.select();
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="mb-1.5 text-[10px] font-bold tracking-wider text-slate-400">{label}</div>
      <textarea
        readOnly value={value} onFocus={(e) => e.target.select()}
        className="scroll-thin h-16 w-full resize-none rounded-lg border border-white/10 bg-black/50 p-2 font-mono text-[10px] leading-tight text-cyan-200 outline-none"
      />
      <button onClick={copy} className="mt-1.5 w-full rounded-lg border border-cyan-300/40 bg-cyan-400/15 py-1.5 text-[11px] font-bold tracking-wider text-cyan-100 active:scale-95">
        {copied ? t(lang, 'mp_copied') : t(lang, 'mp_copy')}
      </button>
    </div>
  );
}

/* ---- entry: nickname + host/join choice ---- */
export function MultiplayerEntry({ lang, name, onName, onHost, onJoin, onBack }: {
  lang: Lang; name: string; onName: (n: string) => void;
  onHost: () => void; onJoin: () => void; onBack: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04070f]/92 px-4 backdrop-blur-md">
      <div className="glass anim-in w-full max-w-md rounded-3xl border border-cyan-400/25 p-6">
        <div className="text-center">
          <div className="font-display text-[10px] tracking-[0.4em] text-cyan-300/70">{t(lang, 'mp_online')}</div>
          <h2 className="font-display title-shine text-3xl font-black">{t(lang, 'mp_title')}</h2>
          <p className="mx-auto mt-2 max-w-xs text-xs text-slate-400">{t(lang, 'mp_p2pNote')}</p>
        </div>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-400">{t(lang, 'mp_nickname')}</span>
          <input
            value={name} maxLength={12} onChange={(e) => onName(e.target.value)}
            placeholder="AAA" autoFocus
            className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center font-display text-lg font-bold tracking-widest text-cyan-100 outline-none focus:border-cyan-300/60"
          />
        </label>
        <div className="mt-5 space-y-2">
          <button
            onClick={onHost} disabled={!name.trim()}
            className="w-full rounded-xl border border-cyan-300/50 bg-gradient-to-b from-cyan-400/25 to-cyan-600/10 py-3.5 font-display text-lg font-black tracking-widest text-cyan-100 transition active:scale-[0.98] disabled:opacity-40"
          >
            🛰 {t(lang, 'mp_newLobby')}
          </button>
          <button
            onClick={onJoin} disabled={!name.trim()}
            className="w-full rounded-xl border border-violet-300/50 bg-violet-500/15 py-3 font-display font-bold tracking-widest text-violet-100 transition active:scale-[0.98] disabled:opacity-40"
          >
            🔗 {t(lang, 'mp_join')}
          </button>
          {!name.trim() && <p className="text-center text-[11px] text-slate-500">{t(lang, 'mp_enterName')}</p>}
          <button onClick={onBack} className="w-full rounded-xl border border-white/10 py-2 text-xs font-semibold tracking-wider text-slate-400 active:scale-[0.98]">
            {t(lang, 'mp_back')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- host lobby: 4 slots ---- */
export function HostLobby({ lang, session, tick, onLeave }: {
  lang: Lang; session: Session; tick: number; onLeave: () => void;
}) {
  void tick;
  const [answerDraft, setAnswerDraft] = useState<Record<number, string>>({});
  const me = session.slots.find((s) => s.isLocal);
  const filled = session.slots.filter((s) => s.filled);
  const everyoneReady = filled.length >= 2 && filled.every((s) => s.ready);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#04070f]/92 px-3 py-4 backdrop-blur-md">
      <div className="glass anim-in my-auto w-full max-w-2xl rounded-3xl border border-cyan-400/25 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-black tracking-widest text-cyan-100">{t(lang, 'mp_title')}</h2>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold text-cyan-200">{t(lang, 'mp_host')}: {session.myName}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {session.slots.map((s) => (
            <SlotCard key={s.slot} lang={lang} s={s} />
          ))}
        </div>

        {/* pending invites needing answer paste */}
        {session.slots.filter((s) => s.pending && s.offerCode).map((s) => (
          <div key={s.slot} className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
            <CodeField lang={lang} label={`${t(lang, 'mp_inviteCode')} — P${s.slot + 1}`} value={s.offerCode} />
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <div className="mb-1.5 text-[10px] font-bold tracking-wider text-slate-400">{t(lang, 'mp_pasteAnswer')}</div>
              <textarea
                value={answerDraft[s.slot] || ''}
                onChange={(e) => setAnswerDraft((d) => ({ ...d, [s.slot]: e.target.value }))}
                placeholder="…"
                className="scroll-thin h-16 w-full resize-none rounded-lg border border-white/10 bg-black/50 p-2 font-mono text-[10px] leading-tight text-violet-200 outline-none"
              />
              <button
                onClick={async () => {
                  const ok = await session.acceptAnswer(s.slot, answerDraft[s.slot] || '');
                  if (ok) { sfx.buy(); setAnswerDraft((d) => ({ ...d, [s.slot]: '' })); }
                  else sfx.hit();
                }}
                className="mt-1.5 w-full rounded-lg border border-violet-300/40 bg-violet-500/20 py-1.5 text-[11px] font-bold tracking-wider text-violet-100 active:scale-95"
              >
                {t(lang, 'mp_connect')}
              </button>
            </div>
          </div>
        ))}

        <div className="mt-5 space-y-2">
          {session.canSoloStart() ? (
            <button onClick={() => { sfx.select(); session.startSolo(); }} className="w-full rounded-xl border border-cyan-300/50 bg-gradient-to-b from-cyan-400/25 to-cyan-600/10 py-3.5 font-display text-lg font-black tracking-widest text-cyan-100 active:scale-[0.98]">
              ▶ {t(lang, 'mp_startSolo')}
            </button>
          ) : (
            <>
              <button
                onClick={() => { sfx.select(); session.toggleReady(0, !me?.ready); }}
                className={`w-full rounded-xl border py-3.5 font-display text-lg font-black tracking-widest active:scale-[0.98] ${me?.ready ? 'border-emerald-300/50 bg-emerald-400/20 text-emerald-100' : 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'}`}
              >
                {me?.ready ? '✓ ' + t(lang, 'mp_isReady') : t(lang, 'mp_ready')}
              </button>
              {!everyoneReady && <p className="text-center text-[11px] text-slate-500">{t(lang, 'mp_waitReady')}</p>}
            </>
          )}
          <button onClick={onLeave} className="w-full rounded-xl border border-white/10 py-2 text-xs font-semibold tracking-wider text-slate-400 active:scale-[0.98]">
            {t(lang, 'mp_leave')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SlotCard({ lang, s }: { lang: Lang; s: LobbySlot }) {
  const session = useSessionCtx();
  if (!s.filled) {
    return (
      <button
        onClick={() => { if (!s.pending) { sfx.select(); session?.invite(s.slot); } }}
        disabled={s.pending}
        className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-60"
        style={{ borderColor: s.pending ? s.color + '66' : undefined }}
      >
        {s.pending ? (
          <>
            <span className="text-2xl" style={{ color: s.color }}>◌</span>
            <span className="text-[10px] font-bold tracking-wider">{t(lang, 'mp_waiting')}</span>
          </>
        ) : (
          <>
            <span className="text-3xl">+</span>
            <span className="text-[10px] font-bold tracking-wider">{t(lang, 'mp_invite')}</span>
          </>
        )}
      </button>
    );
  }
  return (
    <div className="relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-white/[0.03]" style={{ borderColor: s.color + '99' }}>
      <svg width="42" height="42" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="16" fill={s.color + '22'} stroke={s.color} strokeWidth="2.5" />
      </svg>
      <span className="max-w-full truncate px-1 text-[12px] font-bold" style={{ color: s.color }}>{s.name || '…'}</span>
      {s.isHost && <span className="text-[8.5px] font-bold tracking-wider text-amber-300">{t(lang, 'mp_host')}</span>}
      <span className={`text-[9px] font-bold tracking-wider ${s.ready ? 'text-emerald-300' : 'text-slate-500'}`}>
        {s.ready ? '✓ ' + t(lang, 'mp_isReady') : t(lang, 'mp_notReady')}
      </span>
    </div>
  );
}

/* light context so SlotCard can call session.invite */
import { createContext, useContext } from 'react';
const SessionCtx = createContext<Session | null>(null);
export const SessionProvider = SessionCtx.Provider;
function useSessionCtx() { return useContext(SessionCtx); }

/* ---- guest join flow ---- */
export function GuestJoin({ lang, session, tick, onLeave }: {
  lang: Lang; session: Session; tick: number; onLeave: () => void;
}) {
  void tick;
  const [offer, setOffer] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true); sfx.select();
    const a = await session.joinCreateAnswer(session.myName, offer);
    setBusy(false);
    if (a) { setAnswer(a); sfx.buy(); } else sfx.hit();
  };

  // once connected the parent swaps to the lobby view
  const connected = session.guestConnected;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#04070f]/92 px-3 py-4 backdrop-blur-md">
      <div className="glass anim-in my-auto w-full max-w-md rounded-3xl border border-violet-400/25 p-5">
        <h2 className="font-display text-xl font-black tracking-widest text-violet-100">{t(lang, 'mp_join')}</h2>
        {!connected ? (
          <>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
              <div className="mb-1.5 text-[10px] font-bold tracking-wider text-slate-400">{t(lang, 'mp_joinStep1')}</div>
              <textarea
                value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="…"
                className="scroll-thin h-20 w-full resize-none rounded-lg border border-white/10 bg-black/50 p-2 font-mono text-[10px] leading-tight text-cyan-200 outline-none"
              />
            </div>
            <button
              onClick={generate} disabled={!offer.trim() || busy}
              className="mt-2 w-full rounded-xl border border-violet-300/50 bg-violet-500/20 py-2.5 font-display font-bold tracking-widest text-violet-100 active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? t(lang, 'mp_connecting') : t(lang, 'mp_generate')}
            </button>
            {session.guestJoinError === 'bad-code' && <p className="mt-2 text-center text-[11px] text-rose-400">{t(lang, 'mp_badCode')}</p>}
            {answer && (
              <div className="mt-3">
                <CodeField lang={lang} label={t(lang, 'mp_joinStep2')} value={answer} />
                <p className="mt-2 text-center text-[11px] text-slate-400">{t(lang, 'mp_joinWait')}</p>
              </div>
            )}
          </>
        ) : (
          <GuestLobby lang={lang} session={session} />
        )}
        <button onClick={onLeave} className="mt-4 w-full rounded-xl border border-white/10 py-2 text-xs font-semibold tracking-wider text-slate-400 active:scale-[0.98]">
          {t(lang, 'mp_leave')}
        </button>
      </div>
    </div>
  );
}

function GuestLobby({ lang, session }: { lang: Lang; session: Session }) {
  const [ready, setReady] = useState(false);
  const players: LobbyPlayerNet[] = session.lobbyPlayers;
  const me = players.find((p) => p.slot === session.mySlot);
  return (
    <div className="mt-4">
      <div className="mb-3 text-center text-[11px] text-slate-400">{t(lang, 'mp_host')}: <span className="text-cyan-200">{session.hostName}</span></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {players.map((p) => (
          <div key={p.slot} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-white/[0.03]" style={{ borderColor: p.color + '99' }}>
            <svg width="38" height="38" viewBox="0 0 42 42"><circle cx="21" cy="21" r="16" fill={p.color + '22'} stroke={p.color} strokeWidth="2.5" /></svg>
            <span className="max-w-full truncate px-1 text-[11px] font-bold" style={{ color: p.color }}>{p.slot === session.mySlot ? p.name + ' (' + t(lang, 'mp_you') + ')' : p.name}</span>
            <span className={`text-[9px] font-bold ${p.ready ? 'text-emerald-300' : 'text-slate-500'}`}>{p.ready ? '✓' : t(lang, 'mp_notReady')}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => { const n = !ready; setReady(n); session.guestSetReady(n); sfx.select(); }}
        className={`mt-4 w-full rounded-xl border py-3.5 font-display text-lg font-black tracking-widest active:scale-[0.98] ${ready ? 'border-emerald-300/50 bg-emerald-400/20 text-emerald-100' : 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'}`}
      >
        {ready || me?.ready ? '✓ ' + t(lang, 'mp_isReady') : t(lang, 'mp_ready')}
      </button>
      <p className="mt-2 text-center text-[11px] text-slate-500">{t(lang, 'mp_waitReady')}</p>
    </div>
  );
}

/* ---- fullscreen countdown ---- */
export function Countdown({ lang, value }: { lang: Lang; value: number }) {
  const prev = useRef(value);
  useEffect(() => { if (value !== prev.current) { prev.current = value; sfx.select(); } }, [value]);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#04070f]/70 backdrop-blur-[2px]">
      <div className="font-display text-[10px] tracking-[0.5em] text-cyan-300/70">{t(lang, 'mp_countdown')}</div>
      <div key={value} className="anim-slam font-display text-8xl font-black text-cyan-100" style={{ textShadow: '0 0 40px rgba(56,245,224,0.5)' }}>
        {value > 0 ? value : 'GO'}
      </div>
    </div>
  );
}

/* ---- spectator / waiting-for-other's-pick overlay ---- */
export function CoopWaitOverlay({ lang, name }: { lang: Lang; name: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex flex-col items-center">
      <div className="rounded-full border border-amber-400/40 bg-black/60 px-4 py-1.5 backdrop-blur-sm">
        <span className="animate-pulse font-display text-xs font-bold tracking-widest text-amber-200">{t(lang, 'mp_choosing', { name })}</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{t(lang, 'mp_waitPick', { name })}</p>
    </div>
  );
}
