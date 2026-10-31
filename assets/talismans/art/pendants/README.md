# Talisman pendant artwork

32 transparent 512 × 512 WebP inventory icons. Each type has four gemstone grades;
the neutral metal housing stays the same design. Colour IDs match talismans.js:
`0 = green`, `1 = yellow`, `2 = purple`, `3 = red`.

| Type | File prefix | Shape |
| --- | --- | --- |
| X / Demir Pençe | demir-pence | Clipped square |
| Y / Kızıl Muhafız | kizil-muhafiz | Inverted triangle |
| Z / Ay Kâhini | ay-kahini | Oval lunar filigree, revised design |
| T / Fırtına Mührü | firtina-muhru | Hexagonal prism |
| K / Ejder Yüreği | ejder-yuregi | Round twin dragon, revised design |
| L / Yıldız Kalbi | yildiz-kalbi | Rhombus |
| P / Kurt Ruhu | kurt-ruhu | Stepped rectangle |
| O / Anka Gözü | anka-gozu | Teardrop |

Filenames use `<prefix>-<colour>.webp`. The same selector serves inventory,
equipped slots, item dialogs and fusion screens. Existing player items use
their saved type and colour; no migration or stat changes are needed.
