/* 3D arena trial. A self-contained turn-based fight between two rigged 3D characters, used to judge how the arena
   would look and feel in real 3D. It has its own simple rules and touches nothing of the real game: no save data,
   no server calls, no rewards. Characters: KayKit Adventurers (CC0). Particles: Effekseer samples (CC0). */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const canvas=$('a3-canvas'),slot=$('a3-slot'),hudEl=$('a3-hud'),feedEl=$('a3-feed'),turnEl=$('a3-turn'),skillsEl=$('a3-skills'),pickEl=$('a3-pick'),loadEl=$('a3-load');
const fmt=n=>Math.round(n).toLocaleString('tr-TR');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=q=>{q=clamp(q,0,1);return q*q*(3-2*q)},easeIn=q=>clamp(q,0,1)**2,rand=(a,b)=>a+Math.random()*(b-a);

/* ---------- classes ---------- */
const CLASSES={
 'Savaşçı':{file:'knight',hide:['1H_Sword_Offhand','Rectangle_Shield','Round_Shield','Spike_Shield','2H_Sword'],hp:11800,power:820,
  names:{normal:'Kılıç Darbesi',strong:'Alev Dalgası',max:'Kızıl Kıyamet',passive:'Demir Duruş'},
  icons:{normal:'assets/arena/skills/normal.webp',strong:'assets/arena/skills/strong.webp',max:'assets/arena/skills/max.webp',passive:'assets/arena/skills/passive-savasci.webp'},hint:'3 tur, canının %25\'i kadar kalkan'},
 'Büyücü':{file:'mage',hide:['Spellbook','Spellbook_open','1H_Wand'],hp:9600,power:980,
  names:{normal:'Yıldırım',strong:'Ateş Yağmuru',max:'Meteor',passive:'Yenilenme'},
  icons:{normal:'assets/arena/skills/buyucu/normal.webp',strong:'assets/arena/skills/buyucu/strong.webp',max:'assets/arena/skills/buyucu/max.webp',passive:'assets/arena/skills/passive-buyucu.webp'},hint:'Canının %25\'i kadar iyileşir'},
 'Okçu':{file:'rogue',hide:['Knife_Offhand','1H_Crossbow','Knife','Throwable'],hp:10200,power:900,
  names:{normal:'Işık Oku',strong:'İkili Işık Oku',max:'Zümrüt Patlaması',passive:'Odaklan'},
  icons:{normal:'assets/arena/skills/okcu/normal.webp',strong:'assets/arena/skills/okcu/strong.webp',max:'assets/arena/skills/okcu/max.webp',passive:'assets/arena/skills/passive-okcu.webp'},hint:'3 tur boyunca %25 fazla hasar'}
};
const ORDER=['normal','strong','max','passive'],MULT={normal:1,strong:1.3,max:1.75},COOLDOWN={normal:0,strong:2,max:4,passive:5};

/* ---------- renderer and scene ---------- */
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xcdb894);scene.fog=new THREE.Fog(0xd8c4a2,26,60);
const camera=new THREE.PerspectiveCamera(38,1,.1,120);
const HOME=2.35;

function stoneTexture(){const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle='#b9a283';g.fillRect(0,0,512,512);
 const rows=6;for(let r=0;r<rows;r++){const h=512/rows,off=r%2?48:0;for(let x=-96;x<512;x+=96){const v=rand(-14,14);g.fillStyle='rgb('+(186+v)+','+(165+v)+','+(134+v)+')';g.fillRect(x+off+2,r*h+2,92,h-4);
  for(let i=0;i<26;i++){g.fillStyle='rgba(70,50,30,'+rand(.02,.09)+')';g.fillRect(x+off+rand(2,90),r*h+rand(2,h-6),rand(1,5),rand(1,3))}}}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(7,7);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
function buildArena(){
 const ground=new THREE.Mesh(new THREE.CircleGeometry(19,64),new THREE.MeshStandardMaterial({map:stoneTexture(),roughness:.95}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 /* The painted arena of the 2D game, bent around the back as a far wall. Only its upper part is used: its own
    painted floor would not line up with the real 3D floor. */
 new THREE.TextureLoader().load('assets/arena/royal-arena-day.webp?v=1',tex=>{tex.colorSpace=THREE.SRGBColorSpace;tex.repeat.set(1,.8);tex.offset.set(0,.2);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(18,18,13.5,48,1,true,Math.PI-.84,1.68),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,fog:false,toneMapped:false}));wall.position.y=6.6;wall.scale.x=-1;scene.add(wall)});
 const far=new THREE.Mesh(new THREE.CylinderGeometry(18.4,18.4,14,48,1,true),new THREE.MeshBasicMaterial({color:0xbfa883,side:THREE.BackSide,fog:false,toneMapped:false}));far.position.y=6.9;scene.add(far);
 const stone=new THREE.MeshStandardMaterial({color:0xcbb694,roughness:.85}),gold=new THREE.MeshStandardMaterial({color:0xd6a94a,roughness:.4,metalness:.7});
 for(let i=0;i<7;i++){const a=-1.15+i*(2.3/6),r=11.5,x=Math.sin(a)*r,z=-Math.cos(a)*r+2;
  const col=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,5.4,14),stone);col.position.set(x,2.7,z);col.castShadow=col.receiveShadow=true;scene.add(col);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(1.25,.34,1.25),stone);cap.position.set(x,5.55,z);cap.castShadow=true;scene.add(cap);
  const base=new THREE.Mesh(new THREE.BoxGeometry(1.2,.3,1.2),stone);base.position.set(x,.15,z);base.receiveShadow=true;scene.add(base);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.47,.05,8,20),gold);ring.rotation.x=Math.PI/2;ring.position.set(x,4.9,z);scene.add(ring)}
 scene.add(new THREE.HemisphereLight(0xfff3dc,0x8a6f52,1.25));
 const sun=new THREE.DirectionalLight(0xfff0d2,2.4);sun.position.set(5.5,10,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});sun.shadow.bias=-.0006;sun.shadow.radius=4;scene.add(sun);
 const rim=new THREE.DirectionalLight(0x9fc0ff,.75);rim.position.set(-6,5,-8);scene.add(rim);
}
buildArena();

