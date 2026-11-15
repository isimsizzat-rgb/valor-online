/* Cosmetic skill playback only. Combat events, HP, cooldowns and rewards remain owned by the duel engine. */
(function(){'use strict';
 const base='assets/arena/motion/',images={},sessions=new WeakMap(),portraitCache=new Map();let gender='male',canvas;const archer=window.ValorArcherCombat;const maxHits=[.85,1.30,1.75,2.20,2.75];
 const arena=new Image(),arenaReady=new Promise(resolve=>{arena.onload=()=>resolve(true);arena.onerror=()=>resolve(false);arena.src='assets/arena/royal-arena-day.webp?v=1'});
 function arenaBackdrop(c,w,h){
  if(arena.complete&&arena.naturalWidth){const scale=Math.max(w/arena.naturalWidth,h/arena.naturalHeight),dw=arena.naturalWidth*scale,dh=arena.naturalHeight*scale;c.drawImage(arena,(w-dw)/2,(h-dh)/2,dw,dh);return}
  const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#17171f');bg.addColorStop(1,'#32262a');c.fillStyle=bg;c.fillRect(0,0,w,h);
 }
 const files={sheet:'warrior-attack-v2',femaleSheet:'warrior-female-attack',runSheet:'warrior-run-v2',femaleRun:'warrior-female-run',fireMale:'warrior-male-fire-rise',fireFemale:'warrior-female-fire-rise',fireFX:'warrior-fire-wave-v2',maxFX:'warrior-max-explosion',shieldMale:'warrior-male-shield',shieldFemale:'warrior-female-shield',shieldFX:'warrior-gold-barrier',mageMale:'mage-male-raise',mageFemale:'mage-female-raise',staffProp:'mage-staff',lightningFX:'mage-real-lightning',rainFX:'mage-fire-rain',meteorFX:'mage-meteor-v2',healFX:'mage-healing'};
 let allReady=false;const ready=Promise.all(Object.entries(files).map(([key,file])=>new Promise(resolve=>{const im=new Image();images[key]=im;im.onload=()=>resolve(true);im.onerror=()=>resolve(false);im.src=base+file+'.webp'}))).then(ok=>(allReady=ok.every(Boolean)));
 /* The sheets are ~6 MB each once decoded; phones evict them and re-decode while drawing, which froze the
    animation for ~100 ms per frame. Keep one pre-decoded copy at the size they are drawn (60%). */
 const BITMAP_SCALE=.6;
 ready.then(()=>{if(typeof createImageBitmap!=='function')return;for(const im of Object.values(images)){if(!im.naturalWidth)continue;
  createImageBitmap(im,{resizeWidth:Math.round(im.naturalWidth*BITMAP_SCALE),resizeHeight:Math.round(im.naturalHeight*BITMAP_SCALE),resizeQuality:'high'}).then(b=>{im._bmp=b;im._s=b.width/im.naturalWidth}).catch(()=>{})}});
 function fastCtx(c){if(!c||c._valorFast)return c;c._valorFast=true;const raw=c.drawImage;
  c.drawImage=function(img,...a){const b=img&&img._bmp;if(!b)return raw.call(this,img,...a);const k=img._s;
   if(a.length===2)return raw.call(this,b,a[0],a[1],img.naturalWidth,img.naturalHeight);
   if(a.length===4)return raw.call(this,b,a[0],a[1],a[2],a[3]);
   if(a.length===8)return raw.call(this,b,a[0]*k,a[1]*k,a[2]*k,a[3]*k,a[4],a[5],a[6],a[7]);
   return raw.call(this,img,...a)};return c}
 const {sheet,femaleSheet,runSheet,femaleRun,fireMale,fireFemale,fireFX,maxFX,shieldMale,shieldFemale,shieldFX,mageMale,mageFemale,staffProp,lightningFX,rainFX,meteorFX,healFX}=images;
const attackRects=[ [0,0,543,356,300,349],[543,0,543,356,845,349], [0,356,543,382,300,731],[543,356,543,382,845,731], [0,738,543,350,300,1082],[543,738,543,350,840,1082], [0,1090,598,358,300,1418],[598,1090,488,358,845,1418] ];
const runRects=Array.from({length:8},(_,i)=>{let col=i%2,row=Math.floor(i/2);return [col*543,row*362,543,362,col*543+370,row*362+357]});
const femaleAttackRects=[[0,0,575,354,300,350],[575,0,511,354,842,350],[0,354,543,411,300,758],[543,354,543,411,842,758],[0,765,585,335,300,1096],[585,765,501,335,842,1096],[0,1100,605,348,300,1435],[605,1100,481,348,842,1435]];
function sprite(c,frame,x,y,size,skill){if(skill==='passive'){shieldSprite(c,frame%8,x,y,size);return}if(skill==='strong'){fireSprite(c,frame%8,x,y,size);return}const running=frame<8,source=gender==='female'?(running?femaleRun:femaleSheet):(running?runSheet:sheet),b=(running?runRects:(gender==='female'?femaleAttackRects:attackRects))[frame%8],scale=size/350;c.drawImage(source,b[0],b[1],b[2],b[3],x+(b[0]-b[4])*scale,y+(b[1]-b[5])*scale,b[2]*scale,b[3]*scale)}
const mageHands={male:[[-72,-157],[-60,-245],[-57,-311],[-82,-343],[-41,-369],[-67,-365],[-72,-290],[-80,-147]],female:[[-55,-184],[-51,-250],[-55,-318],[-60,-342],[-55,-364],[-60,-364],[-60,-284],[-60,-184]]};
const mageBands=[0,354,722,1104,1448],mageFeet=[350,718,1098,1435];
function mageSprite(c,frame,x,y,size){const source=gender==='female'?mageFemale:mageMale,col=frame%2,row=Math.floor(frame/2),left=col*543,top=mageBands[row],bottom=mageBands[row+1],anchor=col?850:300,scale=size/350; c.save();c.translate(x,y);c.drawImage(source,left,top,543,bottom-top,(left-anchor)*scale,(top-mageFeet[row])*scale,543*scale,(bottom-top)*scale);const hand=mageHands[gender][frame];c.translate(hand[0]*scale,hand[1]*scale);c.rotate((frame===2||frame===3?8:3)*Math.PI/180);const sh=367*scale,sw=sh*staffProp.width/staffProp.height;c.drawImage(staffProp,-sw/2,-sh*.55,sw,sh);c.restore()}
function lightning(c,target,floor,size,t){
 const age=t-1.27;if(age<0||age>.66)return;
 const flash=(center,width,strength)=>strength*Math.exp(-Math.pow((age-center)/width,2));
 const pulse=Math.min(1,flash(.025,.045,1)+flash(.18,.042,.9)+flash(.35,.055,.65)),fade=Math.max(0,1-age/.66),hitY=floor-size*.29,h=hitY/.895,w=h*lightningFX.width/lightningFX.height;
 c.save();c.globalCompositeOperation='screen';
 c.globalAlpha=pulse*.16;c.fillStyle='#d4e5ff';c.fillRect(0,0,canvas.width,canvas.height);
 c.globalAlpha=(.18+pulse*.82)*fade;c.drawImage(lightningFX,target-w*.515,-h*.045,w,h);
 const radius=size*(.32+age*.2),glow=c.createRadialGradient(target,hitY,0,target,hitY,radius);glow.addColorStop(0,'#ffffff');glow.addColorStop(.09,'#e4f2ffcc');glow.addColorStop(.3,'#a2c9ff66');glow.addColorStop(1,'#6d9fff00');c.globalAlpha=(.25+pulse*.65)*fade;c.fillStyle=glow;c.fillRect(target-radius,hitY-radius,radius*2,radius*2);
 c.globalAlpha=fade*.65;c.lineWidth=1.2;c.strokeStyle='#dcecff';for(let i=0;i<13;i++){const a=i*2.399,r=size*(.045+age*.34),len=size*(.02+.035*Math.sin(i*4)**2);c.beginPath();c.moveTo(target+Math.cos(a)*r,hitY+Math.sin(a)*r*.5);c.lineTo(target+Math.cos(a)*(r+len),hitY+Math.sin(a)*(r+len)*.5);c.stroke();}
 c.restore();
}
function mageDuration(k){return k==='strong'?3.8:k==='max'?4.2:3.25}
function magePoseAt(k,t){if(k==='normal'){const seq=[0,1,2,3,4,4,3,2,1,0];return seq[Math.min(9,Math.floor(Math.max(0,t)/2.85*10))]}const rise=k==='max'?1.2:.9,hold=k==='max'?2.9:k==='strong'?2.8:2.15,end=k==='max'?3.9:k==='strong'?3.55:2.95;if(t<rise)return Math.min(4,Math.floor(Math.max(0,t)/rise*5));if(t<hold)return k==='passive'?5:4;if(t<end)return [3,2,1,0][Math.min(3,Math.floor((t-hold)/(end-hold)*4))];return 0}
function mageBurst(c,x,y,size,age,life=.42){if(age<0||age>life)return;const q=age/life,f=Math.min(7,Math.floor(q*8)),cw=maxFX.width/4,ch=maxFX.height/2;c.save();c.globalCompositeOperation='screen';c.globalAlpha=1-q*.3;c.drawImage(maxFX,f%4*cw,Math.floor(f/4)*ch,cw,ch,x-size/2,y-size/2,size,size);c.restore()}
function fireRain(c,target,floor,size,t){
 // The first impact aligns with damage at 1.75; later strikes complete the shower.
 for(let i=0;i<10;i++){
  const at=1.1+i*.12,travel=.65,age=t-at,x=target+Math.sin(i*2.399)*size*.43,ground=floor+Math.cos(i*2.17)*size*.025;
  if(age>=0&&age<travel){
   const p=age/travel,hitY=ground,startY=-size*.55,y=startY+(hitY-startY)*p*p,h=size*(.8+.18*p),w=h*rainFX.width/rainFX.height;
   c.save();c.globalAlpha=Math.min(1,age/.06);c.drawImage(rainFX,x-w*.5,y-h*.9,w,h);c.restore();
  }
  const hit=age-travel,life=.7;if(hit<0||hit>life)continue;
  const q=hit/life,fade=1-q;
  c.save();
  // Low ground footprint and fading hot cracks make the contact point unmistakable.
  c.globalAlpha=fade*.65;c.fillStyle='#33140b';c.beginPath();c.ellipse(x,ground,size*(.12+q*.18),size*.035,0,0,Math.PI*2);c.fill();
  c.globalCompositeOperation='lighter';const glow=c.createRadialGradient(x,ground-size*.04,0,x,ground-size*.04,size*.42);glow.addColorStop(0,'#ffd27d99');glow.addColorStop(.3,'#ff762b55');glow.addColorStop(1,'#ff440000');c.globalAlpha=fade;c.fillStyle=glow;c.fillRect(x-size*.42,ground-size*.46,size*.84,size*.84);
  c.globalAlpha=fade*.8;c.strokeStyle='#ffb751';c.lineWidth=2;c.beginPath();c.ellipse(x,ground,size*(.08+q*.5),size*(.018+q*.1),0,0,Math.PI*2);c.stroke();
  // Painted explosion opens upward from the floor rather than bursting at chest height.
  if(hit<.48){const f=Math.min(7,Math.floor(hit/.48*8)),cw=maxFX.width/4,ch=maxFX.height/2,extent=size*(.65+q*.22);c.globalAlpha=fade;c.drawImage(maxFX,f%4*cw,Math.floor(f/4)*ch,cw,ch,x-extent/2,ground-extent*.78,extent,extent);}
  for(let j=0;j<6;j++){const a=j*1.37+i*2.1,vx=Math.cos(a)*size*.5,vy=-size*(.48+.32*Math.sin(j+1)**2),px=x+vx*hit,py=ground+vy*hit+size*.8*hit*hit;c.globalAlpha=fade;c.strokeStyle=j%2?'#ff9b36':'#fff0b5';c.lineWidth=1.5;c.beginPath();c.moveTo(px,py);c.lineTo(px-vx*.025,py-vy*.02);c.stroke();}
  c.globalAlpha=fade*.6;c.strokeStyle='#ff772d';c.lineWidth=1.4;for(let j=0;j<4;j++){const a=j*1.57+i;c.beginPath();c.moveTo(x,ground);c.lineTo(x+Math.cos(a)*size*.17,ground+Math.sin(a)*size*.035);c.stroke();}
  c.restore();
 }
}
function meteorScale(progress){const p=Math.max(0,Math.min(1,progress));return .16+.84*Math.pow(p,1.15)}
function meteorFall(c,target,floor,size,t){const launch=1.05,impact=2.25,hitY=floor-size*.3;if(t<launch||t>3.3)return;const p=Math.max(0,Math.min(1,(t-launch)/(impact-launch))),h=size*2.05*meteorScale(p),w=h*meteorFX.width/meteorFX.height,x=target-size*.8*(1-p),y=-size*.08+(hitY+size*.08)*p*p;c.save();if(t<impact+.15){c.globalAlpha=t>impact?Math.max(0,1-(t-impact)/.15):1;c.drawImage(meteorFX,x-w*.76,y-h*.73,w,h);}c.restore();const age=t-impact;if(age>=0){mageBurst(c,target,hitY,size*2.15,age,.8);c.save();c.globalCompositeOperation='screen';c.globalAlpha=.22*Math.exp(-age*12);c.fillStyle='#ffe1a5';c.fillRect(0,0,canvas.width,canvas.height);const q=age/.95;c.globalAlpha=Math.max(0,1-q)*.65;c.strokeStyle='#ffb546';c.lineWidth=3;c.beginPath();c.ellipse(target,floor,size*(.15+q*1.15),size*(.035+q*.2),0,0,Math.PI*2);c.stroke();c.restore();}}
function healingAura(c,start,floor,size,t,layer='front'){
 const age=t-.9;if(age<0||age>2.15)return;
 const span=1.75,turns=3,progress=Math.max(0,Math.min(1,age/span)),fade=Math.min(1,age/.25)*Math.min(1,(2.15-age)/.3),angle=progress*Math.PI*2*turns;
 const point=q=>{const p=Math.max(0,Math.min(1,q/(Math.PI*2*turns))),r=size*(.48-.2*p);return{x:start+Math.cos(q)*r,y:floor-size*(.045+.96*p)+Math.sin(q)*size*.115,front:Math.sin(q)>=0}};
 c.save();
 if(layer==='back'){
  const sw=healFX.width,sh=healFX.height*.22,dw=size*.98,dh=dw*sh/sw;
  c.globalAlpha=fade*.65;c.drawImage(healFX,0,healFX.height*.74,sw,sh,start-dw/2,floor-dh*.568,dw,dh);
  c.globalCompositeOperation='screen';const glow=c.createRadialGradient(start,floor,0,start,floor,size*.55);glow.addColorStop(0,'#83ffc54d');glow.addColorStop(1,'#2de78000');c.globalAlpha=fade;c.fillStyle=glow;c.fillRect(start-size*.55,floor-size*.55,size*1.1,size*1.1);
 }
 c.globalCompositeOperation='screen';c.lineCap='round';c.lineJoin='round';
 const tail=Math.min(angle,Math.PI*1.8),steps=52;
 for(let i=0;i<steps;i++){
  const q0=angle-tail+tail*i/steps,q1=angle-tail+tail*(i+1)/steps,a=point(q0),b=point(q1),front=point((q0+q1)/2).front;
  if(front!==(layer==='front'))continue;
  const strength=fade*Math.pow((i+1)/steps,1.35);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.globalAlpha=strength*.8;c.strokeStyle='#28eb87';c.lineWidth=size*.024;c.shadowColor='#42ff9c';c.shadowBlur=size*.055;c.stroke();c.shadowBlur=0;c.globalAlpha=strength;c.strokeStyle='#caffdf';c.lineWidth=size*.006;c.stroke();
 }
 if(layer==='front'){
  for(let i=0;i<16;i++){const lag=i*.23,q=Math.max(0,angle-lag),p=point(q);if(!p.front)continue;const pulse=(1-i/16)*fade;c.globalAlpha=pulse*.8;c.fillStyle=i%3?'#8dffbb':'#edfff1';c.shadowColor='#51ffa2';c.shadowBlur=8;c.beginPath();c.arc(p.x+Math.sin(i*7+age*4)*size*.025,p.y+Math.cos(i*4)*size*.025,size*(i===0?.014:.006),0,Math.PI*2);c.fill();}
 }
 c.restore();
}
function mageEffect(c,k,start,target,floor,size,t){if(k==='normal')lightning(c,target,floor,size,t);else if(k==='strong')fireRain(c,target,floor,size,t);else if(k==='max')meteorFall(c,target,floor,size,t);else if(k==='passive')healingAura(c,start,floor,size,t)}
const shieldPoseMeta={"male": {"feet": [[238, 415], [250, 416], [244, 415], [245, 416], [252, 386], [250, 386], [246, 388], [229, 395]], "height": 312}, "female": {"feet": [[257, 419], [274, 417], [270, 416], [265, 416], [266, 411], [270, 411], [263, 413], [248, 411]], "height": 363}};
function shieldSprite(c,frame,x,y,size){if(frame===0||frame===7){sprite(c,8,x,y,size,'normal');return}const source=gender==='female'?shieldFemale:shieldMale,meta=shieldPoseMeta[gender],cw=source.width/4,ch=source.height/2,foot=meta.feet[frame],scale=size/meta.height;c.drawImage(source,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,x-foot[0]*scale,y-foot[1]*scale,cw*scale,ch*scale)}
function goldenBarrier(c,x,floor,size,progress=1,t=0){if(progress<=0)return;const q=Math.max(0,Math.min(1,progress)),ease=1-Math.pow(1-q,3),diameter=size*1.75*(.65+.35*ease);c.save();c.globalAlpha=(.84+Math.sin(t*4)*.06)*q;c.drawImage(shieldFX,x-size*.08-diameter/2,floor-size*.62-diameter/2,diameter,diameter);c.globalCompositeOperation='lighter';c.globalAlpha=q*.5;c.strokeStyle='#ffe477';c.lineWidth=2;c.beginPath();c.ellipse(x-size*.06,floor+3,size*.55*ease,size*.105*ease,0,0,Math.PI*2);c.stroke();for(let i=0;i<14;i++){const a=i*2.399+t*.5,r=size*(.35+.12*Math.sin(i*7));const px=x+Math.cos(a)*r,py=floor-size*.55+Math.sin(a)*size*.6;c.globalAlpha=q*(.3+.45*Math.sin(i+t*2)**2);c.fillStyle='#ffe977';c.beginPath();c.arc(px,py,1.4,0,Math.PI*2);c.fill();}c.restore();}
function fireSprite(c,frame,x,y,size){const source=gender==='female'?fireFemale:fireMale,cw=source.width/4,ch=source.height/2,col=frame%4,row=Math.floor(frame/4),scale=size/(ch*.64),feet=gender==='male'?[[231,411],[245,416],[230,418],[238,414],[272,374],[258,373],[246,373],[257,374]]:[[250,433],[235,433],[225,433],[200,433],[255,405],[235,405],[216,405],[222,405]],foot=feet[frame];c.drawImage(source,col*cw,row*ch,cw,ch,x-foot[0]*scale,y-foot[1]*scale,cw*scale,ch*scale)}
function fireWave(c,start,target,floor,size,t){
 const launch=.85,arrival=1.75,life=.6;if(t<launch||t>arrival+life)return;
 const p=Math.max(0,Math.min(1,(t-launch)/(arrival-launch))),growth=.22+.78*(p*p*(3-2*p)),head=start+size*.3+(target-start-size*.3)*p,age=Math.max(0,t-arrival),impact=t>=arrival,fade=impact?Math.max(0,1-age/life):Math.min(1,(t-launch)/.075);
 const h=size*.95*growth,w=h*fireFX.width/fireFX.height;
 c.save();
 // Anchor the front of the wave to its travel point and the flame base to the floor.
 // Scaling therefore grows upward and backward without floating or overshooting the target.
 c.globalCompositeOperation='lighter';c.globalAlpha=fade;
 const glow=c.createRadialGradient(head,floor-h*.3,0,head,floor-h*.3,h*.65);glow.addColorStop(0,'#ffac4538');glow.addColorStop(1,'#ef360000');c.fillStyle=glow;c.fillRect(head-h*.65,floor-h,h*1.3,h*1.3);
 c.globalCompositeOperation='source-over';
 if(!impact){c.globalAlpha=fade;c.drawImage(fireFX,head-w*.96,floor-h*.9,w,h);}
 else if(age<.14){c.globalAlpha=1-age/.14;c.drawImage(fireFX,target-w*.96,floor-h*.9,w,h);}
 c.globalCompositeOperation='lighter';
 if(impact){const g=c.createRadialGradient(target,floor-size*.35,0,target,floor-size*.35,size*.6);g.addColorStop(0,'#fff7d9dd');g.addColorStop(.18,'#ffb44899');g.addColorStop(1,'#ff350000');c.globalAlpha=Math.exp(-age*15);c.fillStyle=g;c.fillRect(target-size*.6,floor-size*.95,size*1.2,size*1.2);c.save();c.translate(target,floor);c.scale(1,.22);c.globalAlpha=fade*.65;c.strokeStyle='#ffc66a';c.lineWidth=2;c.beginPath();c.arc(0,0,size*(.12+age*1.3),0,Math.PI*2);c.stroke();c.restore();}
 c.shadowColor='#ff7819';c.shadowBlur=5;
 for(let i=0;i<32;i++){const q=(i*.618+t*.9)%1,a=i*2.399,spread=age/life,x=impact?target+Math.cos(a)*size*spread*.65:head-q*w*.5,y=impact?floor-size*.3+Math.sin(a)*size*spread*.55+size*age*age*.35:floor-h*(q*.6+.06);c.globalAlpha=fade*(1-q)*.8;c.strokeStyle=i%3?'#ff8d25':'#fff0b8';c.lineWidth=1.5;c.beginPath();c.moveTo(x,y);c.lineTo(x-(impact?Math.cos(a)*7:6),y+5);c.stroke();}
 c.restore();
}
function maxExplosion(c,target,floor,size,t){
 for(let i=0;i<maxHits.length;i++){const age=t-maxHits[i];if(age<0||age>.48)continue;const q=age/.48,frame=Math.min(7,Math.floor(q*8)),cw=maxFX.width/4,ch=maxFX.height/2,heavy=i===4,extent=size*(heavy?1.35:.83),x=target+Math.sin(i*2.1)*size*.055,y=floor-size*(heavy?.43:.45+Math.cos(i*2)*.06);
 c.save();c.globalCompositeOperation='lighter';c.globalAlpha=(heavy?.16:.055)*Math.exp(-age*22);c.fillStyle='#ffc376';c.fillRect(0,0,canvas.width,canvas.height);c.globalAlpha=1;c.drawImage(maxFX,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,x-extent/2,y-extent/2,extent,extent);
 // Each hit draws a different sword arc, with an expanding shock ring on the finishing strike.
 c.translate(x,y);c.rotate((i%2?-.7:.6)+i*.35);c.globalAlpha=Math.max(0,1-q*2);c.strokeStyle='#fff0be';c.lineWidth=heavy?5:2;c.shadowColor='#ff4a16';c.shadowBlur=18;c.beginPath();c.ellipse(0,0,extent*.3,extent*.12,-.4,Math.PI*.12,Math.PI*1.6);c.stroke();c.restore();
 if(heavy){c.save();c.globalCompositeOperation='lighter';c.globalAlpha=(1-q)*.65;c.translate(target,floor);c.scale(1,.24);c.lineWidth=3;c.strokeStyle='#ffb53d';c.beginPath();c.arc(0,0,size*(.1+q*.95),0,Math.PI*2);c.stroke();c.restore();}
 }
}

 /* ---------- Cinematic stage ----------
    The fight is still drawn from the same painted sprite sheets, but through a moving camera: the backdrop sits on
    a deeper layer than the fighters (parallax), every impact shakes and punches the view, the strike that lands
    freezes for a few frames (hit-stop), the last blow of a fight plays in slow motion and the loser falls.
    Purely cosmetic: nothing here reads or changes combat results. */
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=q=>{q=clamp(q,0,1);return q*q*(3-2*q)},clock=()=>performance.now()/1000;
 const reducedMotion=()=>{try{return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
 const shownDamage=e=>Number(window.ValorDuelCore?.shownDamage?ValorDuelCore.shownDamage(e):e.damage||0);
 /* [time, strength] of every visible contact of a skill, in animation time. */
 function impacts(actor,k){
  if(k==='passive')return [];
  if(actor.cls==='Okçu'&&archer)return [[archer.hitAt(k),1]];
  if(actor.cls==='Büyücü')return k==='max'?[[2.25,1.6]]:k==='strong'?Array.from({length:10},(_,i)=>[1.75+i*.12,i?.35:.8]):[[1.3,1]];
  return k==='max'?maxHits.map((v,i)=>[v,i===4?1.5:.5]):k==='strong'?[[1.75,1.1]]:[[1.6,.9]];
 }
 /* Particle bursts (see arena-fx.js) fired on top of the painted effect: [effect, 'chest'|'ground' on the target or 'self', size]. */
 function bursts(actor,k,index,heavy,crit){
  if(actor.cls==='Büyücü')return k==='max'?[['fire7','ground',1.25],['sword12','ground',1.3]]:k==='strong'?(index%3?[]:[['fire2','ground',1.15]]):[['blow3','chest',1.1]];
  if(actor.cls==='Okçu')return k==='max'?[['light2','chest',1.25],['sword12','ground',1]]:[['light2','chest',k==='strong'?1:.8]];
  return k==='max'?(heavy?[['blow10','chest',1.5],['sword12','ground',1.15]]:[['blow10','chest',.8]]):k==='strong'?[['fire2','ground',1.25],['blow10','chest',.9]]:[['blow10','chest',crit?1.25:1]];
 }
 const selfBurst=actor=>actor.cls==='Büyücü'?['cure1',.5,1.2]:actor.cls==='Okçu'?['arrow1',.5,1.3]:['arrow1',.55,1.6];
 const mainImpact=list=>list.reduce((best,x)=>!best||x[1]>best[1]?x:best,null);
 function camera(s,ev,t,T,w){
  const still=s.reduced;let z=1.03+(still?0:.008*Math.sin(T*.5)),fx=w/2+(still?0:10*Math.sin(T*.21)),sx=0,sy=0;
  if(s.intro&&!still)z+=.1*(1-ease((T-s.intro.at)/.9));
  if(s.finale&&!still){const q=ease((T-s.finale.at)/.9);z+=.17*q;fx+=((s.finale.side?w*.78:w*.22)-fx)*q*.6}
  if(ev&&!still){const side=ev.side==='foe'?1:0,ax=side?w*.78:w*.22,tx=side?w*.22:w*.78,full=ev._full||4,main=ev._main,crit=!!ev.hit?.critical;
   const env=Math.min(ease(t/.5),1-ease((t-(full-.45))/.45));
   if(!main){z+=.07*env;fx+=(ax-fx)*.3*env}
   else{const focus=ax+(tx-ax)*ease((t-main[0]*.35)/(main[0]*.65));z+=(ev.skill==='max'?.07:.05)*env;fx+=(focus-fx)*.24*env;
    for(const [at,str] of ev._imp){const d=t-at;if(d<0||d>1.4)continue;const p=Math.exp(-d/.28)*str*(crit?1.35:1);z+=.06*p;sx+=Math.sin(d*61+at*9)*10*p;sy+=Math.cos(d*53+at*5)*5*p}}}
  z=clamp(z,1,1.36);fx=clamp(fx,w/(2*z),w-w/(2*z));return {z,fx,sx:clamp(sx,-18,18),sy:clamp(sy,-9,9)};
 }
 function dust(c,x,floor,size,d,str){if(d<0||d>.9)return;const q=d/.9;c.save();for(let i=0;i<12;i++){const a=i*2.399,r=size*(.1+.5*q)*(.5+.5*Math.abs(Math.sin(i*3.1)));c.globalAlpha=(1-q)*.34;c.fillStyle=i%2?'#d9c3a0':'#b89f7d';c.beginPath();c.arc(x+Math.cos(a)*r*str,floor-size*(.02+.22*q*Math.abs(Math.sin(i*1.7)))+2,size*(.02+.035*q),0,Math.PI*2);c.fill()}c.restore()}
 function scorch(c,x,floor,size,age){if(age<0||age>7)return;const fade=Math.min(1,age/.15)*(1-ease((age-3)/4)),hot=Math.max(0,1-age/2.2);c.save();c.translate(x,floor+2);c.scale(1,.2);
  const g=c.createRadialGradient(0,0,0,0,0,size*.62);g.addColorStop(0,'#120a06');g.addColorStop(.55,'#1c100acc');g.addColorStop(1,'#1c100a00');c.globalAlpha=fade*.72;c.fillStyle=g;c.beginPath();c.arc(0,0,size*.62,0,Math.PI*2);c.fill();
  if(hot>0){c.globalCompositeOperation='lighter';c.globalAlpha=fade*hot*.8;c.strokeStyle='#ff7a2a';c.lineWidth=5;for(let i=0;i<7;i++){const a=i*.9+.3,r=size*(.2+.3*Math.abs(Math.sin(i*2.3)));c.beginPath();c.moveTo(Math.cos(a)*size*.05,Math.sin(a)*size*.05);c.lineTo(Math.cos(a+.25)*r*.55,Math.sin(a+.25)*r*.55);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.stroke()}}
  c.restore()}
 function ambience(c,w,h,T,hud){c.save();
  const v=c.createRadialGradient(w/2,h*.52,h*.3,w/2,h*.52,Math.hypot(w,h)*.6);v.addColorStop(0,'#00000000');v.addColorStop(1,'#000000a6');c.fillStyle=v;c.fillRect(0,0,w,h);
  if(hud){const top=c.createLinearGradient(0,0,0,h*.26);top.addColorStop(0,'#05070bcc');top.addColorStop(1,'#05070b00');c.fillStyle=top;c.fillRect(0,0,w,h*.26)}
  c.globalCompositeOperation='lighter';c.fillStyle='#ffe9c0';for(let i=0;i<16;i++){const x=(i*137.5+T*(6+i%5*3))%w,y=h*(.25+.5*((i*.618)%1))+Math.sin(T*.7+i)*14;c.globalAlpha=.08+.12*Math.sin(T*1.3+i*2)**2;c.beginPath();c.arc(x,y,1.2+i%3*.6,0,Math.PI*2);c.fill()}
  c.restore()}

 function normalize(f){return {...f,gender:f.gender==='female'?'female':'male'}}
 function portrait(f){if(f.cls==='Savaşçı'||!f.art)return;let im=portraitCache.get(f.art);if(!im){im=new Image();im.src=f.art;portraitCache.set(f.art,im)}if(im.complete&&im.naturalWidth)f.image=im;else im.addEventListener('load',()=>{f.image=im},{once:true});}
 function idleLoop(s){if(s.idleOn||s.reduced||typeof requestAnimationFrame!=='function')return;s.idleOn=true;let last=0;
  const step=now=>{if(s.closed||!s.root.isConnected){s.idleOn=false;return}if(!s.current&&!(typeof document!=='undefined'&&document.hidden)&&now-last>=30){last=now;try{draw(s,null,0)}catch(error){}}requestAnimationFrame(step)};requestAnimationFrame(step)}
 function mount(root,players){let s=sessions.get(root);
  /* A screen that provides a stage slot gets the tall cinematic stage with its own HUD; other screens keep the classic strip. */
  const slot=root.querySelector('.vdu-stage-slot'),hud=!!(slot&&typeof slot.prepend==='function');
  if(!s){const wrap=document.createElement('div');wrap.className='valor-combat-motion';wrap.innerHTML='<canvas width="1000" height="'+(hud?760:480)+'" aria-label="Beceri animasyonu"></canvas><span class="valor-motion-status" aria-live="polite">Hazır</span>';s={root,wrap,canvas:wrap.querySelector('canvas'),players:[],queue:Promise.resolve(),version:0,current:null,decals:[],ko:null,finale:null,hud,reduced:reducedMotion()};if(hud&&!s.reduced)s.intro={at:clock()};fastCtx(s.canvas.getContext('2d'));sessions.set(root,s);}
  s.closed=false;s.players=players.map(normalize);s.players.forEach(portrait);if(s.ko&&s.players[s.ko.index]?.name!==s.ko.name)s.ko=null;
  const before=root.querySelector('.vdu-turn');
  if(hud){if(s.wrap.parentNode!==slot)slot.prepend(s.wrap)}
  else if(before&&s.wrap.parentNode!==before.parentNode)before.before(s.wrap);else if(before&&s.wrap.nextSibling!==before)before.before(s.wrap);
  if(!s.current){arenaReady.then(()=>{if(root.isConnected&&!s.current)draw(s,null,0)});ready.then(()=>{if(root.isConnected&&!s.current)draw(s,null,0)});archer?.ready.then(()=>{if(root.isConnected&&!s.current)draw(s,null,0)});}
  ready.then(()=>idleLoop(s));if(!s.reduced)window.ValorArenaFx?.boot();return s;}
 function draw(s,event,t){canvas=s.canvas;const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,hud=s.hud,floor=h*.86,size=hud?290:230,T=clock(),still=s.reduced;
 const side=event?.side==='foe'?1:0,actor=event?.actor||s.players[side]||{},foe=event?.target||s.players[1-side]||{},start=w*.22,target=w*.78,contact=w*.62,k=event?.skill||'normal';let x=start,frame=8,returning=false;
 const imp=event?._imp||[],main=event?._main||null,cam=camera(s,event,t,T,w),shown=event&&k!=='passive'?shownDamage(event):0,soaked=!!event&&k!=='passive'&&shown<=0;
 const layer=depth=>{const z=1+(cam.z-1)*depth,fx=w/2+(cam.fx-w/2)*depth;c.translate(w/2+cam.sx*depth,floor+cam.sy*depth);c.scale(z,z);c.translate(-fx,-floor)};
 /* Backdrop: a deeper layer that moves less than the fighters, drawn slightly oversized so shakes never show an edge. */
 c.fillStyle='#0b0d12';c.fillRect(0,0,w,h);c.save();layer(.8);c.translate(w/2,floor);c.scale(hud?1.1:1.08,hud?1.1:1.08);c.translate(-w/2,-floor);if(hud)c.translate(0,floor-h*.807);arenaBackdrop(c,w,h);c.restore();
 if(event&&k==='max'&&!still){const dim=Math.min(ease(t/.45),1-ease((t-((event._full||4)-.5))/.5));c.save();c.globalAlpha=.34*dim;c.fillStyle='#07060c';c.fillRect(0,0,w,h);c.restore()}
 if(event&&actor.cls==='Savaşçı'){if(k==='passive'){frame=t<.35?0:t<.7?1:t<1?2:t<1.25?3:t<2?4:t<2.35?5:t<2.7?6:7;}else if(k==='strong'){const seq=t<.85?Math.min(3,Math.floor(t/.85*4)):t<1.25?4+Math.min(1,Math.floor((t-.85)/.4*2)):t<1.65?5:t<2.15?6:7;frame=seq;}
 else if(k==='max'){if(t<.55){x=start+(contact-start)*(1-Math.pow(1-t/.55,2));frame=Math.floor(t*18)%8;}else if(t<3.15){x=contact;let i=maxHits.findIndex(v=>t<v+.18);if(i<0)i=4;const q=Math.max(0,Math.min(1,(t-(maxHits[i]-.28))/.46)),order=i%2?[1,2,3,4,5,6,7,0]:[0,1,2,3,4,5,6,7];frame=8+order[Math.min(7,Math.floor(q*8))];}else if(t<4.1){x=contact+(start-contact)*(t-3.15)/.95;frame=Math.floor(t*13)%8;returning=true;}}
 else{if(t<1){x=start+(contact-start)*t;frame=Math.floor(t*11)%8;}else if(t<2.05){x=contact;frame=8+Math.min(7,Math.floor((t-1)/1.05*8));}else if(t<3.05){x=contact+(start-contact)*(t-2.05);frame=Math.floor((t-2.05)*11)%8;returning=true;}}}
 if(event&&actor.cls==='Büyücü')frame=magePoseAt(k,t);if(event&&actor.cls==='Okçu'&&archer)frame=archer.pose(k,t);
 /* Reaction of the fighter that is hit: knock-back, a white flash on contact, and the fall on the last blow. */
 let recoil=0,flash=0;if(event&&!still)for(const [at,str] of imp){const d=t-at;if(d<0)continue;recoil+=str*Math.exp(-d/.22)*(soaked?.25:1);if(d<.13&&str>=.5&&!soaked)flash=Math.max(flash,1-d/.13)}
 const falling=event?._kill&&main&&t>=main[0]?ease((t-main[0])/.7):0;
 /* Motion added on top of the painted poses, so the eight frames of an action read as one movement: the caster
    gathers power (aura, a mage lifts off the ground), a warrior stretches into the dash and leaves after-images,
    everyone dips before acting, and both fighters walk in when the fight opens. */
 const power=event&&!still?Math.min(ease(t/.35),1-ease((t-((event._full||4)-.45))/.45)):0;
 const dash=event&&!still&&actor.cls==='Savaşçı'&&(k==='max'?(t<.55||(t>=3.15&&t<4.1)):k==='normal'?(t<1||(t>=2.05&&t<3.05)):false);
 const glow=!event?null:k==='passive'?(actor.cls==='Büyücü'?'#5dffa0':actor.cls==='Okçu'?'#8dffb0':'#ffd95a'):actor.cls==='Büyücü'?(k==='normal'?'#7db4ff':'#ff8a3c'):actor.cls==='Okçu'?'#74f0a0':k==='normal'?null:'#ff6a2c';
 const entering=s.intro&&!event&&!still?ease((T-s.intro.at)/.85):1;if(s.intro&&T-s.intro.at>1)s.intro=null;
 const fighter=(f,px,fr,flip,sk,place)=>{const acting=!!event&&f===actor,struck=!!event&&f===foe,down=struck?falling:(s.ko&&s.ko.name===f.name&&s.players[s.ko.index]===f?1:0),lean=place?1:-1;
  const body=cc=>{if(f.cls==='Okçu'&&archer?.isReady())archer.sprite(cc,f,fr,0,0,size,k,t,acting);else if(f.cls==='Büyücü'&&allReady)mageSprite(cc,fr%8,0,0,size);else if(f.cls==='Savaşçı'&&allReady)sprite(cc,fr,0,0,size,sk);else if(f.image)cc.drawImage(f.image,-size*.48,-size*1.15,size*.96,size*1.15);else{cc.fillStyle='#aa8c68';cc.beginPath();cc.ellipse(0,-size*.39,size*.14,size*.26,0,0,Math.PI*2);cc.fill();cc.beginPath();cc.arc(0,-size*.77,size*.08,0,Math.PI*2);cc.fill();}};
  c.save();c.translate(px+(struck?recoil*size*.055:0)+(entering<1?(place?1:-1)*size*1.9*(1-entering):0),floor);if(entering<1)c.globalAlpha=Math.min(1,entering*1.6);c.fillStyle='#0008';c.beginPath();c.ellipse(0,4,size*.25*(1+down*.5),9,0,0,Math.PI*2);c.fill();
  if(down){c.globalAlpha=1-.4*down;c.rotate(lean*down*1.38);c.translate(0,-down*size*.05)}else if(struck&&recoil)c.rotate(lean*Math.min(.12,recoil*.05));
  if(!acting&&!down&&!still){const breath=Math.sin(T*2.1+(place?1.7:0));c.scale(1+.004*breath,1+.013*breath)}
  gender=f.gender==='female'?'female':'male';
  if(acting&&power>0){
   if(glow){c.save();c.globalCompositeOperation='lighter';const g=c.createRadialGradient(0,-size*.5,0,0,-size*.5,size*.78);g.addColorStop(0,glow+'66');g.addColorStop(.45,glow+'26');g.addColorStop(1,glow+'00');c.globalAlpha=power*(.75+.25*Math.sin(T*9));c.fillStyle=g;c.fillRect(-size*.8,-size*1.3,size*1.6,size*1.6);
    c.scale(1,.22);c.globalAlpha=power*.8;c.strokeStyle=glow;c.lineWidth=5;c.beginPath();c.arc(0,0,size*(.34+.05*Math.sin(T*6)),0,Math.PI*2);c.stroke();c.restore()}
   if(f.cls==='Büyücü')c.translate(0,-size*.05*power+Math.sin(T*5)*1.5*power);
   const dip=t<.32?Math.sin(t/.32*Math.PI)*.05:0;if(dip)c.scale(1+dip*.5,1-dip);
   if(dash){const way=returning?-1:1;for(let i=3;i>=1;i--){c.save();c.globalAlpha*=.2/i;c.translate(-way*size*.17*i,0);if(flip)c.scale(-1,1);body(c);c.restore()}c.transform(1,0,-way*.07,1,0,0);c.scale(1.05,.97)}}
  if(flip)c.scale(-1,1);if(acting&&f.cls==='Büyücü'&&k==='passive'&&allReady)healingAura(c,0,0,size,t,'back');
  const bowman=f.cls==='Okçu'&&archer?.isReady();if(bowman)archer.behind(c,f,0,0,size,k,t,acting);
  if(struck&&flash>0&&typeof c.getTransform==='function'){
   /* Contact flash: paint the sprite on a spare canvas, whiten only its own pixels, then lay it over the scene. */
   if(!s.spare){s.spare=document.createElement('canvas');s.spare.width=w;s.spare.height=h;fastCtx(s.spare.getContext('2d'))}
   const fc=s.spare.getContext('2d');fc.setTransform(1,0,0,1,0,0);fc.globalCompositeOperation='source-over';fc.globalAlpha=1;fc.clearRect(0,0,w,h);fc.save();fc.setTransform(c.getTransform());body(fc);fc.restore();fc.globalCompositeOperation='source-atop';fc.globalAlpha=.6*flash;fc.fillStyle='#fff';fc.fillRect(0,0,w,h);
   c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(s.spare,0,0,w,h);c.restore();
  }else body(c);
  if(bowman)archer.front(c,f,0,0,size,k,t,acting);c.restore();
  const casting=acting&&k==='passive',barrier=casting?Math.max(0,Math.min(1,(t-1.05)/.4)):f.shield>0?1:0;if(allReady&&f.cls==='Savaşçı'&&barrier>0&&!down){goldenBarrier(c,px,floor,size,barrier,still?0:T);
   /* A blow the barrier soaks up ripples across it. */
   if(struck&&event.hit?.absorbed)for(const [at,str] of imp){const d=t-at;if(d<0||d>.5||str<.5)continue;const q=d/.5;c.save();c.globalCompositeOperation='lighter';c.globalAlpha=(1-q)*.9;c.strokeStyle='#fff3b0';c.lineWidth=5*(1-q)+1;c.beginPath();c.ellipse(px-size*.08,floor-size*.62,size*.875*(.55+.5*q),size*.875*(.55+.5*q),0,0,Math.PI*2);c.stroke();c.restore()}}};
 c.save();layer(1);
 if(s.decals.length){s.decals=s.decals.filter(d=>T-d.at<7);for(const d of s.decals)scorch(c,d.x,floor,size,T-d.at)}
 c.save();if(side){c.translate(w,0);c.scale(-1,1);}fighter(foe,target,8,true,'normal',1);fighter(actor,x,frame,returning,k,0);
 if(event&&actor.cls==='Okçu'&&archer?.isReady())archer.effects(c,actor,start,target,floor,size,k,t);if(event&&allReady&&actor.cls==='Büyücü')mageEffect(c,k,start,target,floor,size,t);if(event&&allReady&&actor.cls==='Savaşçı'){if(k==='passive'&&t>1.05&&t<1.6){c.save();c.globalCompositeOperation='lighter';c.globalAlpha=Math.max(0,1-(t-1.05)/.55)*.16;c.fillStyle='#ffe260';c.fillRect(x-size*.8,floor-size*1.4,size*1.6,size*1.5);c.restore();}else if(k==='strong')fireWave(c,start,target,floor,size,t);else if(k==='max')maxExplosion(c,target,floor,size,t);else if(k==='normal'&&t>1.6&&t<1.95){c.save();c.globalCompositeOperation='lighter';c.globalAlpha=Math.sin((t-1.6)/.35*Math.PI);c.drawImage(maxFX,0,0,maxFX.width/4,maxFX.height/2,target-size*.3,floor-size*.75,size*.6,size*.6);c.restore();}}
 if(event&&!soaked)for(const [at,str] of imp)if(str>=.8)dust(c,target,floor,size,t-at,str);
 c.restore();c.restore();
 ambience(c,w,h,still?0:T,hud);if(!still)window.ValorArenaFx?.frame(s.wrap,canvas,cam,floor);
 /* Text is drawn on the screen layer, on top of the camera, and kept inside the frame. */
 const onScreen=(X,Y)=>[clamp(w/2+cam.sx+(X-cam.fx)*cam.z,150,w-150),Math.max(hud?210:70,floor+cam.sy+(Y-floor)*cam.z)];
 c.fillStyle='#decab1';c.font='20px system-ui';c.textAlign='center';
 if(!hud){c.save();c.lineWidth=4;c.lineJoin='round';c.strokeStyle='#24180e';for(const [label,px] of [[(side?foe:actor).name||'Sen',w*.22],[(side?actor:foe).name||'Rakip',w*.78]]){c.strokeText(label,px,h-12);c.fillText(label,px,h-12)}c.restore();}
 if(event&&actor.cls==='Büyücü'&&k==='passive'&&t>1.15&&t<2.8){const [hx,hy]=onScreen(w*(side?.78:.22),floor-size*1.05);c.save();c.font='900 44px system-ui';c.lineJoin='round';c.lineWidth=8;c.strokeStyle='#04180c';c.strokeText('+'+Number(event.healed||0).toLocaleString('tr-TR'),hx,hy-30*ease((t-1.15)/1.2));c.fillStyle='#8dffb5';c.fillText('+'+Number(event.healed||0).toLocaleString('tr-TR'),hx,hy-30*ease((t-1.15)/1.2));c.restore();}
 const hitTime=main?main[0]:actor.cls==='Okçu'&&archer?archer.hitAt(k):k==='max'?2.75:k==='strong'?1.75:1.6;if(event&&k!=='passive'&&t>hitTime){const crit=event.hit?.critical&&!soaked,age=t-hitTime,pop=Math.min(1,age/.12),rise=1-Math.pow(1-Math.min(1,age/1.1),2),[dx,baseY]=onScreen(w*(side?.22:.78),floor-size*.95),dy=baseY-46*rise;
  /* A hit that the shield or a block swallows whole says so instead of showing "-0". */
  const txt=soaked?(event.hit?.absorbed?'EMİLDİ':'BLOK'):'-'+shown.toLocaleString('tr-TR');
  c.save();c.font='900 '+Math.round((soaked?58:crit?86:70)*(.7+.3*pop))+'px system-ui';c.textAlign='center';c.lineJoin='round';c.lineWidth=soaked?10:crit?13:11;c.strokeStyle=soaked?'#0a1626':'#1a0703';c.shadowColor=soaked?'#4aa8ff':crit?'#ff8a00':'#000';c.shadowBlur=crit||soaked?16:8;c.strokeText(txt,dx,dy);c.shadowBlur=0;c.fillStyle=soaked?'#bfe2ff':crit?'#ffd23a':'#ffffff';c.fillText(txt,dx,dy);
  if(crit){c.font='900 32px system-ui';c.lineWidth=7;c.strokeText('KRİTİK',dx,dy-(78*(.7+.3*pop)));c.fillStyle='#ffb02e';c.fillText('KRİTİK',dx,dy-(78*(.7+.3*pop)));}
  else if(!soaked&&event.hit?.absorbed){const part='KALKAN '+Number(event.hit.absorbed).toLocaleString('tr-TR');c.font='900 28px system-ui';c.lineWidth=7;c.strokeStyle='#0a1626';c.strokeText(part,dx,dy+38);c.fillStyle='#bfe2ff';c.fillText(part,dx,dy+38);}
  c.restore();}}

 function play(root,event,actor,target){const s=sessions.get(root);if(!s||!['normal','strong','max','passive'].includes(event.skill)||!['Savaşçı','Büyücü','Okçu'].includes(actor.cls))return Promise.resolve();const version=s.version,item={...event,actor:normalize(actor),target:normalize(target)};portrait(item.target);
 s.queue=s.queue.catch(()=>{}).then(async()=>{await ready;if(actor.cls==='Okçu')await archer?.ready;if((actor.cls==='Okçu'?!archer?.isReady():!allReady)||s.version!==version||!root.isConnected)return;s.current=item;s.wrap.classList?.add('casting');s.wrap.querySelector('span').textContent=(event.side==='me'?'Sen':(actor.name||'Rakip'))+' · '+(actor.cls==='Okçu'&&archer?archer.title(event.skill):actor.cls==='Büyücü'?({normal:'Yıldırım',strong:'Ateş Yağmuru',max:'Meteor',passive:'Şifa'}[event.skill]):event.skill==='passive'?'Demir Duruş · Altın kalkan':event.skill==='max'?'Max · 5 darbeli kombo':event.skill==='strong'?'Alev Dalgası':'Kılıç Darbesi');const full=actor.cls==='Okçu'&&archer?archer.duration(event.skill):actor.cls==='Büyücü'?mageDuration(event.skill):event.skill==='max'?4.5:3.25,ms=(actor.cls==='Okçu'?(event.skill==='max'?2400:event.skill==='passive'?1800:1750):actor.cls==='Büyücü'?(event.skill==='max'?2100:event.skill==='strong'?1850:1650):event.skill==='passive'?1450:event.skill==='max'?1700:event.skill==='strong'?2000:1050)*(root.id==='valor-tduel'?.6:1);
  item._full=full;item._imp=impacts(item.actor,event.skill);item._main=mainImpact(item._imp);
  /* The blow that ends a 1v1 fight: the target's health after this event is zero. */
  const targetHp=event.side==='me'?event.enemyHp:event.myHp;item._kill=event.skill!=='passive'&&Number.isFinite(targetHp)&&targetHp<=0;
  const main=item._main,index=event.side==='me'?1:0;
  await new Promise(resolve=>{const at=performance.now();let last=at,tt=0,frozen=0,slow=0,struck=!main||s.reduced;const fired=new Set(),fx=window.ValorArenaFx,cw=s.canvas.width,floor=s.canvas.height*.86,size=s.hud?290:230,tx=cw*(event.side==='foe'?.22:.78),ax=cw-tx;
   const tick=now=>{if(s.version!==version||!root.isConnected){resolve();return}
    let dt=Math.max(0,now-last);if(now>last)last=now;
    if(frozen>0){const used=Math.min(frozen,dt);frozen-=used;dt-=used}
    let rate=1;if(slow>0&&dt>0){rate=.32;slow-=dt}
    const prev=tt;tt=Math.min(full,tt+dt/ms*full*rate);
    if(!struck&&tt>=main[0]){struck=true;tt=Math.min(full,Math.max(prev,main[0]+.02));frozen=item._kill?170:item.hit?.critical?110:main[1]>=1?70:45;if(item._kill)slow=520;
     if(event.skill==='max'&&actor.cls!=='Okçu')s.decals.push({x:canvasTargetX(s,event.side),at:clock()})}
    if(fx&&!s.reduced){const soaked=event.skill!=='passive'&&shownDamage(event)<=0;
     item._imp.forEach(([when,str],i)=>{if(tt<when||fired.has(i))return;fired.add(i);if(soaked)return;for(const [name,where,scale] of bursts(item.actor,event.skill,i,str>=1.5,!!item.hit?.critical))fx.burst(name,tx,where==='ground'?floor:floor-size*.45,scale*size/290)});
     if(event.skill==='passive'&&tt>=1.05&&!fired.has('self')){fired.add('self');const [name,up,scale]=selfBurst(item.actor);fx.burst(name,ax,floor-size*up,scale*size/290)}}
    try{draw(s,item,tt)}catch(error){console.warn('Beceri animasyonu atlandı',error);resolve();return}
    if(tt>=full){resolve();return}s.raf=requestAnimationFrame(tick)};s.raf=requestAnimationFrame(tick)});
  s.current=null;if(s.version===version&&root.isConnected){if(item._kill)s.ko={index,name:s.players[index]?.name};s.wrap.classList?.remove('casting');s.wrap.querySelector('span').textContent='Hazır';draw(s,null,0);}});return s.queue;}
 const canvasTargetX=(s,side)=>s.canvas.width*(side==='foe'?.22:.78);
 /* End of a fight: the camera closes in on the winner (0 = left fighter, 1 = right fighter). */
 function finale(root,winner){const s=sessions.get(root);if(!s||s.closed)return;s.finale={side:winner?1:0,at:clock()};if(s.reduced&&!s.current)try{draw(s,null,0)}catch(error){}}
 function close(root){const s=sessions.get(root);if(s){s.version++;s.current=null;s.closed=true;s.finale=null;s.ko=null;s.decals=[];window.ValorArenaFx?.detach(s.wrap);s.wrap.remove();}}
 window.ValorCombatMotion={mount,play,close,finale,whenIdle:root=>sessions.get(root)?.queue||Promise.resolve()};
 const style=document.createElement('style');style.textContent='.valor-combat-motion{position:relative;margin:10px 0;border:1px solid #99765166;border-radius:9px;overflow:hidden;background:#17171f}.valor-combat-motion canvas{display:block;width:100%;aspect-ratio:1000/480}.valor-motion-status{position:absolute;top:9px;left:12px;color:#ead0aa;font:11px system-ui;text-shadow:0 1px 3px #000;pointer-events:none}.vdu-dialog:has(.valor-combat-motion){max-width:720px}.vdu-dialog:has(.valor-combat-motion) .vdu-card{padding:7px}.vdu-dialog:has(.valor-combat-motion) .vdu-portrait{width:45px;height:45px;min-width:45px}.vdu-dialog:has(.valor-combat-motion) .vdu-ticker{max-height:72px}@media(max-width:500px){.valor-combat-motion canvas{aspect-ratio:1000/480}.vdu-dialog:has(.valor-combat-motion){padding:12px}.vdu-dialog:has(.valor-combat-motion) h2{margin:4px 0;font-size:18px}}';document.head.appendChild(style);
})();
