const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('assets/arena/combat-motion.js','utf8');
const fn=src.slice(src.indexOf('function fireWave('),src.indexOf('function maxExplosion('));
const calls=[],g={addColorStop(){}};
const ctx=new Proxy({drawImage(...a){calls.push({a,alpha:this.globalAlpha})},createRadialGradient:()=>g},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const scope={fireFX:{width:1919,height:820},Math};vm.createContext(scope);vm.runInContext(fn,scope);
const sample=t=>{calls.length=0;scope.fireWave(ctx,220,780,413,230,t);return calls.slice()};
assert.equal(sample(.84).length,0);
let previous=0;
for(let i=0;i<=18;i++){const t=.85+i*.05,d=sample(t);assert.equal(d.length,1);const [,x,y,w,h]=d[0].a;assert(h>=previous,'Wave shrank in flight');previous=h;assert(Math.abs(y+h*.9-413)<1e-8,'Base floated off the ground');assert(Math.abs(w/h-1919/820)<1e-8,'Aspect ratio changed');assert(x+w*.96<=780+1e-8,'Front passed the target');}
assert(sample(.86)[0].a[4]<sample(1.74)[0].a[4]*.25,'Wave must begin small');
assert.equal(sample(1.9).length,0,'Traveling wave persists after impact');assert.equal(sample(2.36).length,0,'Effect did not finish');
for(let t=0;t<3;t+=.01)for(const {a,alpha} of sample(t)){assert(a.slice(1).every(Number.isFinite));assert(alpha>=0&&alpha<=1)}
console.log('PASS: progressive fire growth, fixed floor anchor, intact proportions, target contact and disappearance');
