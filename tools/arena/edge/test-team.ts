// Local test of the arena-fight 3v3 duel modes with a mocked database.
// Run: deno run --allow-read --import-map=tools/arena/edge/import_map.json tools/arena/edge/test-team.ts
import {store} from "./mock-supabase.js";
let handler;Deno.serve=(h)=>{handler=h};Deno.env.get=()=>"x";
await import("../../../supabase/functions/arena-fight/index.ts");
const call=async(body,tok='u1')=>{const r=await handler(new Request('http://x',{method:'POST',headers:{Authorization:'Bearer '+tok},body:JSON.stringify(body)}));return r.json()};
const assert=(c,m)=>{if(!c)throw new Error('FAIL '+m)};
store.tables.team_room_members.push({user_id:'u1',room_id:'room1',cls:'Savaşçı'},{user_id:'u2',room_id:'room1',cls:'Büyücü'},{user_id:'u3',room_id:'room1',cls:'Okçu'});
assert((await call({mode:'tduel_start'},'u2')).error==='not_leader','only leader starts');
let r=await call({mode:'tduel_start'});assert(r.tduel&&r.tduel.status==='battle','started');assert(r.tduel.units.length>=5,'units');
assert((await call({mode:'tduel_start'})).resumed,'second start resumes');
let s2=await call({mode:'tduel_state'},'u2');assert(s2.tduel&&s2.tduel.status==='battle','member sees duel');
let t=Date.now();const realNow=Date.now;Date.now=()=>t;
let n=0,acted=0;
while(r.tduel&&r.tduel.status==='battle'&&n++<4000){
 const uid=r.tduel.actorUid;
 // the wrong member cannot act
 const other=['u1','u2','u3'].find(x=>x!==uid);if(n<4){const w=await call({mode:'tduel_act',skill:'normal'},other);assert(w.error==='not_ready','wrong member rejected')}
 t+=1500;
 if(n%7===0){t+=5000;r=await call({mode:'tduel_state'},other)}   // idle: another member's poll plays the turn
 else{r=await call({mode:'tduel_act',skill:'normal'},uid);acted++}
}
assert(r.tduel?.status==='done','finished '+n+' '+JSON.stringify(r).slice(0,200));
assert(store.teamStored.length===1,'stored once');assert(!store.tables.team_duels.length,'row removed');
const prep=store.teamStored[0].fight;assert(prep.duel&&prep.battle.units.length===r.tduel.units.length&&prep.battle.log.length>0,'prep shape');
console.log('rounds',prep.battle.rounds,'win',prep.battle.win,'calls',n);
// double finish guard: two stale finishes cannot both store
Date.now=realNow;console.log('EDGE TEAM DUEL PASS');
