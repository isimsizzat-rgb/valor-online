/* Boss calibration for Valor Zindanı.
   Reference players (tools/valor-dungeon/refstats.json, exported from tools/balance/refchars.js) fight
   all 30 floors solo and as a 3-class team, with bots that use skills sensibly and sometimes idle into
   the 7-second auto attack. Prints the median floors cleared per setup.
   Run: node tools/valor-dungeon/balance.cjs 2.5 1 4   (the multipliers baked into core.js) */
const fs=require('fs'),path=require('path');
const refs=JSON.parse(fs.readFileSync(path.join(__dirname,'refstats.json'),'utf8'));
const ORDER=['R0','R1','R2','R3','R4','Zirve'];
const ANCHOR={1:'R0',8:'R1',15:'R2',22:'R3',30:'R4'};
function refAvg(id){const cs=['Savaşçı','Büyücü','Okçu'].map(c=>refs[id+'/'+c].stats);const m=k=>cs.reduce((s,x)=>s+x[k],0)/3;
 return {atk:(refs[id+'/Savaşçı'].stats.Saldırı+refs[id+'/Büyücü'].stats.Sihir+refs[id+'/Okçu'].stats.Saldırı)/3,def:m('Savunma'),can:m('Can'),crit:m('Kritik'),block:m('Bloke')}}
function bossStats(A,D,H,G=1){const keys=Object.keys(ANCHOR).map(Number),out=[];
 for(let f=1;f<=30;f++){let lo=keys.filter(k=>k<=f).pop(),hi=keys.find(k=>k>=f);const a=refAvg(ANCHOR[lo]),b=refAvg(ANCHOR[hi]),t=hi===lo?0:(f-lo)/(hi-lo);
  const lerp=k=>a[k]*Math.pow(b[k]/a[k],t),g=Math.pow(G,f-1),ramp=Math.min(1,.35+.13*(f-1));
  out.push({atk:Math.round(lerp('atk')*A*g*ramp),def:Math.round(lerp('def')*D*g),can:Math.round(lerp('can')*H*g*ramp),crit:Math.round(lerp('crit')),block:Math.round(lerp('block'))})}
 return out}
module.exports={bossStats,refAvg};
if(require.main===module){
 const [A,D,H,G]=process.argv.slice(2).map(Number);const stats=bossStats(A||1,D||1,H||1,G||1);
 const coreSrc=fs.readFileSync(path.join(__dirname,'../../assets/valor-dungeon/core.js'),'utf8').replace(/const BOSS_STATS=\[[^\]]*\];/,'const BOSS_STATS='+JSON.stringify(stats)+';');
 const C={};new Function('globalThis','module',coreSrc)(C,undefined);const core=C.ValorDungeonCore;
 function member(id,cls,i){const s=refs[id+'/'+cls].stats;return core.unit({uid:'u'+i,name:cls,cls,level:1,stats:{Saldırı:s.Saldırı,Sihir:s.Sihir,Savunma:s.Savunma,'Sihir Savunma':s['Sihir Savunma'],Can:s.Can,Kritik:s.Kritik,Bloke:s.Bloke}})}
 function run(team,rng){const room={members:team.map((m,i)=>member(m[0],m[1],i)),floor:1,cleared:0,version:0,status:'waiting',boss:core.unit(core.bosses[0]),log:[]};let now=0;core.start(room,now);let guard=0;
  while(room.status==='battle'&&guard++<200000){const p=room.members[room.turn];
   // Bot: decide whether to use the skill, then attack after a human-like delay; 10% of turns idle into auto.
   if(!process.env.NOSKILL&&now>=(p.cdUntil||0)){const s=core.skills[p.cls].id,low=room.members.filter(m=>m.hp>0).some(m=>m.hp<m.maxHp*.7),aoeNext=room.round%core.AOE_EVERY===0;
    if(s==='boost'||(s==='heal'&&low)||(s==='shield'&&(aoeNext||low))){now+=800+rng()*700;core.skill(room,now)}}
   if(rng()<.1){now=(room.turnAt||now)+core.TURN_MS;core.tick(room,now,rng)}else{now+=1500+rng()*3000;core.attack(room,now,rng)}}
  return room.cleared}
 let seed=7;const rng=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
 const N=Number(process.env.N||60),only=process.env.ONLY;const setups=[];for(const id of ORDER){setups.push([id+' solo Savaşçı',[[id,'Savaşçı']]],[id+' solo Okçu',[[id,'Okçu']]],[id+' ikili',[[id,'Savaşçı'],[id,'Büyücü']]],[id+' üçlü',[[id,'Savaşçı'],[id,'Büyücü'],[id,'Okçu']]])}
 for(const [label,team] of setups){if(only&&!label.includes(only))continue;const r=[];for(let k=0;k<N;k++)r.push(run(team,rng));r.sort((a,b)=>a-b);console.log(label.padEnd(18),"medyan",String(r[N>>1]).padStart(2)," (en kötü %10:",r[Math.floor(N*.1)]+", en iyi %10:",r[Math.floor(N*.9)]+")")}
 if(process.argv.includes('--print'))console.log(JSON.stringify(stats));
}
