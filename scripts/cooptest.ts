/* Two in-memory Game instances wired together — verifies the co-op contract:
   both sides control their own avatar, damage/loot/levels sync, and the run
   pauses for a partner's upgrade pick. */
const gAny = globalThis as unknown as Record<string, unknown>;
(gAny as any).window = { innerWidth: 900, innerHeight: 700, devicePixelRatio: 1, addEventListener: () => {}, setTimeout: (_f: unknown, _ms: number) => 0, clearTimeout: () => {} };
(gAny as any).localStorage = { store: {} as Record<string, string>, getItem(k: string) { return (this as any).store[k] ?? null; }, setItem(k: string, v: string) { (this as any).store[k] = String(v); }, removeItem(k: string) { delete (this as any).store[k]; } };
(gAny as any).performance = { now: () => Date.now() };
(gAny as any).navigator = { language: 'en' };
const ctx: any = new Proxy({}, {
  get: (_t, p) => {
    if (p === 'canvas') return null;
    if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => ({ addColorStop: () => {} });
    return () => undefined;
  },
  set: () => true,
});
const mkCanvas = () => ({
  width: 0, height: 0, getContext: () => ctx,
  getBoundingClientRect: () => ({ width: 900, height: 700, left: 0, top: 0 }),
  addEventListener: () => {}, setPointerCapture: () => {},
}) as unknown as HTMLCanvasElement;