/* ---------- clock, waits and tweens (all follow slow motion and hit-stop) ---------- */
let gameT=0,realT=0,timeScale=1,freeze=0,runId=0;const waits=[],tweens=[],tickers=new Set();
const wait=s=>new Promise(r=>waits.push({at:gameT+s,r,run:runId}));
const tween=(dur,fn,curve=ease)=>new Promise(r=>{fn(curve(0));tweens.push({t0:gameT,dur,fn,curve,r,run:runId})});
function stopAll(){runId++;for(const w of waits.splice(0))w.r();for(const t of tweens.splice(0))t.r();for(const t of [...tickers])t.kill?.();tickers.clear()}

/* ---------- camera rig ---------- */
const cam={x:0,zoom:1,orbit:0,h:2.35,look:1.2},goal={x:0,zoom:1,orbit:0,h:2.35,look:1.2};let shake=0,baseDist=12;
const camTo=o=>Object.assign(goal,o),camHome=()=>camTo({x:0,zoom:1,orbit:0,h:2.35,look:1.2});
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 const half=Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect);baseDist=4.5/Math.tan(half)}
function updateCamera(dt){const k=1-Math.exp(-dt*4.5);for(const key in cam)cam[key]+=(goal[key]-cam[key])*k;
 const orbit=cam.orbit+Math.sin(realT*.28)*.045,d=baseDist*cam.zoom;shake*=Math.exp(-dt*9);
 camera.position.set(cam.x+Math.sin(orbit)*d+rand(-1,1)*shake,cam.h+rand(-1,1)*shake*.7,Math.cos(orbit)*d);camera.lookAt(cam.x,cam.look,0)}

/* ---------- particles (Effekseer, drawn into the same WebGL context) ---------- */
const FX={blow3:.17,fire2:.43,fire7:.12,sword12:.12,cure1:.41,blow10:.18,light2:.14,arrow1:.3},fx={ctx:null,effects:{}};
function bootParticles(){const E=window.effekseer;if(!E||typeof WebAssembly!=='object')return;
 try{E.initRuntime('assets/arena/fx/effekseer.wasm?v=1',()=>{try{const ctx=E.createContext();ctx.init(renderer.getContext());fx.ctx=ctx;
   for(const name of Object.keys(FX)){const effect=ctx.loadEffect('assets/arena/fx/'+name+'/effect.efkefc?v=1',1,()=>{fx.effects[name]=effect},()=>{},p=>/\.efkefc/.test(p)?p:p+'.png')}}catch(error){fx.ctx=null}},()=>{})}catch(error){}}
function burst(name,pos,size=1){if(!fx.ctx||!fx.effects[name])return;try{const h=fx.ctx.play(fx.effects[name],pos.x,pos.y,pos.z),k=FX[name]*size;h.setScale(k,k,k)}catch(error){}}

/* ---------- small 3D effects ---------- */
const additive=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
function flash(pos,color,power=30,life=.35){const l=new THREE.PointLight(color,power,14,1.6);l.position.copy(pos);scene.add(l);tween(life,q=>{l.intensity=power*(1-q)}).then(()=>scene.remove(l))}
function scorch(x){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,4,64,64,62);gr.addColorStop(0,'rgba(15,8,4,.85)');gr.addColorStop(.55,'rgba(28,16,8,.6)');gr.addColorStop(1,'rgba(28,16,8,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
 const m=new THREE.Mesh(new THREE.CircleGeometry(1.7,32),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.02,0);scene.add(m);
 wait(3).then(()=>tween(2.5,q=>{m.material.opacity=1-q})).then(()=>scene.remove(m))}
