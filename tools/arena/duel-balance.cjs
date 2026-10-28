/* Arena duel balance: equal-power reference players of each class fight each other.
   The attacker is a bot that thinks 1–3 s per turn (sometimes idling into the 5 s auto pick);
   the defender is the game AI. Prints attacker win % per class pairing.
   Run: node tools/arena/duel-balance.cjs [shield heal focus]   (passive values to try) */
const fs=require('fs'),path=require('path');
const D=require('../../assets/arena/duel-core.js');
const refs=JSON.parse(fs.readFileSync(path.join(__dirname,'../valor-dungeon/refstats.json'),'utf8'));
const [sh,he,fo]=process.argv.slice(2).map(Number);
if(sh)D.PASSIVES['Savaşçı'].value=sh;if(he)D.PASSIVES['Büyücü'].value=he;if(fo)D.PASSIVES['Okçu'].value=fo;
let seed=11;const rng=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
const C=['Savaşçı','Büyücü','Okçu'],N=Number(process.env.N||400),ids=(process.env.REFS||'R1,R2,R3').split(',');
function duel(id,ca,cb,human){const p=c=>({name:c,cls:c,stats:refs[id+'/'+c].stats});let now=0;const st=D.create(p(ca),p(cb),now,rng);let g=0;
 while(st.status==='battle'&&g++<3000){if(human===false){now=st.turnAt+D.TURN_MS;D.act(st,'auto',now,rng);continue}
  if(rng()<.08){now=st.turnAt+D.TURN_MS;D.act(st,'auto',now,rng)}else{now=Math.max(st.turnAt,now)+1000+rng()*2000;const k=D.choose(st.me,now);if(!D.act(st,k,now,rng)){now+=1000}}}
 return st.result}
const out={};let rounds=0,n=0;
for(const id of ids)for(const a of C)for(const b of C){let w=0;for(let k=0;k<N;k++){const r=duel(id,a,b);if(r.win)w++;rounds+=r.rounds;n++}out[a+'>'+b]=(out[a+'>'+b]||0)+w/N/ids.length}
for(const a of C)console.log(a.padEnd(8),C.map(b=>b.slice(0,3)+' '+String(Math.round(out[a+'>'+b]*100)).padStart(3)+'%').join('  '));
const cls=C.map(c=>[c,Math.round(C.reduce((s,b)=>s+out[c+'>'+b]+(1-out[b+'>'+c]),0)/6*100)]);
console.log('sınıf ortalaması:',cls.map(x=>x.join(' %')).join(' · '),'· ort. tur',Math.round(rounds/n));
