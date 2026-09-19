/* ============================================================
   Co-op transport.

   Real internet play: WebRTC data channels brokered by the public
   PeerJS signalling server. The host's peer id IS the lobby code,
   so there is no game server to run — two browsers anywhere on the
   planet can talk to each other directly.

   Fallback: if WebRTC/broker is unavailable (offline, locked-down
   network), the same protocol runs over BroadcastChannel so tabs on
   one machine still play together. Everything is plain JSON so the
   payload shape is identical on both paths.
   ============================================================ */

import Peer, { type DataConnection } from 'peerjs';

export const MAX_PLAYERS = 4;
export const PEER_PREFIX = 'psiege1-';
export const LOCAL_PREFIX = 'polygon-siege-run:';
export const PEER_COLORS = ['#38f5e0', '#f472b6', '#fbbf24', '#a78bfa'];

export interface RosterEntry {
  id: string;
  name: string;
  ready: boolean;
  host: boolean;
  color: string;
}

type Raw = { k: string; d: unknown; to: string | null; from: string };

export interface SessionCallbacks {
  /** Lobby/transport events: 'roster' | 'start' | 'end' | 'status' */
  onRoster?: (roster: RosterEntry[]) => void;
  onStart?: () => void;
  onEnd?: (reason: string) => void;
  onStatus?: (state: 'connecting' | 'live' | 'error', message?: string) => void;
  /** Round-trip time in ms, measured by the heartbeat (guests only). */
  onPing?: (ms: number) => void;
  /** Everything the game itself puts on the wire. */
  onData?: (type: string, payload: Record<string, unknown>, from: string) => void;
}

const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.services.mozilla.com'] },
  ],
};

const rnd = () => Math.random().toString(36).slice(2, 9);

export function makeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

interface Link {
  id: string;
  send: (raw: Raw) => void;
  close: () => void;
}

export class Session {
  kind: 'net' | 'local' = 'net';
  selfId = rnd();
  roster: RosterEntry[] = [];
  /** Last measured round-trip time in milliseconds. */
  ping = 0;
  private links = new Map<string, Link>();
  private peer: Peer | null = null;
  private chan: BroadcastChannel | null = null;
  private beat: number | null = null;
  private lastHeard = new Map<string, number>();
  private disposed = false;
  private pendingReady = false;

  constructor(
    readonly role: 'host' | 'guest',
    readonly code: string,
    readonly name: string,
    private cb: SessionCallbacks = {},
  ) {}

  get isHost() { return this.role === 'host'; }
  get partnerCount() { return this.roster.filter((r) => r.id !== this.selfId).length; }

  /* ------------------------------------------------ public */

