// Local test of the arena-fight duel modes with a mocked database.
// Run: deno run --allow-read --import-map=tools/arena/edge/import_map.json tools/arena/edge/test.ts
import {store} from "./mock-supabase.js";
let handler;Deno.serve=(h)=>{handler=h};Deno.env.get=()=>"x";
await import("../../../supabase/functions/arena-fight/index.ts");
const call=async(body,tok='u1')=>{const r=await handler(new Request('http://x',{method:'POST',headers:{Authorization:'Bearer '+tok},body:JSON.stringify(body)}));return r.json()};
const assert=(c,m)=>{if(!c)throw new Error('FAIL '+m)};
let r=await call({mode:'duel_state'});assert(r.duel===null,'no duel');
r=await call({mode:'duel_start',target:'t1'});assert(r.duel&&r.duel.status==='battle','started');assert(r.duel.turn==='me','my turn');
const r2=await call({mode:'duel_start',target:'t2'});assert(r2.resumed,'resumes live duel');
r=await call({mode:'duel_act',skill:'max'});assert(!r.error,'max ok '+r.error);assert(r.duel.events.some(e=>e.side==='me'&&e.skill==='max'),'max event');
r=await call({mode:'duel_act',skill:'max'});assert(r.error==='not_ready','max on cooldown');
r=await call({mode:'duel_act',skill:'auto'});assert(r.error==='not_ready','auto before 5s rejected');
// play out with real time skipped: patch Date.now
let t=Date.now();const realNow=Date.now;Date.now=()=>t;
let n=0;while(r.duel&&r.duel.status==='battle'&&n++<500){t+=2500;r=await call({mode:'duel_act',skill:'normal'})}
assert(r.duel.status==='done','finished '+n);assert(store.log.length===1,'stored once');assert(!store.duels.has('u1'),'row deleted');
console.log('result',JSON.stringify(r.duel.result),'turns',n);
// abandoned duel older than 10 min gets played out and recorded on next start
r=await call({mode:'duel_start',target:'t1'});store.duels.get('u1').updated_at=new Date(t-11*60000).toISOString();
r=await call({mode:'duel_start',target:'t3'});assert(store.log.length===2,'abandoned recorded');assert(r.duel.status==='battle'&&!r.resumed,'fresh duel');
store.limit=2;store.duels.clear();r=await call({mode:'duel_start',target:'t1'});assert(r.error==='limit','limit');
r=await call({mode:'duel_state'},'bad');assert(r.error==='auth','auth');
Date.now=realNow;console.log('EDGE DUEL PASS');
