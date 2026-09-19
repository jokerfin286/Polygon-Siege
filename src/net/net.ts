/* ============================================================
   Global Internet & Local Multiplayer Transport for Polygon Siege.

   Connects players across the internet using standard Secure WebSockets (WSS)
   via public global brokers (EMQX & HiveMQ), with fallback to BroadcastChannel
   for instant same-browser tabs. Zero configuration, works across any device,
   browser, mobile data, Wi-Fi, and firewalls worldwide.
   ============================================================ */

export interface NetMsg {
  type: string;
  from: string;
  _mid?: string;
  [key: string]: unknown;
}

export const LOBBY_TOPIC = 'polygon-siege-lobby-v3';
export const LOBBY_ROOM_CODE = 'POLYGON_SIEGE_GLOBAL_LOBBY';
export const runTopic = (code: string) => `polygon-siege/v3/${code.toUpperCase()}`;

export function makeId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export function makeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

type Handler = (msg: NetMsg) => void;

const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeMqttString(str: string): Uint8Array {
  const bytes = encoder.encode(str);
  const out = new Uint8Array(bytes.length + 2);
  out[0] = (bytes.length >> 8) & 0xff;
  out[1] = bytes.length & 0xff;
  out.set(bytes, 2);
  return out;
}

function encodeMqttLength(len: number): number[] {
  const bytes: number[] = [];
  do {
    let b = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) b |= 0x80;
    bytes.push(b);
  } while (len > 0);
  return bytes;
}

function concatUint8(arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

export class Bus {
  readonly id = makeId();
  private bc: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private handler: Handler | null = null;
  private closed = false;
  private wsConnected = false;
  private seenMids = new Set<string>();
  private packetId = 1;
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private brokerIndex = 0;
  readonly topic: string;

  constructor(readonly roomCode: string) {
    this.topic = runTopic(roomCode);

    // 1. BroadcastChannel for zero-latency local testing in same browser
    try {
      this.bc = new BroadcastChannel('ps-' + roomCode.toUpperCase());
      this.bc.onmessage = (event: MessageEvent) => {
        const msg = event.data as NetMsg;
        this.processIncoming(msg);
      };
    } catch {
      this.bc = null;
    }

    // 2. Global WebSocket connection for worldwide internet play
    this.connectWs();
  }

  get supported() {
    return true; // Always supported via WebSocket in any modern browser
  }

  get isOnline() {
    return this.wsConnected;
  }

  private connectWs() {
    if (this.closed || typeof WebSocket === 'undefined') return;

    const url = BROKERS[this.brokerIndex % BROKERS.length];

    try {
      this.ws = new WebSocket(url, 'mqtt');
      this.ws.binaryType = 'arraybuffer';
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      // Send MQTT 3.1.1 CONNECT packet
      const proto = encodeMqttString('MQTT');
      const varHeader = new Uint8Array([0x04, 0x02, 0x00, 0x3c]); // level 4, clean session, 60s keepalive
      const cid = encoder.encode('ps-' + this.id + '-' + Math.random().toString(36).slice(2, 6));
      const cidField = new Uint8Array(cid.length + 2);
      cidField[0] = (cid.length >> 8) & 0xff;
      cidField[1] = cid.length & 0xff;
      cidField.set(cid, 2);

      const body = concatUint8([proto, varHeader, cidField]);
      const lenBytes = new Uint8Array(encodeMqttLength(body.length));
      const pkt = concatUint8([new Uint8Array([0x10]), lenBytes, body]);

      try {
        this.ws?.send(pkt.buffer);
      } catch {}
    };

    this.ws.onmessage = (evt: MessageEvent) => {
      const buf = new Uint8Array(evt.data as ArrayBuffer);
      if (!buf || buf.length < 2) return;
      const type = buf[0] >> 4;

      if (type === 2) {
        // CONNACK (0x20)
        this.wsConnected = true;
        this.subscribeTopic(this.topic);
        this.startPing();
      } else if (type === 3) {
        // PUBLISH (0x30)
        let offset = 1;
        while (buf[offset] & 0x80) offset++;
        offset++; // past remaining length
        if (offset + 2 > buf.length) return;
        const topicLen = (buf[offset] << 8) | buf[offset + 1];
        offset += 2 + topicLen;
        if (offset > buf.length) return;

        try {
          const payloadStr = decoder.decode(buf.subarray(offset));
          const msg = JSON.parse(payloadStr) as NetMsg;
          this.processIncoming(msg);
        } catch {}
      }
    };

    this.ws.onerror = () => {
      // Handled by onclose
    };

    this.ws.onclose = () => {
      this.wsConnected = false;
      this.stopPing();
      this.scheduleReconnect();
    };
  }

  private subscribeTopic(topic: string) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const topicField = encodeMqttString(topic);
    const pid = new Uint8Array([(this.packetId >> 8) & 0xff, this.packetId & 0xff]);
    this.packetId = (this.packetId + 1) & 0xffff;
    const body = concatUint8([pid, topicField, new Uint8Array([0x00])]); // QoS 0
    const lenBytes = new Uint8Array(encodeMqttLength(body.length));
    const pkt = concatUint8([new Uint8Array([0x82]), lenBytes, body]);
    try {
      this.ws.send(pkt.buffer);
    } catch {}
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = (setInterval as unknown as typeof window.setInterval)(() => {
      if (this.ws && this.ws.readyState === 1) {
        try {
          // MQTT PINGREQ (0xc0, 0x00)
          this.ws.send(new Uint8Array([0xc0, 0x00]).buffer);
        } catch {}
      }
    }, 28000);
  }

  private stopPing() {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.closed || this.reconnectTimer !== null) return;
    this.reconnectTimer = (setTimeout as unknown as typeof window.setTimeout)(() => {
      this.reconnectTimer = null;
      this.brokerIndex++;
      this.connectWs();
    }, 2500);
  }

  private processIncoming(msg: NetMsg) {
    if (!msg || typeof msg.type !== 'string' || msg.from === this.id) return;
    if (msg._mid) {
      if (this.seenMids.has(msg._mid)) return;
      this.seenMids.add(msg._mid);
      if (this.seenMids.size > 800) {
        const first = this.seenMids.values().next().value;
        if (first) this.seenMids.delete(first);
      }
    }
    this.handler?.(msg);
  }

  on(handler: Handler) {
    this.handler = handler;
  }

  send(type: string, payload: Record<string, unknown> = {}) {
    if (this.closed) return;
    const mid = this.id + '-' + (++this.packetId) + '-' + Date.now();
    const msg: NetMsg = { type, from: this.id, _mid: mid, ...payload };

    // 1. Send locally over BroadcastChannel
    try {
      this.bc?.postMessage(msg);
    } catch {}

    // 2. Send globally over WebSocket MQTT
    if (this.wsConnected && this.ws && this.ws.readyState === 1) {
      try {
        const topicField = encodeMqttString(this.topic);
        const payloadStr = JSON.stringify(msg);
        const payloadBytes = encoder.encode(payloadStr);
        const body = concatUint8([topicField, payloadBytes]);
        const lenBytes = new Uint8Array(encodeMqttLength(body.length));
        const pkt = concatUint8([new Uint8Array([0x30]), lenBytes, body]);
        this.ws.send(pkt.buffer);
      } catch {}
    }
  }

  close() {
    this.closed = true;
    this.stopPing();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.bc?.close();
    } catch {}
    this.bc = null;

    try {
      if (this.ws) {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      }
    } catch {}
    this.ws = null;
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

export const PEER_COLORS = ['#38f5e0', '#f472b6', '#fbbf24', '#a78bfa'];
