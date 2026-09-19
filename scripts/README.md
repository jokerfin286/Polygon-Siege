# Gameplay Regression Checks

Run `node scripts/regression.mjs` (single-player + content) and `node scripts/cooptest.mjs` (two linked Game instances over an in-memory transport) from the project root. `cooptest.mjs` bundles `cooptest.ts` the same way `regression.mjs` bundles `regression.ts`. The runner bundles the TypeScript tests with Vite's installed esbuild dependency and executes them in Node with a stub canvas and isolated in-memory storage. No saved browser progress is modified.

The suite checks adjacent weapon mounts at short and long ranges, even-numbered laser arrays, independent secondary weapons, every shape's native weapon, swept projectile collision, all shape masteries and rank caps, bounded damage cascades, all enemy and boss behaviors, boss rotation, rendering in every arena, and Russian translation coverage.

These checks do not replace real browser playtesting or desktop/mobile frame-rate profiling.
The co-op suite checks that each client controls its own avatar (move, dash, fire), that damage and kill credit cross the wire, that XP gems survive until collected, that a partner's level-up pauses the shared world and mirrors their cards with their nickname, that a fallen player keeps spectating while the other fights, and that a boss kill revives them with 3 seconds of immunity.
