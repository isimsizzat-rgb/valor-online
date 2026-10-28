# Macera encounter artwork

Generated with the built-in image-generation tool for Valor Online. Production assets are optimized WebP in this directory. Original generated PNG files are kept separately; no gameplay state or reward rules are changed by this artwork.

Common enemy prompt: "One standalone square dark fantasy RPG enemy portrait for Valor Online. High quality realistic hand-painted fantasy game concept art, cinematic chiaroscuro, detailed materials, moody atmospheric background. Center subject's head and upper body with safe margins. Single character or creature, no gore. No text, lettering, UI, frame or watermark."

Subjects appended to that prompt:

- `bandit.webp`: hooded forest bandit, worn leather armor and rusty curved sword on a mossy path.
- `thorn-vine.webp`: living carnivorous thorn vine with a wooden beast face and green sap.
- `boss-bear.webp`: enormous ancient brown bear Grimtaş, mossy stone-like scarred hide, roaring in a primeval forest.
- `red-fox.webp`: fierce russet fox in a crimson autumn forest.
- `blood-beetle.webp`: giant crimson armored beetle with mandibles in an autumn forest.
- `boss-forest-guardian.webp`: enormous black-bark treant with antler branches and crimson foliage.
- `swamp-leech.webp`: giant swamp leech with dark green segmented skin in a foggy marsh.
- `mud-golem.webp`: heavy clay golem, reeds and roots, green eyes in a foggy marsh.
- `boss-swamp-witch.webp`: aged swamp witch Morra, twig crown, mossy hood and gnarled staff.
- `dark-bat.webp`: giant black cave bat with violet eyes in a moonless valley.
- `void-cat.webp`: shadow panther with violet eyes and purple fissures.
- `storm-eagle.webp`: giant blue-grey eagle with lightning around its talons over a mountain pass.
- `frost-fairy.webp`: winter fairy with pale blue skin, white hair, ice crown and icy wings.
- `lava-salamander.webp`: charcoal-scaled salamander with molten orange fissures by lava.
- `flame-demon.webp`: horned humanoid fire demon with charcoal skin and flaming shoulders.
- `abyss-reptile.webp`: violet-scaled spined lizard with green eyes above a bottomless chasm.
- `dragon-hatchling.webp`: juvenile crimson dragon in a treasure-lined throne chamber.
- `lightning-spirit.webp`: floating blue-white lightning elemental without physical armor in a stormy pass.
- `boss-fire-lord.webp`: regal Fire Lord Ignar, gold crown, obsidian plate armor, molten seams and a flaming greatsword before a volcanic fortress; no horns.

Victory prompt: "One landscape 3:2 dark fantasy RPG victory illustration: magnificent ornate golden sword planted into ancient stone, a gold laurel wreath around its hilt, warm rays and golden embers, moody charcoal forest. Rich realistic hand-painted game art, cinematic lighting, gold and amber with teal shadows. Strong centered silhouette and dark margins. No people, trophy cup, text, UI, border or watermark."

The remaining creatures reuse matching portraits from `assets/valor-dungeon/bosses.webp` through CSS atlas coordinates. All 40 named encounters are mapped in `expedition.js`; bosses use a separate entry from the normal foes in their region. Resolution by name also applies to saved adventures from before this update.
