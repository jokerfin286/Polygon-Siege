import { useCallback, useEffect, useRef, useState } from 'react';
import { t, type Lang } from '../i18n';
import { PEER_COLORS, type RosterEntry } from '../net/net';
import type { PickerState } from '../game/engine';
import { RARITY } from './Screens';

function Slot({ index, peer, selfId, lang }: {
  index: number; peer?: RosterEntry; selfId: string; lang: Lang;
}) {
  const filled = Boolean(peer);
  const isSelf = peer?.id === selfId;
  return (
    <div
      className={[
        'relative flex h-[92px] flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-all duration-200',
        filled ? 'border-transparent bg-white/[0.06]' : 'border-dashed border-white/12 bg-white/[0.02]',
      ].join(' ')}
      style={filled ? { borderColor: `${peer!.color}88`, background: `${peer!.color}12` } : undefined}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-black"
        style={filled ? { background: `${peer!.color}2b`, color: peer!.color } : undefined}
      >
        {filled ? ['◆', '▲', '●', '■'][index % 4] : <span className="text-xl font-light text-white/25">+</span>}
      </div>

      {filled ? (
        <>
          <div className="max-w-full truncate px-2 text-[12.5px] font-bold text-white">{peer!.name}</div>
          <div className="flex items-center gap-1">
            {isSelf && <span className="rounded bg-white/10 px-1 py-px text-[8.5px] font-bold tracking-wider text-white/70">{t(lang, 'you')}</span>}
            {peer!.host && <span className="rounded bg-amber-400/20 px-1 py-px text-[8.5px] font-bold tracking-wider text-amber-300">{t(lang, 'host')}</span>}
            <span className={`h-1.5 w-1.5 rounded-full ${peer!.ready ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-white/15'}`} />
          </div>
        </>
      ) : (
        <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/25">{t(lang, 'openSlot')}</div>
      )}
    </div>
  );
}

