# Drip Drip: Ice Clicker (React + Vite)

A lightweight idle clicker built with React and Vite. Click the ice cube to earn Drops, buy tools to increase per-click gains, and hire workers for automatic Drops per second.

## Prerequisites
- Node.js 18+ recommended
- npm (bundled with Node)

## Setup
```bash
git clone git@github.com:DiegoWearden/idle-game.git
cd idle-game
npm install
```

## Run (development)
```bash
npm run dev
```
Open the URL printed by Vite (typically http://localhost:5173).

## Build (production)
```bash
npm run build
npm run preview
```
Then open the preview URL to test the production build locally.

## Gameplay (current)
- Click the ice cube to gain Drops.
- Tools (Pickaxe, Flamethrower, Jackhammer) increase Drops per click.
- Automation (Miner, Torch Operator, Jackhammer Operator) generates Drops per second.
- Numbers are integer-based (no decimals). Costs scale geometrically per purchase.

## Dev Mode
- Toggle: press Ctrl+Shift+D or add `?dev=1` to the URL.
- Features: add/set Drops, grant tools or workers quickly.

## Customization
- Panel positions: in `src/App.css`, adjust `--shop-offset-x/y` and `--automation-offset-x/y`.
- Styles: edit `src/App.css` for hover effects, animations, and layout.

## Scripts
- `npm run dev` — start Vite dev server
- `npm run build` — build to `dist/`
- `npm run preview` — preview production build

## License
MIT
