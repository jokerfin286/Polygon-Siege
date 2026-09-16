/* Headless smoke-test: runs the real simulation for a few in-game minutes. */

const gAny: Record<string, unknown> = globalThis as unknown as Record<string, unknown>;
(gAny as any).window = {
  innerWidth: 900,
  innerHeight: 700,
  devicePixelRatio: 1,
  addEventListener: () => {},
};
(gAny as any).localStorage = {
  store: {} as Record<string, string>,
  getItem(k: string) { return (this as any).store[k] ?? null; },
  setItem(k: string, v: string) { (this as any).store[k] = String(v); },
  removeItem(k: string) { delete (this as any).store[k]; },
};
(gAny as any).performance = { now: () => Date.now() };
(gAny as any).requestAnimationFrame = () => 0;

const ctxStub: any = new Proxy({}, {
  get(_t, p) {
    if (p === 'canvas') return null;
    return (..._a: unknown[]) => undefined;
  },
  set() { return true; },
});

const canvas: any = {
  width: 0,
  height: 0,
  getContext: () => ctxStub,
  getBoundingClientRect: () => ({ width: 900, height: 700, left: 0, top: 0 }),
  addEventListener: () => {},
  setPointerCapture: () => {},
};

async function main() {
  const mod = await import('../src/game/engine');
  const Game = mod.Game;
  let picks = 0;
  const g = new Game(canvas, () => {});
  g.reset();

  const dt = 1 / 60;
  let maxEnemies = 0;
  const deathsLog: unknown[] = [];
  let frames = 0;
  for (let i = 0; i < 60 * 60 * 6; i++) {
    // simulate a competent kiting player
    if (i % 6 === 0) {
      let near: any = null;
      let nd = 1e9;
      for (const e of g.enemies) {
        if (!e.active) continue;
        const d = (e.x - g.px) ** 2 + (e.y - g.py) ** 2;
        if (d < nd) { nd = d; near = e; }
      }
      let vx = 0, vy = 0;
      if (near) {
        const dist = Math.sqrt(nd) || 1;
        const away = dist < 230 ? -1 : dist > 420 ? 0.4 : 0;
        vx = ((g.px - near.x) / dist) * away;
        vy = ((g.py - near.y) / dist) * away;
      }
      // steer to centre
      vx += (g.W / 2 - g.px) / g.W * 0.6;
      vy += (g.H / 2 - g.py) / g.H * 0.6;
      g.keys.clear();
      if (vx < -0.15) g.keys.add('a'); else if (vx > 0.15) g.keys.add('d');
      if (vy < -0.15) g.keys.add('w'); else if (vy > 0.15) g.keys.add('s');
      if (near && Math.sqrt(nd) < 90 && g.dashCd <= 0) g.tryDash();
    }
    if (i % 240 === 0) g.tryDash();
    if (process.env.GOD) { g.hp = g.maxHp; g.phase = g.phase === 'dead' ? 'playing' : g.phase; }
    g.frame(dt);
    frames++;
    if (g.phase === 'levelup') {
      picks++;
      const scoreC = (k: any) => {
        const id = k.def.id;
        if (k.def.kind === 'weapon') return 100;
        if (['dmg', 'rate', 'multi', 'critd', 'pierce', 'crit', 'wslot'].includes(id)) return 80;
        if (k.def.kind === 'shape') return 70;
        return 10 + Math.random() * 20;
      };
      const c = g.choices.slice().sort((a, b) => scoreC(b) - scoreC(a))[0];
      g.pick(c.key);
    }
    if (i % 600 === 0) g.togglePause();
    let n = 0;
    for (const e of g.enemies) if (e.active) n++;
    if (n > maxEnemies) maxEnemies = n;
    if (!Number.isFinite(g.score)) { console.error('SCORE BROKE at frame', i); break; }
    if (g.phase === 'dead') {
      deathsLog.push({ t: +g.elapsed.toFixed(1), kills: g.kills, lvl: g.level, score: Math.floor(g.score) });
      g.reset();
    }
  }
  console.log(JSON.stringify({
    ok: true,
    frames,
    picks,
    score: Math.floor(g.score),
    level: g.level,
    kills: g.kills,
    maxEnemies,
    deaths: deathsLog,
    shape: g.shapeId,
    weapons: g.weapons.join(','),
    owned: Object.keys(g.owned).length,
    enemiesActive: g.enemies.filter((e) => e.active).length,
    projActive: g.projs.filter((p) => p.active).length,
    upgrades: Object.entries(g.owned).slice(0, 14).map(([k, v]) => `${k}:${v}`).join(' '),
  }, null, 1));
}

main().catch((e) => { console.error('CRASH', e); process.exit(1); });
