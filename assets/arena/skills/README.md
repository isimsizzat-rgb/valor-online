# Arena skill icons

Final transparent artwork. Square, 256×256, WebP. Attack and passive icons are selected by character class. Root attack files are for Savaşçı; `buyucu/` and `okcu/` each provide their own `normal.webp`, `strong.webp`, and `max.webp`.

| File | Skill |
|---|---|
| `normal.webp` | Savaşçı · 1 · Saldırı (normal hit, 1 s) |
| `strong.webp` | Savaşçı · 2 · Güçlü Vuruş (130%, 5 s) |
| `max.webp` | Savaşçı · 3 · Son Darbe (175%, 15 s) |
| `passive-savasci.webp` | 4 · Savaşçı pasif: Demir Duruş (shield 9% max HP, 10 s) |
| `passive-buyucu.webp` | 4 · Büyücü pasif: Yenilenme (heal 11% max HP, 10 s) |
| `passive-okcu.webp` | 4 · Okçu pasif: Odaklan (next hit +180%, 10 s) |

After replacing, bump the image query version in `skillIcon` in `duel.js` and `duel.js?v=` in `index.html` so phones load the new images.
