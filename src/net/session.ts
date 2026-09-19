/* ============================================================
   Multiplayer session controller. Owns the lobby, the host/guest
   roles, the countdown, and message routing between the WebRTC
   layer and the game engine / remote view.
   ============================================================ */

import type { Game } from '../game/engine';
import { buildStartConfig, type Meta } from '../game/meta';
import { HostNet, GuestNet, type NetMessage, type LobbyPlayerNet, type NetChoice, type Snapshot } from './net';
import type { RemoteView } from './remoteView';

export interface LobbySlot {
  slot: number;
  filled: boolean;
  name: string;
  color: string;
  ready: boolean;
  isHost: boolean;
  isLocal: boolean;
  pending: boolean;   // invite created, waiting for the guest's answer
  offerCode: string;  // host-only: code to share
}

export type SessionPhase = 'idle' | 'lobby' | 'countdown' | 'playing' | 'over';

const MAX_PLAYERS = 4;
const COLORS = ['#38f5e0', '#ff7a45', '#a78bfa', '#fde047'];

export interface SessionCallbacks {
  onChange: () => void;                          // lobby / phase changed → re-render UI
  onStart: (players: { slot: number; name: string; color: string; local: boolean }[]) => void;
  onSnapshot: (snap: Snapshot) => void;          // guest received a frame
  onGuestLevelUp: (name: string, choices: NetChoice[], rerolls: number) => void;
  onGuestLevelUpEnd: () => void;
  onGuestGameOver: (snap: Snapshot) => void;
  onToMenu: () => void;
}

export class Session {
  role: 'host' | 'guest' = 'host';
  phase: SessionPhase = 'idle';
  myName = 'PLAYER';
  myColor = COLORS[0];
  countdown = 0;

  slots: LobbySlot[] = [];
  guestConnected = false;
  guestJoinError = '';