function fireball(from,to,dur,size,color=0xff6a1a){const g=new THREE.Group(),core=new THREE.Mesh(new THREE.SphereGeometry(size,16,12),new THREE.MeshBasicMaterial({color:0xfff0c0,fog:false})),halo=new THREE.Mesh(new THREE.SphereGeometry(size*1.9,16,12),additive(color,.55)),light=new THREE.PointLight(color,18*size+6,9,1.6);
 g.add(core,halo,light);const tail=[];for(let i=0;i<7;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(size*(1.4-i*.15),10,8),additive(color,.4-i*.05));scene.add(s);tail.push(s)}
 scene.add(g);const trail=[];return tween(dur,q=>{g.position.lerpVectors(from,to,q);trail.unshift(g.position.clone());tail.forEach((s,i)=>s.position.copy(trail[Math.min(trail.length-1,(i+1)*2)]))},easeIn).then(()=>{scene.remove(g);tail.forEach(s=>scene.remove(s))})}
function lightning(target){const group=new THREE.Group(),pts=[];let p=new THREE.Vector3(target.x+rand(-1.2,1.2),10,rand(-.6,.6));pts.push(p.clone());
 while(p.y>target.y+.2){p=new THREE.Vector3(p.x+(target.x-p.x)*.35+rand(-.5,.5),p.y-rand(.9,1.5),p.z*.6+rand(-.2,.2));pts.push(p.clone())}pts[pts.length-1].copy(target);
 for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],len=a.distanceTo(b),mid=a.clone().add(b).multiplyScalar(.5),ang=Math.atan2(b.y-a.y,b.x-a.x);
  for(const [w,color,o] of [[.42,0x6da8ff,.5],[.11,0xffffff,1]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(len,w),additive(color,o));m.position.copy(mid);m.rotation.z=ang;group.add(m)}}
 scene.add(group);flash(target,0xa8cbff,34,.4);return tween(.42,q=>{group.visible=q<.18||(q>.3&&q<.5)||(q>.62&&q<.8)},x=>x).then(()=>scene.remove(group))}
function arrow(from,to,dur,scale=1,color=0x7dffb0){const g=new THREE.Group(),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.03*scale,.03*scale,1.1*scale,8),new THREE.MeshBasicMaterial({color:0xf2fff5,fog:false})),glow=new THREE.Mesh(new THREE.CylinderGeometry(.11*scale,.02,1.5*scale,8),additive(color,.6)),light=new THREE.PointLight(color,9*scale,6,1.6);
 shaft.rotation.z=glow.rotation.z=-Math.PI/2*Math.sign(to.x-from.x);g.add(shaft,glow,light);scene.add(g);return tween(dur,q=>g.position.lerpVectors(from,to,q),x=>x).then(()=>scene.remove(g))}
function crescent(from,to,dur){const dir=Math.sign(to.x-from.x),g=new THREE.Group(),a=new THREE.Mesh(new THREE.TorusGeometry(1,.16,8,24,Math.PI),additive(0xff7a1e,.9)),b=new THREE.Mesh(new THREE.TorusGeometry(1,.34,8,24,Math.PI),additive(0xff3b0a,.4)),light=new THREE.PointLight(0xff7a1e,26,9,1.6);
 a.rotation.z=b.rotation.z=-Math.PI/2;g.add(a,b,light);g.scale.x=dir;scene.add(g);let last=0;
 return tween(dur,q=>{g.position.lerpVectors(from,to,q);const s=.55+q*.95;g.scale.set(dir*s,s,s);if(q-last>.22){last=q;burst('fire2',new THREE.Vector3(g.position.x,0,0),.7)}},x=>x).then(()=>scene.remove(g))}

