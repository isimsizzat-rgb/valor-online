/* Arena particle layer. Plays Effekseer effects (real-time particles) on a WebGL canvas laid over the painted arena.
   Cosmetic only and fully optional: when WebGL, WebAssembly or a file is missing, nothing is drawn and the fight
   plays exactly as before. The runtime (about 1.4 MB) is fetched the first time an arena opens, not at page load. */
(function(){'use strict';
 const base='assets/arena/fx/',VERSION='1';
 /* name -> size of one effect unit in arena pixels (the packs use very different scales). */
 const EFFECTS={blow3:25,fire2:62,fire7:17,sword12:17,cure1:60,blow10:26,light2:20,arrow1:44};
 let state='idle',gl=null,ctx=null,layer=null,last=0;const loaded={};
 function boot(){if(state!=='idle')return;state='loading';
  try{if(typeof WebAssembly!=='object'||typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches){state='off';return}}catch(error){state='off';return}
  const script=document.createElement('script');script.src=base+'effekseer.min.js?v='+VERSION;script.onerror=()=>{state='off'};
  script.onload=()=>{try{window.effekseer.initRuntime(base+'effekseer.wasm?v='+VERSION,start,()=>{state='off'})}catch(error){state='off'}};document.head.appendChild(script)}
 function start(){try{
   layer=document.createElement('canvas');layer.className='valor-fx-layer';layer.setAttribute('aria-hidden','true');
   gl=layer.getContext('webgl',{alpha:false,antialias:false,depth:true,stencil:false,powerPreference:'low-power'});if(!gl){state='off';return}
   layer.addEventListener('webglcontextlost',event=>{event.preventDefault();state='off';layer.remove()});
   ctx=window.effekseer.createContext();ctx.init(gl);
   for(const name of Object.keys(EFFECTS)){const dir=base+name+'/';const effect=ctx.loadEffect(dir+'effect.efkefc?v='+VERSION,1,()=>{loaded[name]=effect},()=>{},path=>/\.efkefc/.test(path)?path:path+'.png')}
   state='ready'}catch(error){state='off'}}
 /* Put the layer over a stage canvas (one WebGL context is shared by every arena screen). */
 function attach(wrap,canvas){boot();if(state!=='ready'||!wrap||typeof wrap.appendChild!=='function')return false;
  if(layer.width!==canvas.width||layer.height!==canvas.height){layer.width=canvas.width;layer.height=canvas.height}
  if(layer.parentNode!==wrap){ctx.stopAll();wrap.appendChild(layer)}return true}
 /* x, y: arena pixels in the painted scene (before the camera). size multiplies the effect's normal size. */
 function burst(name,x,y,size=1){if(state!=='ready'||!loaded[name]||!layer.isConnected)return;
  try{const handle=ctx.play(loaded[name],x,-y,0),k=EFFECTS[name]*size;handle.setScale(k,k,k)}catch(error){}}
 /* Called once per drawn frame with the camera the painted scene used, so particles stay glued to the fighters. */
 function frame(wrap,canvas,cam,floor){if(!attach(wrap,canvas))return;
  try{const now=performance.now(),w=canvas.width,h=canvas.height,frames=last?Math.min(4,Math.max(0,(now-last)/1000*60)):1;last=now;
   const cx=cam.fx-cam.sx/cam.z,cy=floor+(h/2-floor-cam.sy)/cam.z;
   ctx.update(frames);ctx.setProjectionOrthographic(w/cam.z,h/cam.z,1,2000);ctx.setCameraLookAt(cx,-cy,1000,cx,-cy,0,0,1,0);
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);ctx.draw()}catch(error){state='off';layer.remove()}}
 function detach(wrap){if(layer&&layer.parentNode===wrap){try{ctx.stopAll()}catch(error){}layer.remove()}}
 window.ValorArenaFx={boot,frame,burst,detach,ready:()=>state==='ready'};
 /* Black + "screen" blending makes the particle canvas add light to the painting underneath, like a glow. */
 const style=document.createElement('style');style.textContent='.valor-fx-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen}';document.head.appendChild(style);
})();
