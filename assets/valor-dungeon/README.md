# Valor Zindanı

New map/scene card with the approved entrance artwork; thirty separately previewable bosses. The room, battle, result and chest screens are responsive modal dialogs. Existing stages and the original 100-floor dungeon are unchanged.

## Rules

- A room holds 1–3 real players. The leader posts a world-chat invitation; clicking it joins a waiting room. Joining is locked after battle starts.
- Turn-based: members act in join order, each pressing **Saldır** on their own turn; after the last member the boss strikes once per living member (random targets), and every third round it hits the whole team at 150%. A player who does not act within **7 seconds** attacks automatically (any client may request the server `tick`).
- Skills are a free action on your own turn, once per minute: Savaşçı **Kalkan Duvarı** (shield 25% of each member's max HP), Büyücü **Şifa Dalgası** (heal 25% max HP), Okçu **Av Ruhu** (team damage +25% for the rest of the floor).
- Boss HP scales with party size (×1/×2/×3). Bosses are calibrated with `tools/valor-dungeon/balance.cjs` against the balance reference players: a full 3-class team reaches about floor 5 on day 0, 11 on day 10, 17 on day 30, 22 on day 60, 27 on day 90 and clears 30 at the top end. Without skills the same teams stall far earlier.
- Cleared floors advance automatically; surviving HP and shields carry over.
- Loss or voluntary leader withdrawal pays each participating member one chest per completed floor, once. Full completion pays 30 chests. Failed floors pay nothing.
- Each chest contains **all six**: 25 diamonds, one energy bottle, one expedition paper, one epic stone, one level-1 luck stone and one pet food. No random drop rates were specified, so all six are guaranteed.
- A withdrawing non-leader is marked defeated and remains eligible for the party's final completed-floor reward. Waiting-room leadership transfers when the leader leaves.
- Offline/guest accounts have persisted solo runs. Cloud accounts require the server migration; they never silently fall back to a fake multiplayer room.

## Activation

Apply `supabase/valor-dungeon.sql` in the project's Supabase SQL Editor after the existing schema, arena, chat, profiles and guard3 migrations. The migration is transactional and adds dedicated tables and RPCs. It does not reset characters. It requires database-owner privileges, not the public browser key.

Publish the tested branch only after the migration is installed. Until then, cloud players can inspect the thirty bosses but receive a clear unavailable message when attempting online rooms. This branch does not apply or deploy the migration automatically.

Server turns use row locks and expected version checks. Clients cannot submit damage, stats, completed floors or reward counts. Settlement and wallet opening are serialized; chest opening updates the save revision under the existing server-write guard convention.

## Validation

`node --check assets/valor-dungeon/core.js`

`node --check assets/valor-dungeon/valor-dungeon.js`

Install `@electric-sql/pglite` in a temporary dependency directory, then run `PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite node tools/valor-dungeon/check.cjs` for the real PostgreSQL function tests.

With Playwright and a Chromium binary installed, run `CHROMIUM_EXECUTABLE=/path/to/chromium node tools/valor-dungeon/ui-check.cjs`. It checks 360px, 390px and 768px layouts, boss previews, combat, loss payout, all six reward stocks, duplicate opening and safe chat markers. Browser tests use fresh local contexts and never connect a real account.

## Artwork

The entrance and 30-portrait boss atlas were generated using the built-in Imagegen tool, then encoded to WebP for mobile delivery (about 980 KiB combined). The atlas is displayed with CSS sprite positions, so each battle downloads no additional boss image. The approved entrance is `entrance.webp`; the boss atlas is `bosses.webp`.