/* ---------- fighters ---------- */
/* Skinned characters cannot share one scene graph, so the downloaded file is kept and parsed again for each fighter. */
const loader=new GLTFLoader(),buffers={};
const fetchModel=file=>buffers[file]||(buffers[file]=fetch('assets/arena3d/models/'+file+'.glb?v=1').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()}));
const parseModel=async file=>{const data=await fetchModel(file);return new Promise((resolve,reject)=>loader.parse(data.slice(0),'',resolve,reject))};
class Fighter{
 constructor(cls,side,gltf,name){this.cls=cls;this.def=CLASSES[cls];this.side=side;this.name=name;this.maxHp=this.def.hp;this.hp=this.maxHp;this.shield=0;this.shieldTurns=0;this.focusTurns=0;this.cd={normal:0,strong:0,max:0,passive:0};this.dead=false;
  this.root=new THREE.Group();this.model=gltf.scene;this.root.add(this.model);this.materials=[];
  this.model.traverse(o=>{if(this.def.hide.includes(o.name))o.visible=false;if(o.isMesh){o.castShadow=true;o.frustumCulled=false;o.material=o.material.clone();this.materials.push(o.material)}});
  /* Same body size for everyone: the mage's tall hat would otherwise shrink the rest of the figure. */
  const box=new THREE.Box3().setFromObject(this.model),h=box.max.y-box.min.y||2,tall=cls==='Büyücü'?2.4:2.05;this.model.scale.setScalar(tall/h);this.model.position.y=-box.min.y*tall/h;
  this.root.position.set(side*HOME,0,0);this.face(-side);scene.add(this.root);
  this.mixer=new THREE.AnimationMixer(this.model);this.clips={};for(const c of gltf.animations)this.clips[c.name]=c;this.current=null;this.idle=cls==='Okçu'?'2H_Ranged_Aiming':'Idle';
  this.mixer.addEventListener('finished',e=>{if(e.action===this.current&&!this.dead&&!this.hold)this.play(this.idle,{loop:true,fade:.22})});
  this.play(this.idle,{loop:true,fade:0});this.mixer.update(Math.random());
  this.bubble=null}
 /* dir: +1 looks right, -1 looks left; a little turn toward the camera keeps the face readable. */
 face(dir,toCamera=.38){this.root.rotation.y=dir>0?Math.PI/2-toCamera:-Math.PI/2+toCamera}
 play(name,{loop=false,fade=.12,speed=1,hold=false}={}){const clip=this.clips[name];if(!clip)return 0;const action=this.mixer.clipAction(clip);action.reset();action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=true;action.timeScale=speed;
  if(this.current&&this.current!==action&&fade>0)action.crossFadeFrom(this.current,fade,false);else if(this.current&&this.current!==action)this.current.stop();action.play();this.current=action;this.hold=hold;return clip.duration/speed}
 get chest(){return new THREE.Vector3(this.root.position.x,1.15,0)}
 get feet(){return new THREE.Vector3(this.root.position.x,0,0)}
 get head(){return new THREE.Vector3(this.root.position.x,2.35,0)}
 glow(color=0xffffff,power=1,life=.16){for(const m of this.materials){m.emissive=new THREE.Color(color);m.emissiveIntensity=power}return tween(life,q=>{for(const m of this.materials)m.emissiveIntensity=power*(1-q)})}
 setBubble(on){if(on&&!this.bubble){const g=new THREE.Group(),shell=new THREE.Mesh(new THREE.SphereGeometry(1.32,28,20),additive(0xffd75a,.16)),cage=new THREE.Mesh(new THREE.IcosahedronGeometry(1.36,1),new THREE.MeshBasicMaterial({color:0xffe9a0,wireframe:true,transparent:true,opacity:.32,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));g.add(shell,cage);g.position.y=1.15;this.root.add(g);this.bubble=g;g.scale.setScalar(.01);tween(.35,q=>g.scale.setScalar(Math.max(.01,q)))}
  else if(!on&&this.bubble){const g=this.bubble;this.bubble=null;tween(.3,q=>g.scale.setScalar(1+q*.4)).then(()=>this.root.remove(g))}}
 dispose(){scene.remove(this.root);this.mixer.stopAllAction()}
}
let me=null,foe=null,round=1,phase='loading',myClass='Büyücü',foeClass='Savaşçı';
const fighters=()=>[me,foe].filter(Boolean);

/* ---------- screen ---------- */
function hudUnit(f,side){return '<div class="vdu-hud-unit vdu-'+side+'" data-side="'+side+'"><div class="vdu-hud-info"><b></b><div class="vdu-hp"><em style="width:100%"></em><i style="width:100%"></i><b style="width:0"></b></div><small></small><span class="vdu-tags"></span></div></div>'}
function buildHud(){hudEl.innerHTML=hudUnit(me,'me')+'<span class="vdu-round"><small>TUR</small><b>1</b></span>'+hudUnit(foe,'foe');paintHud()}
function paintHud(){for(const [f,side] of [[me,'me'],[foe,'foe']]){const el=hudEl.querySelector('.vdu-'+side);if(!el||!f)continue;const pct=clamp(f.hp/f.maxHp*100,0,100);
  el.querySelector('.vdu-hud-info>b').textContent=f.name;el.querySelector('em').style.width=pct+'%';el.querySelector('i').style.width=pct+'%';el.querySelector('.vdu-hp b').style.width=clamp(f.shield/f.maxHp*100,0,100)+'%';
  el.querySelector('small').textContent=fmt(Math.max(0,f.hp))+' / '+fmt(f.maxHp);
  el.querySelector('.vdu-tags').textContent=f.cls+(f.shield>0?' · 🛡 '+fmt(f.shield)+' ('+f.shieldTurns+' tur)':'')+(f.focusTurns>0?' · 🎯 +%25 ('+f.focusTurns+' tur)':'')}
 hudEl.querySelector('.vdu-round b').textContent=round}
function shakeHud(side){const el=hudEl.querySelector('.vdu-'+side);if(!el)return;el.classList.remove('hit');void el.offsetWidth;el.classList.add('hit')}
const lines=[];function log(html,cls){lines.push('<p class="'+cls+'">'+html+'</p>');feedEl.innerHTML=lines.slice(-3).join('')}
function paintSkills(){const mine=phase==='me';turnEl.className='vdu-turn'+(mine?' mine':'');turnEl.querySelector('b').textContent=phase==='me'?'Sıra sende':phase==='foe'?'Rakip saldırıyor…':phase==='over'?'Savaş bitti':'';
 skillsEl.className='vdu-skills'+(mine?' ready':'');
 skillsEl.innerHTML=ORDER.map(k=>{const cd=me.cd[k],ok=mine&&!cd;return '<button type="button" class="vdu-skill" data-skill="'+k+'" '+(ok?'':'disabled')+' title="'+(k==='passive'?me.def.hint:'%'+Math.round(MULT[k]*100)+' hasar')+'"><img src="'+me.def.icons[k]+'?v=art2" alt=""><span class="vdu-sname">'+me.def.names[k]+'</span><span class="vdu-cd">'+(cd?cd+' tur':'')+'</span></button>'}).join('')}
function paintPicker(){pickEl.innerHTML='<span>Karakterin:</span>'+Object.keys(CLASSES).map(c=>'<button type="button" data-class="'+c+'" aria-pressed="'+(c===myClass)+'">'+c+'</button>').join('')+'<button type="button" class="again" data-again>Yeniden başlat</button>'}
function number(pos,text,cls='',label=''){const v=pos.clone().project(camera),el=document.createElement('span');el.className='a3-num '+cls;el.style.left=clamp((v.x*.5+.5)*100,12,88)+'%';el.style.top=clamp((-v.y*.5+.5)*100,24,90)+'%';el.innerHTML=(label?'<small>'+label+'</small>':'')+text;slot.appendChild(el);setTimeout(()=>el.remove(),1200)}

/* ---------- combat ---------- */
/* Cosmetic contact: the target flinches and sparks fly, no damage. */
function tap(target,power=.5){if(target.dead)return;target.glow(0xffffff,.5*power+.2,.14);shake=Math.max(shake,.05*power);if(!target.shield)target.play(Math.random()<.5?'Hit_A':'Hit_B',{fade:.05,speed:1.3})}
/* The blow that counts. Returns true when it ends the fight. */
function strike(a,b,mult,{heavy=false}={}){const crit=Math.random()<.2,base=a.def.power*mult*rand(.9,1.1)*(a.focusTurns>0?1.25:1)*(crit?1.5:1);let dmg=Math.round(base);
 const soaked=Math.min(b.shield,dmg);b.shield-=soaked;dmg-=soaked;if(b.shield<=0&&b.bubble){b.shieldTurns=0;b.setBubble(false)}
 b.hp=Math.max(0,b.hp-dmg);const kill=b.hp<=0,who=a===me?'Sen':a.name,side=b===me?'me':'foe';
 log(who+' · '+a.def.names[a.skill]+' <b>'+(dmg>0?fmt(dmg):'Emildi')+'</b>'+(crit&&dmg>0?' <u>Kritik</u>':'')+(soaked&&dmg>0?' <u>🛡 '+fmt(soaked)+'</u>':''),a===me?'mine':'theirs');
 if(dmg>0)number(b.head,'-'+fmt(dmg),crit?'crit':'',crit?'KRİTİK':'');else number(b.head,'EMİLDİ','soak');
 paintHud();shakeHud(side);
 if(dmg>0){b.glow(0xffffff,heavy||crit?.8:.5,.18);const from=b.root.position.x,push=Math.sign(b.root.position.x-a.root.position.x||b.side)*(heavy?.5:.28);
  if(!kill){b.play(heavy?'Hit_B':'Hit_A',{fade:.04});tween(.12,q=>{b.root.position.x=from+push*q}).then(()=>tween(.3,q=>{b.root.position.x=from+push*(1-q)}))}}
 else{b.bubble&&b.bubble.scale.setScalar(1.18);b.bubble&&tween(.25,q=>b.bubble&&b.bubble.scale.setScalar(1.18-.18*q));b.play('Block_Hit',{fade:.05})}
 shake=Math.max(shake,heavy?.32:crit?.2:.12);freeze=kill?.16:heavy||crit?.1:.06;
 if(kill){b.dead=true;b.setBubble(false);b.play('Death_A',{fade:.08,hold:true});timeScale=.3;setTimeout(()=>{timeScale=1},900)}
 return kill}
async function runTo(f,x){const from=f.root.position.x,dir=Math.sign(x-from)||1;f.face(dir,.15);f.play('Running_A',{loop:true,fade:.1,speed:1.5});await tween(Math.abs(x-from)/8.5,q=>{f.root.position.x=from+(x-from)*q},q=>q)}
async function goHome(f){await runTo(f,f.side*HOME);f.face(-f.side);f.play(f.idle,{loop:true,fade:.18})}
const SKILLS={
 'Savaşçı':{
  async normal(a,b){const dir=Math.sign(b.root.position.x-a.root.position.x);camTo({x:b.root.position.x*.14,zoom:.92});await runTo(a,b.root.position.x-dir*1.25);a.play('1H_Melee_Attack_Slice_Diagonal',{speed:1.15});await wait(.34);burst('blow10',b.chest,1);const kill=strike(a,b,MULT.normal);await wait(.5);await goHome(a);return kill},
  async strong(a,b){const dir=Math.sign(b.root.position.x-a.root.position.x);camTo({zoom:.92});a.play('1H_Melee_Attack_Slice_Horizontal',{speed:1.05});a.glow(0xff6a1a,.7,.5);await wait(.42);
   await crescent(new THREE.Vector3(a.root.position.x+dir*.9,1.05,0),new THREE.Vector3(b.root.position.x-dir*.2,1.05,0),.42);burst('fire2',b.feet,1.2);burst('blow10',b.chest,.9);flash(b.chest,0xff7a1e,40);const kill=strike(a,b,MULT.strong);await wait(.6);return kill},
  async max(a,b){const dir=Math.sign(b.root.position.x-a.root.position.x);camTo({x:b.root.position.x*.3,zoom:.82,orbit:-dir*.3,h:2});await runTo(a,b.root.position.x-dir*1.25);
   a.play('1H_Melee_Attack_Chop',{speed:1.5});await wait(.27);tap(b,.6);burst('blow10',b.chest,.7);await wait(.3);
   a.play('1H_Melee_Attack_Slice_Horizontal',{speed:1.5,fade:.06});await wait(.27);tap(b,.7);burst('blow10',b.chest,.8);await wait(.28);
   a.play('2H_Melee_Attack_Spin',{speed:1.9,fade:.06});a.glow(0xff4a12,.5,.7);await wait(.42);tap(b,.8);burst('blow10',b.chest,.9);await wait(.4);
   burst('blow10',b.chest,1.5);burst('sword12',b.feet,1.15);flash(b.chest,0xff5a1a,60,.5);scorch(b.root.position.x);const kill=strike(a,b,MULT.max,{heavy:true});await wait(.75);await goHome(a);return kill},
  async passive(a){camTo({x:a.root.position.x*.3,zoom:.88});a.play('Block',{speed:.9});await wait(.35);a.shield=Math.round(a.maxHp*.25);a.shieldTurns=3;a.setBubble(true);burst('arrow1',a.chest,1.6);flash(a.chest,0xffd75a,30);number(a.head,'🛡 '+fmt(a.shield),'soak');log((a===me?'Sen':a.name)+' · Demir Duruş <b>🛡 '+fmt(a.shield)+'</b>','pas');paintHud();await wait(.8)}},
 'Büyücü':{
  async normal(a,b){camTo({x:b.root.position.x*.14,zoom:.93});a.play('Spellcast_Shoot');a.glow(0x7db4ff,.6,.5);await wait(.42);lightning(b.chest);burst('blow3',b.chest,1.1);shake=.2;const kill=strike(a,b,MULT.normal);await wait(.75);return kill},
  async strong(a,b){camTo({x:b.root.position.x*.14,zoom:.95,h:2.6});a.play('Spellcast_Long',{speed:1.25});a.glow(0xff8a3c,.7,.9);await wait(.7);let kill=false;const drops=[];
   for(let i=0;i<7;i++){const x=b.root.position.x+rand(-.85,.85),to=new THREE.Vector3(x,.1,rand(-.5,.5)),from=to.clone().add(new THREE.Vector3(-b.side*rand(1,2.4),rand(8,10),rand(-.4,.4)));
    drops.push(fireball(from,to,.5,.16).then(()=>{burst('fire2',to,.75);flash(to,0xff7a1e,16,.25);shake=Math.max(shake,.09);if(i===2)kill=strike(a,b,MULT.strong);else tap(b,.4)}));await wait(.12)}
   await Promise.all(drops);await wait(.5);return kill},
  async max(a,b){camTo({x:0,zoom:1.08,h:3.1,look:1.9});a.play('Spellcast_Raise',{speed:1.2});a.glow(0xff8a3c,.5,1.2);await wait(.75);
   const to=b.feet.clone().setY(.4),from=to.clone().add(new THREE.Vector3(-b.side*5.5,11,-1.2));const fall=fireball(from,to,.95,.6,0xff4a12);await wait(.55);camTo({x:b.root.position.x*.3,zoom:.84,h:2.1,look:1.1});await fall;
   burst('fire7',b.feet,1.3);burst('sword12',b.feet,1.4);flash(to,0xffb060,70,.6);scorch(b.root.position.x);const kill=strike(a,b,MULT.max,{heavy:true});shake=.5;await wait(1);return kill},
  async passive(a){camTo({x:a.root.position.x*.3,zoom:.88});a.play('Use_Item',{speed:1.3});await wait(.5);const heal=Math.min(a.maxHp-a.hp,Math.round(a.maxHp*.25));a.hp+=heal;burst('cure1',a.chest,1.3);flash(a.chest,0x5dffa0,26,.6);a.glow(0x5dffa0,.8,.6);number(a.head,'+'+fmt(heal),'heal');log((a===me?'Sen':a.name)+' · Yenilenme <b>+'+fmt(heal)+'</b>','pas');paintHud();await wait(.8)}},
 'Okçu':{
  async shot(a,b,scale=1,dur=.26){const dir=Math.sign(b.root.position.x-a.root.position.x);await arrow(new THREE.Vector3(a.root.position.x+dir*.8,1.3,0),new THREE.Vector3(b.root.position.x-dir*.2,1.2,0),dur,scale)},
  async normal(a,b){camTo({x:b.root.position.x*.14,zoom:.93});a.play('2H_Ranged_Shoot',{speed:1.2});await wait(.2);await this.shot(a,b);burst('light2',b.chest,.8);const kill=strike(a,b,MULT.normal);await wait(.65);return kill},
  async strong(a,b){camTo({x:b.root.position.x*.14,zoom:.93});a.play('2H_Ranged_Shoot',{speed:1.4});await wait(.18);await this.shot(a,b);tap(b,.6);burst('light2',b.chest,.7);
   a.play('2H_Ranged_Shoot',{speed:1.4,fade:.05});await wait(.18);await this.shot(a,b);burst('light2',b.chest,1);const kill=strike(a,b,MULT.strong);await wait(.65);return kill},
  async max(a,b){const dir=Math.sign(b.root.position.x-a.root.position.x);camTo({x:a.root.position.x*.35,zoom:.8,orbit:dir*.28,h:1.9});a.play('2H_Ranged_Aiming',{loop:true});a.glow(0x74f0a0,.45,.9);
   const charge=new THREE.PointLight(0x74f0a0,0,6,1.6);charge.position.set(a.root.position.x+dir*.7,1.3,.2);scene.add(charge);await tween(.8,q=>{charge.intensity=40*q});scene.remove(charge);
   camTo({x:b.root.position.x*.25,zoom:.86,orbit:0,h:2.2});a.play('2H_Ranged_Shoot',{speed:1.1,fade:.05});await wait(.14);await this.shot(a,b,2.4,.2);
   burst('light2',b.chest,1.3);burst('sword12',b.feet,1);flash(b.chest,0x74f0a0,70,.5);const kill=strike(a,b,MULT.max,{heavy:true});await wait(.9);return kill},
  async passive(a){camTo({x:a.root.position.x*.3,zoom:.88});a.play('Cheer',{speed:1.3});await wait(.4);a.focusTurns=3;burst('arrow1',a.chest,1.3);flash(a.chest,0x8dffb0,24,.6);a.glow(0x8dffb0,.7,.6);number(a.head,'🎯 Odak','heal');log((a===me?'Sen':a.name)+' · Odaklan 🎯','pas');paintHud();await wait(.85)}}
};
async function act(a,b,k){const run=runId;a.skill=k;a.cd[k]=COOLDOWN[k];const kill=await SKILLS[a.cls][k](a,b);if(run!==runId)return true;camHome();return !!kill}
function startTurn(f){for(const k of ORDER)if(f.cd[k]>0)f.cd[k]--;if(f.shieldTurns>0&&--f.shieldTurns<=0){f.shield=0;f.setBubble(false)}if(f.focusTurns>0)f.focusTurns--}
function foeChoice(){const c=foe.cd;if(!c.passive&&foe.hp<foe.maxHp*.55&&(foe.cls!=='Büyücü'||foe.hp<foe.maxHp*.7))return 'passive';if(!c.max)return 'max';if(!c.strong)return 'strong';if(!c.passive&&foe.cls==='Okçu')return 'passive';return 'normal'}
async function playerMove(k){if(phase!=='me'||me.cd[k])return;const run=runId;phase='busy';paintSkills();
 if(await act(me,foe,k)){if(run===runId)finish(me);return}
 phase='foe';paintSkills();await wait(.45);if(run!==runId)return;startTurn(foe);paintHud();
 if(await act(foe,me,foeChoice())){if(run===runId)finish(foe);return}
 round++;startTurn(me);paintHud();phase='me';paintSkills()}
async function finish(winner){const run=runId;phase='over';paintSkills();await wait(.5);if(run!==runId)return;const won=winner===me;
 camTo({x:winner.root.position.x*.85,zoom:.52,orbit:-winner.side*.55,h:1.75,look:1.25});winner.face(-winner.side,.9);winner.play('Cheer',{loop:true,fade:.2});
 const banner=document.createElement('div');banner.className='vdu-banner '+(won?'win':'loss');banner.innerHTML='<span>'+(won?'ZAFER':'YENİLGİ')+'</span>';slot.appendChild(banner);log(won?'Kazandın! Başka bir karakterle dene.':'Kaybettin. Yeniden dene.','tip')}

/* ---------- fight setup ---------- */
async function start(){stopAll();const run=runId;phase='loading';timeScale=1;freeze=0;slot.querySelectorAll('.vdu-banner,.a3-num').forEach(n=>n.remove());lines.length=0;
 const others=Object.keys(CLASSES).filter(c=>c!==myClass);foeClass=others[Math.floor(Math.random()*others.length)];
 let a,b;try{[a,b]=await Promise.all([parseModel(CLASSES[myClass].file),parseModel(CLASSES[foeClass].file)])}catch(error){delete buffers[CLASSES[myClass].file];delete buffers[CLASSES[foeClass].file];loadEl.classList.remove('done');loadEl.querySelector('span').textContent='Karakterler yüklenemedi. Sayfayı yenile.';return}
 if(run!==runId)return;for(const f of fighters())f.dispose();
 me=new Fighter(myClass,-1,a,'Sen');foe=new Fighter(foeClass,1,b,'Rakip '+foeClass);round=1;
 loadEl.classList.add('done');buildHud();paintPicker();feedEl.innerHTML='<p class="tip">Bu sayfa bir denemedir: gerçek savaş, ödül ve sıralama etkilenmez.</p>';
 /* Entrance: both walk in while the camera settles. */
 Object.assign(cam,{x:0,zoom:1.35,orbit:.5,h:3.4,look:1.2});camHome();
 for(const f of [me,foe]){f.root.position.x=f.side*7;f.face(-f.side,.1);f.play('Running_A',{loop:true,fade:0,speed:1.3})}
 phase='busy';paintSkills();await Promise.all([me,foe].map(f=>tween(1.1,q=>{f.root.position.x=f.side*(7-(7-HOME)*q)},q=>1-(1-q)*(1-q))));if(run!==runId)return;
 for(const f of [me,foe]){f.face(-f.side);f.play(f.idle,{loop:true,fade:.2})}phase='me';paintSkills()}
skillsEl.addEventListener('click',e=>{const b=e.target.closest('[data-skill]');if(b&&!b.disabled)playerMove(b.dataset.skill)});
pickEl.addEventListener('click',e=>{const c=e.target.closest('[data-class]');if(c){myClass=c.dataset.class;start()}else if(e.target.closest('[data-again]'))start()});
window.addEventListener('resize',resize);

/* ---------- frame loop ---------- */
let last=performance.now();
function frame(now){const real=Math.min(.05,Math.max(0,(now-last)/1000));last=now;realT+=real;let dt=real*timeScale;if(freeze>0){freeze-=real;dt=0}gameT+=dt;
 for(let i=waits.length-1;i>=0;i--)if(waits[i].at<=gameT){const w=waits.splice(i,1)[0];w.r()}
 for(let i=tweens.length-1;i>=0;i--){const t=tweens[i],q=t.dur>0?clamp((gameT-t.t0)/t.dur,0,1):1;try{t.fn(t.curve(q))}catch(error){}if(q>=1){tweens.splice(i,1);t.r()}}
 for(const f of fighters()){f.mixer.update(dt);if(f.bubble){f.bubble.children[1].rotation.y+=real*.6;f.bubble.children[0].material.opacity=.14+.05*Math.sin(realT*4)}}
 updateCamera(real);renderer.render(scene,camera);
 if(fx.ctx){try{fx.ctx.setProjectionMatrix(camera.projectionMatrix.elements);fx.ctx.setCameraMatrix(camera.matrixWorldInverse.elements);fx.ctx.update(real*60*(freeze>0?.2:timeScale));fx.ctx.draw()}catch(error){fx.ctx=null}renderer.resetState()}
 requestAnimationFrame(frame)}

resize();bootParticles();requestAnimationFrame(frame);start();
window.arena3d={state:()=>({phase,round,me:me&&{cls:me.cls,hp:me.hp,cd:me.cd},foe:foe&&{cls:foe.cls,hp:foe.hp}}),use:playerMove,setFoeHp:v=>{foe.hp=v;paintHud()},pick:c=>{myClass=c;return start()}};
