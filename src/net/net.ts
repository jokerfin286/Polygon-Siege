/* ============================================================
   Peer-to-peer co-op networking (WebRTC data channels).

   No dedicated game server is available in this static build, so
   connections are established with copy/paste signalling codes:
   the host generates an "offer" code, each guest turns it into an
   "answer" code, and the host pastes those back. Once connected,
   all game traffic flows over an ordered RTCDataChannel.

   The host is authoritative: it runs the whole simulation and
   streams a compact world snapshot ~20x/sec. Guests only send
   their input (movement, dash, ready, upgrade pick).
============================================================ */

export type NetRole = 'host' | 'guest';

export type NetMessage =
  // guest -> host
  | { t: 'hello'; name: string; color: string }
  | { t: 'input'; mx: number; my: number; dash: boolean; aim: number }
  | { t: 'ready'; ready: boolean }
  | { t: 'pick'; key: string }
  | { t: 'reroll' }
  // host -> guest
  | { t: 'lobby'; players: LobbyPlayerNet[]; hostName: string }
  | { t: 'countdown'; value: number }
  | { t: 'snapshot'; data: Snapshot }
  | { t: 'levelup'; slot: number; name: string; choices: NetChoice[]; rerolls: number }
  | { t: 'levelupEnd' }
  | { t: 'gameover'; snapshot: Snapshot }
  | { t: 'toMenu' };

export interface LobbyPlayerNet {
  slot: number;
  name: string;
  color: string;
  ready: boolean;
  isHost: boolean;
}

export interface NetChoice {
  key: string;
  name: string;
  desc: string;
  rarity: number;
  kind: string;
  icon: string;
  level: number;
  max: number;
  weapon?: string;
  shape?: string;
}

/* Compact snapshot streamed from host to guests. Kept lean so it
   fits comfortably in a data-channel message every 50ms. */
export interface SnapMate {
  slot: number;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shape: string;
  color: string;
  alive: boolean;
  level: number;
  xp: number;
  xpNeed: number;
  invuln: number;
  aim: number;
  shield: number;
}

export interface SnapEntity {
  x: number; y: number; r: number; sides: number; c: string; rot: number; kind: number;
}

export interface Snapshot {
  t: number;
  worldW: number;
  worldH: number;
  theme: string;
  mates: SnapMate[];
  enemies: SnapEntity[];
  projs: SnapEntity[];
  ebullets: SnapEntity[];
  pickups: { x: number; y: number; heal: boolean; big: boolean }[];
  banner: string;
  bannerT: number;
  wave: number;
  score: number;
  boss?: { name: string; hp: number; maxHp: number; color: string; phase: number };
  flash?: { color: string; power: number };
  shake: number;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/* Signalling payloads are base64-encoded JSON so they are easy to
   copy/paste. They bundle the SDP with pre-gathered ICE candidates. */
function encodeSignal(obj: unknown): string {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  } catch {
    return JSON.stringify(obj);
  }
}
export function decodeSignal<T>(code: string): T | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(trimmed)))) as T;
  } catch {
    try { return JSON.parse(trimmed) as T; } catch { return null; }
  }
}

function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const done = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', done);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', done);
    // Fallback: don't wait forever for a trickling candidate.
    setTimeout(resolve, 2500);
  });
}

/* ---------------- Host side: one connection per guest ---------------- */

export interface HostConnection {
  slot: number;
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  offerCode: string;
  connected: boolean;
}

export class HostNet {
  conns: HostConnection[] = [];
  onMessage: (slot: number, msg: NetMessage) => void = () => {};
  onOpen: (slot: number) => void = () => {};
  onClose: (slot: number) => void = () => {};

  /** Create a fresh invite (offer) for the next guest slot. */
  async createInvite(slot: number): Promise<HostConnection> {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const channel = pc.createDataChannel('game', { ordered: true });
    const conn: HostConnection = { slot, pc, channel, offerCode: '', connected: false };
    this.wireChannel(conn, channel);
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && conn.connected) {
        conn.connected = false;
        this.onClose(slot);
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIce(pc);
    conn.offerCode = encodeSignal(pc.localDescription);
    this.conns.push(conn);
    return conn;
  }

  /** Complete the handshake with a guest's answer code. */
  async acceptAnswer(slot: number, answerCode: string): Promise<boolean> {
    const conn = this.conns.find((c) => c.slot === slot);
    if (!conn) return false;
    const answer = decodeSignal<RTCSessionDescriptionInit>(answerCode);
    if (!answer || answer.type !== 'answer') return false;
    try {
      await conn.pc.setRemoteDescription(answer);
      return true;
    } catch {
      return false;
    }
  }

  private wireChannel(conn: HostConnection, channel: RTCDataChannel) {
    channel.onopen = () => { conn.connected = true; this.onOpen(conn.slot); };
    channel.onclose = () => { if (conn.connected) { conn.connected = false; this.onClose(conn.slot); } };
    channel.onmessage = (e) => {
      const msg = safeParse(e.data);
      if (msg) this.onMessage(conn.slot, msg);
    };
  }

  send(slot: number, msg: NetMessage) {
    const conn = this.conns.find((c) => c.slot === slot);
    if (conn?.channel && conn.channel.readyState === 'open') {
      try { conn.channel.send(JSON.stringify(msg)); } catch { /* ignore */ }
    }
  }

  broadcast(msg: NetMessage) {
    const data = JSON.stringify(msg);
    for (const conn of this.conns) {
      if (conn.channel?.readyState === 'open') {
        try { conn.channel.send(data); } catch { /* ignore */ }
      }
    }
  }

  dropSlot(slot: number) {
    const conn = this.conns.find((c) => c.slot === slot);
    if (conn) {
      try { conn.channel?.close(); conn.pc.close(); } catch { /* ignore */ }
      this.conns = this.conns.filter((c) => c.slot !== slot);
    }
  }

  close() {
    for (const conn of this.conns) {
      try { conn.channel?.close(); conn.pc.close(); } catch { /* ignore */ }
    }
    this.conns = [];
  }
}

/* ---------------- Guest side: single connection to host ---------------- */

export class GuestNet {
  pc: RTCPeerConnection | null = null;
  channel: RTCDataChannel | null = null;
  onMessage: (msg: NetMessage) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};

  /** Consume the host's invite code and produce an answer code. */
  async createAnswer(offerCode: string): Promise<string | null> {
    const offer = decodeSignal<RTCSessionDescriptionInit>(offerCode);
    if (!offer || offer.type !== 'offer') return null;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pc = pc;
    pc.ondatachannel = (e) => this.wireChannel(e.channel);
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) this.onClose();
    };
    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIce(pc);
      return encodeSignal(pc.localDescription);
    } catch {
      return null;
    }
  }

  private wireChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => this.onOpen();
    channel.onclose = () => this.onClose();
    channel.onmessage = (e) => {
      const msg = safeParse(e.data);
      if (msg) this.onMessage(msg);
    };
  }

  send(msg: NetMessage) {
    if (this.channel?.readyState === 'open') {
      try { this.channel.send(JSON.stringify(msg)); } catch { /* ignore */ }
    }
  }

  close() {
    try { this.channel?.close(); this.pc?.close(); } catch { /* ignore */ }
    this.channel = null;
    this.pc = null;
  }
}

function safeParse(data: unknown): NetMessage | null {
  if (typeof data !== 'string') return null;
  try { return JSON.parse(data) as NetMessage; } catch { return null; }
}
