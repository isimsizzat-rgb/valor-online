# Arena skill icons

Final transparent artwork. Square, 256×256, WebP. The first three attack icons are shared by all classes; the passive icon is selected by class.

| File | Skill |
|---|---|
| `normal.webp` | 1 · Saldırı (normal hit, 1 s) |
| `strong.webp` | 2 · Güçlü Vuruş (130%, 5 s) |
| `max.webp` | 3 · Son Darbe (175%, 15 s) |
| `passive-savasci.webp` | 4 · Savaşçı pasif: Demir Duruş (shield 9% max HP, 10 s) |
| `passive-buyucu.webp` | 4 · Büyücü pasif: Yenilenme (heal 12% max HP, 10 s) |
| `passive-okcu.webp` | 4 · Okçu pasif: Odaklan (next hit +135%, 10 s) |

After replacing, bump the image query version in `skillIcon` in `duel.js` and `duel.js?v=` in `index.html` so phones load the new images.