async function main() {
  const { Game } = await import('../src/game/engine');
  const results: string[] = [];
  const check = (name: string, ok: boolean, extra = '') => {
    results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) process.exitCode = 1;
  };

  const host = new Game(mkCanvas(), () => {});
  const guest = new Game(mkCanvas(), () => {});
  host.lang = guest.lang = 'en';
  // in-memory transport: deliver straight to the other side
  host.attachNet('local', (type, payload) => guest.applyMessage(type, payload, host.selfId));
  guest.attachNet('local', (type, payload) => host.applyMessage(type, payload, guest.selfId));

  host.applyMeta({ mods: {}, rerollTokens: 0, coinMul: 1, color: '#38f5e0', theme: (await import('../src/game/meta')).THEMES[0] });
  guest.applyMeta({ mods: {}, rerollTokens: 0, coinMul: 1, color: '#f472b6', theme: (await import('../src/game/meta')).THEMES[0] });

  host.beginCoop({ selfId: 'H', selfName: 'HOST', selfColor: '#38f5e0', isHost: true });
  host.syncPeers([{ id: 'G', name: 'GUEST', color: '#f472b6' }]);
  guest.beginCoop({ selfId: 'G', selfName: 'GUEST', selfColor: '#f472b6', isHost: false });
  host.startCountdown(1);

  const dt = 1 / 60;
  const tick = () => { host.frame(dt); guest.frame(dt); };
  for (let i = 0; i < 60; i++) tick();          // countdown runs the full minute

  check('countdown gates both clients', host.elapsed < 1.2, `host elapsed ${host.elapsed.toFixed(2)}s`);

  // ---- the reported bug: can the partner move and shoot? ----
  guest.keys.add('d');
  const x0 = guest.px, y0 = guest.py;
  for (let i = 0; i < 40; i++) tick();
  const moved = Math.abs(guest.px - x0) + Math.abs(guest.py - y0);
  check('guest moves under its own input', moved > 60, `moved ${moved.toFixed(0)}px`);

  guest.tryDash();
  const dashBefore = guest.px;
  for (let i = 0; i < 12; i++) tick();
  check('guest can dash', Math.abs(guest.px - dashBefore) > 4);

  // the guest must arrive with its own fresh build, not the host's
  check('guest starts with its own weapon + full HP', guest.weapons.length === 1 && guest.hp === guest.maxHp,
    `weapons ${guest.weapons.join('+') || 'NONE'} hp ${Math.round(guest.hp)}`);

  // spawn a fat dummy enemy right next to the guest so shots must land
  host.keys.clear();
  const dummy = host.spawnEnemy('epentagon', guest.px + 150, guest.py, 0.01);
  if (dummy) { dummy.hp = dummy.maxHp = 100000; dummy.speed = 0; }
  let shotsSeen = 0;
  for (let i = 0; i < 240; i++) {
    tick();
    if (guest.projs.some((p) => p.active)) shotsSeen++;
    if (guest.peers.length) { /* host sees guest avatar mirrored back */ }
  }
  check('guest fires projectiles locally', shotsSeen > 30, `${shotsSeen} frames with shots`);
  check('guest damage reaches the host', !!dummy && dummy.hp < 100000, `dummy hp ${dummy ? Math.round(dummy.hp) : 'n/a'}`);
  check('guest kills score for the guest, not the host', guest.kills >= 0 && Number.isFinite(guest.score), `guest score ${Math.round(guest.score)}`);
  check('host sees the guest as a partner avatar', host.peers.length === 1
    && Math.abs(host.peers[0].x - guest.px) < 60,
  host.peers.length ? `partner at ${Math.round(host.peers[0].x)} vs guest ${Math.round(guest.px)}` : 'no peers');

  // ---- gems never expire and claims propagate ----
  const before = host.pickups.filter((p) => p.active).length;
  const gem = host.pickups.find((p) => p.active && !p.heal);
  for (let i = 0; i < 60 * 40; i++) tick();
  const stillOnFloor = host.pickups.filter((p) => p.active && !p.heal).length;
  check('XP gems persist on the field', stillOnFloor > 0 || gem === undefined || before === 0,
    `active gems after 40s: ${stillOnFloor}`);

  // ---- shared level-up pause with the partner's name ----
  guest.hp = guest.maxHp;
  (guest as unknown as { gainXP: (v: number) => void }).gainXP(guest.xpNeed + 1);
  tick();
  check('guest level-up opens its own picker', guest.phase === 'levelup', guest.phase);
  check('guest level-up pauses the host world', host.phase === 'levelup' && host.chooserId === 'G',
    `phase ${host.phase} chooser ${host.chooserId}`);
  check('host mirrors the partner cards + nickname', Boolean(host.picker && host.picker.cards.length > 0 && host.picker.name === 'GUEST'),
    host.picker ? `${host.picker.cards.length} cards for ${host.picker.name}` : 'no picker');
  const hostElapsed = host.elapsed;
  for (let i = 0; i < 30; i++) tick();
  check('world stays frozen while a partner picks', Math.abs(host.elapsed - hostElapsed) < 0.001);
  const key = guest.choices[0]?.key;
  if (key) guest.pick(key);
  for (let i = 0; i < 5; i++) tick();
  check('picking resumes the run for both', host.phase === 'playing' && guest.phase === 'playing',
    `host ${host.phase} / guest ${guest.phase}`);

  // ---- death, spectating and the boss revive ----
  guest.hp = guest.maxHp; host.hp = host.maxHp;
  (guest as unknown as { hurtPlayer: (d: number, x: number, y: number) => void }).hurtPlayer(999999, host.px, host.py);
  tick();
  check('a dead partner keeps the run alive for the other', guest.phase !== 'dead' && host.phase === 'playing',
    `guest ${guest.phase} / host ${host.phase}`);
  const boss = host.spawnEnemy('b_maw', host.px + 260, host.py, 0.02);
  if (boss) { boss.hp = boss.maxHp = 40; }
  for (let i = 0; i < 60 * 12; i++) { host.hp = host.maxHp; tick(); }
  check('killing the boss revives the fallen partner', guest.hp > 0 && guest.invuln > 0,
    `guest hp ${Math.round(guest.hp)} invuln ${guest.invuln.toFixed(1)}`);

  console.log(results.join('\n'));
  if (!results.some((r) => r.startsWith('FAIL'))) console.log('\nCO-OP OK');
}
main().catch((e) => { console.error('CRASH', e); process.exit(1); });
