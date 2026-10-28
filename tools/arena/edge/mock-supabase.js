// In-memory stand-in for the Supabase client used by the arena-fight function (tests only).
export const store={tables:{arena_duels:[],team_duels:[],team_room_members:[]},log:[],teamStored:[],limit:10};
const refs=JSON.parse(Deno.readTextFileSync(new URL('../../valor-dungeon/refstats.json',import.meta.url)));
export const fx={me:{class:'Okçu',combat:refs['R2/Okçu'].stats},foe:{class:'Savaşçı',combat:refs['R2/Savaşçı'].stats},refs};
export function createClient(){return {
 auth:{getUser:async t=>t==='bad'?{error:'x'}:{data:{user:{id:t}}}},
 rpc:async(name,a)=>{
  if(name==='srv_arena_context'){if(store.log.filter(x=>x.attacker===a.attacker).length>=store.limit)return {data:{status:'limit'}};return {data:{status:'ok',me:{name:'Ben',class:fx.me.class,level:50,combat:fx.me.combat},foe:{name:'Rakip',class:fx.foe.class,level:50,combat:fx.foe.combat,gender:'male'}}}}
  if(name==='srv_arena_store'){store.log.push(a);return {data:'ok'}}
  if(name==='srv_team_context'){const mine=store.tables.team_room_members.filter(m=>m.room_id==='room1');if(a.leader!=='u1')return {data:{status:'not_leader'}};
   return {data:{status:'ok',room:'room1',members:mine.map(m=>({user_id:m.user_id,name:'P'+m.user_id,class:m.cls,level:50,combat:refs['R2/'+m.cls].stats,gender:'male'}))}}}
  if(name==='srv_team_rivals')return {data:['Okçu','Savaşçı','Büyücü'].slice(0,a.n).map((c,i)=>({user_id:'r'+i,name:'Rakip'+i,class:c,level:50,combat:refs['R2/'+c].stats,gender:'male'}))};
  if(name==='srv_team_store'){store.teamStored.push(a);return {data:'ok'}}
  return {data:null}},
 from(table){const rows=store.tables[table];const f=[];let mode='select',payload=null,wantRows=false;
  const match=r=>f.every(([k,v])=>r[k]===v);
  const b={select(){wantRows=true;return b},eq(k,v){f.push([k,v]);return b},
   async maybeSingle(){const r=rows.find(match);return {data:r?structuredClone(r):null}},
   insert(row){const pk=table==='arena_duels'?'attacker':'room_id';if(rows.some(r=>r[pk]===row[pk]))return Promise.resolve({error:{message:'duplicate'}});rows.push(structuredClone(row));return Promise.resolve({error:null})},
   delete(){mode='delete';return b},update(p){mode='update';payload=p;return b},
   then(res,rej){let data=[];
    if(mode==='delete'){for(let i=rows.length-1;i>=0;i--)if(match(rows[i])){data.push({...rows[i]});rows.splice(i,1)}}
    else if(mode==='update'){for(const r of rows)if(match(r)){Object.assign(r,structuredClone(payload));data.push({...r})}}
    return Promise.resolve({data,error:null}).then(res,rej)}};return b}}}
