export const store={duels:new Map(),log:[],limit:10};
const refs=JSON.parse(Deno.readTextFileSync(new URL('../../valor-dungeon/refstats.json',import.meta.url)));
function q(){const f={};const api={select(){return api},eq(k,v){f[k]=v;return api},async maybeSingle(){const r=store.duels.get(f.attacker);return {data:r?structuredClone(r):null}},
 async then(res){}};return {api,f}}
export function createClient(){return {
 auth:{getUser:async t=>t==='bad'?{error:'x'}:{data:{user:{id:t}}}},
 rpc:async(name,a)=>{if(name==='srv_arena_context'){if(store.log.filter(x=>x.attacker===a.attacker).length>=store.limit)return {data:{status:'limit'}};return {data:{status:'ok',me:{name:'Ben',class:'Okçu',level:50,combat:refs['R2/Okçu'].stats},foe:{name:'Rakip',class:'Savaşçı',level:50,combat:refs['R2/Savaşçı'].stats,gender:'male'}}}}
  if(name==='srv_arena_store'){store.log.push(a);return {data:'ok'}}return {data:null}},
 from(){const f={};let mode='select',payload=null;const b={select(){return b},eq(k,v){f[k]=v;return b},
  async maybeSingle(){const r=store.duels.get(f.attacker);return {data:r?structuredClone(r):null}},
  insert(row){store.duels.set(row.attacker,structuredClone(row));return Promise.resolve({error:null})},
  delete(){mode='delete';return b},update(p){mode='update';payload=p;return b},
  then(res,rej){if(mode==='delete'){store.duels.delete(f.attacker);return Promise.resolve({error:null}).then(res,rej)}
   if(mode==='update'){const r=store.duels.get(f.attacker);let data=[];if(r&&r.updated_at===f.updated_at){Object.assign(r,structuredClone(payload));data=[{attacker:f.attacker}]}return Promise.resolve({data,error:null}).then(res,rej)}
   return Promise.resolve({data:null}).then(res,rej)}};return b}}}
