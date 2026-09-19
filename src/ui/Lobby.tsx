import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t, type Lang } from '../i18n';
import type { PeerInfo } from '../net/net';

export type LobbyStep = 'entry' | 'hosting' | 'joining' | 'inside';

export interface LobbyProps {
  lang: Lang;
  step: LobbyStep;
  nickname: string;
  code: string;
  peers: PeerInfo[];
  selfId: string;
  maxPlayers: number;
  error: string;
  busy: boolean;
  onNickname: (name: string) => void;
  onCreate: () => void;
  onConnect: (code: string) => void;
  onReady: () => void;
  onStart: () => void;
  onLeave: () => void;
  onBack: () => void;
}

const SLOT_FACES = ['◆', '▲', '●', '■'];

function Slot({ index, peer, selfId, lang }: {
  index: number; peer?: PeerInfo; selfId: string; lang: Lang;
}) {
  const filled = Boolean(peer);
  const isSelf = peer?.id === selfId;
  return (
    <div
      className={[
        'relative flex h-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 transition-all duration-200',
        filled
          ? 'border-transparent bg-white/[0.06]'
          : 'border-dashed border-white/12 bg-white/[0.02]',
      ].join(' ')}
      style={filled ? { borderColor: peer!.color, background: `${peer!.color}14` } : undefined}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-black"
        style={filled ? { background: `${peer!.color}26`, color: peer!.color } : undefined}
      >
        {filled ? SLOT_FACES[index % SLOT_FACES.length] : <span className="text-2xl font-light text-white/25">+</span>}
      </div>

      {filled ? (
        <>
          <div className="max-w-full truncate px-2 text-[13px] font-bold text-white">
            {peer!.name}
          </div>
          <div className="flex items-center gap-1.5">
            {isSelf && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white/70">
                {t(lang, 'you')}
              </span>
            )}
            {peer!.host && (
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-300">
                {t(lang, 'host')}
              </span>
            )}
          </div>
          <div
            className={[
              'absolute right-2 top-2 h-2 w-2 rounded-full transition-colors',
              peer!.ready ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-white/15',
            ].join(' ')}
          />
        </>
      ) : (
        <div className="text-[10px] uppercase tracking-widest text-white/25">
          {t(lang, 'openSlots', { n: 1 })}
        </div>
      )}
    </div>
  );
}

