/* ============================================================
   Cooperative multiplayer transport.

   The game ships as one self-contained HTML file, so there is no
   server to talk to. Everything runs over BroadcastChannel, which
   reaches other tabs/windows of the same browser (and other
   browsers on the same machine). The host tab owns the simulation;
   guest tabs send input and render authoritative snapshots.

   Topics:
     lobby  — "polygon-siege-lobby"  (discovery, rosters, ready)
     run    — "polygon-siege-run:<code>" (snapshots + input)
   ============================================================ */

export interface NetMsg {
  type: string;
  from: string;
  [key: string]: unknown;
}

export const LOBBY_TOPIC = 'polygon-siege-lobby';
export const runTopic = (code: string) => `polygon-siege-run:${code}`;

export function makeId(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 5);
}

export function makeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

type Handler = (msg: NetMsg) => void;

export class Bus {
  readonly id = makeId();
  private channel: BroadcastChannel | null = null;
  private handler: Handler | null = null;
  private closed = false;

  constructor(readonly topic: string) {
    try {
      this.channel = new BroadcastChannel(topic);
      this.channel.onmessage = (event: MessageEvent) => {
        const msg = event.data as NetMsg;
        if (!msg || typeof msg.type !== 'string' || msg.from === this.id) return;
        this.handler?.(msg);
      };
    } catch {
      this.channel = null; // unsupported — the game still works solo
    }
  }

  get supported() { return this.channel !== null; }

  on(handler: Handler) { this.handler = handler; }

  send(type: string, payload: Record<string, unknown> = {}) {
    if (this.closed || !this.channel) return;
    try {
      this.channel.postMessage({ type, from: this.id, ...payload } as NetMsg);
    } catch {
      /* payload not cloneable or channel gone — never break the run */
    }
  }

  close() {
    this.closed = true;
    try { this.channel?.close(); } catch { /* already closed */ }
    this.channel = null;
    this.handler = null;
  }
}

/* ---------------- lobby bookkeeping ---------------- */

export interface PeerInfo {
  id: string;
  name: string;
  ready: boolean;
  host: boolean;
  color: string;
  shape: string;
}

export interface Advert {
  code: string;
  hostName: string;
  count: number;
  max: number;
  busy: boolean;
  seen: number;
}

export const PEER_COLORS = ['#38f5e0', '#f472b6', '#fbbf24', '#a78bfa'];

/** Cheap throttle so the snapshot channel never floods. */
export class Throttle {
  private acc = 0;
  constructor(private interval: number) {}
  ready(dt: number) {
    this.acc += dt;
    if (this.acc < this.interval) return false;
    this.acc = 0;
    return true;
  }
  reset() { this.acc = 0; }
}
