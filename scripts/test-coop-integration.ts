import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener() {}, setInterval() { return 0; }, clearInterval() {},
  setTimeout() { return 0; }, clearTimeout() {},
};
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as unknown as { navigator: unknown }).navigator = { language: 'en' };
const ctxStub = new Proxy({}, { get: () => () => {} });
function makeCanvas() {
  return {
    width: 1280, height: 720, getContext: () => ctxStub,
    getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }),
    addEventListener() {}, setPointerCapture() {},
  } as unknown as HTMLCanvasElement;
}

async function main() {
  const { Game } = await import('../src/game/engine.ts');

  const host = new Game(makeCanvas(), () => {});
  const guest = new Game(makeCanvas(), () => {});

  // Wire the two engines directly to each other (no real network needed).
  host.beginCoop({ selfId: 'H', selfName: 'Host', selfColor: '#38f5e0', isGuest: false });
  guest.beginCoop({ selfId: 'G', selfName: 'Guest', selfColor: '#f472b6', isGuest: true });

  host.onSnapshot = (snap) => guest.applySnapshot(JSON.parse(JSON.stringify(snap)));
  guest.onGuestSync = (sync) => host.updatePeerFromNet(JSON.parse(JSON.stringify(sync)));
  guest.onDamageEnemyNet = (id, dmg, crit, kx, ky) => host.applyNetHit(id, dmg, crit, kx, ky);

  host.startCountdown(0);

  // Run ~30s of co-op with the guest kiting and shooting.
  let guestKills = 0;
  let sawEnemiesOnGuest = false;
  let sawGuestPeerOnHost = false;
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 30; i++) {
    // Guest wanders so its position changes and enemies chase it too.
    guest.keys.clear();
    guest.keys.add(i % 120 < 60 ? 'd' : 'a');

    host.frame(dt);
    guest.frame(dt);

    if (guest.enemies.some((e) => e.active)) sawEnemiesOnGuest = true;
    if (host.peers.some((p) => p.id === 'G')) sawGuestPeerOnHost = true;
    guestKills = guest.kills;

    // Auto-resolve any level-up the host raises so the sim keeps moving.
    if (host.phase === 'levelup' && host.choices.length) {
      host.pick(host.choices[0].key);
    }
  }

  assert.ok(sawEnemiesOnGuest, 'guest must see enemies streamed from host');
  assert.ok(sawGuestPeerOnHost, 'host must track the guest as a partner');
  assert.ok(host.score > 0, 'host should be scoring kills');
  // The guest fires locally and forwards hits, so the shared score climbs.
  assert.ok(host.kills > 0, 'combined fire should be killing enemies');
  console.log(`PASS 30s host+guest co-op ran cleanly (host kills=${host.kills}, guest sees enemies=${sawEnemiesOnGuest})`);

  // The guest position the host tracks should follow the guest's real position.
  const gPeer = host.peers.find((p) => p.id === 'G')!;
  const drift = Math.hypot(gPeer.x - guest.px, gPeer.y - guest.py);
  assert.ok(drift < 160, `host's view of guest should track within ~160px (was ${drift.toFixed(0)})`);
  console.log(`PASS Host tracks guest position accurately (drift=${drift.toFixed(0)}px)`);

  void guestKills;
  console.log('\nIntegration co-op check passed.');
}

main().catch((err) => { console.error(err); process.exit(1); });
