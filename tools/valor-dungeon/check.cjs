/* Run: PGLITE_MODULE=/path/to/@electric-sql/pglite node tools/valor-dungeon/check.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const C=require('../../assets/valor-dungeon/core.js');
(async()=>{
 assert.equal(C.bosses.length,30);assert.equal(new Set(C.bosses.map(b=>b.name)).size,30);
 for(let i=1;i<30;i++){assert(C.unit(C.bosses[i]).maxHp>C.unit(C.bosses[i-1]).maxHp);assert(C.unit(C.bosses[i]).attack>C.unit(C.bosses[i-1]).attack)}
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function public.is_banned(uuid) returns boolean language sql as $$select false$$;create table saves(user_id uuid primary key,name text,class text,level integer,profile jsonb,combat jsonb,data jsonb,rev integer default 1,updated_at timestamptz);create table chat_messages(user_id uuid,channel text,name text,class text,level integer,body text);create table chat_mutes(user_id uuid,until timestamptz);`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../../supabase/valor-dungeon.sql'),'utf8'));
 // Server boss table must match core.js exactly.
 for(const row of (await db.query('select floor,cls,stats from valor_dungeon_bosses order by floor')).rows){const b=C.bosses[row.floor-1];assert.equal(row.cls,b.cls);assert.deepEqual(row.stats,b.stats)}
 const ids=Array.from({length:4},(_,i)=>`00000000-0000-0000-0000-00000000000${i+1}`);
 for(const [i,id] of ids.entries()){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into saves(user_id,name,class,level,profile,combat,data) values($1,$2,$3,10,$4,$5,$6)',[id,'Test'+i,'Savaşçı',{gender:'male'},{Saldırı:1000000,Sihir:0,Savunma:10000,'Sihir Savunma':10000,Can:10000,Kritik:0,Bloke:0},{state:{diamonds:5,shards:2,stones:{1:2},inventory:[]}}])}
 async function call(i,op,room=null,ver=null,qty=1){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);return (await db.query('select valor_dungeon_action($1,$2,$3,$4) r',[op,room,ver,qty])).rows[0].r}
 let r=await call(0,'create');const rid=r.room.id;assert.equal(r.room.status,'waiting');assert.equal((await call(0,'create')).status,'already');
 assert.equal((await call(1,'join',rid)).status,'ok');assert.equal((await call(2,'join',rid)).status,'ok');assert.equal((await call(3,'join',rid)).status,'full');
 assert.equal((await call(1,'start',null,2)).status,'not_leader');r=await call(0,'state');r=await call(0,'start',null,r.room.version);assert.equal(r.room.members.length,3);
 assert.equal((await call(3,'join',rid)).status,'started');
 // Turn order: members act in join order; others get not_turn. Boss HP scales with party size.
 assert.equal(r.room.boss.maxHp,3*C.unit(C.bosses[0]).maxHp);assert.equal(r.room.turn,0);assert.ok(r.now>0&&r.room.turnAt>0);
 assert.equal((await call(1,'attack',null,r.room.version)).status,'not_turn');
 // Skill is a free action once a minute: the warrior shields everyone, then still attacks.
 r=await call(0,'skill',null,r.room.version);assert.equal(r.status,'ok');for(const m of r.room.members)assert.equal(m.shield,Math.round(m.maxHp*.25));
 assert.equal((await call(0,'skill',null,r.room.version)).status,'cooldown');
 const version=r.room.version;r=await call(0,'attack',null,version);assert.equal(r.room.cleared,1);assert.equal(r.room.floor,2);assert.equal(r.room.turn,0);assert.equal((await call(0,'attack',null,version)).status,'stale');
 // Weaken the party so floors take several turns, then walk the turn order 0 → 1 → 2 → boss.
 await db.query(`update valor_dungeon_runs set members=(select jsonb_agg(value||'{"attack":50}'::jsonb) from jsonb_array_elements(members)) where id=$1`,[rid]);r=await call(0,'state');
 r=await call(0,'attack',null,r.room.version);assert.equal(r.room.turn,1);r=await call(1,'attack',null,r.room.version);assert.equal(r.room.turn,2);
 await db.query(`update valor_dungeon_runs set members=jsonb_set(members,'{2,cls}','"Okçu"') where id=$1`,[rid]);r=await call(2,'state');
 r=await call(2,'skill',null,r.room.version);assert.equal(r.room.boost,1);r=await call(2,'attack',null,r.room.version);assert.equal(r.room.turn,0);assert.equal(r.room.round,2);
 // Tick only acts after 7 idle seconds; then the idle player attacks automatically.
 assert.equal((await call(1,'tick')).status,'wait');await db.query(`update valor_dungeon_runs set turn_at=now()-interval '8 seconds' where id=$1`,[rid]);
 r=await call(1,'tick');assert.equal(r.status,'ok');assert.equal(r.room.turn,1);assert.equal(r.room.log.at(-1).auto,true);
 // Healer heals, capped at max HP.
 await db.query(`update valor_dungeon_runs set members=jsonb_set(members,'{1,hp}','1') where id=$1`,[rid]);r=await call(1,'skill',null,(await call(1,'state')).room.version);
 assert.equal(r.room.members[1].hp,1);/* member 1 is Savaşçı in fixtures, so this is a shield, not a heal */
 await db.query(`update valor_dungeon_runs set members=(select jsonb_agg(value||'{"cls":"Büyücü","cdUntil":0,"skillUsedTurn":false}'::jsonb) from jsonb_array_elements(members)) where id=$1`,[rid]);
 r=await call(1,'skill',null,(await call(1,'state')).room.version);assert.equal(r.room.members[1].hp,1+Math.round(r.room.members[1].maxHp*.25));assert.equal(r.room.members[0].hp,r.room.members[0].maxHp);
 // Simulate the last living players' deaths with an authoritative boss stat fixture.
 await db.query(`update valor_dungeon_runs set floor=8,cleared=7,boss=jsonb_set(boss,'{attack}','1000000000000'),members=(select jsonb_agg(value||'{"hp":1,"shield":0,"attack":1}'::jsonb) from jsonb_array_elements(members)) where id=$1`,[rid]);
 for(let k=0;k<12;k++){r=await call(0,'state');if(r.room.status!=='battle')break;const actor=ids.indexOf(r.room.members[r.room.turn].uid);r=await call(actor,'attack',null,r.room.version)}
 assert.equal(r.room.status,'lost');assert.equal(r.room.cleared,7);
 for(let i=0;i<3;i++)assert.equal((await call(i,'state')).balance,7);
 assert.equal((await call(0,'finish',null,r.room.version)).status,'invalid');assert.equal((await call(0,'state')).balance,7);
 let opened=await call(0,'open',null,null,3);assert.equal(opened.opened,3);assert.equal(opened.balance,4);
 let st=(await db.query('select data from saves where user_id=$1',[ids[0]])).rows[0].data.state;
 assert.equal(st.diamonds,80);assert.equal(st.shards,5);assert.equal(st.stones['1'],5);for(const item of ['petFood','energyBottle','expeditionPaper'])assert.equal(st.inventory.find(x=>x.marketItemId===item).count,3);
 assert.equal((await call(0,'open',null,null,999)).opened,4);assert.equal((await call(0,'open')).status,'empty');assert.equal((await call(1,'state')).balance,7);
 // New one-player run: all 30 floors are sequential; final reward is exactly 30 once.
 await db.query(`update saves set combat=combat||'{"Saldırı":1000000000,"Can":100000000}'::jsonb where user_id=$1`,[ids[0]]);
 await call(0,'leave');r=await call(0,'create');r=await call(0,'start',null,r.room.version);
 for(let f=1;f<=30;f++){for(let k=0;k<20&&r.room.cleared<f;k++)r=await call(0,'attack',null,r.room.version);assert.equal(r.room.cleared,f)}
 assert.equal(r.room.status,'complete');assert.equal(r.balance,30);assert.equal((await call(0,'state')).balance,30);assert.equal((await call(0,'attack',null,r.room.version)).status,'invalid');
 // Waiting-room leave transfers leadership and rejects an obsolete invite once empty.
 await call(3,'leave');await call(1,'leave');await call(2,'leave');r=await call(1,'create');const second=r.room.id;await call(2,'join',second);await call(1,'leave');r=await call(2,'state');assert.equal(r.room.leader,ids[2]);await call(2,'leave');assert.equal((await call(3,'join',second)).status,'gone');
 console.log('PASS: 30 bosses, 1–3-player rooms, capacity, leader permissions, turn order, skills and cooldown, 7s auto attack, duplicate rejection, 7-floor loss, per-member rewards, one-time settlement, all six chest rewards, 30-floor completion and room lifecycle.');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