  private host: HostNet | null = null;
  private guest: GuestNet | null = null;
  private cb: SessionCallbacks;
  private meta: () => Meta;
  private game: () => Game | null;
  private view: () => RemoteView | null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private snapTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: {
    cb: SessionCallbacks;
    meta: () => Meta;
    game: () => Game | null;
    view: () => RemoteView | null;
  }) {
    this.cb = opts.cb;
    this.meta = opts.meta;
    this.game = opts.game;
    this.view = opts.view;
  }

  /* ---------------- host: create lobby ---------------- */

  async createLobby(name: string) {
    this.role = 'host';
    this.phase = 'lobby';
    this.myName = name || 'HOST';
    this.myColor = COLORS[0];
    this.host = new HostNet();
    this.host.onOpen = (slot) => this.onGuestOpen(slot);
    this.host.onClose = (slot) => this.onGuestClose(slot);
    this.host.onMessage = (slot, msg) => this.onHostMessage(slot, msg);
    this.slots = [
      { slot: 0, filled: true, name: this.myName, color: COLORS[0], ready: true, isHost: true, isLocal: true, pending: false, offerCode: '' },
      ...Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => ({
        slot: i + 1, filled: false, name: '', color: COLORS[i + 1], ready: false,
        isHost: false, isLocal: false, pending: false, offerCode: '',
      })),
    ];
    this.cb.onChange();
  }

  /** Host: generate an invite code for an empty slot. */
  async invite(slot: number) {
    if (!this.host) return;
    const s = this.slots.find((x) => x.slot === slot);
    if (!s || s.filled || s.pending) return;
    s.pending = true;
    this.cb.onChange();
    try {
      const conn = await this.host.createInvite(slot);
      s.offerCode = conn.offerCode;
    } catch {
      s.pending = false;
    }
    this.cb.onChange();
  }

  /** Host: paste the guest's answer to complete their connection. */
  async acceptAnswer(slot: number, answer: string): Promise<boolean> {
    if (!this.host) return false;
    const ok = await this.host.acceptAnswer(slot, answer);
    return ok;
  }

  private onGuestOpen(slot: number) {
    const s = this.slots.find((x) => x.slot === slot);
    if (!s) return;
    s.pending = false;
    // name/color arrive with the guest's hello; keep placeholders until then
    s.filled = true;
    this.broadcastLobby();
    this.cb.onChange();
  }

  private onGuestClose(slot: number) {
    const s = this.slots.find((x) => x.slot === slot);
    if (!s) return;
    s.filled = false; s.ready = false; s.name = ''; s.pending = false; s.offerCode = '';
    this.host?.dropSlot(slot);
    this.broadcastLobby();
    this.cb.onChange();
    // A disconnect mid-game shouldn't hang the survivors.
    if (this.phase === 'playing') {
      const g = this.game();
      g?.setMateInput(slot, 0, 0, false, 0);
    }
  }

  private onHostMessage(slot: number, msg: NetMessage) {
    const s = this.slots.find((x) => x.slot === slot);
    if (!s) return;
    switch (msg.t) {
      case 'hello':
        s.name = (msg.name || ('P' + (slot + 1))).slice(0, 12);
        s.color = msg.color || s.color;
        this.broadcastLobby();
        this.cb.onChange();
        break;
      case 'ready':
        s.ready = msg.ready;
        this.broadcastLobby();
        this.cb.onChange();
        this.maybeStartCountdown();
        break;
      case 'input': {
        const g = this.game();
        g?.setMateInput(slot, msg.mx, msg.my, msg.dash, msg.aim);
        break;
      }
      case 'pick': {
        const g = this.game();
        g?.pickForSlot(slot, msg.key);
        break;
      }
      case 'reroll': {
        const g = this.game();
        g?.rerollForSlot(slot);
        break;
      }
    }
  }

  toggleReady(slot: number, ready: boolean) {
    // host toggling its own readiness
    const s = this.slots.find((x) => x.slot === slot);
    if (s) { s.ready = ready; }
    this.broadcastLobby();
    this.cb.onChange();
    this.maybeStartCountdown();
  }

  private broadcastLobby() {
    if (!this.host) return;
    const players: LobbyPlayerNet[] = this.slots.filter((s) => s.filled)
      .map((s) => ({ slot: s.slot, name: s.name || ('P' + (s.slot + 1)), color: s.color, ready: s.ready, isHost: s.isHost }));
    this.host.broadcast({ t: 'lobby', players, hostName: this.myName });
  }

  private filledSlots() { return this.slots.filter((s) => s.filled); }

  private maybeStartCountdown() {
    if (this.role !== 'host' || this.phase !== 'lobby') return;
    const filled = this.filledSlots();
    if (filled.length < 2) return;             // solo start is a normal PLAY
    if (!filled.every((s) => s.ready)) return; // wait for everyone
    this.startCountdown();
  }

  private startCountdown() {
    this.phase = 'countdown';
    this.countdown = 3;
    this.host?.broadcast({ t: 'countdown', value: this.countdown });
    this.cb.onChange();
    this.countdownTimer = setInterval(() => {
      this.countdown--;
      this.host?.broadcast({ t: 'countdown', value: this.countdown });
      this.cb.onChange();
      if (this.countdown <= 0) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.beginGame();
      }
    }, 1000);
  }

  /** Host: solo (1 player) start — skip ready/countdown. */
  startSolo() {
    if (this.role !== 'host') return;
    this.beginGame();
  }

  canSoloStart() {
    return this.role === 'host' && this.filledSlots().length === 1;
  }

  private beginGame() {
    this.phase = 'playing';
    const players = this.filledSlots().map((s) => ({
      slot: s.slot, name: s.name || ('P' + (s.slot + 1)), color: s.color, local: s.isLocal,
    }));
    this.cb.onStart(players);
    // Stream snapshots to guests ~20/sec.
    if (this.host && players.length > 1) {
      this.snapTimer = setInterval(() => {
        const g = this.game();
        if (!g) return;
        this.host!.broadcast({ t: 'snapshot', data: g.buildSnapshot() });
      }, 50);
    }
    this.cb.onChange();
  }

  /* host: called by engine when a mate needs to choose an upgrade */
  sendLevelUp(slot: number, name: string, choices: NetChoice[], rerolls: number) {
    this.host?.send(slot, { t: 'levelup', slot, name, choices, rerolls });
  }
  sendLevelUpEnd() {
    this.host?.broadcast({ t: 'levelupEnd' });
  }
  sendGameOver() {
    const g = this.game();
    if (g && this.host) this.host.broadcast({ t: 'gameover', snapshot: g.buildSnapshot() });
  }

  /* ---------------- guest: join ---------------- */

  async joinCreateAnswer(name: string, offerCode: string): Promise<string | null> {
    this.role = 'guest';
    this.myName = name || 'GUEST';
    this.guestJoinError = '';
    this.guest = new GuestNet();
    this.guest.onOpen = () => {
      this.guestConnected = true;
      this.phase = 'lobby';
      this.guest?.send({ t: 'hello', name: this.myName, color: this.myColor });
      this.cb.onChange();
    };
    this.guest.onClose = () => this.onGuestDisconnected();
    this.guest.onMessage = (msg) => this.onGuestMessage(msg);
    const answer = await this.guest.createAnswer(offerCode);
    if (!answer) { this.guestJoinError = 'bad-code'; this.cb.onChange(); }
    return answer;
  }

  mySlot = 0;
  lobbyPlayers: LobbyPlayerNet[] = [];
  hostName = '';

  private onGuestMessage(msg: NetMessage) {
    switch (msg.t) {
      case 'lobby':
        this.lobbyPlayers = msg.players;
        this.hostName = msg.hostName;
        // discover my own slot from the roster by name match on first arrival
        const mine = msg.players.find((p) => !p.isHost && p.name === this.myName);
        if (mine) this.mySlot = mine.slot;
        this.cb.onChange();
        break;
      case 'countdown':
        this.phase = 'countdown';
        this.countdown = msg.value;
        this.cb.onChange();
        break;
      case 'snapshot':
        if (this.phase !== 'playing') { this.phase = 'playing'; this.cb.onChange(); }
        this.mySlot = this.mySlot; // keep
        this.view()?.push(msg.data);
        this.cb.onSnapshot(msg.data);
        break;
      case 'levelup':
        this.mySlot = msg.slot;
        this.cb.onGuestLevelUp(msg.name, msg.choices, msg.rerolls);
        break;
      case 'levelupEnd':
        this.cb.onGuestLevelUpEnd();
        break;
      case 'gameover':
        this.phase = 'over';
        this.view()?.push(msg.snapshot);
        this.cb.onGuestGameOver(msg.snapshot);
        this.cb.onChange();
        break;
      case 'toMenu':
        this.leave();
        this.cb.onToMenu();
        break;
    }
  }

  private onGuestDisconnected() {
    if (this.phase === 'playing' || this.phase === 'lobby' || this.phase === 'countdown') {
      this.guestJoinError = 'lost';
      this.cb.onToMenu();
    }
    this.cleanup();
  }

  guestSetReady(ready: boolean) {
    this.guest?.send({ t: 'ready', ready });
  }
  guestInput(mx: number, my: number, dash: boolean, aim: number) {
    this.guest?.send({ t: 'input', mx, my, dash, aim });
  }
  guestPick(key: string) {
    this.guest?.send({ t: 'pick', key });
  }
  guestReroll() {
    this.guest?.send({ t: 'reroll' });
  }

  /* ---------------- shared ---------------- */

  startConfigForRun() {
    return buildStartConfig(this.meta());
  }

  leave() {
    if (this.role === 'host') this.host?.broadcast({ t: 'toMenu' });
    this.cleanup();
    this.phase = 'idle';
    this.cb.onChange();
  }

  private cleanup() {
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.snapTimer) { clearInterval(this.snapTimer); this.snapTimer = null; }
    this.host?.close();
    this.guest?.close();
    this.host = null;
    this.guest = null;
    this.guestConnected = false;
  }
}
