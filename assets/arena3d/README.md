# 3D arena trial

`arena3d.html` (repo root) is a stand-alone test page for a real-3D arena. It has its own simple fight rules and
does not read or write save data, call the server, or give rewards. Nothing in the main game links to it or loads it.

- `arena3d.js`: scene, camera, fighters, skills and the small fight loop.
- `models/`: KayKit Adventurers characters (Knight, Mage, Rogue_Hooded) by Kay Lousberg, CC0, trimmed to the
  26 animations the page uses. https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
- `vendor/`: three.js r160 (MIT) with GLTFLoader and its helpers.
- Particles reuse `../arena/fx` (Effekseer, see its README).

To use other characters, put a rigged `.glb` in `models/` and point the class entry in `arena3d.js` at it; the
animation names used by the skills are listed there.
