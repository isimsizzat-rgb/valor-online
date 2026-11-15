/* Walking views for existing Macera and Sahne journeys. The journey owns all encounters/rewards. */
(function(){
 'use strict';
 const C=window.ValorWalkCore, active=new Map();
 const themes=[['#283e2d','#47613d','#9d956b','#173b2e'],['#513c32','#77523b','#b29a70','#713b2c'],['#273f3e','#42615b','#91a18a','#244d44'],['#4b4940','#6b6a56','#c4b68e','#454d3a'],['#35364b','#52526b','#9993ae','#353747'],['#344556','#526775','#a4b1b6','#344855'],['#718f99','#a0bcc2','#e0e2cc','#466877'],['#493330','#694237','#ae8666','#542c2a'],['#3e3348','#65506c','#aa8c9d','#392e42'],['#4a4435','#736448','#c8b384','#454634']];
 function context(kind){
  const r=kind==='adventure'?state.adventureRun:stageRun;if(!r)return null;
  const adventure=kind==='adventure',index=adventure?r.i:Math.floor(r.step/2),seed=adventure?r.zone:[0,3,6,7][r.area];
  return {r,index,seed,count:adventure?10:7,title:adventure?valorAdventureZones[r.zone].name:stageAreas[r.area].name,ready:adventure?r.phase==='story':r.step%2===0&&r.step<14&&!r.failed};
 }
 function position(c,map){const p=c.r.walkPosition;return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&map.walkable(p.x,p.y)?{...p}:c.index?{...map.nodes[c.index-1]}:{...map.start}}
 function near(kind){const c=context(kind);if(!c?.ready)return false;const m=C.create(c.seed,c.count),p=position(c,m),t=m.nodes[c.index];return !!t&&Math.hypot(p.x-t.x,p.y-t.y)<66}
 function markup(kind){const c=context(kind);if(!c)return '';return '<div class="valor-walk" data-walk="'+kind+'"><canvas tabindex="0" aria-label="Yürünebilir harita. Ok tuşları veya WASD ile yürü; haritaya dokunarak hedef seç."></canvas><div class="walk-heading">'+(kind==='adventure'?'MACERA':'SAHNE')+' · KEŞİF<strong>'+escapeAttr(c.title)+'</strong></div><div class="walk-hint" role="status">Haritaya dokun veya yön tuşlarıyla yürü.</div><div class="walk-pad" aria-label="Yürüme kontrolleri"><button type="button" data-dir="up" aria-label="Yukarı yürü">↑</button><button type="button" data-dir="left" aria-label="Sola yürü">←</button><button type="button" data-dir="down" aria-label="Aşağı yürü">↓</button><button type="button" data-dir="right" aria-label="Sağa yürü">→</button></div></div>'}
 function mount(el){
  const kind=el.dataset.walk,c=context(kind);if(!c?.ready)return;
  const map=C.create(c.seed,c.count),palette=themes[c.seed],canvas=el.querySelector('canvas'),ctx=canvas.getContext('2d'),abort=new AbortController(),opts={signal:abort.signal};
  let p=position(c,map),route=[],keys=new Set(),last=0,frame=0,moving=false,facing=1,cam={x:0,y:0},w=0,h=0,wasNear=null,dirty=false,lastSaved=0;
  const terrain=document.createElement('canvas');terrain.width=map.width;terrain.height=map.height;const g=terrain.getContext('2d');
  // Paint once: a winding stone trail, open clearings and solid woodland/rocks.
  g.fillStyle=palette[0];g.fillRect(0,0,map.width,map.height);
  for(let y=0;y<C.ROWS;y++)for(let x=0;x<C.COLS;x++){
   const px=x*C.TILE,py=y*C.TILE,n=map.hash(x,y),road=map.road(x,y);
   g.fillStyle=road?palette[2]:palette[1];g.globalAlpha=road?.7:.16+n*.28;g.fillRect(px,py,40,40);g.globalAlpha=1;
   if(road){g.strokeStyle='#fff2';g.strokeRect(px+4+n*6,py+5,24,15);g.fillStyle='#26281844';g.fillRect(px+6,py+27,20,2)}
   else {g.fillStyle='#d9dea222';for(let j=0;j<3;j++)g.fillRect(px+n*28+j*4,py+10+j*8,2,5)}
   if(!map.cells[y][x]){g.fillStyle='#0004';g.beginPath();g.ellipse(px+23,py+30,22,12,0,0,7);g.fill();
    if(n>.3){g.fillStyle='#453b2b';g.fillRect(px+17,py+12,7,20);for(let j=0;j<3;j++){g.fillStyle=j===1?palette[1]:palette[3];g.beginPath();g.moveTo(px+20,py-22+j*12);g.lineTo(px-5+j*3,py+17+j*8);g.lineTo(px+45-j*3,py+17+j*8);g.closePath();g.fill()}}
    else {g.fillStyle='#71756b';g.beginPath();g.moveTo(px+3,py+25);g.lineTo(px+11,py+6);g.lineTo(px+29,py+3);g.lineTo(px+37,py+25);g.closePath();g.fill();g.strokeStyle='#b6baa06b';g.stroke()}
   }
  }
  function persist(){if(!dirty)return;c.r.walkPosition={x:p.x,y:p.y};if(kind==='adventure')save();else stageRunSave();dirty=false;lastSaved=performance.now()}
  function setPosition(){c.r.walkPosition={x:p.x,y:p.y};dirty=true}
  function stop(){keys.clear();route=[];persist()}
  function size(){const r=canvas.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);w=r.width;h=r.height;canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0)}
  const observer=new ResizeObserver(size);observer.observe(canvas);size();
  function key(e,on){const k={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'}[e.key];if(!k)return;e.preventDefault();route=[];on?keys.add(k):keys.delete(k)}
  el.addEventListener('keydown',e=>key(e,true),opts);el.addEventListener('keyup',e=>key(e,false),opts);
  el.addEventListener('focusout',e=>{if(!el.contains(e.relatedTarget))stop()},opts);
  window.addEventListener('blur',stop,opts);window.addEventListener('pagehide',persist,opts);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()},opts);
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus({preventScroll:true});const r=canvas.getBoundingClientRect(),target={x:e.clientX-r.left+cam.x,y:e.clientY-r.top+cam.y};keys.clear();route=map.path(p,target);if(!route.length)el.querySelector('.walk-hint').textContent='Buradan geçilemiyor. Açık bir alan seç.'},opts);
  for(const b of el.querySelectorAll('[data-dir]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);route=[];keys.add(b.dataset.dir)},opts);for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.dir),opts)}
  function draw(t){
   if(!el.isConnected||context(kind)?.r!==c.r){cleanup();return}
   const dt=Math.min(.04,(t-(last||t))/1000);last=t;
   let dx=(keys.has('right')?1:0)-(keys.has('left')?1:0),dy=(keys.has('down')?1:0)-(keys.has('up')?1:0);
   if(route.length&&!dx&&!dy){const next=route[0],dist=Math.hypot(next.x-p.x,next.y-p.y);if(dist<5)route.shift();else {dx=(next.x-p.x)/dist;dy=(next.y-p.y)/dist}}
   const len=Math.hypot(dx,dy),old={...p};if(len){dx=dx/len*180*dt;dy=dy/len*180*dt;if(map.walkable(p.x+dx,p.y))p.x+=dx;if(map.walkable(p.x,p.y+dy))p.y+=dy;if(dx)facing=dx>0?1:-1}
   const nowMoving=Math.hypot(p.x-old.x,p.y-old.y)>.01;if(nowMoving)setPosition();if((moving&&!nowMoving)||(dirty&&t-lastSaved>1500))persist();moving=nowMoving;
   cam.x=Math.max(0,Math.min(map.width-w,p.x-w/2));cam.y=Math.max(0,Math.min(map.height-h,p.y-h*.57));
   ctx.clearRect(0,0,w,h);ctx.drawImage(terrain,cam.x,cam.y,w,h,0,0,w,h);
   ctx.save();ctx.translate(-cam.x,-cam.y);
   map.nodes.forEach((n,i)=>{ctx.globalAlpha=i>c.index?.45:1;ctx.strokeStyle=i<c.index?'#80bd87':i===c.index?'#ffe0a0':'#aa9c7d';ctx.fillStyle=i===c.index?'#4d251e':'#202f29';ctx.lineWidth=2;ctx.beginPath();ctx.arc(n.x,n.y,23+(i===c.index?Math.sin(t/350)*2:0),0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff0cc';ctx.textAlign='center';ctx.font='bold 16px system-ui';ctx.fillText(i<c.index?'✓':i===map.nodes.length-1?'♛':String(i+1),n.x,n.y+6);ctx.globalAlpha=1});
   // Armored traveller: shadow, walking legs, cloak, torso, head and weapon.
   ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(0,5,17,7,0,0,7);ctx.fill();const stride=moving?Math.sin(t/90)*5:0;
   ctx.strokeStyle='#20232a';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(-6+stride,6);ctx.moveTo(5,-5);ctx.lineTo(6-stride,6);ctx.stroke();ctx.fillStyle=state.class==='Büyücü'?'#615399':state.class==='Okçu'?'#447451':'#a33e32';ctx.beginPath();ctx.moveTo(0,-31);ctx.lineTo(-15,-2+stride*.2);ctx.lineTo(14,-2);ctx.closePath();ctx.fill();ctx.fillStyle='#b7c2ba';ctx.fillRect(-8,-27,16,17);ctx.fillStyle='#e2c29b';ctx.beginPath();ctx.arc(0,-34,7,0,7);ctx.fill();ctx.fillStyle='#596571';ctx.fillRect(-7,-40,14,5);ctx.strokeStyle='#d6c895';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(facing*12,-9);ctx.lineTo(facing*19,-32);ctx.stroke();ctx.restore();ctx.restore();
   const target=map.nodes[c.index],distance=Math.hypot(p.x-target.x,p.y-target.y),ready=distance<66;
   if(ready!==wasNear){wasNear=ready;const parent=el.parentElement;parent.querySelectorAll('[data-walk-action]').forEach(b=>b.disabled=!ready);el.querySelector('.walk-hint').textContent=ready?'Karşılaşmaya ulaştın. Aşağıdaki butonla devam et.':'Altın işarete ilerle · Dokun veya yön tuşlarını kullan.'}
   // Compass points at the active encounter even when it is off-screen.
   if(distance>66){const angle=Math.atan2(target.y-p.y,target.x-p.x);ctx.save();ctx.translate(w-35,36);ctx.rotate(angle);ctx.fillStyle='#ffe0a0';ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-8,-7);ctx.lineTo(-4,0);ctx.lineTo(-8,7);ctx.closePath();ctx.fill();ctx.restore()}
   frame=requestAnimationFrame(draw);
  }
  function cleanup(){persist();cancelAnimationFrame(frame);observer.disconnect();abort.abort();active.delete(el)}
  active.set(el,cleanup);frame=requestAnimationFrame(draw);
 }
 function scan(){for(const [el,clean] of active)if(!el.isConnected)clean();document.querySelectorAll('[data-walk]').forEach(el=>{if(!active.has(el))mount(el)})}
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
 window.ValorWalk={markup,near};
 const previous=stageAdventurePage;
 stageAdventurePage=function(){let html=previous.apply(this,arguments);const c=context('stage');if(!c?.ready)return html;html=html.replace(/<img class="stage-adventure-art"[^>]*>/,markup('stage'));return html.replace('<button onclick="stageNext()">','<button data-walk-action disabled onclick="stageNext()">')};
 const advance=stageNext;stageNext=function(){if(context('stage')?.ready&&!near('stage'))return toast('Önce haritadaki karşılaşmaya yaklaş.');return advance.apply(this,arguments)};
 scan();
})();