export function LobbyScreen({
  lang, step, nickname, code, roster, selfId, isHost, maxPlayers,
  transport, ping, connecting, error,
  onNickname, onCreate, onConnect, onReady, onStart, onLeave,
}: {
  lang: Lang;
  step: 'entry' | 'inside';
  nickname: string;
  code: string;
  roster: RosterEntry[];
  selfId: string;
  isHost: boolean;
  maxPlayers: number;
  transport: 'net' | 'local';
  ping: number;
  connecting: boolean;
  error: string;
  onNickname: (name: string) => void;
  onCreate: () => void;
  onConnect: (code: string) => void;
  onReady: () => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const me = roster.find((r) => r.id === selfId);
  const partners = roster.filter((r) => r.id !== selfId);
  const allReady = roster.length > 1 && roster.every((r) => r.ready);

  useEffect(() => { if (step === 'entry') inputRef.current?.focus(); }, [step]);
  useEffect(() => { if (!copied) return; const id = window.setTimeout(() => setCopied(false), 1600); return () => window.clearTimeout(id); }, [copied]);

  const submit = useCallback(() => {
    const clean = draft.trim().toUpperCase();
    if (clean.length >= 4) onConnect(clean);
  }, [draft, onConnect]);

  const showError = error === 'short' ? t(lang, 'codeTooShort')
    : error === 'lost' ? t(lang, 'connectionLost')
      : error ? t(lang, 'netError', { msg: error }) : '';

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[#05070f]/93 px-3 py-5 backdrop-blur-md sm:items-center">
      <div className="glass anim-in my-auto w-full max-w-[452px] rounded-3xl border border-violet-400/25 p-5 shadow-[0_0_80px_rgba(167,139,250,0.16)] sm:p-6">

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-[10px] tracking-[0.32em] text-violet-300/70">{t(lang, 'multiplayer')}</div>
            <h2 className="font-display text-[22px] font-black leading-tight text-white">
              {step === 'inside' ? t(lang, 'lobby') : t(lang, 'coopTitle')}
            </h2>
          </div>
          <button onClick={onLeave} aria-label={t(lang, 'leaveLobby')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white/60 transition hover:border-white/25 hover:text-white">✕</button>
        </div>

        {/* ---------------- entry ---------------- */}
        {step === 'entry' && (
          <>
            <label htmlFor="nick" className="mb-1.5 block font-display text-[10px] tracking-[0.22em] text-white/45">{t(lang, 'nickname')}</label>
            <input
              id="nick" ref={inputRef} value={nickname} maxLength={14}
              onChange={(e) => onNickname(e.target.value)}
              placeholder={t(lang, 'yourNamePlaceholder')}
              className="mb-4 w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-[15px] font-semibold text-white outline-none transition focus:border-violet-300/60"
            />

            <button
              onClick={onCreate}
              disabled={connecting || nickname.trim().length === 0}
              className="group flex w-full items-center gap-3 rounded-2xl border border-violet-300/50 bg-gradient-to-b from-violet-400/25 to-violet-700/10 px-4 py-3.5 text-left transition active:scale-[0.98] hover:from-violet-300/35 disabled:opacity-40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-300/20 text-xl text-violet-100 transition group-hover:scale-105">🌐</span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-black tracking-wide text-violet-50">{t(lang, 'createLobby')}</span>
                <span className="block text-[11px] leading-snug text-violet-100/55">{t(lang, 'createHint')}</span>
              </span>
            </button>

            <div className="my-3.5 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="font-display text-[9px] tracking-[0.28em] text-white/25">{t(lang, 'or')}</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder={t(lang, 'enterCode')}
                aria-label={t(lang, 'lobbyCode')}
                className="w-full rounded-xl border border-white/12 bg-black/35 px-3 py-3 text-center font-mono text-[17px] font-bold uppercase tracking-[0.3em] text-white outline-none transition focus:border-cyan-300/60"
              />
              <button onClick={submit} disabled={connecting || draft.trim().length < 4}
                className="shrink-0 rounded-xl border border-cyan-300/50 bg-cyan-400/15 px-4 font-display text-[12px] font-black tracking-wider text-cyan-100 transition active:scale-95 hover:bg-cyan-400/25 disabled:opacity-40">
                {t(lang, 'connect')}
              </button>
            </div>

            {connecting && (
              <div className="mt-4 flex items-center justify-center gap-2.5 text-[12px] text-white/55">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-violet-300" />
                {t(lang, 'connecting')}
              </div>
            )}
            {!connecting && showError && <p className="mt-3 text-[12px] font-semibold text-rose-400">{showError}</p>}

            <p className="mt-4 border-t border-white/10 pt-3 text-[10.5px] leading-relaxed text-white/35">{t(lang, 'coopHowTo')}</p>
          </>
        )}

        {/* ---------------- inside ---------------- */}
        {step === 'inside' && (
          <>
            <div className="mb-4 overflow-hidden rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.07]">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-display text-[9px] tracking-[0.28em] text-cyan-300/70">{t(lang, 'lobbyCode')}</div>
                  <div className="font-mono text-[30px] font-black leading-none tracking-[0.3em] text-cyan-100">{code || '······'}</div>
                </div>
                <button
                  onClick={() => { try { void navigator.clipboard?.writeText(code); setCopied(true); } catch { /* ignore */ } }}
                  className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  {copied ? t(lang, 'copied') : t(lang, 'copy')}
                </button>
              </div>
              <div className="flex items-center gap-2 border-t border-white/10 bg-black/25 px-4 py-2">
                <span className={`h-2 w-2 rounded-full ${transport === 'net' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`} />
                <span className="min-w-0 flex-1 truncate text-[10.5px] tracking-wide text-white/55">
                  {t(lang, transport === 'net' ? 'transportNet' : 'transportLocal')}
                </span>
                {partners.length > 0 && ping > 0 && (
                  <span className={`shrink-0 font-mono text-[10.5px] font-bold ${ping < 90 ? 'text-emerald-300' : ping < 220 ? 'text-amber-300' : 'text-rose-300'}`}>
                    {ping}ms
                  </span>
                )}
              </div>
            </div>

            {/* your seat */}
            <div className="mb-3 flex items-center gap-3 rounded-2xl border px-3.5 py-3"
              style={{ borderColor: `${me?.color || PEER_COLORS[0]}66`, background: `${me?.color || PEER_COLORS[0]}0f` }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-[17px] font-black"
                style={{ background: `${me?.color || PEER_COLORS[0]}30`, color: me?.color || PEER_COLORS[0] }}>◆</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-bold text-white">{me?.name || nickname || 'PLAYER'}</div>
                <div className="text-[10px] tracking-wide text-white/40">
                  {t(lang, 'you')}{isHost ? ` · ${t(lang, 'host')}` : ''} · {t(lang, 'playersInLobby', { n: roster.length, max: maxPlayers })}
                </div>
              </div>
              <span className={`rounded-lg px-2 py-1 text-[9.5px] font-black tracking-wider ${me?.ready ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/45'}`}>
                {me?.ready ? t(lang, 'ready') : t(lang, 'notReady')}
              </span>
            </div>

            <div className="mb-1.5 font-display text-[9.5px] tracking-[0.22em] text-white/40">{t(lang, 'openSlots')}</div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: maxPlayers }).map((_, i) => (
                <Slot key={i} index={i} peer={roster[i]} selfId={selfId} lang={lang} />
              ))}
            </div>

            {!roster.length && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/25 py-2.5 text-[11.5px] text-white/50">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/15 border-t-cyan-300" />
                {t(lang, 'waitingForPlayers')}
              </div>
            )}
            {showError && <p className="mt-2 text-[12px] font-semibold text-rose-400">{showError}</p>}

            <div className="mt-4 space-y-2.5">
              <button
                onClick={onReady}
                className={[
                  'flex w-full items-center justify-center gap-2.5 rounded-2xl border px-4 py-3 font-display text-[13px] font-black tracking-[0.16em] transition active:scale-[0.98]',
                  me?.ready
                    ? 'border-emerald-300/60 bg-emerald-400/20 text-emerald-100'
                    : 'border-white/15 bg-white/[0.05] text-white/80 hover:border-white/30',
                ].join(' ')}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${me?.ready ? 'bg-emerald-300 shadow-[0_0_10px_#6ee7b7]' : 'bg-white/20'}`} />
                {me?.ready ? t(lang, 'cancelReady') : t(lang, 'imReady')}
              </button>

              {isHost ? (
                <>
                  <button
                    onClick={onStart}
                    disabled={roster.length === 0}
                    className="w-full rounded-2xl border border-cyan-300/55 bg-gradient-to-b from-cyan-400/25 to-cyan-600/10 px-4 py-3.5 font-display text-[14px] font-black tracking-[0.18em] text-cyan-100 transition active:scale-[0.98] hover:from-cyan-300/35 disabled:opacity-40"
                  >
                    ▶ {t(lang, 'startGame')}
                  </button>
                  {partners.length > 0 && !allReady && (
                    <p className="text-center text-[10.5px] text-white/40">{t(lang, 'waitingReady')}</p>
                  )}
                  {allReady && <p className="text-center text-[10.5px] font-semibold text-emerald-300">{t(lang, 'allReady')}</p>}
                </>
              ) : (
                <p className="text-center text-[11px] text-white/45">{t(lang, 'waitingHost')}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Everyone else watches the partner's decision, with their nickname on it. */
export function PartnerPicker({ lang, picker }: { lang: Lang; picker: PickerState }) {
  const chosen = picker.cards.find((c) => c.key === picker.chosen);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#04070f]/80 px-4 backdrop-blur-[3px]">
      <div className="anim-in w-full max-w-3xl text-center">
        <div className="font-display text-[10px] tracking-[0.4em] text-violet-300/70">{t(lang, 'partnerTurn')}</div>
        <h3 className="font-display mt-1 text-2xl font-black text-white sm:text-3xl">
          <span className="text-violet-200">{picker.name}</span> {chosen ? t(lang, 'picked') : t(lang, 'isChoosing')}
        </h3>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {picker.cards.map((c) => {
            const isPicked = c.key === picker.chosen;
            const dim = picker.chosen && !isPicked;
            const r = RARITY[Math.max(0, Math.min(3, c.rarity))];
            return (
              <div
                key={c.key}
                className={[
                  'rounded-2xl border p-3.5 text-left transition-all duration-300',
                  isPicked ? `${RARITY[Math.max(0, Math.min(3, c.rarity))].border} scale-[1.03] bg-white/[0.07]` : 'border-white/10 bg-black/35',
                  dim ? 'opacity-30' : 'opacity-100',
                ].join(' ')}
                style={isPicked ? { boxShadow: `0 0 44px ${c.color}44` } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/45 text-lg" style={{ color: c.color }}>{c.icon}</span>
                  <span className={`font-display text-[8.5px] tracking-[0.2em] ${r.text}`}>{t(lang, `rarity_${c.rarity}`)}</span>
                  {isPicked && <span className="ml-auto text-[10px] font-black text-emerald-300">{t(lang, 'taken')}</span>}
                </div>
                <div className="mt-2 font-display text-[15px] font-bold leading-tight text-white">{c.name}</div>
                <div className="mt-1 text-[10px] tracking-wider text-white/40">
                  {t(lang, `kind_${c.kind}`)} · {t(lang, 'lv')} {c.level}/{c.max}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11.5px] text-white/45">{chosen ? t(lang, 'resuming') : t(lang, 'partnerChoosingHint')}</p>
      </div>
    </div>
  );
}
