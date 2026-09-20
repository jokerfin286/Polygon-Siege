import assert from 'node:assert/strict';

// Minimal DOM/canvas stubs so the engine can construct headlessly.
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
    width: 1280, height: 720,
    getContext: () => ctxStub,
    getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }),
    addEventListener() {}, setPointerCapture() {},
  } as unknown as HTMLCanvasElement;
}

async function main() {
  const { Game } = await import('../src/game/engine.ts');

  /* ---------- 1. Host death → downed spectator ---------- */
  {
    const host = new Game(makeCanvas(), () => {});
    host.beginCoop({ selfId: 'H', selfName: 'Host', selfColor: '#38f5e0', isGuest: false });
    // Inject a living partner so the run continues when the host falls.
    host.updatePeerFromNet({
      id: 'G', name: 'Guest', color: '#f472b6', shape: 'circle',
      x: 400, y: 400, vx: 0, vy: 0, aimA: 0, hp: 100, maxHp: 100, alive: true,
      level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, weapons: ['disc'],
    });

    host.hp = 5;
    host.invuln = 0;
    (host as unknown as { hurtPlayer(d: number, x: number, y: number): void }).hurtPlayer(999, host.px + 5, host.py);

    assert.equal(host.downed, true, 'host should be downed after fatal hit');
    assert.equal(host.phase, 'playing', 'run continues while a partner lives');

    // A downed host cannot gain score/XP or move meaningfully.
    const scoreBefore = host.score;
    const xpBefore = host.xp;
    host.keys.add('d');
    const startX = host.px;
    for (let i = 0; i < 120; i++) host.frame(1 / 60);
    assert.ok(Math.abs(host.px - startX) < 25, 'downed host does not run around');
    assert.equal(host.score, scoreBefore, 'downed host earns no score');
    assert.equal(host.xp, xpBefore, 'downed host earns no XP');

    // A downed host takes no further damage.
    const hpBefore = host.hp;
    (host as unknown as { hurtPlayer(d: number, x: number, y: number): void }).hurtPlayer(999, host.px, host.py);
    assert.equal(host.hp, hpBefore, 'downed host is immune to damage');

    // Reviving (e.g. after a boss) brings the host back to life.
    (host as unknown as { revivePeers(): void }).revivePeers();
    assert.equal(host.downed, false, 'revive clears downed');
    assert.ok(host.hp > 0, 'revive restores HP');
    console.log('PASS Host death enters spectator mode and revives correctly');
  }

  /* ---------- 2. Guest obeys host authority for its own death ---------- */
  {
    const guest = new Game(makeCanvas(), () => {});
    guest.beginCoop({ selfId: 'G', selfName: 'Guest', selfColor: '#f472b6', isGuest: true });
    guest.hp = 100;

    const base = {
      t: 0, elapsed: 5, wave: 1, score: 0, phase: 'playing' as const, countdown: 0,
      chooser: '', chooserName: '', banner: '', bannerT: 0,
      me: { x: 400, y: 400, hp: 100, maxHp: 100, level: 1, alive: true },
      enemies: [], hazards: [], ebullets: [], shots: [], gems: [],
    };

    // Host reports the guest is alive.
    guest.applySnapshot({ ...base, peers: [{ id: 'G', name: 'Guest', color: '#f472b6', x: 400, y: 400, vx: 0, vy: 0, hp: 100, maxHp: 100, alive: true, invuln: 0, level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, shape: 'circle', revived: 0 }, { id: 'H', name: 'Host', color: '#38f5e0', x: 500, y: 500, vx: 0, vy: 0, hp: 100, maxHp: 100, alive: true, invuln: 0, level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, shape: 'circle', revived: 0 }] } as never);
    assert.equal(guest.downed, false, 'guest starts alive');

    // Host reports the guest died.
    guest.applySnapshot({ ...base, peers: [{ id: 'G', name: 'Guest', color: '#f472b6', x: 400, y: 400, vx: 0, vy: 0, hp: 0, maxHp: 100, alive: false, invuln: 0, level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, shape: 'circle', revived: 0 }, { id: 'H', name: 'Host', color: '#38f5e0', x: 500, y: 500, vx: 0, vy: 0, hp: 100, maxHp: 100, alive: true, invuln: 0, level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, shape: 'circle', revived: 0 }] } as never);
    assert.equal(guest.downed, true, 'guest obeys host: downed when host says dead');

    // Host revives the guest.
    guest.applySnapshot({ ...base, peers: [{ id: 'G', name: 'Guest', color: '#f472b6', x: 400, y: 400, vx: 0, vy: 0, hp: 100, maxHp: 100, alive: true, invuln: 3, level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, shape: 'circle', revived: 3 }, { id: 'H', name: 'Host', color: '#38f5e0', x: 500, y: 500, vx: 0, vy: 0, hp: 100, maxHp: 100, alive: true, invuln: 0, level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, shape: 'circle', revived: 0 }] } as never);
    assert.equal(guest.downed, false, 'guest resurrects when host revives it');
    console.log('PASS Guest death and revival are host-authoritative');
  }

  /* ---------- 3. Guest interpolates enemy motion smoothly ---------- */
  {
    const guest = new Game(makeCanvas(), () => {});
    guest.beginCoop({ selfId: 'G', selfName: 'Guest', selfColor: '#f472b6', isGuest: true });

    const peer = { id: 'H', name: 'Host', color: '#38f5e0', x: 600, y: 600, vx: 0, vy: 0, hp: 100, maxHp: 100, alive: true, invuln: 0, level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, shape: 'circle', revived: 0 };
    const me = { id: 'G', name: 'Guest', color: '#f472b6', x: 400, y: 400, vx: 0, vy: 0, hp: 100, maxHp: 100, alive: true, invuln: 0, level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, shape: 'circle', revived: 0 };
    const enemyAt = (x: number) => ([{ id: 1, x, y: 300, r: 14, s: 3, hp: 20, maxHp: 20, rot: 0, col: '#ff5a5a', boss: false, frozen: 0, burn: 0, poison: 0 }]);
    const base = {
      t: 0, wave: 1, score: 0, phase: 'playing' as const, countdown: 0,
      chooser: '', chooserName: '', banner: '', bannerT: 0,
      me: { x: 400, y: 400, hp: 100, maxHp: 100, level: 1, alive: true },
      hazards: [], ebullets: [], shots: [], gems: [], peers: [me, peer],
    };

    // Two snapshots 0.05s apart: enemy moves from x=100 to x=200.
    guest.applySnapshot({ ...base, elapsed: 1.0, enemies: enemyAt(100) } as never);
    guest.frame(0.05);
    guest.applySnapshot({ ...base, elapsed: 1.05, enemies: enemyAt(200) } as never);

    // Step a few 60fps frames — the enemy should glide between 100 and 200,
    // producing intermediate positions rather than teleporting.
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) {
      guest.frame(1 / 60);
      const e = guest.enemies.find((en) => en.active && en.id === 1);
      if (e) seen.push(e.x);
    }
    const intermediate = seen.some((x) => x > 105 && x < 199);
    assert.ok(intermediate, `guest should interpolate enemy motion, saw: ${seen.map((n) => n.toFixed(0)).join(',')}`);
    console.log('PASS Guest smoothly interpolates world entities between snapshots');
  }

  /* ---------- 4. Guest forwards hits instead of mutating enemy HP ---------- */
  {
    const guest = new Game(makeCanvas(), () => {});
    let reported = 0;
    guest.beginCoop({ selfId: 'G', selfName: 'Guest', selfColor: '#f472b6', isGuest: true });
    guest.onDamageEnemyNet = () => { reported++; };
    const me = { id: 'G', name: 'Guest', color: '#f472b6', x: 400, y: 400, vx: 0, vy: 0, hp: 100, maxHp: 100, alive: true, invuln: 0, level: 1, xp: 0, xpNeed: 8, score: 0, kills: 0, shape: 'circle', revived: 0 };
    guest.applySnapshot({
      t: 0, elapsed: 1, wave: 1, score: 0, phase: 'playing', countdown: 0,
      chooser: '', chooserName: '', banner: '', bannerT: 0,
      me: { x: 400, y: 400, hp: 100, maxHp: 100, level: 1, alive: true },
      enemies: [{ id: 7, x: 410, y: 400, r: 40, s: 3, hp: 200, maxHp: 200, rot: 0, col: '#ff5a5a', boss: false, frozen: 0, burn: 0, poison: 0 }],
      hazards: [], ebullets: [], shots: [], gems: [], peers: [me],
    } as never);
    const enemy = guest.enemies.find((e) => e.active && e.id === 7)!;
    const hpBefore = enemy.hp;
    (guest as unknown as { damageEnemy(e: unknown, d: number, c: boolean, x: number, y: number): void }).damageEnemy(enemy, 50, false, 0, 0);
    assert.equal(enemy.hp, hpBefore, 'guest must not mutate authoritative enemy HP');
    assert.equal(reported, 1, 'guest reports the hit to the host');
    console.log('PASS Guest hits are reported to host, never applied locally');
  }

  console.log('\nAll cooperative multiplayer checks passed.');
}

main().catch((err) => { console.error(err); process.exit(1); });
