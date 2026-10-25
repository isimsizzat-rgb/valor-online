(function(){
 const labels={idle:'Bekleme',walk:'Yürüme',attack:'Kılıç Saldırısı',hit:'Darbe Alma',defeat:'Yenilme'};
 const images={};let ready=null,session=null;
 function preload(){if(!ready)ready=Promise.all(Object.entries(VALOR_WARRIOR_MOTION_ART.actions).map(([name,art])=>new Promise((resolve,reject)=>{const image=new Image();images[name]=image;image.onload=()=>resolve();image.onerror=()=>reject(new Error('Savaşçı görseli yüklenemedi'));image.src=art.src})));return ready}
 function starterWorn(){return state.class==='Savaşçı'&&!state.equipped?.Kanat?.wingId&&['Silah','Zırh','Kask','Ayakkabı'].every(slot=>state.equipped?.[slot]?.starterSet==='starter-v1')}
 function controlHtml(){return '<div class="vwm-actions" aria-label="Savaşçı hareketleri">'+Object.entries(labels).map(([name,label])=>'<button type="button" data-motion="'+name+'" aria-pressed="false" onclick="valorWarriorPlayMotion(\''+name+'\')">'+label+'</button>').join('')+'</div>'}
 function showFrame(s,name,frame){const art=VALOR_WARRIOR_MOTION_ART.actions[name],el=s.sprite;el.style.backgroundImage='url("'+art.src+'")';el.style.backgroundSize=(art.frames*100)+'% 100%';el.style.backgroundPosition=(art.frames===1?0:frame/(art.frames-1)*100)+'% 0';el.dataset.action=name;el.dataset.frame=String(frame);s.stage.classList.toggle('vwm-cut',name==='attack'&&frame>=3&&frame<=4);s.stage.classList.toggle('vwm-hurt',name==='hit'&&frame===1)}
 function play(s,name,{loop=false,hold=false,done=null}={}){
  cancelAnimationFrame(s.raf);if(session!==s)return;
  const art=VALOR_WARRIOR_MOTION_ART.actions[name];if(!art)return;
  s.status.textContent=labels[name];s.root.querySelectorAll('[data-motion]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.motion===name)));
  const start=performance.now();showFrame(s,name,0);
  const tick=now=>{if(session!==s||!s.root.isConnected)return;const step=Math.floor((now-start)/art.frameMs);if(!loop&&step>=art.frames){showFrame(s,name,art.frames-1);if(done)done();else if(!hold)play(s,'idle',{loop:true});return}showFrame(s,name,step%art.frames);s.raf=requestAnimationFrame(tick)};
  s.raf=requestAnimationFrame(tick);
 }
 function stopDemo(s){s.version++;clearTimeout(s.demoTimer);cancelAnimationFrame(s.raf)}
 window.valorWarriorPlayMotion=async function(name){const s=session;if(!s||!Object.hasOwn(labels,name))return;stopDemo(s);const version=s.version;try{await preload();if(session===s&&version===s.version)play(s,name,{loop:name==='idle'||name==='walk',hold:name==='defeat'})}catch{if(session===s)s.status.textContent='Görseller yüklenemedi. Yeniden açmayı dene.'}};
 window.valorWarriorMotionDemo=async function(){const s=session;if(!s)return;stopDemo(s);const version=s.version;await preload();if(session!==s||s.version!==version)return;const steps=[['idle',1300],['walk',1500],['attack',850],['attack',850],['hit',650],['defeat',1300],['idle',0]];let index=0;const advance=()=>{if(session!==s||s.version!==version)return;const [name,duration]=steps[index++];play(s,name,{loop:name==='idle'||name==='walk',hold:true});if(duration)s.demoTimer=setTimeout(advance,duration)};advance()};
 window.valorCloseWarriorMotion=function(){const s=session;if(!s)return;stopDemo(s);session=null;s.root.remove();document.body.style.overflow=s.previousOverflow;document.removeEventListener('keydown',s.keyHandler);if(s.opener?.isConnected)s.opener.focus({preventScroll:true})};
 window.valorOpenWarriorMotion=async function(){
  if(session){session.root.querySelector('.vwm-close')?.focus();return}
  const root=document.createElement('div');root.className='vwm-overlay';root.id='valor-warrior-motion';
  root.innerHTML='<section class="vwm-dialog" role="dialog" aria-modal="true" aria-labelledby="vwm-title"><button class="vwm-close" type="button" onclick="valorCloseWarriorMotion()" aria-label="Kapat">×</button><header class="vwm-heading"><img src="'+VALOR_WARRIOR_MOTION_ART.portrait+'" alt="Acemi Savaşçı portresi" width="60" height="60"><div><small>1. SEVİYE · SAVAŞÇI</small><h2 id="vwm-title">Acemi Savaşçı</h2></div></header><div class="vwm-stage"><div class="vwm-ground"></div><div class="vwm-sprite" role="img" aria-label="Başlangıç ekipmanlarıyla hareket eden savaşçı"></div><div class="vwm-slash" aria-hidden="true"></div></div><p class="vwm-status" aria-live="polite">Görseller hazırlanıyor…</p>'+controlHtml()+'<button type="button" class="vwm-demo" onclick="valorWarriorMotionDemo()">Tüm Hareketleri İzle</button><div class="vwm-equipment"><span>Acemi Kılıcı</span><span>Yıpranmış Deri Zırh</span><span>Eski Demir Miğfer</span><span>Yıpranmış Çizmeler</span></div></section>';
  const s={root,sprite:root.querySelector('.vwm-sprite'),stage:root.querySelector('.vwm-stage'),status:root.querySelector('.vwm-status'),raf:0,demoTimer:0,version:0,opener:document.activeElement,previousOverflow:document.body.style.overflow};
  s.keyHandler=event=>{if(event.key==='Escape')valorCloseWarriorMotion();if(event.key==='Tab'){const buttons=[...s.root.querySelectorAll('button:not([disabled])')],first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}};
  session=s;root.addEventListener('click',event=>{if(event.target===root)valorCloseWarriorMotion()});document.body.appendChild(root);document.body.style.overflow='hidden';document.addEventListener('keydown',s.keyHandler);root.querySelector('.vwm-close').focus();
  try{await preload();if(session===s){play(s,'idle',{loop:!matchMedia('(prefers-reduced-motion: reduce)').matches,hold:true})}}catch{if(session===s)s.status.textContent='Görseller yüklenemedi. Yeniden açmayı dene.'}
 };
 const previousProfile=profile;
 profile=function(){const html=previousProfile.apply(this,arguments);if(state.class!=='Savaşçı')return html;const template=document.createElement('template');template.innerHTML=html;if(starterWorn()){const hero=template.content.querySelector('.vp-hero'),image=hero?.querySelector('img');if(image){image.src=VALOR_WARRIOR_MOTION_ART.hero;image.alt='1. seviye başlangıç ekipmanlı savaşçı';hero.classList.add('vwm-profile-hero')}}return template.innerHTML};
 const previousRender=render;
 render=function(){const result=previousRender.apply(this,arguments);if(starterWorn()){const portrait=document.getElementById('valor-hud-portrait');if(portrait){portrait.src=VALOR_WARRIOR_MOTION_ART.portrait;portrait.classList.add('vwm-starter-portrait')}const hero=document.querySelector('.vwm-profile-hero'),image=hero?.querySelector('img');if(hero&&image){for(const [name,value]of Object.entries({inset:'6px 14%',width:'72%',height:'calc(100% - 12px)',display:'flex',overflow:'hidden'}))hero.style.setProperty(name,value,'important');for(const[name,value]of Object.entries({inset:'0',width:'100%',height:'100%','object-fit':'contain','object-position':'center bottom',transform:'none'}))image.style.setProperty(name,value,'important')}}else document.getElementById('valor-hud-portrait')?.classList.remove('vwm-starter-portrait');return result};
 const previousGo=go;
 go=function(){if(session)valorCloseWarriorMotion();return previousGo.apply(this,arguments)};
 if(state.class&&typeof valorAccountCanPlay==='function'&&valorAccountCanPlay())render();
})();

/* Play the actual Arena hit ledger before opening the existing rewards dialog. */
(function(){
 let active=null;
 function hasMageArt(){return typeof VALOR_COMBAT_ART!=='undefined'}
 function supported(cls){return cls==='Savaşçı'||cls==='Büyücü'&&hasMageArt()||cls==='Okçu'&&typeof VALOR_ARCHER_MOTION_ART!=='undefined'}
 function actions(cls){if(cls==='Okçu'&&typeof VALOR_ARCHER_MOTION_ART!=='undefined')return VALOR_ARCHER_MOTION_ART.actions;return cls==='Büyücü'&&hasMageArt()?VALOR_COMBAT_ART.mage.actions:VALOR_WARRIOR_MOTION_ART.actions}
 const wingAnchors={
  'Savaşçı':{idle:[[46,35,-5],[46,34,-4],[46,35,-5],[46,36,-6]],attack:[[46,36,-8],[48,35,-12],[51,35,-15],[53,39,4],[49,37,5],[46,35,-4]],hit:[[46,38,-10],[42,39,-20],[44,38,-12],[46,35,-5]],defeat:[[46,42,-12],[45,53,-25],[47,67,-45],[49,79,-65],[52,86,-82],[54,89,-88]]},
  'Büyücü':{idle:[[47,38,-4],[47,37,-3],[47,38,-4],[47,39,-5]],attack:[[47,39,-4],[47,40,-6],[46,42,-10],[47,41,-10]],hit:[[46,41,-10],[43,40,-20],[45,41,-9],[47,38,-4]],defeat:[[47,43,-10],[46,57,-25],[48,80,-60],[48,87,-85]]},
  'Okçu':{idle:[[46,36,-4],[46,35,-3],[46,36,-4],[46,37,-5]],attack:[[45,37,-6],[44,35,-9],[44,36,-9],[46,36,-4]],hit:[[43,43,-14],[43,39,-25],[46,44,-14],[46,36,-4]],defeat:[[45,46,-12],[45,61,-25],[52,80,-65],[57,88,-87]]}
 };
 function wingId(value){const id=typeof value==='string'?value:value?.wingId;return typeof valorWings!=='undefined'&&valorWings.some(w=>w.id===id)?id:null}
 function wingMarkup(id){const w=typeof valorWings!=='undefined'&&valorWings.find(w=>w.id===id);return w?'<div class="vab-wings" role="img" aria-label="'+escapeAttr(w.name)+'" data-wing="'+w.id+'" style="--vab-wing-art:url('+valorWingArt(w)+');--vab-wing-color:'+w.color+'"><div class="vab-wing-half vab-wing-left"></div><div class="vab-wing-half vab-wing-right"></div></div>':''}
 function moveWings(s,side,name,frame,now){
  const wing=s.wings[side];if(!wing)return;
  const table=wingAnchors[s.classes[side]],points=table?.[name]||table?.idle;if(!points)return;
  const a=points[Math.min(frame,points.length-1)],fall=name==='defeat',progress=fall?Math.min(1,frame/(points.length-1)):0;
  const flap=fall?28+progress*50:22+Math.sin((now-s.started)/650*Math.PI+(side==='enemy'?.7:0))*10+(name==='attack'?9:0);
  wing.style.left=a[0]+'%';wing.style.top=a[1]+'%';wing.style.transform='translate(-50%,-53%) rotate('+a[2]+'deg) scale('+(1-progress*.3)+')';
  wing.style.setProperty('--vab-wing-fold',flap+'deg');wing.style.opacity=String(1-progress*.18);wing.dataset.action=name;wing.dataset.frame=String(frame);
 }
 function effectMarkup(){return '<div class="vab-fx" aria-hidden="true"><div class="vab-vfx-sprite"></div></div><div class="vab-arrow" aria-hidden="true"><svg viewBox="0 0 120 14"><path d="M9 7H106" stroke="#aa8552" stroke-width="2.2"/><path d="m103 3 15 4-15 4 3-4Z" fill="#d6dad4"/><path d="M5 2 22 4 29 7 11 6ZM5 12 22 10 29 7 11 8Z" fill="#c9bd9c"/></svg></div>'}
 function prepareEffect(s,attacker,target){
  if(typeof VALOR_COMBAT_VFX==='undefined')return;
  const kind=s.classes[attacker]==='Büyücü'?'mage':s.classes[attacker]==='Okçu'?'archer':'sword',art=VALOR_COMBAT_VFX[kind==='archer'?'sword':kind],fx=s.root.querySelector('.vab-fx');
  fx.dataset.kind=kind;fx.dataset.target=target;fx.dataset.attacker=attacker;
  const sprite=fx.firstElementChild;sprite.style.backgroundImage='url("'+art.src+'")';sprite.style.backgroundSize=art.frames*100+'% 100%';
  fx.style.visibility='hidden';s.effect={kind,art,frameStart:kind==='archer'?3:0,start:performance.now()+(kind==='archer'?300:160),fx,sprite};
  if(kind==='archer'){const arena=s.root.querySelector('.vab-arena'),box=s.fighters[attacker].getBoundingClientRect(),stage=arena.getBoundingClientRect(),forward=attacker==='me';s.shot={start:performance.now()+200,attacker,element:s.root.querySelector('.vab-arrow'),fromX:(box.left-stage.left+box.width*(forward?.86:.14))/stage.width*100,fromY:(box.top-stage.top+box.height*.31)/stage.height*100};}
 }
 function impact(s,attacker,target){
  s.root.querySelector('.vab-arena').dataset.impact=s.classes[attacker]==='Büyücü'?'mage':s.classes[attacker]==='Okçu'?'archer':'sword';
  s.hitStopUntil=performance.now()+45;
 }
 const beforeSimulate=valorArenaSimulate;
 valorArenaSimulate=function(myStats,myClass,rivalStats,rivalClass){
  const result=beforeSimulate.apply(this,arguments);
  result.motionClasses=[myClass,rivalClass];result.motionWings=[wingId(state.equipped?.Kanat),null];return result;
 };
 const beforeWait=valorArenaBeginWait;
 valorArenaBeginWait=function(finish){
  if(!supported(state.class))return beforeWait.apply(this,arguments);
  if(active||valorArenaPendingBattle||document.getElementById('valor-arena-result'))return;
  if(page==='Savaş')finish();
 };
 const beforeResult=valorArenaResult;
 function clean(){
  const s=active;if(!s)return;active=null;cancelAnimationFrame(s.raf);clearTimeout(s.timer);
  document.removeEventListener('keydown',s.key);s.root.remove();document.body.style.overflow=s.overflow;
 }
 function finish(){const s=active;if(!s)return;const result=s.result;clean();beforeResult(result);document.querySelector('#valor-arena-result button')?.focus()}
 const beforeGo=go;
 go=function(){clean();return beforeGo.apply(this,arguments)};
 function setHp(s,side,value,max){
  const box=s.root.querySelector('[data-health="'+side+'"]');
  box.querySelector('b').textContent=money(value)+' / '+money(max);
  box.querySelector('i').style.width=Math.max(0,Math.min(100,value/max*100))+'%';
 }
 function pose(s,side,name,hold=false){s.poses[side]={name,start:performance.now(),hold};s.fighters[side].dataset.action=name}
 function hp(s,event){setHp(s,'me',event.myHp,s.result.myMaxHp);setHp(s,'enemy',event.enemyHp,s.result.enemyMaxHp)}
 function damage(s,side,value,hit){
  const el=s.fighters[side].querySelector('.vab-damage');el.className='vab-damage';el.textContent='−'+money(value)+(hit?.critical?' Kritik!':hit?.blocked?' Bloke!':'');
  void el.offsetWidth;el.classList.add('vab-float');
  const heal=hit?.healed;if(heal){const label=document.createElement('span');label.className='vab-heal';label.textContent='+'+money(heal);label.addEventListener('animationend',()=>label.remove(),{once:true});s.fighters[side].appendChild(label)}
 }
 function next(s){
  if(active!==s||!s.root.isConnected)return;
  if(s.index>=s.steps.length){
   hp(s,s.result);if(s.result.myHp===0)pose(s,'me','defeat',true);if(s.result.enemyHp===0)pose(s,'enemy','defeat',true);
   s.status.textContent=s.result.draw?'Savaş sonuçsuz kaldı.':s.result.win?'Rakip yenildi!':'Savaşçın yenildi.';
   s.timer=setTimeout(finish,1050);return;
  }
  const step=s.steps[s.index++];
  s.round.textContent=step.round+'. TUR';
  if(step.side==='effects'){
   hp(s,step);if(step.mine)damage(s,'enemy',step.mine);if(step.theirs)damage(s,'me',step.theirs);
   s.status.textContent='Tur sonu etkileri';s.timer=setTimeout(()=>next(s),450);return;
  }
  const target=step.side==='me'?'enemy':'me';pose(s,step.side,'attack');prepareEffect(s,step.side,target);
  s.status.textContent=(step.side==='me'?s.myName:s.result.opponent)+' saldırıyor!';
  s.timer=setTimeout(()=>{
   if(active!==s)return;pose(s,target,'hit');hp(s,step);damage(s,target,step.damage,step.hit);impact(s,step.side,target);
   s.root.querySelector('.vab-arena').classList.remove('vab-impact');void s.root.offsetWidth;s.root.querySelector('.vab-arena').classList.add('vab-impact');
   s.timer=setTimeout(()=>next(s),470);
  },300);
 }
 function tick(s,now){
  if(active!==s)return;
  if(!s.root.isConnected){clean();return}
  if(s.shot){const shot=s.shot,t=(now-shot.start)/100,forward=shot.attacker==='me';shot.element.style.visibility=t>=0&&t<1?'visible':'hidden';if(t>=0&&t<1){shot.element.style.left=(shot.fromX+((forward?74:26)-shot.fromX)*t)+'%';shot.element.style.top=(shot.fromY+(48-shot.fromY)*t)+'%';shot.element.style.transform='translate(-50%,-50%) '+(forward?'rotate(6deg)':'rotate(174deg)')}}
  if(s.effect){const e=s.effect,art=e.art,elapsed=now-e.start,localFrame=Math.floor(elapsed/art.frameMs),frame=localFrame+e.frameStart;e.fx.style.visibility=localFrame>=0&&frame<art.frames?'visible':'hidden';if(localFrame>=0&&frame<art.frames){e.sprite.style.backgroundPosition=frame/(art.frames-1)*100+'% 0';e.sprite.dataset.frame=String(frame)}}
  if(now<s.hitStopUntil){s.raf=requestAnimationFrame(t=>tick(s,t));return}
  for(const side of ['me','enemy']){
   const p=s.poses[side],bank=actions(s.classes[side]),art=bank[p.name];
   let frame=Math.floor((now-p.start)/art.frameMs);
   if(frame>=art.frames&&!p.hold&&p.name!=='idle'){pose(s,side,'idle');frame=0}
   const current=bank[s.poses[side].name],sprite=s.fighters[side].querySelector('.vab-sprite');
   frame=s.poses[side].hold?Math.min(frame,current.frames-1):frame%current.frames;
   sprite.dataset.frame=String(frame);moveWings(s,side,s.poses[side].name,frame,now);
   if(supported(s.classes[side])){
    if(sprite.dataset.sheet!==s.poses[side].name){sprite.style.backgroundImage='url("'+current.src+'")';sprite.style.backgroundSize=current.frames*100+'% 100%';sprite.dataset.sheet=s.poses[side].name}
    sprite.style.backgroundPosition=frame/(current.frames-1)*100+'% 0';
   }
  }
  s.raf=requestAnimationFrame(t=>tick(s,t));
 }
 valorArenaResult=function(result){
  if(!supported(state.class)||!result.log?.length||!result.log.every(r=>Array.isArray(r.events))||matchMedia('(prefers-reduced-motion: reduce)').matches)return beforeResult.apply(this,arguments);
  clean();document.getElementById('valor-arena-result')?.remove();
  const root=document.createElement('div');root.id='valor-arena-result';root.className='vab-overlay';
  const cls=result.motionClasses||[state.class,'Savaşçı'],myName=state.name||'Sen';
  const myWing=wingId(Array.isArray(result.motionWings)?result.motionWings[0]:state.equipped?.Kanat),rival=(!result.training&&typeof valorArenaPlayers==='function')?valorArenaPlayers().find(p=>p.name===result.opponent):null;
  const wings={me:myWing,enemy:result.training?myWing:wingId(result.motionWings?.[1]||rival?.equipped?.Kanat||rival?.wingId)};
  const fighter=(side,c)=>'<div class="vab-fighter vab-'+side+'" data-side="'+side+'" data-class="'+(c==='Büyücü'?'mage':c==='Savaşçı'?'warrior':'archer')+'"'+(wings[side]?' data-wing="'+wings[side]+'"':'')+'><div class="vab-shadow"></div><div class="vab-facing">'+wingMarkup(wings[side])+'<div class="vab-sprite" role="img" aria-label="'+escapeAttr(c)+'"'+(!supported(c)?' style="background-image:url('+escapeAttr(heroImages[Math.max(0,classes.indexOf(c))])+');background-size:contain;background-position:center bottom"':'')+'></div></div><span class="vab-damage"></span></div>';
  const health=(side,name)=>'<div class="vab-health" data-health="'+side+'"><span>'+escapeAttr(name)+'</span><div><i></i></div><b></b></div>';
  root.innerHTML='<section class="vab-dialog" role="dialog" aria-modal="true" aria-labelledby="vab-title"><header><small>ZAFER ARENASI</small><h2 id="vab-title">'+(result.training?'Denk Rakip':'Düello')+'</h2><span class="vab-round">1. TUR</span></header><div class="vab-health-row">'+health('me',myName)+health('enemy',result.opponent)+'</div><div class="vab-arena">'+fighter('me',cls[0])+fighter('enemy',cls[1])+'<div class="vab-dust"></div><div class="vab-embers"></div>'+effectMarkup()+'</div><p class="vab-status" role="status">Savaşçılar hazırlanıyor…</p><button type="button" class="vab-skip">Sonucu Göster</button></section>';
  if(hasMageArt())root.style.setProperty('--vab-arena-art','url("'+VALOR_COMBAT_ART.arena+'")');
  const s={root,result,myName,classes:{me:cls[0],enemy:cls[1]},fighters:{me:root.querySelector('.vab-me'),enemy:root.querySelector('.vab-enemy')},poses:{},index:0,steps:[],raf:0,timer:0,overflow:document.body.style.overflow,status:root.querySelector('.vab-status'),round:root.querySelector('.vab-round')};
  for(const r of result.log){
   s.steps.push(...r.events.map(e=>({...e,round:r.round})));
   const last=r.events.at(-1);if(last&&(last.myHp!==r.myHp||last.enemyHp!==r.enemyHp))s.steps.push({side:'effects',round:r.round,myHp:r.myHp,enemyHp:r.enemyHp,mine:r.myHit?.burnTick||0,theirs:r.enemyHit?.burnTick||0});
  }
  s.wings={me:s.fighters.me.querySelector('.vab-wings'),enemy:s.fighters.enemy.querySelector('.vab-wings')};s.started=performance.now();
  if(wings.me||wings.enemy)root.querySelector('.vab-arena').classList.add('vab-winged-arena');
  active=s;s.key=e=>{if(e.key==='Escape'){e.preventDefault();finish()}if(e.key==='Tab'){e.preventDefault();root.querySelector('button').focus()}};
  root.querySelector('button').onclick=finish;document.body.appendChild(root);document.body.style.overflow='hidden';document.addEventListener('keydown',s.key);root.querySelector('button').focus();
  setHp(s,'me',result.myMaxHp,result.myMaxHp);setHp(s,'enemy',result.enemyMaxHp,result.enemyMaxHp);pose(s,'me','idle');pose(s,'enemy','idle');tick(s,performance.now());
  const art=[...new Set(cls)].flatMap(c=>Object.values(actions(c)));if(typeof VALOR_COMBAT_VFX!=='undefined')art.push(...Object.values(VALOR_COMBAT_VFX));for(const id of new Set(Object.values(wings).filter(Boolean)))art.push({src:valorWingArt({id})});
  const ready=Promise.all(art.map(a=>new Promise(resolve=>{const image=new Image();image.onload=image.onerror=resolve;image.src=a.src})));
  // Never leave a completed fight blocked by an image decode or tab lifecycle.
  s.timer=setTimeout(()=>{if(active===s){clearTimeout(s.timer);next(s)}},2500);
  ready.then(()=>{if(active===s&&s.index===0){clearTimeout(s.timer);s.timer=setTimeout(()=>next(s),500)}});
 };
 const style=document.createElement('style');style.textContent=`
 .vab-overlay{position:fixed;inset:0;z-index:100110;display:grid;place-items:center;padding:12px;background:#05070bef;overscroll-behavior:contain}
 .vab-dialog{width:min(100%,650px);max-height:calc(100dvh - 24px);overflow:auto;border:1px solid #91784b;border-radius:12px;color:#e8dcc7;background:linear-gradient(145deg,#252025,#10141b);box-shadow:0 20px 80px #000c;padding:20px 14px;text-align:center;box-sizing:border-box}
 .vab-dialog header{position:relative}.vab-dialog header small{font:10px system-ui;letter-spacing:3px;color:#b4a07b}.vab-dialog h2{font:700 28px Georgia;margin:7px 0 12px;color:#ebcf98}.vab-round{font:11px system-ui;color:#d1b786;letter-spacing:2px}
 .vab-health-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;margin:20px 0 0}.vab-health{min-width:0;text-align:left}.vab-health span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:bold 14px Georgia;margin-bottom:7px}.vab-health>div{height:8px;overflow:hidden;background:#07090c;border:1px solid #6d5945;border-radius:5px}.vab-health i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#376c58,#a0ba79);transition:width .22s}.vab-health[data-health=enemy] i{background:linear-gradient(90deg,#713733,#c27d58)}.vab-health b{display:block;font:10px system-ui;font-variant-numeric:tabular-nums;color:#c3bda9;margin-top:6px}
 .vab-arena{position:relative;isolation:isolate;height:300px;overflow:hidden;background:radial-gradient(ellipse at 50% 80%,#a7814938,transparent 60%),linear-gradient(0deg,#181719,transparent 65%);border-bottom:1px solid #98805755}.vab-arena:before{content:'';position:absolute;inset:12% 4% 14%;border:1px solid #aa89581f;border-radius:50% 50% 0 0;box-shadow:inset 0 0 60px #0008;z-index:-1}.vab-arena:after{content:'';position:absolute;bottom:15%;left:5%;right:5%;height:1px;background:linear-gradient(90deg,transparent,#a8845555,transparent);z-index:-1}
 .vab-fighter{position:absolute;width:76%;aspect-ratio:1;bottom:0;pointer-events:none}.vab-me{left:-14%}.vab-enemy{right:-14%}.vab-facing,.vab-sprite{width:100%;height:100%}.vab-enemy .vab-facing{transform:scaleX(-1)}.vab-sprite{background-repeat:no-repeat;filter:drop-shadow(0 5px 5px #0009)}.vab-shadow{position:absolute;bottom:8%;left:35%;width:30%;height:9px;background:#0009;filter:blur(5px);border-radius:50%}.vab-fighter[data-class=warrior][data-action=attack] .vab-facing{animation:vabLunge .6s ease-in-out}.vab-enemy[data-class=warrior][data-action=attack] .vab-facing{animation-name:vabEnemyLunge}.vab-fighter[data-action=hit] .vab-sprite{filter:drop-shadow(0 0 10px #db5e4155)}
 .vab-damage{position:absolute;top:34%;left:35%;right:0;text-align:center;font:bold 22px Georgia;color:#ffe3ad;text-shadow:0 2px 4px #000,0 0 10px #a33;opacity:0;z-index:4}.vab-float{animation:vabFloat .8s ease-out forwards}.vab-heal{position:absolute;top:50%;left:45%;color:#abe5a0;font:bold 16px Georgia;animation:vabFloat 1s forwards}.vab-status{min-height:36px;margin:12px 0 6px;font:14px/1.5 Georgia;color:#dac6a2}.vab-dialog .vab-skip{min-height:44px;padding:10px 24px;border:1px solid #816b49;border-radius:5px;background:#17151b;color:#d6c8ae;font:14px Georgia}.vab-impact{animation:vabShake .18s}
 @keyframes vabLunge{50%{transform:translateX(16px)}}@keyframes vabEnemyLunge{50%{transform:scaleX(-1) translateX(16px)}}@keyframes vabFloat{0%{opacity:0;transform:translateY(10px)}20%{opacity:1}80%{opacity:1}100%{opacity:0;transform:translateY(-32px)}}@keyframes vabShake{25%{transform:translate(2px,1px)}65%{transform:translate(-2px,-1px)}}
 @media(min-width:500px){.vab-arena{height:365px}.vab-fighter{width:64%}.vab-me{left:-3%}.vab-enemy{right:-3%}}@media(max-width:350px){.vab-dialog{padding:16px 8px}.vab-arena{height:255px}.vab-health-row{gap:14px}.vab-damage{font-size:18px}}@media(max-height:540px){.vab-arena{height:210px}.vab-fighter{width:250px}.vab-me{left:calc(25% - 125px)}.vab-enemy{right:calc(25% - 125px)}}
 `;document.head.appendChild(style);
})();

(function(){const style=document.createElement('style');style.textContent=`
.vab-arena{border-radius:7px;background-image:linear-gradient(0deg,#080b1344,#080b130d 55%,#080b1322),var(--vab-arena-art);background-size:cover;background-position:center 65%;margin-top:12px;box-shadow:inset 0 0 40px #0006}
.vab-arena:before{inset:0;border:0;border-radius:0;box-shadow:inset 0 0 28px #0007;background:linear-gradient(0deg,#0a0b0f33,transparent 40%);z-index:0;pointer-events:none}.vab-arena:after{display:none}.vab-fighter{z-index:2}.vab-damage{color:#fff0cd}.vab-shadow{background:#000b;filter:blur(4px)}
.vab-dust{position:absolute;inset:55% -25% 0;z-index:3;pointer-events:none;opacity:.25;background:radial-gradient(ellipse at 30% 80%,#a8acba70,transparent 45%),radial-gradient(ellipse at 70% 70%,#9babb450,transparent 50%);animation:vabMist 9s ease-in-out infinite alternate}
.vab-embers{position:absolute;inset:0;pointer-events:none;z-index:4;background-image:radial-gradient(circle,#fbd7a6 0 1px,transparent 2px),radial-gradient(circle,#eb975c 0 1px,transparent 2px),radial-gradient(circle,#d5a27c 0 1px,transparent 2px);background-size:107px 139px,151px 173px,193px 127px;opacity:.5;animation:vabEmbers 8s linear infinite}
.vab-fx{position:absolute;z-index:5;pointer-events:none;visibility:hidden;left:76%;top:59%;width:58%;aspect-ratio:1;transform:translate(-50%,-50%);mix-blend-mode:screen}
.vab-fx[data-target=me]{left:24%}.vab-vfx-sprite{width:100%;height:100%;background-repeat:no-repeat}.vab-fx[data-attacker=enemy][data-kind=sword] .vab-vfx-sprite{transform:scaleX(-1)}
.vab-arrow{position:absolute;z-index:6;width:18%;max-width:92px;aspect-ratio:120/14;visibility:hidden;pointer-events:none;filter:drop-shadow(-3px 0 2px #c5c2ad44)}.vab-arrow svg{display:block;width:100%;height:100%}.vab-fx[data-kind=archer]{width:32%;top:48%}
.vab-fx[data-kind=mage]{top:-4%;height:112%;width:82%;aspect-ratio:auto;transform:translateX(-50%)}
.vab-fighter[data-action=hit]{animation:vabRecoil .2s ease-out}.vab-enemy[data-action=hit]{animation-name:vabEnemyRecoil}
@keyframes vabRecoil{35%{transform:translateX(-6px)}}@keyframes vabEnemyRecoil{35%{transform:translateX(6px)}}
.vab-fighter[data-class=mage][data-action=attack] .vab-sprite{animation:vabCast .4s ease-in both}.vab-arena.vab-impact[data-impact=mage]:before{animation:vabSkyFlash .35s ease-out}.vab-arena.vab-impact[data-impact=sword]:before{animation:vabGoldFlash .2s ease-out}
@keyframes vabMist{to{transform:translateX(10%);opacity:.4}}@keyframes vabEmbers{from{background-position:0 160px,30px 90px,80px 110px}to{background-position:25px -118px,4px -256px,110px -144px}}@keyframes vabCast{to{filter:drop-shadow(0 0 9px #b79dff)}}@keyframes vabSkyFlash{0%,25%{background:#b5c9ff55}100%{background:transparent}}@keyframes vabGoldFlash{0%{background:#efc78022}100%{background:transparent}}
@media(prefers-reduced-motion:reduce){.vab-dust,.vab-embers{animation:none}}
`;document.head.appendChild(style)})();

(function(){const style=document.createElement('style');style.textContent=`
.vab-facing{position:relative;isolation:isolate}.vab-sprite{position:relative;z-index:2}.vab-wings{position:absolute;left:46%;top:36%;width:72%;aspect-ratio:1;transform:translate(-50%,-53%) rotate(-5deg);z-index:1;pointer-events:none;filter:drop-shadow(0 2px 3px #0008);will-change:transform}
.vab-wing-half{position:absolute;top:0;width:50%;height:100%;background-image:var(--vab-wing-art);background-size:200% 100%;background-repeat:no-repeat;backface-visibility:hidden}.vab-wing-left{left:0;background-position:left center;transform-origin:right 53%;transform:perspective(500px) rotateY(var(--vab-wing-fold,22deg)) rotate(-2deg)}.vab-wing-right{right:0;background-position:right center;transform-origin:left 53%;transform:perspective(500px) rotateY(calc(-1 * var(--vab-wing-fold,22deg))) rotate(2deg)}
.vab-winged-arena .vab-fighter{width:64%}.vab-winged-arena .vab-me{left:-7%}.vab-winged-arena .vab-enemy{right:-7%}.vab-wings[data-wing=anka]{filter:drop-shadow(0 0 3px #b9502633)}.vab-wings[data-wing=ayaz]{filter:drop-shadow(0 0 3px #7ac9e533)}.vab-wings[data-wing=hiclik]{filter:drop-shadow(0 0 3px #9b65d633)}
@media(max-height:540px){.vab-winged-arena .vab-fighter{width:220px}.vab-winged-arena .vab-me{left:calc(25% - 110px)}.vab-winged-arena .vab-enemy{right:calc(25% - 110px)}}
`;document.head.appendChild(style)})();
