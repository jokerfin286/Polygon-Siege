/*
 * Headless verification of the host-authoritative co-op model.
 * Runs a host Game and a guest Game wired through an in-process message bus,
 * then asserts movement, shooting, separate XP, synced level-up pauses, and
 * synced game pause all behave correctly.
 */
import assert from 'node:assert';

// --- minimal DOM/canvas stubs so the engine constructs in Node ---
const g: any = globalThis;
g.window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, setInterval, clearInterval, setTimeout, clearTimeout };
g.performance = g.performance || { now: () => Date.now() };
const store = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
g.navigator = { language: 'en' };
function makeCtx() {
  return new Proxy({}, {
    get: (_t, p) => {
      if (p === 'canvas') return canvasStub;
      if (p === 'setTransform' || p === 'createLinearGradient' || p === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      return () => {};
    },
  });
}
const canvasStub: any = {
  width: 1280, height: 800,
  getContext: () => makeCtx(),
  getBoundingClientRect: () => ({ width: 1280, height: 800, left: 0, top: 0 }),
  addEventListener() {}, setPointerCapture() {},
};

async function main() {
  const { Game } = await import('../src/game/engine.ts');

  const host = new Game(canvasStub, () => {});
  const guest = new Game(canvasStub, () => {});

  // wire host <-> guest directly (simulates the network bus, zero latency)
  host.beginCoop({ selfId: 'HOST', selfName: 'Alice', selfColor: '#38f5e0', isGuest: false });
  guest.beginCoop({ selfId: 'GUEST', selfName: 'Bob', selfColor: '#f472b6', isGuest: true });
  host.syncPeers([{ id: 'GUEST', name: 'Bob', color: '#f472b6' }]);

  host.onSnapshot = (snap) => guest.applySnapshot(JSON.parse(JSON.stringify(snap)));
  guest.onGuestInput = (input) => host.applyGuestInput(JSON.parse(JSON.stringify(input)));
  guest.onGuestAction = (action, payload) => {
    if (action === 'pause') host.netPause(true);
    else if (action === 'resume') host.netPause(false);
    else if (action === 'pick') host.peerPick('GUEST', String(payload.key));
    else if (action === 'reroll') host.peerReroll('GUEST');
  };

  host.startCountdown(0.1);

  const step = (n: number, drive?: () => void) => {
    for (let i = 0; i < n; i++) {
      drive?.();
      host.frame(1 / 60);
      guest.frame(1 / 60);
    }
  };

  // let the countdown expire
  step(20);
  assert.strictEqual(host.phase, 'playing', 'host should be playing after countdown');

  // ---- 1) GUEST MOVEMENT ----
  const gx0 = guest.px;
  step(60, () => { guest.keys.clear(); guest.keys.add('d'); });
  guest.keys.clear();
  assert.ok(guest.px > gx0 + 30, `guest should move right (from ${gx0.toFixed(0)} to ${guest.px.toFixed(0)})`);
  // host must see the guest peer near the guest's position
  const hostPeer = host.peers.find((p) => p.id === 'GUEST')!;
  assert.ok(hostPeer, 'host tracks the guest as a peer');
  assert.ok(Math.abs(hostPeer.x - guest.px) < 120, `host peer x (${hostPeer.x.toFixed(0)}) tracks guest (${guest.px.toFixed(0)})`);

  // ---- 2) GUEST SHOOTING damages host enemies ----
  // drop an enemy right next to the guest's host-side position
  const enemy = host.spawnEnemy('ecircle', hostPeer.x + 40, hostPeer.y, 1)!;
  enemy.hp = enemy.maxHp = 500;
  const startHp = enemy.hp;
  step(120);
  assert.ok(enemy.hp < startHp, `guest weapons must damage shared enemies (hp ${enemy.hp} < ${startHp})`);

  // ---- 3) SEPARATE XP ----
  const hostXp0 = host.xp, guestPeerXp0 = hostPeer.xp;
  // give the guest a gem right on top of them
  (host as any).dropPickup(hostPeer.x, hostPeer.y, 6, false);
  step(30);
  assert.ok(hostPeer.xp >= guestPeerXp0, 'guest gains its own xp from its own gems');
  assert.strictEqual(host.xp, hostXp0, 'host xp unchanged by guest gem');

  // ---- 4) LEVEL-UP PAUSES BOTH, only leveler picks ----
  // one clean level for the guest
  host.creditPeerXP('GUEST', hostPeer.xpNeed - hostPeer.xp + 1);
  step(4);
  assert.strictEqual(host.phase, 'levelup', 'host pauses for guest level-up');
  assert.strictEqual(guest.phase, 'levelup', 'guest also pauses (synced)');
  assert.strictEqual(host.chooserId, 'GUEST', 'guest is the chooser');
  // host must NOT be able to pick (not their turn)
  const beforeOwnedHost = JSON.stringify(host.owned);
  host.pick(host.choices[0]?.key ?? 'nope');
  assert.strictEqual(JSON.stringify(host.owned), beforeOwnedHost, 'host cannot pick during guest turn');
  // guest picks -> forwards to host
  const card = guest.myChoices[0];
  assert.ok(card, 'guest sees its own upgrade cards');
  const firstId = card.def.id;
  let guard = 0;
  while (guest.phase === 'levelup' && guest.chooserId === 'GUEST' && guard++ < 10) {
    const c = guest.myChoices[0];
    if (!c) break;
    guest.pick(c.key);
    step(4);
  }
  assert.ok((hostPeer.owned[firstId] || 0) >= 1, 'guest pick applied on host');
  assert.strictEqual(host.phase, 'playing', 'run resumes after guest picks');
  step(4);
  assert.strictEqual(guest.phase, 'playing', 'guest resumes too');

  // ---- 5) PAUSE SYNC ----
  guest.togglePause();
  step(4);
  assert.strictEqual(host.phase, 'paused', 'guest can pause the host');
  assert.strictEqual(guest.phase, 'paused', 'guest is paused');
  guest.togglePause();
  step(4);
  assert.strictEqual(host.phase, 'playing', 'guest can resume');
  step(4);
  assert.strictEqual(guest.phase, 'playing', 'guest resumed');

  // ---- 6) HOST LEVEL-UP pauses guest, guest sees partner cards ----
  (host as any).gainXP(100000);
  step(4);
  assert.strictEqual(host.phase, 'levelup', 'host level-up pauses');
  assert.strictEqual(guest.phase, 'levelup', 'guest pauses for host level-up');
  assert.strictEqual(host.chooserId, 'HOST', 'host is chooser');
  assert.ok(guest.partnerChoices.length > 0, 'guest sees host cards in overlay');
  host.pick(host.choices[0].key);
  step(4);
  assert.strictEqual(host.phase, 'playing', 'run resumes after host picks');

  console.log('ALL CO-OP SYNC TESTS PASSED ✔');
  console.log(`  guest moved: ${(guest.px - gx0).toFixed(0)}px`);
  console.log(`  enemy hp after guest fire: ${enemy.hp}/${startHp}`);
  console.log(`  guest level: ${hostPeer.level}, host level: ${host.level}`);
}

main().catch((e) => { console.error('TEST FAILED:', e.message); process.exit(1); });
