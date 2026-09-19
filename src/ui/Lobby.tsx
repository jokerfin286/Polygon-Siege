import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t, upgName, upgDesc, type Lang } from '../i18n';
import type { PeerInfo } from '../net/net';
import { SHAPES, WEAPONS } from '../game/defs';
import type { Choice } from '../game/engine';
import { RARITY } from './Screens';

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
  playerShape: string;
  playerColor: string;
  countdown: number;
  onNickname: (name: string) => void;
  onCreate: () => void;
  onConnect: (code: string) => void;
  onReady: () => void;
  onStart: () => void;
  onLeave: () => void;
  onBack: () => void;
}

function ShapeIcon({ sides, color, size = 32 }: { sides: number; color: string; size?: number }) {
  const c = size / 2;
  const pts: string[] = [];
  const n = Math.max(3, sides);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(c + Math.cos(a) * (c - 3)).toFixed(1)},${(c + Math.sin(a) * (c - 3)).toFixed(1)}`);
  }
  if (sides <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={c - 3} fill={color + '33'} stroke={color} strokeWidth="2.5" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={pts.join(' ')} fill={color + '33'} stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

function Slot({
  index,
  peer,
  selfId,
  lang,
  defaultShape,
  defaultColor,
}: {
  index: number;
  peer?: PeerInfo;
  selfId: string;
  lang: Lang;
  defaultShape: string;
  defaultColor: string;
}) {
  const filled = Boolean(peer);
  const isSelf = peer?.id === selfId;
  const color = peer?.color || (isSelf ? defaultColor : '#38f5e0');
  const shapeId = peer?.shape || (isSelf ? defaultShape : 'circle');
  const sides = SHAPES[shapeId]?.sides ?? 0;

  return (
    <div
      className={[
        'relative flex min-h-[115px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-2.5 transition-all duration-300',
        filled
          ? 'bg-white/[0.06] shadow-lg'
          : 'border-dashed border-white/15 bg-white/[0.02]',
      ].join(' ')}
      style={filled ? { borderColor: color, background: `${color}14` } : undefined}
    >
      {filled ? (
        <>
          <div className="relative mb-0.5 flex h-12 w-12 items-center justify-center">
            <ShapeIcon sides={sides} color={color} size={38} />
          </div>

          <div className="max-w-full truncate px-1 text-center font-display text-[13px] font-bold text-white">
            {peer!.name}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1">
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
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
                peer!.ready
                  ? 'bg-emerald-400/25 text-emerald-300'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {peer!.ready ? `✓ ${t(lang, 'ready')}` : t(lang, 'notReady')}
            </span>
          </div>

          <div
            className={[
              'absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full transition-colors',
              peer!.ready
                ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                : 'bg-amber-400/50',
            ].join(' ')}
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 text-white/30">
          <span className="text-3xl font-light leading-none">+</span>
          <span className="text-[10px] uppercase tracking-wider">
            {t(lang, 'openSlots', { n: index + 1 })}
          </span>
        </div>
      )}
    </div>
  );
}

export function LobbyScreen({
  lang,
  step,
  nickname,
  code,
  peers,
  selfId,
  maxPlayers,
  error,
  busy,
  playerShape,
  playerColor,
  countdown,
  onNickname,
  onCreate,
  onConnect,
  onReady,
  onStart,
  onLeave,
  onBack,
}: LobbyProps) {
  const [draftCode, setDraftCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const me = useMemo(() => peers.find((p) => p.id === selfId), [peers, selfId]);
  const isHost = Boolean(me?.host || peers[0]?.id === selfId);
  const isMulti = peers.length > 1;
  const allReady = peers.length > 0 && peers.every((p) => p.ready);

  useEffect(() => {
    if (step === 'entry') inputRef.current?.focus();
  }, [step]);

  const submitCode = useCallback(() => {
    const clean = draftCode.trim().toUpperCase();
    if (clean.length >= 3) onConnect(clean);
  }, [draftCode, onConnect]);

  const copyCode = useCallback(() => {
    try {
      void navigator.clipboard?.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  }, [code]);

  const copyLink = useCallback(() => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
      void navigator.clipboard?.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  }, [code]);

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[#05070f]/92 px-4 py-6 backdrop-blur-md">
      <div className="glass anim-in my-auto w-full max-w-[480px] rounded-3xl border border-cyan-400/25 p-6 shadow-[0_0_80px_rgba(56,245,224,0.14)] sm:p-7">
        {/* ---------- Header ---------- */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-[10px] tracking-[0.35em] text-cyan-300/70">
                {t(lang, 'multiplayer')}
              </span>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                {t(lang, 'onlineBadge')}
              </span>
            </div>
            <h2 className="font-display text-2xl font-black leading-tight text-white sm:text-3xl">
              {step === 'inside'
                ? t(lang, 'lobby')
                : step === 'joining'
                  ? t(lang, 'joinLobby')
                  : t(lang, 'createLobby')}
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

        {/* ---------- Nickname field ---------- */}
        {step !== 'inside' && (
          <div className="mb-5">
            <label
              className="mb-1.5 block font-display text-[10px] tracking-[0.22em] text-white/50"
              htmlFor="nick"
            >
              {t(lang, 'nickname')}
            </label>
            <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-black/35 px-3 py-2 focus-within:border-cyan-300/60">
              <span className="text-xl">👤</span>
              <input
                id="nick"
                ref={inputRef}
                value={nickname}
                maxLength={14}
                onChange={(e) => onNickname(e.target.value)}
                placeholder={t(lang, 'yourNamePlaceholder')}
                className="w-full bg-transparent font-display text-[15px] font-bold text-white outline-none placeholder:text-white/30"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-white/35">
              {t(lang, 'nicknameHint')}
            </p>
          </div>
        )}

        {/* ---------- Entry view (Create or Join) ---------- */}
        {step === 'entry' && (
          <div className="space-y-3.5">
            <p className="text-[12px] leading-relaxed text-white/55">
              {t(lang, 'coopIntro')}
            </p>

            <button
              onClick={onCreate}
              disabled={busy || nickname.trim().length === 0}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-cyan-300/50 bg-gradient-to-b from-cyan-400/25 to-cyan-600/10 px-5 py-4 text-left transition active:scale-[0.98] disabled:opacity-40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-300/20 text-2xl text-cyan-100">
                ＋
              </span>
              <span>
                <span className="block font-display text-[15px] font-black tracking-wider text-cyan-100">
                  {t(lang, 'createLobby')}
                </span>
                <span className="block text-[11px] text-cyan-100/60">
                  {t(lang, 'shareCode')}
                </span>
              </span>
            </button>

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-white/10" />
              <span className="font-display text-[10px] tracking-[0.3em] text-white/30">
                {t(lang, 'joinLobby')}
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex gap-2">
              <input
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCode();
                }}
                placeholder={t(lang, 'enterCode')}
                className="w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-center font-mono text-[17px] font-bold uppercase tracking-[0.35em] text-white outline-none transition focus:border-violet-300/60"
              />
              <button
                onClick={submitCode}
                disabled={busy || draftCode.trim().length < 3}
                className="shrink-0 rounded-xl border border-violet-300/50 bg-violet-500/25 px-5 font-display text-[12px] font-black tracking-wider text-violet-100 transition active:scale-95 disabled:opacity-40"
              >
                {t(lang, 'connect')}
              </button>
            </div>

            {error && (
              <p className="pt-1 text-[12px] font-semibold text-rose-400">{error}</p>
            )}
            <p className="pt-1 text-[10.5px] leading-relaxed text-white/30">
              {t(lang, 'coopNote')}
            </p>
          </div>
        )}

        {/* ---------- Joining spinner ---------- */}
        {step === 'joining' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-cyan-300" />
            <p className="text-[13px] text-white/60">{t(lang, 'connecting')}</p>
            {error && (
              <p className="text-[12px] font-semibold text-rose-400">{error}</p>
            )}
          </div>
        )}

        {/* ---------- Inside Lobby: 4 slots & ready flow ---------- */}
        {step === 'inside' && (
          <>
            {/* Room code card with copy buttons */}
            <div className="mb-4 rounded-2xl border border-cyan-300/30 bg-cyan-400/[0.08] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-display text-[9px] tracking-[0.28em] text-cyan-300/70">
                    {t(lang, 'lobbyCode')}
                  </div>
                  <div className="font-mono text-[32px] font-black leading-none tracking-[0.32em] text-cyan-100">
                    {code}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold text-white transition hover:border-cyan-300 hover:text-cyan-200"
                    title="Copy code"
                  >
                    <span>{copiedCode ? '✓' : '⧉'}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {copiedCode ? t(lang, 'copied') : 'CODE'}
                    </span>
                  </button>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1.5 rounded-xl border border-cyan-300/40 bg-cyan-400/15 px-3 py-2 text-[11px] font-bold text-cyan-100 transition hover:bg-cyan-400/25"
                    title="Copy invite link"
                  >
                    <span>{copiedLink ? '✓' : '🔗'}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {copiedLink ? t(lang, 'copied') : t(lang, 'copyInviteLink')}
                    </span>
                  </button>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-white/50">
                {t(lang, 'shareCode')}
              </div>
            </div>

            {/* Slots header */}
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[10px] tracking-[0.22em] text-white/50">
                {t(lang, 'playersInLobby', { n: peers.length })}
              </span>
              {isMulti && !allReady && (
                <span className="text-[11px] font-semibold text-amber-300">
                  {t(lang, 'youMustReady')}
                </span>
              )}
              {isMulti && allReady && (
                <span className="text-[11px] font-bold text-emerald-300">
                  {countdown > 0
                    ? t(lang, 'startingIn', { n: Math.ceil(countdown) })
                    : t(lang, 'allReady')}
                </span>
              )}
            </div>

            {/* 4 slots at the bottom: 1 with US, 3 with + sign when empty */}
            <div className="my-3.5 grid grid-cols-2 gap-2.5">
              {Array.from({ length: maxPlayers }).map((_, i) => (
                <Slot
                  key={i}
                  index={i}
                  peer={peers[i]}
                  selfId={selfId}
                  lang={lang}
                  defaultShape={playerShape}
                  defaultColor={playerColor}
                />
              ))}
            </div>

            {error && (
              <p className="mb-2 text-[12px] font-semibold text-rose-400">{error}</p>
            )}

            {/* Actions: Ready button & start flow */}
            <div className="mt-5 space-y-2.5">
              {countdown > 0 ? (
                <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/80 bg-cyan-400/20 py-4 font-display text-[18px] font-black tracking-widest text-white shadow-[0_0_20px_rgba(56,245,224,0.3)]">
                  <span className="h-3 w-3 animate-ping rounded-full bg-cyan-300" />
                  {t(lang, 'startingIn', { n: Math.ceil(countdown) })}
                </div>
              ) : (
                <>
                  <button
                    onClick={onReady}
                    className={[
                      'flex w-full items-center justify-center gap-2.5 rounded-2xl border px-5 py-3.5 font-display text-[15px] font-black tracking-[0.18em] transition active:scale-[0.98]',
                      me?.ready
                        ? 'border-emerald-300/70 bg-emerald-400/25 text-emerald-100 shadow-[0_0_15px_rgba(52,211,153,0.25)]'
                        : 'border-white/20 bg-white/[0.07] text-white hover:border-white/35',
                    ].join(' ')}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        me?.ready
                          ? 'bg-emerald-300 shadow-[0_0_10px_#6ee7b7]'
                          : 'bg-white/30'
                      }`}
                    />
                    {me?.ready ? t(lang, 'cancelReady') : t(lang, 'imReady')}
                  </button>

                  {/* If alone: can launch solo test. If with friends: only active when everyone is ready */}
                  {isHost && (
                    <button
                      onClick={onStart}
                      disabled={isMulti && !allReady}
                      className="w-full rounded-2xl border border-cyan-300/55 bg-gradient-to-b from-cyan-400/25 to-cyan-600/10 px-5 py-4 font-display text-[15px] font-black tracking-[0.2em] text-cyan-100 transition active:scale-[0.98] disabled:opacity-35"
                    >
                      ▶ {t(lang, 'startGame')}
                    </button>
                  )}
                </>
              )}

              <button
                onClick={onLeave}
                className="w-full rounded-xl border border-white/10 py-2.5 text-[11px] font-semibold tracking-[0.2em] text-white/50 transition hover:border-white/20 hover:text-white"
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