export function LobbyScreen({
  lang, step, nickname, code, peers, selfId, maxPlayers,
  error, busy, onNickname, onCreate, onConnect,
  onReady, onStart, onLeave, onBack,
}: LobbyProps) {
  const [draftCode, setDraftCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const me = useMemo(() => peers.find((p) => p.id === selfId), [peers, selfId]);
  const allReady = peers.length > 0 && peers.every((p) => p.ready);
  const isHost = Boolean(me?.host);

  useEffect(() => {
    if (step === 'entry') inputRef.current?.focus();
  }, [step]);

  const submitCode = useCallback(() => {
    const clean = draftCode.trim().toUpperCase();
    if (clean.length >= 3) onConnect(clean);
  }, [draftCode, onConnect]);

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[#05070f]/92 px-4 py-6 backdrop-blur-md">
      <div className="glass anim-in my-auto w-full max-w-[440px] rounded-3xl border border-cyan-400/20 p-6 shadow-[0_0_80px_rgba(56,245,224,0.14)]">

        {/* ---------- header ---------- */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-[10px] tracking-[0.35em] text-cyan-300/70">
              {t(lang, 'multiplayer')}
            </div>
            <h2 className="font-display text-2xl font-black leading-tight text-white">
              {step === 'inside' ? t(lang, 'lobby') : step === 'joining' ? t(lang, 'joinLobby') : t(lang, 'createLobby')}
            </h2>
          </div>
          <button
            onClick={step === 'inside' ? onLeave : onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white/60 transition hover:border-white/25 hover:text-white"
            aria-label="Back"
          >
            ✕
          </button>
        </div>

        {/* ---------- nickname (entry only) ---------- */}
        {step !== 'inside' && (
          <div className="mb-5">
            <label className="mb-1.5 block font-display text-[10px] tracking-[0.22em] text-white/50" htmlFor="nick">
              {t(lang, 'nickname')}
            </label>
            <input
              id="nick"
              ref={inputRef}
              value={nickname}
              maxLength={14}
              onChange={(e) => onNickname(e.target.value)}
              placeholder={t(lang, 'yourNamePlaceholder')}
              className="w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-[15px] font-semibold text-white outline-none transition focus:border-cyan-300/60"
            />
            <p className="mt-1.5 text-[11px] text-white/35">{t(lang, 'nicknameHint')}</p>
          </div>
        )}

        {/* ---------- entry: two paths ---------- */}
        {step === 'entry' && (
          <div className="space-y-3">
            <p className="mb-4 text-[12px] leading-relaxed text-white/45">{t(lang, 'coopIntro')}</p>
            <button
              onClick={onCreate}
              disabled={busy || nickname.trim().length === 0}
              className="flex w-full items-center gap-3 rounded-2xl border border-cyan-300/50 bg-gradient-to-b from-cyan-400/25 to-cyan-600/10 px-5 py-4 text-left transition active:scale-[0.98] disabled:opacity-40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/20 text-xl text-cyan-100">＋</span>
              <span>
                <span className="block font-display text-[15px] font-black tracking-wider text-cyan-100">
                  {t(lang, 'createLobby')}
                </span>
                <span className="block text-[11px] text-cyan-100/55">{t(lang, 'shareCode')}</span>
              </span>
            </button>

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-white/10" />
              <span className="font-display text-[10px] tracking-[0.3em] text-white/25">{t(lang, 'joinLobby')}</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex gap-2">
              <input
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') submitCode(); }}
                placeholder={t(lang, 'enterCode')}
                className="w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-center font-mono text-[17px] font-bold uppercase tracking-[0.35em] text-white outline-none transition focus:border-violet-300/60"
              />
              <button
                onClick={submitCode}
                disabled={busy || draftCode.trim().length < 3}
                className="shrink-0 rounded-xl border border-violet-300/50 bg-violet-500/20 px-5 font-display text-[12px] font-black tracking-wider text-violet-100 transition active:scale-95 disabled:opacity-40"
              >
                {t(lang, 'connect')}
              </button>
            </div>

            {error && <p className="pt-1 text-[12px] font-semibold text-rose-400">{error}</p>}
            <p className="pt-2 text-[10.5px] leading-relaxed text-white/30">{t(lang, 'coopNote')}</p>
          </div>
        )}

        {/* ---------- joining spinner ---------- */}
        {step === 'joining' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-cyan-300" />
            <p className="text-[13px] text-white/55">{t(lang, 'connecting')}</p>
            {error && <p className="text-[12px] font-semibold text-rose-400">{error}</p>}
          </div>
        )}

        {/* ---------- inside the lobby ---------- */}
        {step === 'inside' && (
          <>
            <div className="mb-4 rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.07] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-[9px] tracking-[0.28em] text-cyan-300/70">
                    {t(lang, 'lobbyCode')}
                  </div>
                  <div className="font-mono text-[30px] font-black leading-none tracking-[0.32em] text-cyan-100">
                    {code}
                  </div>
                </div>
                <button
                  onClick={() => {
                    try { void navigator.clipboard?.writeText(code); } catch { /* clipboard blocked */ }
                  }}
                  className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-[11px] font-bold text-white/70 transition hover:border-white/25 hover:text-white"
                >
                  ⧉
                </button>
              </div>
              <div className="mt-2 text-[10.5px] text-white/40">{t(lang, 'shareCode')}</div>
            </div>

            <div className="mb-1 flex items-center justify-between">
              <span className="font-display text-[10px] tracking-[0.22em] text-white/45">
                {t(lang, 'playersInLobby', { n: peers.length })}
              </span>
              {!allReady && peers.length > 1 && (
                <span className="text-[10.5px] text-white/35">{t(lang, 'waitingForPlayers')}</span>
              )}
              {allReady && peers.length > 1 && (
                <span className="text-[10.5px] font-semibold text-emerald-300">{t(lang, 'allReady')}</span>
              )}
            </div>

            <div className="my-3 grid grid-cols-2 gap-2.5">
              {Array.from({ length: maxPlayers }).map((_, i) => (
                <Slot key={i} index={i} peer={peers[i]} selfId={selfId} lang={lang} />
              ))}
            </div>

            {error && <p className="mb-2 text-[12px] font-semibold text-rose-400">{error}</p>}

            <div className="mt-4 space-y-2.5">
              <button
                onClick={onReady}
                className={[
                  'flex w-full items-center justify-center gap-2.5 rounded-2xl border px-5 py-3.5 font-display text-[14px] font-black tracking-[0.18em] transition active:scale-[0.98]',
                  me?.ready
                    ? 'border-emerald-300/60 bg-emerald-400/20 text-emerald-100'
                    : 'border-white/15 bg-white/[0.05] text-white/80 hover:border-white/30',
                ].join(' ')}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${me?.ready ? 'bg-emerald-300 shadow-[0_0_10px_#6ee7b7]' : 'bg-white/20'}`} />
                {me?.ready ? t(lang, 'cancelReady') : t(lang, 'imReady')}
              </button>

              {isHost ? (
                <button
                  onClick={onStart}
                  disabled={!allReady && peers.length > 1}
                  className="w-full rounded-2xl border border-cyan-300/55 bg-gradient-to-b from-cyan-400/25 to-cyan-600/10 px-5 py-4 font-display text-[15px] font-black tracking-[0.2em] text-cyan-100 transition active:scale-[0.98] disabled:opacity-35"
                >
                  ▶ {t(lang, 'startGame')}
                </button>
              ) : (
                <p className="pb-1 text-center text-[11px] text-white/35">{t(lang, 'countdownStarted')}</p>
              )}

              <button
                onClick={onLeave}
                className="w-full rounded-xl border border-white/10 py-2.5 text-[11px] font-semibold tracking-[0.2em] text-white/45 transition hover:border-white/20 hover:text-white/70"
              >
                {t(lang, 'leaveLobby')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Read-only overlay shown to everyone while a partner picks an upgrade. */
export function PartnerChoosingOverlay({ lang, name }: { lang: Lang; name: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-25 flex items-center justify-center bg-[#04070f]/72 px-6 backdrop-blur-[3px]">
      <div className="anim-in max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/40 bg-violet-500/15 text-2xl">
          ⟳
        </div>
        <h3 className="font-display text-xl font-black leading-snug text-white">
          {t(lang, 'partnerChoosing', { name })}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-white/50">
          {t(lang, 'partnerChoosingHint')}
        </p>
      </div>
    </div>
  );
}
