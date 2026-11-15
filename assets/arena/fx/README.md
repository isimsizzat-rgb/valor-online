# Arena particle effects

Real-time particle effects for the arena, played with the Effekseer WebGL runtime.

- `effekseer.min.js`, `effekseer.wasm`: EffekseerForWebGL 1.70e, MIT licence, (c) Effekseer Project.
  https://github.com/effekseer/EffekseerForWebGL
- Effect folders (`blow3`, `fire2`, `light2` from the tktk02 pack; `fire7`, `sword12`, `cure1`, `blow10`, `arrow1`
  from the tktk01 pack): official Effekseer sample effects by tktk, licensed CC0.
  https://effekseer.github.io/en/contribute.html

Each folder holds `effect.efkefc` and its textures (file name = the resource name inside the effect + `.png`).
`../arena-fx.js` loads them on first use; if WebGL or the runtime is unavailable the arena simply plays without them.
