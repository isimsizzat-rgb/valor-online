/* Walking views for existing Macera and Sahne journeys. The journey owns all encounters/rewards. */
(function(){
 'use strict';
 const C=window.ValorWalkCore,A=window.ValorWalkArt, active=new Map();
 const AGGRO=104;
 const themes=[['#283e2d','#47613d','#9d956b','#173b2e'],['#513c32','#77523b','#b29a70','#713b2c'],['#273f3e','#42615b','#91a18a','#244d44'],['#4b4940','#6b6a56','#c4b68e','#454d3a'],['#35364b','#52526b','#9993ae','#353747'],['#344556','#526775','#a4b1b6','#344855'],['#718f99','#a0bcc2','#e0e2cc','#466877'],['#493330','#694237','#ae8666','#542c2a'],['#3e3348','#65506c','#aa8c9d','#392e42'],['#4a4435','#736448','#c8b384','#454634']];
 function context(kind){
  const r=kind==='adventure'?state.adventureRun:stageRun;if(!r)return null;
  const adventure=kind==='adventure',index=adventure?r.i:Math.floor(r.step/2),seed=adventure?r.zone:[0,3,6,7][r.area];
  return {r,index,seed,count:adventure?10:7,title:adventure?valorAdventureZones[r.zone].name:stageAreas[r.area].name,ready:adventure?r.phase==='story':r.step%2===0&&r.step<14&&!r.failed};
 }
 function position(c,map){const p=c.r.walkPosition;return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&map.walkable(p.x,p.y)?{...p}:c.index?{...map.nodes[c.index-1]}:{...map.start}}
 function near(kind){const c=context(kind);if(!c?.ready)return false;const m=C.create(c.seed,c.count),p=position(c,m),t=m.nodes[c.index];return !!t&&Math.hypot(p.x-t.x,p.y-t.y)<AGGRO}
 function markup(kind){const c=context(kind);if(!c)return '';return '<div class="valor-walk" data-walk="'+kind+'"><canvas tabindex="0" aria-label="Yürünebilir harita. Ok tuşları veya WASD ile yürü; haritaya dokunarak hedef seç."></canvas><div class="walk-heading">'+(kind==='adventure'?'MACERA':'SAHNE')+' · '+(c.index+1)+' / '+c.count+'<strong>'+escapeAttr(c.title)+'</strong></div><button type="button" class="walk-close" onclick="ValorWalk.close(\''+kind+'\')" aria-label="Haritadan çık, ilerlemeyi koru">✕</button><div class="walk-hint" role="status">Joystick ile yürü veya haritaya dokun.</div><div class="walk-joystick" role="group" aria-label="Hareket joysticki"><span class="walk-stick"></span></div></div>'}
 function close(kind){if(kind==='adventure')valorExpedition.close();else go('Sahneler')}
 function engage(kind){const c=context(kind);if(!c?.ready||!near(kind))return false;
  if(kind==='adventure'){valorExpedition.ambush();return true}
  stageNext();const r=stageRun;if(!r||r.step%2!==1||!r.enemy||r.walkAmbushedStep===r.step)return false;
  r.walkAmbushedStep=r.step;const {me,foe}=valorStageUnits(r,valorArenaStats()),hit=valorArenaHit(foe,me);const damage=Math.min(r.hp,Math.max(0,hit.damage));r.hp=Math.max(0,r.hp-damage);r.message=r.enemy.name+' sana saldırdı! −'+money(damage)+' Can';if(r.hp===0)r.failed=true;stageRunSave();render();return true;
 }
 function mount(el){
  const kind=el.dataset.walk,c=context(kind);if(!c?.ready)return;A.preload(state.class,state.gender);
  const map=C.create(c.seed,c.count),palette=themes[c.seed],canvas=el.querySelector('canvas'),ctx=canvas.getContext('2d'),abort=new AbortController(),opts={signal:abort.signal};
  let p=position(c,map),route=[],keys=new Set(),last=0,frame=0,moving=false,facing=1,cam={x:0,y:0},w=0,h=0,wasNear=null,dirty=false,lastSaved=0,zoom=1,triggered=false,engageTimer=null,ambushAt=0,terrainVersion=-1,stick={x:0,y:0,id:null},destination=null;
  const terrainScale=c.seed===0?2:1,terrain=document.createElement('canvas');terrain.width=map.width*terrainScale;terrain.height=map.height*terrainScale;const g=terrain.getContext('2d');g.scale(terrainScale,terrainScale);
  function paintTerrain(){
   terrainVersion=A.version;if(A.backdrop(g,c.seed,map.width,map.height))return;g.fillStyle=palette[0];g.fillRect(0,0,map.width,map.height);
   for(let y=0;y<C.ROWS;y++)for(let x=0;x<C.COLS;x++){
    const px=x*C.TILE,py=y*C.TILE,n=map.hash(x,y),road=map.road(x,y);

    for(let j=0;j<22;j++){const v=map.hash(x*23+j,y*17+j);g.fillStyle=j%3===0?'#d2c9a22b':'#060e1433';g.beginPath();g.ellipse(px+v*40,py+map.hash(y+j,x)*40,road?3+v*5:1+v*2,road?2+v*3:1,0,0,7);g.fill()}
   }
   const trail=[map.start,...C.create(c.seed,10).nodes];
   g.lineCap='round';g.lineJoin='round';
   for(const [width,alpha] of [[136,.06],[118,.09],[100,.16],[80,.32]]){g.strokeStyle=palette[2];g.globalAlpha=alpha;g.lineWidth=width;g.beginPath();trail.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.stroke()}g.globalAlpha=1;
   for(let y=0;y<C.ROWS;y++)for(let x=0;x<C.COLS;x++)if(!map.cells[y][x]){const n=map.hash(x,y),tree=c.seed===1?1:c.seed===6?3:c.seed>=7?2:0,id=n>.6?tree:c.seed>=7?4:5;A.scenery(g,id,x*40+20,y*40+36,id<4?64:48)}
   // Sparse foliage around clearings breaks up the grid without covering the trail.
   for(let y=2;y<C.ROWS-2;y++)for(let x=2;x<C.COLS-2;x++)if(!map.road(x,y)&&map.hash(x+41,y)>.91)A.scenery(g,7,x*40+20,y*40+30,38);

  }
  function persist(){if(!dirty)return;c.r.walkPosition={x:p.x,y:p.y};if(kind==='adventure')save();else stageRunSave();dirty=false;lastSaved=performance.now()}
  function setPosition(){c.r.walkPosition={x:p.x,y:p.y};dirty=true}
  function resetStick(){stick.x=stick.y=0;stick.id=null;const knob=el.querySelector('.walk-stick');if(knob)knob.style.transform='translate(0px,0px)'}
  function stop(){keys.clear();route=[];destination=null;resetStick();persist()}
  function size(){const r=canvas.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);w=r.width;h=r.height;zoom=Math.max(1.2,w/map.width,h/map.height);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);updateCamera()}
  function updateCamera(){cam.x=Math.max(0,Math.min(map.width-w/zoom,p.x-w/zoom/2));cam.y=Math.max(0,Math.min(map.height-h/zoom,p.y-h/zoom*.57))}
  const observer=new ResizeObserver(size);observer.observe(canvas);size();
  function key(e,on){const k={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'}[e.key];if(!k)return;e.preventDefault();route=[];on?keys.add(k):keys.delete(k)}
  el.addEventListener('keydown',e=>key(e,true),opts);el.addEventListener('keyup',e=>key(e,false),opts);
  el.addEventListener('focusout',e=>{if(!el.contains(e.relatedTarget))stop()},opts);
  window.addEventListener('blur',stop,opts);window.addEventListener('pagehide',persist,opts);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()},opts);
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus({preventScroll:true});const r=canvas.getBoundingClientRect(),target={x:(e.clientX-r.left)/zoom+cam.x,y:(e.clientY-r.top)/zoom+cam.y};keys.clear();resetStick();route=map.path(p,target);destination=route.length?route[route.length-1]:null;if(!route.length)el.querySelector('.walk-hint').textContent='Buradan geçilemiyor. Açık bir alan seç.'},opts);
  const joystick=el.querySelector('.walk-joystick');
  if(joystick){const move=e=>{if(stick.id!==e.pointerId)return;e.preventDefault();const r=joystick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,len=Math.hypot(dx,dy),radius=r.width*.32,scale=len>radius?radius/len:1;stick.x=len<8?0:dx*scale/radius;stick.y=len<8?0:dy*scale/radius;el.querySelector('.walk-stick').style.transform='translate('+dx*scale+'px,'+dy*scale+'px)'};
   joystick.addEventListener('pointerdown',e=>{if(stick.id!==null)return;keys.clear();route=[];destination=null;stick.id=e.pointerId;joystick.setPointerCapture(e.pointerId);move(e)},opts);joystick.addEventListener('pointermove',move,opts);
   for(const event of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(event,e=>{if(stick.id===e.pointerId){resetStick();persist()}},opts);
  }
  function draw(t){
   if(!el.isConnected||context(kind)?.r!==c.r||!context(kind)?.ready){cleanup();return}
   if(document.hidden){last=t;frame=requestAnimationFrame(draw);return}
   if(terrainVersion!==A.version)paintTerrain();
   const dt=Math.min(.04,(t-(last||t))/1000);last=t;
   let dx=stick.x||(keys.has('right')?1:0)-(keys.has('left')?1:0),dy=stick.y||(keys.has('down')?1:0)-(keys.has('up')?1:0);
   if(route.length&&!dx&&!dy){const next=route[0],dist=Math.hypot(next.x-p.x,next.y-p.y);if(dist<5)route.shift();else {dx=(next.x-p.x)/dist;dy=(next.y-p.y)/dist}}
   const len=Math.hypot(dx,dy),old={...p};if(len&&!triggered){const speed=stick.id!==null?Math.min(1,len):1;dx=dx/len*180*dt*speed;dy=dy/len*180*dt*speed;if(map.walkable(p.x+dx,p.y))p.x+=dx;if(map.walkable(p.x,p.y+dy))p.y+=dy;if(dx)facing=dx>0?1:-1}
   const nowMoving=Math.hypot(p.x-old.x,p.y-old.y)>.01;if(nowMoving)setPosition();if((moving&&!nowMoving)||(dirty&&t-lastSaved>1500))persist();moving=nowMoving;
   const vw=w/zoom,vh=h/zoom;updateCamera();
   ctx.clearRect(0,0,w,h);ctx.drawImage(terrain,cam.x*terrainScale,cam.y*terrainScale,vw*terrainScale,vh*terrainScale,0,0,w,h);
   ctx.save();ctx.scale(zoom,zoom);ctx.translate(-cam.x,-cam.y);
   if(destination&&route.length){ctx.strokeStyle='#e9d29a';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(destination.x,destination.y,13,7,0,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(destination.x-5,destination.y);ctx.lineTo(destination.x+5,destination.y);ctx.moveTo(destination.x,destination.y-4);ctx.lineTo(destination.x,destination.y+4);ctx.stroke()}
   const entities=map.nodes.map((n,i)=>({n,i})).filter(e=>e.i>=c.index);entities.push({n:p,i:-1});entities.sort((a,b)=>a.n.y-b.n.y);
   for(const {n,i} of entities){
    if(i===-1){A.hero(ctx,state.class,state.gender,p.x,p.y,94,t,moving,facing);continue}
    const info=A.info(kind,c.r,i),current=i===c.index;let ex=n.x,ey=n.y;
    if(current&&triggered&&!info.chest){const q=Math.min(1,(t-ambushAt)/420);ex+=(p.x-n.x)*q*.65;ey+=(p.y-n.y)*q*.65}
    if(current){ctx.strokeStyle=triggered?'#ff6255':'#d9ad6688';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(n.x,n.y,AGGRO,AGGRO*.55,0,0,7);ctx.stroke()}
    A.enemy(ctx,info,ex,ey,info.boss?140:info.chest?70:100,t,ex<p.x);
    ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.fillStyle=info.boss?'#ffd391':'#fff0da';ctx.shadowColor='#000';ctx.shadowBlur=5;ctx.fillText(info.name,ex,ey+(info.boss?22:17));ctx.shadowBlur=0;
   }
   ctx.restore();
   const target=map.nodes[c.index],distance=Math.hypot(p.x-target.x,p.y-target.y),ready=distance<AGGRO;
   if(ready!==wasNear){wasNear=ready;el.parentElement.querySelectorAll('[data-walk-action]').forEach(b=>b.disabled=!ready);el.querySelector('.walk-hint').textContent=ready?'Dikkat! Karşılaşma başlıyor…':'Joystick ile yürü veya haritaya dokun'}
   if(ready&&!triggered){triggered=true;ambushAt=t;stop();const expectedIndex=c.index;engageTimer=setTimeout(()=>{const live=context(kind);if(el.isConnected&&!document.hidden&&live?.r===c.r&&live.index===expectedIndex&&live.ready)engage(kind);else {triggered=false;ambushAt=0}},500)}
   // Compact minimap keeps destinations visible on a full-screen mobile viewport.
   const mw=96,mh=70,mx=w-mw-16,my=82;ctx.fillStyle='#0a191dcc';ctx.fillRect(mx-5,my-5,mw+10,mh+10);
   map.nodes.forEach((n,i)=>{ctx.fillStyle=i<c.index?'#75a47a':i===c.index?'#ffbe75':'#b2aaa1';ctx.beginPath();ctx.arc(mx+n.x/map.width*mw,my+n.y/map.height*mh,i===c.index?3:2,0,7);ctx.fill()});ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(mx+p.x/map.width*mw,my+p.y/map.height*mh,3,0,7);ctx.fill();
   frame=requestAnimationFrame(draw);
  }
  function cleanup(){clearTimeout(engageTimer);persist();cancelAnimationFrame(frame);observer.disconnect();abort.abort();active.delete(el)}
  active.set(el,cleanup);draw(performance.now());
 }
 function scan(){for(const [el,clean] of active)if(!el.isConnected)clean();document.querySelectorAll('[data-walk]').forEach(el=>{if(!active.has(el))mount(el)})}
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
 window.ValorWalk={markup,near,engage,close};
 const previous=stageAdventurePage;
 stageAdventurePage=function(){let html=previous.apply(this,arguments);const c=context('stage');if(!c)return html;html=html.replace('class="stage-adventure"','class="stage-adventure walk-stage-screen"');if(!c.ready){if(stageRun.enemy){const info=A.info('stage',stageRun,Math.floor(stageRun.step/2));html=html.replace(/<img class="stage-adventure-art"[^>]*>/,'<div class="walk-stage-enemy">'+A.enemyHtml(info)+'</div>')}return html;}html=html.replace(/<img class="stage-adventure-art"[^>]*>/,markup('stage'));return html.replace('<button onclick="stageNext()">','<button data-walk-action disabled onclick="stageNext()">')};
 const advance=stageNext;stageNext=function(){if(context('stage')?.ready&&!near('stage'))return toast('Önce haritadaki karşılaşmaya yaklaş.');return advance.apply(this,arguments)};
 scan();
})();
