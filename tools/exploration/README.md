# Walking exploration

Fullscreen viewport (100dvh with fallback), safe-area controls, click/touch pathfinding, keyboard movement, collision boundaries, following camera, minimap and saved run positions. Macera keeps 10 encounters and a single 10-energy admission; Sahne keeps its seven encounters and single admission. The exit button preserves the active journey.

Class and gender sprites use six dedicated four-direction walking atlases. Six frames per direction advance with distance travelled; idle freezes a stance facing the last direction. Each run saves its facing. Combat sprites are independent. Enemy atlas and scenery caching remain as before.

Approaching within 104 world pixels schedules one encounter after 500ms. Closing the map cancels it. Hidden pages pause movement and do not start encounters. Macera's optional ambush flag gives the enemy the first normal hit; other duel callers keep existing initiative. Sahne applies one existing-engine enemy hit before its normal fight screen. Rewards remain in existing encounter handlers.

Checks (run from repository root):
- `node tools/exploration/check.cjs`: all 20 terrain/count combinations, route connectivity and collision.
- `node tools/exploration/ambush-check.cjs`: first enemy hit, regular initiative, lethal opening hit.
- `node tools/exploration/integration-check.cjs`: actual rendered sprites at 390px/800px, movement, collision, one-shot ambush, persistence, cleanup. Requires @napi-rs/canvas.
- `node tools/exploration/ui-check.cjs`: full-app Chromium mobile/desktop and mobile WebKit, viewport fill, touch movement, closing/resuming, first strike, entry costs, sprites, console errors. Requires Playwright browsers.

GitHub Actions runs these checks on relevant PRs and main pushes and retains screenshots. WebKit emulation is not a physical iPhone test.
