# Rare Force

Contra-style co-op run-and-gun for the [Rare Friends Vibeathon](https://github.com/spokesz/rarefriends-vibeathon).
Your verified Generations NFT is player one. Artwork is the official 16×16 walk frames.

**Builder:** [@Sharpbigred](https://x.com/Sharpbigred) · **Category:** Character Spotlight · **SDK:** FriendSDK v0.1.2

Source lives in `games/rare-force/`.

## Play on a computer or phone

Need Node.js 22+ and a browser wallet on **Robinhood mainnet (chain 4663)** holding a hardwired Generations NFT (generation ≥ 1).

```bash
git clone https://github.com/stevereynolds2006-ship-it/rare-force.git
cd rare-force
npm install
npm run dev          # http://localhost:4173
npm run dev:lan      # phone on the same Wi-Fi: http://YOUR_LAN_IP:4173
```

Connect the wallet, pick your Friend. On a phone use the JUMP / FIRE pads.

Public preview (after the first Actions run and Pages is enabled on `gh-pages`):
https://stevereynolds2006-ship-it.github.io/rare-force/

In the repo: **Settings → Pages → Deploy from a branch → `gh-pages` / (root)**.

## Modes

- **Solo + AI partner** — your Friend plus Rare Friend #1337 as a rifle buddy.
- **Local 2-player** — P1 on WASD / J, P2 on arrows / Enter. One device.

FriendSDK has no networked multiplayer. Local co-op + AI is the working multiplayer loop.

## Controls

| Action | P1 | P2 | Touch |
| --- | --- | --- | --- |
| Run | A / D | ← / → | ◀ ▶ |
| Jump | W / Space | ↑ | JUMP |
| Shoot | J / Z / K | Enter / Shift | FIRE |

## Stages

1. Jungle Drop
2. Waterfall Ascent
3. Red Base
4. Core Guardian (boss)

Shared lives. Reach the beacon on the right. Progress resets on reload.

## Simulated economy

Armory supply drops cost **1 RF** (simulated). Highest prize is 3 RF, so each purchase reserves 3 RF of free backing.

| Drop | Chance | Redeem | Deploy bonus |
| --- | --- | --- | --- |
| Dented canteen | 18% | 0 RF | none |
| Field ration | 26% | 0.25 RF | +1 life |
| Extra magazine | 22% | 0.50 RF | rapid fire |
| Spread kit | 16% | 1 RF | three-way shot |
| Life medal | 12% | 1.50 RF | +2 lives |
| Hero bounty | 6% | 3 RF | 3-hit shield + 500 score |

No live contracts. Label stays on screen: simulated RF.

## Settings

Mute, reduced motion, retry on failed artwork. Game honors the runtime `paused` flag.

## Checks

```bash
npm run check
npm run build
```
