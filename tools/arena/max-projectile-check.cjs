const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const motion=fs.readFileSync('assets/arena/combat-motion.js','utf8');
const meteorFX={width:1024,height:1536},calls=[],gradient={addColorStop(){}};
const c=new Proxy({drawImage(...a){assert(a.slice(1).every(Number.isFinite));calls.push(a)},createRadialGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const scope={meteorFX,Math,canvas:{width:1000,height:480},mageBurst(){}};vm.createContext(scope);
vm.runInContext(motion.slice(motion.indexOf('function meteorScale('),motion.indexOf('function healingAura(')),scope);
let previous=0;
for(let i=0;i<=100;i++){
 calls.length=0;scope.meteorFall(c,780,413,230,1.05+1.2*i/100);
 const a=calls.find(a=>a[0]===meteorFX);assert(a,'Missing meteor frame');
 assert(a[4]>previous,'Meteor must grow continuously');previous=a[4];
 assert(Math.abs(a[3]/a[4]-meteorFX.width/meteorFX.height)<1e-9,'Meteor proportions changed');
 if(i===0)assert(a[4]<230*.4,'Meteor starts too large');
 if(i===100){assert(Math.abs(a[1]+a[3]*.76-780)<1e-6);assert(Math.abs(a[2]+a[4]*.73-(413-230*.3))<1e-6,'Meteor misses impact point')}
}
calls.length=0;scope.meteorFall(c,780,413,230,3.31);assert.equal(calls.length,0,'Meteor survives its animation');
const archer=fs.readFileSync('assets/arena/archer-combat.js','utf8');
const snippets=[['function archerMaxScale(', 'function archerJumpLift('],['function archerProjectile(', 'function archerImpact('],['function archerShotLayout(', '\nconst keys=']].map(([a,b])=>archer.slice(archer.indexOf(a),archer.indexOf(b))).join('\n');
const source={naturalWidth:1536,naturalHeight:1024};
const aScope={Math,skill:3,archerAssets:{'energy-max-v2':source},archerClamp:v=>Math.max(0,Math.min(1,v)),archerMix:(a,b,q)=>a+(b-a)*q,archerLaunches:{3:[2.35]},archerTravel:()=>.62,archerCharge(){},archerImpact(){}};
vm.createContext(aScope);vm.runInContext(snippets,aScope);
for(const size of [180,230,280]){
 let height,previousWidth=0;
 for(let i=0;i<100;i++){
  const p=i/100,translations=[],rotations=[];calls.length=0;
  const ctx=new Proxy(c,{get:(o,k)=>k==='translate'?((x,y)=>translations.push([x,y])):k==='rotate'?(r=>rotations.push(r)):o[k]});
  aScope.archerEffects(ctx,220,780,413,size,2.35+.62*p);
  const a=calls.find(a=>a[0]===source);assert(a,'Missing Max arrow');
  const [x,y]=translations[0];height??=y;assert.equal(y,height,'Max arrow drifts vertically');assert.equal(rotations.length,0,'Max arrow tilts');
  assert(Math.abs(x-(220+size*.5+(780-220-size*.5)*p))<1e-6,'Max arrow leaves straight path');
  assert(a[3]>previousWidth,'Max arrow growth was lost');previousWidth=a[3];
  assert(Math.abs(a[1]+a[3]*.97)<1e-6&&Math.abs(a[2]+a[4]*.58)<1e-6,'Arrow tip shifts as it grows');
 }
}
console.log('PASS: meteor grows from small to full size with fixed impact; Max arrow flies horizontally, keeps its tip anchored, and still grows');