  static async connect(
    role: 'host' | 'guest',
    code: string,
    name: string,
    cb: SessionCallbacks = {},
    timeoutMs = 14000,
  ): Promise<Session> {
    const s = new Session(role, code, name, cb);
    const webrtc = typeof window !== 'undefined'
      && (Boolean((window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection)
        || Boolean((window as unknown as { webkitRTCPeerConnection?: unknown }).webkitRTCPeerConnection));
    try {
      if (webrtc) {
        await s.openNet(timeoutMs);
      } else {
        throw new Error('no-webrtc');
      }
    } catch (err) {
      // Broker unreachable / WebRTC blocked — same-browser play still works.
      try {
        s.teardown(true);
        await s.openLocal();
      } catch {
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
    s.startHeartbeat();
    return s;
  }

  send(type: string, payload: Record<string, unknown> = {}, to: string | null = null) {
    if (this.disposed) return;
    const raw: Raw = { k: type, d: payload, to, from: this.selfId };
    if (this.chan) {
      try { this.chan.postMessage(raw); } catch { /* ignore */ }
      return;
    }
    if (this.isHost) {
      for (const [, link] of this.links) {
        if (to && to !== link.id) continue;
        link.send(raw);
      }
    } else {
      this.links.get('host')?.send(raw);
    }
  }

  broadcast(type: string, payload: Record<string, unknown> = {}) { this.send(type, payload); }

  setReady(ready: boolean) {
    this.pendingReady = ready;
    if (this.isHost) {
      this.patchSelf({ ready });
      this.pushRoster();
    } else {
      this.send('ready', { ready });
    }
  }

  startRun() {
    if (!this.isHost) return;
    this.pushRoster();
    this.send('start', {});
  }

  close() {
    this.send('bye', {});
    this.teardown(false);
  }

  /* ------------------------------------------------ WebRTC */

  private async openNet(timeoutMs: number) {
    this.kind = 'net';
    // Extra public STUN servers meaningfully improve NAT traversal odds.
    const peer = this.isHost
      ? new Peer(PEER_PREFIX + this.code, { debug: 0, config: ICE })
      : new Peer({ debug: 0, config: ICE });
    this.peer = peer;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Signalling server unreachable'));
      }, timeoutMs);

      const hostId = PEER_PREFIX + this.code;
      peer.on('open', (openId: string) => {
        this.selfId = openId;
        if (this.isHost) {
          this.seedHostRoster();
        } else {
          this.links.set('host', this.wrapConn(peer.connect(hostId, { reliable: true, serialization: 'json' })));
        }
        settled = true;
        window.clearTimeout(timer);
        this.cb.onStatus?.('live');
        resolve();
      });

      peer.on('error', (err: { type?: string; message?: string }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(new Error(err?.type === 'unavailable-id' ? 'Lobby code already in use' : (err?.message || 'WebRTC error')));
      });

      if (this.isHost) {
        peer.on('connection', (conn: DataConnection) => this.hostAccept(conn));
      } else {
        peer.on('connection', (conn: DataConnection) => conn.close());
        // Surface late-arriving broker errors (peer-unavailable etc.) after open.
        peer.on('error', (err: { type?: string }) => {
          if (err?.type === 'peer-unavailable') this.cb.onStatus?.('error', 'Lobby not found');
        });
      }
    });

