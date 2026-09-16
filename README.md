# Polygon Siege

<p align="center">
  <strong>A fast-paced geometric arena survival game.</strong><br>
  Survive waves of enemies, evolve your shape, collect upgrades, and push your high score.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-in%20development-orange" alt="Status">
  <img src="https://img.shields.io/badge/platform-web-blue" alt="Platform">
  <img src="https://img.shields.io/badge/React-TypeScript-61DAFB" alt="React + TypeScript">
  <img src="https://img.shields.io/badge/Vite-646CFF" alt="Vite">
  <img src="https://img.shields.io/badge/license-not%20specified-lightgrey" alt="License">
</p>

## About the game

**Polygon Siege** is a browser-based arena survival game built around a simple idea: start as a geometric shape, survive increasingly dangerous enemy waves, collect experience, choose upgrades, and build a stronger loadout every run.

The project combines a Canvas-based game engine with a React interface, a progression system, an in-game armory, visual effects, sound effects, and local high scores.

> This repository is an active development project. Features, balance, visuals, and architecture may change.

## Features

- Geometric player shapes: circle, triangle, square, pentagon, hexagon, heptagon, and octagon.
- Arena survival gameplay with escalating enemy pressure.
- Keyboard controls and touch-oriented input support.
- Dash movement and pause controls.
- Level-ups with upgrade choices.
- Weapons, helpers, special upgrades, and stat upgrades.
- Coins and a persistent armory.
- Unlockable colors and locations/themes.
- Local high scores and best-score tracking.
- Canvas rendering with particles, rings, beams, projectiles, and screen effects.
- Procedural sound effects through the Web Audio API.
- A simulation script for long-run engine checks.

## Controls

| Action | Keyboard |
|---|---|
| Move | WASD / Arrow keys |
| Dash | Space |
| Pause | Escape |

Touch input is also supported through the game's touch control.

## Tech stack

- React
- TypeScript
- Vite
- Canvas 2D
- Tailwind CSS
- Web Audio API
- GitHub Actions for deployment

## Project structure

```text
src/
├── App.tsx                 # Application shell and game/UI coordination
├── main.tsx                # React entry point
├── index.css               # Global styles
├── game/
│   ├── defs.ts             # Shapes, weapons, enemies, upgrades
│   ├── engine.ts           # Main gameplay simulation
│   ├── fx.ts               # Particles, rings, beams, floaters, flashes
│   ├── meta.ts              # Armory, coins, colors, themes, shop upgrades
│   ├── render.ts            # Canvas rendering and HUD
│   ├── sfx.ts               # Procedural sound effects
│   └── storage.ts           # Local scores, best score, mute state
├── ui/
│   ├── Screens.tsx          # Start, pause, level-up, game-over screens
│   └── Shop.tsx             # Armory/shop modal
└── utils/
    └── cn.ts                # Class-name helper

scripts/
└── sim.ts                   # Automated gameplay simulation

.github/workflows/
└── deploy.yml               # GitHub Actions deployment workflow
```

## How the game is organized

### Game engine

`src/game/engine.ts` owns the runtime state and gameplay rules: movement, enemy updates, projectiles, damage, pickups, progression, weapons, and run state.

### Definitions

`src/game/defs.ts` contains the data-driven definitions for shapes, weapons, enemies, and upgrades. Many content additions can start here without changing the UI.

### Rendering

`src/game/render.ts` draws the arena, player, enemies, projectiles, effects, and HUD on Canvas 2D.

### Progression and armory

`src/game/meta.ts` stores persistent progression data such as coins, unlocked colors/themes, and shop upgrade levels.

### UI

React components in `src/ui/` display menus, upgrade choices, pause/game-over screens, and the armory. The UI communicates with the game through callbacks and state passed from `App.tsx`.

## Getting started

### Requirements

- Node.js
- npm

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open the local URL shown by Vite in your terminal.

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## Development workflow

1. Start the Vite development server.
2. Make changes in `src/`.
3. Test the game in the browser.
4. Run a production build before committing.
5. Keep gameplay rules in `src/game/` and presentation in `src/ui/` / `src/game/render.ts`.

## Adding new content

### New shape

1. Add the shape definition in `src/game/defs.ts`.
2. Add its ID to the shape order.
3. Add a shape upgrade if it should be unlockable through progression.
4. Check rendering and balance.

### New weapon

1. Add the weapon definition in `src/game/defs.ts`.
2. Add the corresponding engine behavior in `src/game/engine.ts` if it requires a new weapon type.
3. Add rendering in `src/game/render.ts` when the projectile or effect needs a unique visual.
4. Add an upgrade entry if the weapon is acquired through level-ups.

### New enemy

1. Add the enemy definition.
2. Implement special behavior in `engine.ts` when needed.
3. Add or update enemy rendering.
4. Test spawn timing, damage, health, speed, and rewards.

### New shop upgrade

Add the shop definition in `src/game/meta.ts`. If the upgrade introduces a new stat, make sure the engine reads and applies that stat.

## Testing and simulation

The repository includes `scripts/sim.ts`, which runs an automated gameplay simulation using the game engine and a Canvas stub. It is intended to help detect long-run issues such as invalid scores, runaway entity counts, and broken progression.

Run the simulation with the project's TypeScript execution setup, or adapt it to the command you use locally.

## Deployment

The repository includes a GitHub Actions workflow at:

```text
.github/workflows/deploy.yml
```

The workflow is intended for automated deployment of the web build. Check the workflow and repository Pages settings before publishing.

## Roadmap

- [ ] More shapes, weapons, enemies, and bosses
- [ ] More arena themes and visual effects
- [ ] Better balance and progression
- [ ] Expanded audio
- [ ] More automated tests
- [ ] Online leaderboards
- [ ] Unity/PC prototype
- [ ] Mobile-friendly Unity build

## Unity port

A future Unity version can preserve the game's core design while replacing the web technology:

| Current web project | Unity equivalent |
|---|---|
| `engine.ts` | C# gameplay systems |
| `defs.ts` | ScriptableObjects / data assets |
| `render.ts` | Unity 2D Renderer, sprites, particles, shaders |
| `fx.ts` | Unity Particle System / VFX |
| `sfx.ts` | Unity AudioSource / AudioMixer |
| `storage.ts` | Save system / JSON / platform storage |
| React UI | Unity UI Toolkit or Canvas UI |

The recommended approach is to keep the game design and content definitions, then rebuild the runtime in C# rather than trying to convert React code directly.

## License

No license is currently specified in this repository. Add a license file before distributing the project or accepting external contributions.

## Author

Created by [jokerfin286](https://github.com/jokerfin286).

---

If you like the project, consider starring the repository and following its development.