/** Overlay shown to spectators/teammates when a partner is choosing an upgrade. Shows the cards! */
export function PartnerChoosingOverlay({
  lang,
  name,
  choices,
}: {
  lang: Lang;
  name: string;
  choices?: Choice[];
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#04070f]/82 px-4 py-6 backdrop-blur-[4px]">
      <div className="anim-in w-full max-w-2xl text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/50 bg-violet-500/20 text-3xl text-violet-200 shadow-[0_0_20px_rgba(167,139,250,0.3)]">
          ⟳
        </div>

        <div className="font-display text-[11px] tracking-[0.4em] text-violet-300/80">
          {t(lang, 'partnerUpgradeChoices')}
        </div>
        <h3 className="font-display mt-1 text-2xl font-black leading-snug text-white sm:text-3xl">
          {t(lang, 'partnerChoosing', { name })}
        </h3>
        <p className="mt-1 text-[12.5px] text-white/50">
          {t(lang, 'partnerChoosingHint')}
        </p>

        {/* Display the 3 upgrade cards the partner is looking at! */}
        {choices && choices.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {choices.map((c) => {
              const r = RARITY[c.def.rarity];
              const w = c.def.weapon ? WEAPONS[c.def.weapon] : null;
              return (
                <div
                  key={c.key}
                  className={`flex flex-col rounded-2xl border ${r.border} bg-gradient-to-b ${r.bg} to-black/60 p-4 text-left shadow-lg opacity-90`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-2xl">
                      {w ? (
                        <span style={{ color: w.color }}>{w.icon}</span>
                      ) : (
                        <span>{c.def.icon}</span>
                      )}
                    </div>
                    <div className={`font-display text-[9px] tracking-[0.2em] ${r.text}`}>
                      {t(lang, 'rarity_' + c.def.rarity)}
                    </div>
                  </div>
                  <h4 className="font-display mt-2 text-base font-bold text-white">
                    {upgName(lang, c.def.id, c.def.name)}
                  </h4>
                  <p className="mt-1 text-[12px] leading-snug text-slate-300">
                    {upgDesc(lang, c.def.id, c.def.desc)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
