# Gameplay Regression Checks

Run `node scripts/regression.mjs` from the project root. The runner bundles the TypeScript tests with Vite's installed esbuild dependency and executes them in Node with a stub canvas and isolated in-memory storage. No saved browser progress is modified.

The suite checks adjacent weapon mounts at short and long ranges, even-numbered laser arrays, independent secondary weapons, every shape's native weapon, swept projectile collision, all shape masteries and rank caps, bounded damage cascades, all enemy and boss behaviors, boss rotation, rendering in every arena, and Russian translation coverage.

These checks do not replace real browser playtesting or desktop/mobile frame-rate profiling.