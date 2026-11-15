# Walking exploration

Macera retains 10 encounters and a single 10-energy admission. Sahne retains seven encounters in its 15-step flow and a single daily admission. Walking changes neither rewards nor combat rules. Each region has deterministic terrain, an unobstructed trail, collision boundaries, click-to-walk pathfinding, keyboard controls, touch direction controls and a following camera. The next encounter unlocks within 66 world pixels. Position is stored on the existing run and saved on stopping, periodically while moving, and when leaving the map.

Run from repository root:

- `node tools/exploration/check.cjs`: all 20 terrain/count combinations, route connectivity and collision checks.
- `node tools/exploration/integration-check.cjs`: actual canvas rendering plus keyboard movement, proximity gating, position saves, boundary collisions and lifecycle cleanup at 390px and 800px. Requires `@napi-rs/canvas`.
- `CHROMIUM_EXECUTABLE=/usr/bin/chromium node tools/exploration/ui-check.cjs`: full application browser checks for admission costs, encounter transitions, input and layout. Requires Playwright and a runnable Chromium.

The first two suites pass. The browser suite could not run in the implementation environment because Chromium's Unix socket creation was denied. The shared browser also could not reach the local preview. Full browser/iOS visual verification remains necessary.