    peer.on('disconnected', () => {
      if (this.disposed) return;
      try { peer.reconnect(); } catch { /* ignore */ }
    });
    peer.on('close', () => { if (!this.disposed) this.cb.onStatus?.('error', 'Connection closed'); });
  }

  private hostAccept(conn: DataConnection) {
    const link = this.wrapConn(conn);
    conn.on('open', () => {
      this.links.set(conn.peer, link);
    });
    conn.on('close', () => this.dropGuest(conn.peer));
    conn.on('error', () => this.dropGuest(conn.peer));
  }

  private wrapConn(conn: DataConnection): Link {
    conn.on('data', (data: unknown) => this.receive(data as Raw, conn.peer));
    return {
      id: conn.peer,
      send: (raw) => {
        try {
          if (conn.open) conn.send(raw);
        } catch { /* channel closing */ }
      },
      close: () => { try { conn.close(); } catch { /* ignore */ } },
    };
  }

  /* ------------------------------------------------ BroadcastChannel */

  private async openLocal() {
    this.kind = 'local';
    const chan = new BroadcastChannel(LOCAL_PREFIX + this.code);
    this.chan = chan;
    chan.onmessage = (event: MessageEvent) => this.receive(event.data as Raw, (event.data as Raw)?.from);

    this.seedHostRoster();
    if (this.isHost) return;

    // Guest: announce ourselves and wait for the host's roster.
    let waited = 0;
    const hello = () => {
      if (this.disposed || this.roster.length) return;
      this.send('hello', { name: this.name, ready: this.pendingReady });
      waited += 1;
      if (waited < 30) window.setTimeout(hello, 200);
      else this.cb.onStatus?.('error', 'Lobby not found');
    };
    await new Promise<void>((resolve) => {
      const check = window.setInterval(() => {
        if (this.roster.length || waited >= 30) { window.clearInterval(check); resolve(); }
      }, 120);
      hello();
    });
  }

  /* ------------------------------------------------ shared plumbing */

  private seedHostRoster() {
    if (!this.isHost) return;
    this.roster = [{
      id: this.selfId, name: this.name, ready: true, host: true,
      color: PEER_COLORS[0],
    }];
    this.cb.onRoster?.(this.roster);
  }

  private patchSelf(next: Partial<RosterEntry>) {
    this.roster = this.roster.map((r) => (r.id === this.selfId ? { ...r, ...next } : r));
  }

  private receive(data: unknown, fallbackFrom: string) {
    const raw = data as Raw;
    if (!raw || typeof raw.k !== 'string') return;
    const from = raw.from || fallbackFrom;
    if (from === this.selfId) return;
    if (raw.to && raw.to !== this.selfId && !(this.isHost && raw.to === 'host')) return;
    this.lastHeard.set(from, Date.now());

    switch (raw.k) {
      case 'hello': {
        if (!this.isHost) return;
        if (!this.roster.some((r) => r.id === from)) {
          if (this.roster.length >= MAX_PLAYERS) {
            this.send('full', {}, from);
            return;
          }
          const d = (raw.d || {}) as { name?: string };
          this.roster = [...this.roster, {
            id: from,
            name: String(d.name || 'PLAYER').slice(0, 14),
            ready: false,
            host: false,
            color: PEER_COLORS[this.roster.length % PEER_COLORS.length],
          }];
          this.cb.onRoster?.(this.roster);
          this.pushRoster();
        } else {
          this.pushRoster();
        }
        return;
      }
      case 'ready': {
        if (!this.isHost) return;
        const d = (raw.d || {}) as { ready?: boolean };
        this.roster = this.roster.map((r) => (r.id === from ? { ...r, ready: Boolean(d.ready) } : r));
        this.cb.onRoster?.(this.roster);
        this.pushRoster();
        return;
      }
      case 'roster': {
        if (this.isHost) return;
        const d = (raw.d || {}) as { list?: RosterEntry[] };
        if (Array.isArray(d.list)) {
          this.roster = d.list;
          this.cb.onRoster?.(this.roster);
          if (!this.links.get('host')) this.links.set('host', { id: 'host', send: () => {}, close: () => {} });
        }
        return;
      }
      case 'full': {
        if (!this.isHost) this.cb.onStatus?.('error', 'Lobby is full');
        return;
      }
      case 'start': {
        if (this.isHost) return;
        this.cb.onStart?.();
        return;
      }
      case 'end': {
        this.cb.onEnd?.('host-ended');
        return;
      }
      case 'bye': {
        if (this.isHost) this.dropGuest(from);
        else this.cb.onEnd?.('partner-left');
        return;
      }
      case 'ping': {
        // The host answers the heartbeat so guests can read their real ping.
        if (!this.isHost) return;
        const ts = (raw.d as { ts?: number } | undefined)?.ts;
        if (typeof ts === 'number') this.send('pong', { ts }, from);
        return;
      }
      case 'pong': {
        const ts = (raw.d as { ts?: number } | undefined)?.ts;
        if (typeof ts === 'number') this.ping = Math.max(0, Date.now() - ts);
        this.cb.onPing?.(this.ping);
        return;
      }
      default:
        this.cb.onData?.(raw.k, (raw.d || {}) as Record<string, unknown>, from);
    }
  }

  pushRoster() {
    if (!this.isHost) return;
    this.send('roster', { list: this.roster });
  }

  private dropGuest(id: string) {
    if (!this.isHost) return;
    this.links.delete(id);
    this.lastHeard.delete(id);
    if (!this.roster.some((r) => r.id === id)) return;
    this.roster = this.roster.filter((r) => r.id !== id);
    this.cb.onRoster?.(this.roster);
    this.pushRoster();
  }

  private startHeartbeat() {
    this.beat = window.setInterval(() => {
      this.send('ping', { ts: Date.now() });
      if (!this.isHost) {
        // A quiet host means the connection died.
        const last = this.lastHeard.get('host') ?? Math.max(...[...this.lastHeard.values()], 0);
        if (Date.now() - last > 12000) this.cb.onStatus?.('error', 'Lost the host');
        return;
      }
      const now = Date.now();
      for (const [id, seen] of [...this.lastHeard]) {
        if (id !== this.selfId && now - seen > 12000) this.dropGuest(id);
      }
    }, 2500);
  }

  private teardown(keepSession: boolean) {
    if (this.beat !== null) { window.clearInterval(this.beat); this.beat = null; }
    for (const [, link] of this.links) link.close();
    this.links.clear();
    try { this.chan?.close(); } catch { /* ignore */ }
    this.chan = null;
    if (!keepSession) {
      try { this.peer?.destroy(); } catch { /* ignore */ }
      this.peer = null;
      this.disposed = true;
    }
  }
}
