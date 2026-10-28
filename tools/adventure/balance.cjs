/* Macera balance: reference players (tools/valor-dungeon/refstats.json) play every zone their level allows.
   Run: node tools/adventure/balance.cjs */
const D=require('../../assets/arena/duel-core.js');
const A=require('../../assets/adventure/expedition-core.js');
const refs=require('../valor-dungeon/refstats.json');
const LV={R0:1,R1:25,R2:50,R3:75,R4:100};
let seed=7;const rng=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
function fight(me,foe){const st=D.create(me,foe,0,rng);let t=0,g=0;while(st.status==='battle'&&g++<500){t+=1100;D.act(st,D.choose(st.me,t),t,rng)}return {win:!!st.result.win,rounds:st.result.rounds,hp:st.me.hp/st.me.maxHp}}
const K=Number(process.argv[2]||1);   // player strength vs the reference (0.8 = 20% weaker)
for(const [ref,lv] of Object.entries(LV))for(const cls of ['Savaşçı','Büyücü','Okçu']){
 const r0=refs[ref+'/'+cls],r={stats:Object.fromEntries(Object.entries(r0.stats).map(([k,v])=>[k,typeof v==='number'&&v>1?v*K:v]))};const zones=A.zones.map((z,i)=>i).filter(i=>A.zones[i].min<=lv&&A.zones[i].max>=lv-10).slice(-2);
 for(const zi of zones){let runs=0,clears=0,minionWin=0,minions=0,bossWin=0,bossTry=0,rounds=0,fights=0,br=0;
  for(let n=0;n<200;n++){runs++;const plan=A.plan(zi,rng);let ok=true;
   for(const step of plan.steps){if(step.kind!=='fight')continue;const e=A.enemy(zi,step);const res=fight({name:'Ref',cls,level:lv,stats:r.stats},e);if(step.boss)br+=res.rounds;else{rounds+=res.rounds;fights++}
    if(step.boss){bossTry++;if(res.win)bossWin++}else{minions++;if(res.win)minionWin++}
    if(!res.win){ok=false;break}}
   if(ok)clears++}
  console.log((ref+'/'+cls).padEnd(12),'zone',String(zi+1).padStart(2),'minion',(100*minionWin/minions).toFixed(0)+'%','boss',(100*bossWin/Math.max(1,bossTry)).toFixed(0)+'%','clear',(100*clears/runs).toFixed(0)+'%','foe rounds',(rounds/fights).toFixed(1),'boss rounds',(br/Math.max(1,bossTry)).toFixed(1))}}
