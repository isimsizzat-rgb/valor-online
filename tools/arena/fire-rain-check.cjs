const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('assets/arena/combat-motion.js','utf8'),fn=src.slice(src.indexOf('function fireRain('),src.indexOf('function meteorFall('));
const rainFX={width:1024,height:1536},maxFX={width:2048,height:1024},calls=[],g={addColorStop(){}};
const c=new Proxy({drawImage(...a){assert(a.slice(1).every(Number.isFinite));calls.push(a)},createRadialGradient:()=>g},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const scope={rainFX,maxFX,Math};vm.createContext(scope);vm.runInContext(fn,scope);
const sample=t=>{calls.length=0;scope.fireRain(c,780,413,230,t);return calls.slice()};
assert.equal(sample(1.09).length,0,'Rain starts before casting');
for(let i=0;i<10;i++){const contact=1.75+i*.12,ground=413+Math.cos(i*2.17)*230*.025,x=780+Math.sin(i*2.399)*230*.43;
const before=sample(contact-.0001).find(a=>a[0]===rainFX&&Math.abs(a[1]+a[3]*.5-x)<.01);assert(before,'Missing falling flame '+i);assert(Math.abs(before[2]+before[4]*.9-ground)<.2,'Flame stopped above floor');
const after=sample(contact+.001).find(a=>a[0]===maxFX&&Math.abs(a[5]+a[7]/2-x)<.01);assert(after,'Missing ground explosion '+i);assert(Math.abs(after[6]+after[8]*.78-ground)<.001,'Explosion not anchored to ground');}
assert.equal(sample(3.6).length,0,'Rain does not finish within skill duration');
for(let t=0;t<3.8;t+=.01)sample(t);
console.log('PASS: ten falling flames reach floor, grounded contact bursts, casting timing and complete cleanup');
