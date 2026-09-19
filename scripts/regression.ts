import assert from 'node:assert/strict';
import { adjacentMount, segmentDistanceSq } from '../src/game/aim';
import { BOSS_IDS, ENEMIES, EXPANSION_UPGRADES, SHAPES, UPGRADES, WEAPONS } from '../src/game/defs';
import { RU_ENEMIES, RU_UPGRADES, enemyTactic, t } from '../src/i18n';
import { THEMES } from '../src/game/meta';
import type { Game as GameType } from '../src/game/engine';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { innerWidth: 960, innerHeight: 720, devicePixelRatio: 1 } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });

const gradient = { addColorStop: () => {} };
const context = new Proxy({}, {
  get: (_, key) => {
    if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => gradient;
    if (key === 'measureText') return () => ({ width: 30 });
    return () => {};
  },
  set: () => true,
});
const canvas = {
  width: 0, height: 0, getContext: () => context,
  getBoundingClientRect: () => ({ width: 960, height: 720 }),
} as unknown as HTMLCanvasElement;

interface TestHooks {
  updateWeapons(dt: number): void;
  updateProjs(dt: number): void;
  updateEnemies(dt: number): void;
  updateHazards(dt: number): void;
  updatePickups(dt: number): void;
  spawnBoss(): void;
  bossCount: number;
  damageEnemy(enemy: NonNullable<ReturnType<GameType['spawnEnemy']>>, damage: number, crit: boolean, kx: number, ky: number): void;
  killEnemy(enemy: NonNullable<ReturnType<GameType['spawnEnemy']>>): void;
}
const hooks = (game: GameType) => game as unknown as TestHooks;
const upgrade = (game: GameType, id: string, ranks = 1) => {
  const definition = UPGRADES.find((u) => u.id === id);
  assert.ok(definition, `Unknown upgrade: ${id}`);
  for (let i = 0; i < ranks; i++) game.applyUpgrade(definition);
};

