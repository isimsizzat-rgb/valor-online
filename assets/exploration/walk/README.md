# Directional walking sprites

Six class/gender atlases: warrior, mage, archer × male/female. Generated with built-in image generation using existing arena artwork as a costume reference; optimized into transparent WebP.

Each atlas is 1536×1024: six columns, four rows (down/front, left, right, up/back). Each row is a six-phase walking cycle. Weapons are carried, not fired or swung. Common prompt: serious realistic painted RPG art matching Valor Online; consistent full-body scale, costume and feet baseline; alternating foot contact and passing phases, arm counter-swing and cloak sway; regular 6×4 layout; true transparency, no shadows, ground, text or borders. Warrior: dark hair, red/gold crown, black/red plate, red cape, lowered sword. Mage: white hair, human ears, purple/gold robes, vertical staff. Archer: blond hair, green/gold crown and armor, lowered bow, green cape. Female/male variants generated individually.

Animation uses actual distance travelled, one frame per 18 world pixels. Idle holds frame 1 in the last direction. Dominant movement axis selects the direction with hysteresis at diagonals. Direction persists with the run. Rendering uses a common cell-center and foot anchor so frames do not jump or mirror the weapon. Existing combat atlases remain independent.

Verification: `walk-check.cjs` (direction, cycles, idle), `walk-art-check.cjs` (all 144 occupied transparent distinct frames), `ui-check.cjs` (all class/gender sheets and distinct poses in Chromium/WebKit plus movement and encounter regression).
