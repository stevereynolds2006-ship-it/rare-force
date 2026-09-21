# Rare Force

SDK version **v0.1.2**. A Contra-style side-scrolling run-and-gun starring your verified Rare Friends Generations NFT.

You drop into four stages with shared lives, local two-player controls, and an AI partner drawn from Rare Friend #1337 when you play solo. The selected Friend’s original 16×16 walk frames are painted unmodified (black mask, white halo) as player one.

The SDK runtime supplies wallet connection, owned-Friend selection, the ownership gate and the simulated RF ledger. This folder is only the sandboxed game.

## Play on a computer or phone

From this FriendSDK checkout (Node.js 22+):

```bash
npm ci
npm run dev:game -- games/rare-force
```

Open the printed URL (usually `http://localhost:4173`). Connect a browser wallet on Robinhood mainnet (chain 4663) that holds a hardwired Generations NFT, generation ≥ 1. Select that Friend and play.

On a phone, open the same URL on your Wi-Fi (use your computer’s LAN address if needed), connect the wallet, then use the on-screen JUMP / FIRE pads.

## Controls

| Action | Player 1 | Player 2 | Touch |
| --- | --- | --- | --- |
| Run | A / D | ← / → | ◀ ▶ pads |
| Jump | W / Space | ↑ | JUMP |
| Shoot | J / Z / K | Enter / Shift | FIRE |

Solo mode also accepts arrow keys for player 1 and drives Friend #1337 as an AI rifle partner.

## Stages

1. **Jungle Drop** — ground walkers, flyers, first pits.
2. **Waterfall Ascent** — stacked platforms over water.
3. **Red Base** — turrets and tighter corridors.
4. **Core Guardian** — stage boss with a health bar.

Reach the right-hand beacon to clear a stage. Shared lives. A checkpoint trails the lead Friend for the current visit only. Reloading resets the run; the sandbox has no save store.

## Simulated supply drops

All balances, purchases and redemptions are simulated. Each drop costs 1 RF and reserves 3 RF of free backing (the hero bounty).

| Drop | Chance | Redeem value | Field bonus if deployed |
| --- | --- | --- | --- |
| Dented canteen | 18% | 0 RF | none |
| Field ration | 26% | 0.25 RF | +1 life |
| Extra magazine | 22% | 0.50 RF | rapid fire |
| Spread kit | 16% | 1 RF | three-way shot |
| Life medal | 12% | 1.50 RF | +2 lives |
| Hero bounty | 6% | 3 RF | 3-hit shield + 500 score |

Kept medals have no expiry. Deploying a kit only changes the current run. Live RF transfers are not implemented.

## Multiplayer note

FriendSDK v0.1.2 has no networked session. Rare Force therefore ships **local co-op on one device** plus a **solo AI partner** that uses another Rare Friend’s canonical frames. That is the working multiplayer interaction.

## Settings

Mute and reduced motion live in Settings. Reduced motion freezes walk frames and snaps the camera. Failed artwork loads can be retried. The game honors the runtime `paused` flag when an SDK menu is open.