async function main() {
  const { Game } = await import('../src/game/engine');
  const { render } = await import('../src/game/render');
  let passed = 0;
  const test = (name: string, run: () => void) => {
    run(); passed++; console.log(`PASS ${name}`);
  };
  const game = () => {
    const value = new Game(canvas, () => {});
    value.reset(); value.invuln = 100000;
    return value;
  };

  test('Every muzzle hits the target, including even mount counts and sidearms', () => {
    for (const radius of Object.values(SHAPES).map((s) => s.size)) {
      for (const count of [1, 2, 3, 4, 5]) for (const angle of [0, 0.74, Math.PI / 2, Math.PI, -1.2]) {
        for (const distance of [35, 90, 300, 900]) {
          const target = { x: 500 + Math.cos(angle) * distance, y: 500 + Math.sin(angle) * distance };
          const original = adjacentMount(500, 500, radius, angle, 0, 0, 1, target);
          for (let wi = 0; wi < 4; wi++) for (let i = 0; i < (wi === 0 ? count : 1); i++) {
            const mount = adjacentMount(500, 500, radius, angle, wi, i, count, target);
            const x2 = mount.x + Math.cos(mount.angle) * 2000;
            const y2 = mount.y + Math.sin(mount.angle) * 2000;
            assert.ok(segmentDistanceSq(target.x, target.y, mount.x, mount.y, x2, y2) < 0.00001);
            if (wi === 0 && i === 0) { assert.equal(mount.x, original.x); assert.equal(mount.y, original.y); }
          }
        }
      }
    }
  });

  test('Two and four lasers originate at adjacent mounts and intersect a small enemy', () => {
    for (const count of [2, 4]) {
      const g = game();
      g.shapeId = 'triangle'; g.weapons = ['laser']; g.wcd = [0]; g.recompute();
      upgrade(g, 'barrels', count - 1);
      const enemy = g.spawnEnemy('ecircle', g.px + 420, g.py, 1)!;
      enemy.hp = enemy.maxHp = 10000; enemy.r = 2;
      hooks(g).updateWeapons(0);
      const beams = g.fx.beams.filter((b) => b.active);
      assert.equal(beams.length, count);
      assert.ok(new Set(beams.map((b) => `${b.x1},${b.y1}`)).size === count);
      for (const b of beams) assert.ok(segmentDistanceSq(enemy.x, enemy.y, b.x1, b.y1, b.x2, b.y2) < 0.001);
      assert.ok(enemy.hp < enemy.maxHp);
    }
  });

  test('Secondary weapons work without Auxiliary Fire and keep independent cooldowns', () => {
    const g = game();
    g.shapeId = 'triangle'; g.weapons = ['laser']; g.wcd = [0]; g.recompute();
    upgrade(g, 'wslot'); upgrade(g, 'w_rail');
    const enemy = g.spawnEnemy('ecircle', g.px + 300, g.py, 1)!;
    enemy.hp = enemy.maxHp = 10000;
    hooks(g).updateWeapons(0);
    assert.equal(g.fx.beams.filter((b) => b.active).length, 2);
    assert.notEqual(g.wcd[0], g.wcd[1]);
    assert.notEqual(g.getWeaponMount(0).y, g.getWeaponMount(1).y);
  });

  test('Shape changes replace the primary, not an already equipped sidearm', () => {
    const g = game();
    upgrade(g, 'wslot'); upgrade(g, 'w_rail');
    upgrade(g, 'shape_triangle');
    assert.deepEqual(g.weapons, ['laser', 'rail']);
  });

  test('All native weapons retain their target with five mounts', () => {
    for (const shape of Object.values(SHAPES)) {
      const g = game();
      g.shapeId = shape.id; g.weapons = [shape.weapon]; g.wcd = [0]; g.recompute();
      upgrade(g, 'barrels', 4);
      const enemy = g.spawnEnemy('ecircle', g.px + 160, g.py, 1)!;
      enemy.hp = enemy.maxHp = 10000; enemy.speed = 0;
      hooks(g).updateWeapons(0);
      for (let i = 0; i < 90; i++) hooks(g).updateProjs(1 / 60);
      assert.ok(enemy.hp < enemy.maxHp, `${shape.name} failed to hit`);
      assert.ok(g.projs.filter((p) => p.active).length <= g.projs.length);
    }
  });

  test('Swept collision detects fast projectiles between frames', () => {
    const g = game();
    const enemy = g.spawnEnemy('ecircle', g.px + 30, g.py, 1)!;
    enemy.hp = enemy.maxHp = 1000;
    const p = g.projs[0];
    Object.assign(p, { active: true, x: g.px, y: g.py, vx: 1200, vy: 0, r: 2, dmg: 10, life: 1, homing: 0 });
    hooks(g).updateProjs(0.05);
    assert.ok(enemy.hp < 1000);
  });

  test('Each shape has two exclusive, rank-capped, functional mastery upgrades', () => {
    for (const shape of Object.keys(SHAPES)) {
      const g = game(); g.shapeId = shape; g.recompute();
      const choices = g.availableChoices().filter((c) => c.def.forShape);
      assert.equal(choices.length, 2);
      assert.ok(choices.every((c) => c.def.forShape === shape));
      const before = JSON.stringify(g.stats);
      for (const choice of choices) upgrade(g, choice.def.id, 8);
      assert.notEqual(JSON.stringify(g.stats), before);
      assert.ok(choices.every((c) => g.owned[c.def.id] === 3));
      assert.equal(g.availableChoices().filter((c) => c.def.forShape).length, 0);
    }
  });

  test('Defensive upgrades, healing and boss damage change actual outcomes', () => {
    const g = game();
    upgrade(g, 'fieldMedicine', 3);
    g.hp = 10;
    Object.assign(g.pickups[0], { active: true, heal: true, life: 10, x: g.px, y: g.py, vx: 0, vy: 0 });
    hooks(g).updatePickups(0);
    assert.ok(Math.abs(g.hp - (10 + g.maxHp * 0.12 * 1.6)) < 0.001);
    upgrade(g, 'bossHunter', 3);
    const boss = g.spawnEnemy('b_maw', g.px + 300, g.py, 1)!;
    const before = boss.hp;
    hooks(g).damageEnemy(boss, 10, false, 0, 0);
    assert.ok(Math.abs(before - boss.hp - 16) < 0.001);
    upgrade(g, 'bastion', 3); upgrade(g, 'secondSkin', 3);
    assert.ok(Math.abs(g.stats!.damageReduction - 0.24) < 0.001);
    assert.ok(Math.abs(g.stats!.invulnBonus - 0.30) < 0.001);
  });

  test('Rerolls stay consumable and pausing stops the simulation', () => {
    const g = game();
    g.applyMeta({ mods: {}, rerollTokens: 5, coinMul: 1, color: '#38f5e0', theme: THEMES[0] });
    g.reset();
    let spent = 0; g.onSpendReroll = () => { spent++; };
    g.reroll(); assert.equal(g.rerolls, 5);
    g.phase = 'levelup'; g.rollChoices();
    for (let i = 0; i < 3; i++) g.reroll();
    g.rollChoices(); assert.equal(g.rerolls, 2); assert.equal(spent, 3);
    g.reset(); assert.equal(g.rerolls, 2);
    g.pause(); const elapsed = g.elapsed; g.frame(0.5);
    assert.equal(g.elapsed, elapsed);
    g.resume(); assert.equal(g.phase, 'playing');
  });

  test('Secondary chains and explosions terminate and never award duplicate kills', () => {
    const g = game();
    for (const id of ['chainhit', 'shock', 'explode', 'deathbomb', 'fire', 'poison']) upgrade(g, id, 3);
    for (let i = 0; i < 24; i++) g.spawnEnemy('ecircle', g.px + 100 + i % 6 * 12, g.py + Math.floor(i / 6) * 12, 1);
    const target = g.enemies.find((e) => e.active)!;
    hooks(g).damageEnemy(target, 50, false, 0, 0);
    assert.ok(g.kills > 0 && g.kills <= 24);
    const kills = g.kills;
    hooks(g).killEnemy(target);
    assert.equal(g.kills, kills);
    assert.ok(Number.isFinite(g.score));
  });

  test('New enemies and all boss phases simulate and render in every arena', () => {
    for (const definition of Object.values(ENEMIES)) {
      const g = game(); g.weapons = []; g.wcd = []; g.recompute();
      const e = g.spawnEnemy(definition.id, g.px + 270, g.py, 1)!;
      e.atkT = 0;
      if (definition.boss) e.hp = e.maxHp * 0.45;
      for (let i = 0; i < 360; i++) {
        hooks(g).updateEnemies(1 / 60);
        hooks(g).updateHazards(1 / 60);
        g.fx.update(1 / 60);
      }
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
      if (definition.boss) assert.equal(e.enraged, true);
      for (const theme of THEMES) { g.theme = theme; render(g, 6); }
    }
  });

  test('Boss rotation visits four unique bosses without repetition', () => {
    const g = game();
    const seen = new Set<string>();
    for (let i = 0; i < BOSS_IDS.length; i++) {
      for (const e of g.enemies) e.active = false;
      hooks(g).bossCount = i;
      hooks(g).spawnBoss();
      const boss = g.enemies.find((e) => e.active && e.def.boss)!;
      assert.ok(boss); seen.add(boss.def.id);
    }
    assert.equal(seen.size, BOSS_IDS.length);
  });

  test('Every upgrade, enemy and boss has Russian text and tactics', () => {
    for (const u of UPGRADES) assert.ok(RU_UPGRADES[u.id]?.name && RU_UPGRADES[u.id]?.desc, u.id);
    for (const e of Object.values(ENEMIES)) {
      assert.ok(RU_ENEMIES[e.id], e.id);
      assert.ok(enemyTactic('en', e.id) && enemyTactic('ru', e.id), e.id);
    }
    assert.equal(EXPANSION_UPGRADES.length, 26);
    assert.equal(Object.keys(WEAPONS).length, 11);
    assert.equal(t('en', 'bnr_bossIn', { name: 'IRON MAW' }), 'IRON MAW INBOUND');
    assert.equal(t('ru', 'bossPhase', { n: 2 }), '\u0424\u0410\u0417\u0410 2');
  });

  console.log(`${passed} regression groups passed.`);
}

await main().catch((error) => { console.error(error); process.exitCode = 1; });