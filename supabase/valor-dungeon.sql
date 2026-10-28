-- Valor Zindanı. Apply after schema.sql, arena.sql, chat.sql, guard3.sql and profiles.sql.
-- All room membership, fights and chest balances are server-authoritative. Safe to re-run.
begin;
create table if not exists public.valor_dungeon_bosses (
 floor integer primary key check(floor between 1 and 30), name text not null,
 cls text not null, stats jsonb not null
);
create table if not exists public.valor_dungeon_runs (
 id uuid primary key default gen_random_uuid(), leader uuid not null references auth.users(id),
 status text not null default 'waiting' check(status in ('waiting','battle','cleared','lost','complete')),
 floor integer not null default 1 check(floor between 1 and 30), cleared integer not null default 0 check(cleared between 0 and 30),
 members jsonb not null default '[]', boss jsonb, turn integer not null default 0,
 round integer not null default 1, version integer not null default 0,
 log jsonb not null default '[]', paid boolean not null default false,
 invite_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- One-tap floors: summary of the last fight (floor, boss, won, rounds, dealt, taken).
alter table public.valor_dungeon_runs add column if not exists last jsonb;
create table if not exists public.valor_dungeon_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 room_id uuid not null references public.valor_dungeon_runs(id) on delete cascade
);
create index if not exists valor_dungeon_members_room on public.valor_dungeon_members(room_id);
create table if not exists public.valor_dungeon_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 balance integer not null default 0 check(balance>=0)
);
alter table public.valor_dungeon_bosses enable row level security;
alter table public.valor_dungeon_runs enable row level security;
alter table public.valor_dungeon_members enable row level security;
alter table public.valor_dungeon_wallets enable row level security;
revoke all on public.valor_dungeon_bosses, public.valor_dungeon_runs, public.valor_dungeon_members, public.valor_dungeon_wallets from public, anon, authenticated;

-- Canonical battle unit from server-approved combat stats, never from a request body.
create or replace function public.vzd_unit(p jsonb) returns jsonb language sql immutable set search_path=public as $$
 select p || jsonb_build_object('attack',10+greatest(0,coalesce((p->'stats'->>(case when p->>'cls'='Büyücü' then 'Sihir' else 'Saldırı' end))::numeric,0)),
 'maxHp',greatest(1,round(100+coalesce((p->'stats'->>'Can')::numeric,0)*10)),
 'hp',greatest(1,round(100+coalesce((p->'stats'->>'Can')::numeric,0)*10)));
$$;
create or replace function public.vzd_player(who uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select vzd_unit(jsonb_build_object('uid',s.user_id,'name',s.name,'cls',s.class,'level',s.level,
 'gender',coalesce(s.profile->>'gender','male'),'stats',s.combat))
 from saves s where s.user_id=who and s.class is not null and coalesce(s.name,'')<>'' and s.combat is not null;
$$;
create or replace function public.vzd_boss(f integer) returns jsonb language sql stable security definer set search_path=public as $$
 select vzd_unit(jsonb_build_object('floor',floor,'name',name,'cls',cls,'stats',stats)) from valor_dungeon_bosses where floor=f;
$$;
create or replace function public.vzd_hit(a jsonb,b jsonb) returns jsonb language plpgsql volatile set search_path=public as $$
declare atk numeric:=greatest(1,(a->>'attack')::numeric); def numeric:=greatest(0,coalesce((b->'stats'->>(case when a->>'cls'='Büyücü' then 'Sihir Savunma' else 'Savunma' end))::numeric,0));
 c numeric:=greatest(0,coalesce((a->'stats'->>'Kritik')::numeric,0)); bl numeric:=greatest(0,coalesce((b->'stats'->>'Bloke')::numeric,0)); crit boolean; blocked boolean;
begin
 crit:=random()<least(.75,c/(c+1000)); blocked:=random()<least(.75,bl/(bl+1000));
 return jsonb_build_object('name',a->>'name','target',b->>'name','damage',greatest(1,round(atk*atk/(atk+def)*(1+case when crit then .25 else 0 end-case when blocked then .25 else 0 end))), 'critical',crit,'blocked',blocked);
end; $$;
-- One-time settlement under the room row lock, including members who disconnected.
create or replace function public.vzd_settle(run_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r valor_dungeon_runs%rowtype; m jsonb;
begin
 select * into r from valor_dungeon_runs where id=run_id for update;
 if not found or r.paid or r.status not in ('lost','complete') then return; end if;
 for m in select value from jsonb_array_elements(r.members) loop
  insert into valor_dungeon_wallets(user_id,balance) values((m->>'uid')::uuid,r.cleared)
  on conflict(user_id) do update set balance=valor_dungeon_wallets.balance+excluded.balance;
 end loop;
 update valor_dungeon_runs set paid=true where id=run_id;
end; $$;
create or replace function public.vzd_stack(inv jsonb, item text, title text, n integer) returns jsonb language plpgsql immutable set search_path=public as $$
declare result jsonb:='[]'; e jsonb; added boolean:=false;
begin
 for e in select value from jsonb_array_elements(coalesce(inv,'[]')) loop
  if e->>'marketItemId'=item then
   if not added then result:=result||jsonb_build_array(e||jsonb_build_object('count',greatest(1,coalesce((e->>'count')::integer,1))+n));added:=true; end if;
  else result:=result||jsonb_build_array(e); end if;
 end loop;
 if not added then result:=result||jsonb_build_array(jsonb_build_object('id','vzd-'||item,'slot','Eşya','marketItemId',item,'name',title,'count',n)); end if;
 return result;
end; $$;

-- The only public entrypoint. Optimistic version checks reject double taps and stale turns.
create or replace function public.valor_dungeon_action(op text, rid uuid default null, expected_version integer default null, quantity integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); r valor_dungeon_runs%rowtype; room_id uuid; p jsonb; members jsonb; h jsonb;
 i integer; j integer; k integer; n integer; alive integer; target integer; new_id uuid; bal integer:=0; hp0 numeric; hp1 numeric; dealt numeric; fought integer; bname text; qty integer; revn integer; inv jsonb; d jsonb; st jsonb; response text:='ok';
begin
 if me is null then return jsonb_build_object('status','invalid'); end if;
 if is_banned(me) then return jsonb_build_object('status','banned'); end if;
 -- Per-user serialization also prevents parallel create/join/open requests.
 perform pg_advisory_xact_lock(hashtextextended('vzd:'||me::text,0));
 select balance into bal from valor_dungeon_wallets where user_id=me;
 bal:=coalesce(bal,0);
 select m.room_id into room_id from valor_dungeon_members m where m.user_id=me;

 if op='open' then
  select balance into bal from valor_dungeon_wallets where user_id=me for update;
  if coalesce(bal,0)<=0 then return jsonb_build_object('status','empty','balance',0); end if;
  qty:=least(bal,greatest(1,coalesce(quantity,1)),1000);
  select data,rev into d,revn from saves where user_id=me for update;
  if d is null then return jsonb_build_object('status','no_character'); end if;
  st:=d->'state';inv:=coalesce(st->'inventory','[]');
  inv:=vzd_stack(inv,'energyBottle','Enerji Şişesi',qty);
  inv:=vzd_stack(inv,'expeditionPaper','Sefer Kağıdı',qty);
  inv:=vzd_stack(inv,'petFood','Pet Yemi',qty);
  st:=st||jsonb_build_object('inventory',inv,'diamonds',coalesce((st->>'diamonds')::numeric,0)+25*qty,
   'shards',coalesce((st->>'shards')::numeric,0)+qty,
   'stones',coalesce(st->'stones','{}')||jsonb_build_object('1',coalesce((st->'stones'->>'1')::integer,0)+qty));
  perform set_config('valor.server_write','1',true);
  update saves set data=jsonb_set(d,'{state}',st),rev=rev+1,updated_at=now() where user_id=me returning rev into revn;
  update valor_dungeon_wallets set balance=balance-qty where user_id=me returning balance into bal;
  return jsonb_build_object('status','ok','opened',qty,'balance',bal,'rev',revn);
 end if;

 if op='create' then
  if room_id is not null then response:='already';
  else
   p:=vzd_player(me);if p is null then return jsonb_build_object('status','no_character'); end if;
   insert into valor_dungeon_runs(leader,members,boss) values(me,jsonb_build_array(p),vzd_boss(1)) returning id into room_id;
   insert into valor_dungeon_members values(me,room_id);
  end if;
 elsif op='join' then
  if room_id is not null then response:='already';
  else
   select * into r from valor_dungeon_runs where id=rid for update;
   if not found then return jsonb_build_object('status','gone','balance',bal); end if;
   if r.status<>'waiting' then return jsonb_build_object('status','started','balance',bal); end if;
   if r.created_at<now()-interval '2 hours' then return jsonb_build_object('status','gone','balance',bal); end if;
   if jsonb_array_length(r.members)>=3 then return jsonb_build_object('status','full','balance',bal); end if;
   p:=vzd_player(me);if p is null then return jsonb_build_object('status','no_character'); end if;
   insert into valor_dungeon_members values(me,r.id);
   update valor_dungeon_runs set members=r.members||jsonb_build_array(p),version=version+1,updated_at=now() where id=r.id;
   room_id:=r.id;
  end if;
 end if;
 if room_id is null then return jsonb_build_object('status',case when op='state' then 'ok' else 'gone' end,'room',null,'balance',bal); end if;
 select * into r from valor_dungeon_runs where id=room_id for update;
 if op not in ('state','create','join','leave','invite') and (expected_version is null or expected_version<>r.version) then response:='stale';
 elsif op='start' then
  if r.leader<>me then response:='not_leader';
  elsif r.status<>'waiting' then response:='invalid';
  else
   members:='[]';for p in select value from jsonb_array_elements(r.members) loop members:=members||jsonb_build_array(vzd_player((p->>'uid')::uuid));end loop;
   r.members:=members;r.status:='battle';r.version:=r.version+1;
  end if;
 elsif op='fight' then
  -- One tap resolves a whole floor: members attack in order, the boss strikes after each full round.
  if r.leader<>me then response:='not_leader';
  elsif r.status not in ('battle','cleared') then response:='invalid';
  else
   n:=jsonb_array_length(r.members);
   if r.status='cleared' and r.floor<30 then
    r.floor:=r.floor+1;r.boss:=vzd_boss(r.floor);r.round:=1;r.turn:=0;
    while r.turn<n and (r.members->r.turn->>'hp')::numeric<=0 loop r.turn:=r.turn+1;end loop;r.status:='battle';
   end if;
   if r.status='battle' then
    hp0:=0;for i in 0..n-1 loop hp0:=hp0+(r.members->i->>'hp')::numeric;end loop;
    dealt:=0;j:=0;fought:=r.floor;bname:=r.boss->>'name';
    while r.status='battle' and j<5000 loop
     j:=j+1;
     p:=r.members->r.turn;h:=vzd_hit(p,r.boss);dealt:=dealt+least((r.boss->>'hp')::numeric,(h->>'damage')::numeric);
     r.boss:=jsonb_set(r.boss,'{hp}',to_jsonb(greatest(0,(r.boss->>'hp')::numeric-(h->>'damage')::numeric)));
     if (r.boss->>'hp')::numeric<=0 then
      r.cleared:=r.floor;r.status:=case when r.floor=30 then 'complete' else 'cleared' end;
     else
      r.turn:=r.turn+1;
      while r.turn<n and (r.members->r.turn->>'hp')::numeric<=0 loop r.turn:=r.turn+1;end loop;
      if r.turn>=n then
       alive:=0;for i in 0..n-1 loop if (r.members->i->>'hp')::numeric>0 then alive:=alive+1;end if;end loop;
       k:=(r.round-1)%greatest(alive,1);target:=0;
       for i in 0..n-1 loop if (r.members->i->>'hp')::numeric>0 then if k=0 then target:=i;exit;end if;k:=k-1;end if;end loop;
       p:=r.members->target;h:=vzd_hit(r.boss,p);p:=jsonb_set(p,'{hp}',to_jsonb(greatest(0,(p->>'hp')::numeric-(h->>'damage')::numeric)));
       r.members:=jsonb_set(r.members,array[target::text],p);
       r.turn:=0;while r.turn<n and (r.members->r.turn->>'hp')::numeric<=0 loop r.turn:=r.turn+1;end loop;
       r.round:=r.round+1;if r.turn>=n then r.status:='lost';end if;
      end if;
     end if;
    end loop;
    hp1:=0;for i in 0..n-1 loop hp1:=hp1+(r.members->i->>'hp')::numeric;end loop;
    r.last:=jsonb_build_object('floor',fought,'name',bname,'won',r.status<>'lost','rounds',r.round,'dealt',dealt,'taken',greatest(0,hp0-hp1));
    r.log:='[]';
    if r.status='cleared' then
     r.floor:=r.floor+1;r.boss:=vzd_boss(r.floor);r.round:=1;r.turn:=0;
     while r.turn<n and (r.members->r.turn->>'hp')::numeric<=0 loop r.turn:=r.turn+1;end loop;r.status:='battle';
    end if;
   end if;
   r.version:=r.version+1;
  end if;
 elsif op='finish' then
  if r.status not in ('battle','cleared') then response:='invalid';
  elsif r.leader=me then r.status:='lost';r.version:=r.version+1;
  else
   -- Withdrawn members stay in the result and receive only the party's final cleared-floor reward.
   for i in 0..jsonb_array_length(r.members)-1 loop if r.members->i->>'uid'=me::text then
    r.members:=jsonb_set(r.members,array[i::text,'hp'],'0');r.members:=jsonb_set(r.members,array[i::text,'withdrawn'],'true');
   end if;end loop;
   alive:=0;for i in 0..jsonb_array_length(r.members)-1 loop if (r.members->i->>'hp')::numeric>0 then alive:=alive+1;end if;end loop;
   if alive=0 then r.status:='lost';else
    while r.turn<jsonb_array_length(r.members) and (r.members->r.turn->>'hp')::numeric<=0 loop r.turn:=r.turn+1;end loop;
    if r.turn>=jsonb_array_length(r.members) then r.turn:=0;while (r.members->r.turn->>'hp')::numeric<=0 loop r.turn:=r.turn+1;end loop;end if;
   end if;r.version:=r.version+1;
  end if;
 elsif op='leave' then
  if r.status not in ('waiting','lost','complete') then response:='invalid';
  else
   delete from valor_dungeon_members where user_id=me;
   if r.status='waiting' then
    select coalesce(jsonb_agg(value),'[]') into r.members from jsonb_array_elements(r.members) where value->>'uid'<>me::text;
    if jsonb_array_length(r.members)=0 then delete from valor_dungeon_runs where id=r.id;return jsonb_build_object('status','ok','room',null,'balance',bal);end if;
    if r.leader=me then r.leader:=(r.members->0->>'uid')::uuid;end if;r.version:=r.version+1;
   end if;
  end if;
 elsif op='invite' then
  if r.leader<>me then response:='not_leader';
  elsif r.status<>'waiting' then response:='started';
  elsif r.invite_at>now()-interval '15 seconds' then response:='slow';
  elsif exists(select 1 from chat_mutes where user_id=me and (until is null or until>now())) then response:='muted';
  else
   insert into chat_messages(user_id,channel,name,class,level,body)
   select me,'world',s.name,s.class,s.level,'Valor Zindanı · 30 kat · 1–3 kişi [VALOR-ZINDANI:'||r.id::text||']' from saves s where s.user_id=me;
   r.invite_at:=now();
  end if;
 elsif op not in ('state','create','join') then response:='invalid';
 end if;
 if response='ok' then
  select coalesce(jsonb_agg(value),'[]') into r.log from (select value from jsonb_array_elements(r.log) with ordinality x(value,ord) order by ord desc limit 8) q;
  -- Preserve chronological order after trimming.
  select coalesce(jsonb_agg(value order by ord desc),'[]') into r.log from jsonb_array_elements(r.log) with ordinality x(value,ord);
  update valor_dungeon_runs set leader=r.leader,status=r.status,floor=r.floor,cleared=r.cleared,members=r.members,boss=r.boss,
   turn=r.turn,round=r.round,version=r.version,log=r.log,last=r.last,invite_at=r.invite_at,updated_at=now() where id=r.id;
  perform vzd_settle(r.id);
 end if;
 select * into r from valor_dungeon_runs where id=room_id;
 select balance into bal from valor_dungeon_wallets where user_id=me;
 return jsonb_build_object('status',response,'balance',coalesce(bal,0),'room',case when op='leave' and response='ok' then null else to_jsonb(r)-'invite_at' end);
end; $$;

revoke all on function public.vzd_unit(jsonb), public.vzd_player(uuid), public.vzd_boss(integer), public.vzd_hit(jsonb,jsonb), public.vzd_settle(uuid), public.vzd_stack(jsonb,text,text,integer) from public,anon,authenticated;
revoke all on function public.valor_dungeon_action(text,uuid,integer,integer) from public,anon;
grant execute on function public.valor_dungeon_action(text,uuid,integer,integer) to authenticated;
insert into public.valor_dungeon_bosses(floor,name,cls,stats) values
(1,'Paslı Nöbetçi','Savaşçı','{"Saldırı":90,"Sihir":10,"Savunma":35,"Sihir Savunma":35,"Can":120,"Kritik":4,"Bloke":3}'::jsonb),
(2,'Lağım Kralı','Savaşçı','{"Saldırı":108,"Sihir":10,"Savunma":41,"Sihir Savunma":41,"Can":142,"Kritik":8,"Bloke":6}'::jsonb),
(3,'Mağara Trolü','Savaşçı','{"Saldırı":130,"Sihir":10,"Savunma":49,"Sihir Savunma":49,"Can":167,"Kritik":12,"Bloke":9}'::jsonb),
(4,'Zümrüt Örümcek','Savaşçı','{"Saldırı":156,"Sihir":10,"Savunma":58,"Sihir Savunma":58,"Can":197,"Kritik":16,"Bloke":12}'::jsonb),
(5,'Demir Gardiyan','Savaşçı','{"Saldırı":187,"Sihir":10,"Savunma":68,"Sihir Savunma":68,"Can":233,"Kritik":20,"Bloke":15}'::jsonb),
(6,'Ayaz Hayaleti','Büyücü','{"Saldırı":10,"Sihir":224,"Savunma":80,"Sihir Savunma":80,"Can":275,"Kritik":24,"Bloke":18}'::jsonb),
(7,'Buz Şövalyesi','Savaşçı','{"Saldırı":269,"Sihir":10,"Savunma":94,"Sihir Savunma":94,"Can":324,"Kritik":28,"Bloke":21}'::jsonb),
(8,'Ak Kurt','Savaşçı','{"Saldırı":322,"Sihir":10,"Savunma":111,"Sihir Savunma":111,"Can":382,"Kritik":32,"Bloke":24}'::jsonb),
(9,'Kristal Dev','Büyücü','{"Saldırı":10,"Sihir":387,"Savunma":132,"Sihir Savunma":132,"Can":451,"Kritik":36,"Bloke":27}'::jsonb),
(10,'Ayaz Ejderhası','Büyücü','{"Saldırı":10,"Sihir":464,"Savunma":155,"Sihir Savunma":155,"Can":532,"Kritik":40,"Bloke":30}'::jsonb),
(11,'Gölge Celladı','Savaşçı','{"Saldırı":557,"Sihir":10,"Savunma":183,"Sihir Savunma":183,"Can":628,"Kritik":44,"Bloke":33}'::jsonb),
(12,'Karanlık Büyücü','Büyücü','{"Saldırı":10,"Sihir":669,"Savunma":216,"Sihir Savunma":216,"Can":741,"Kritik":48,"Bloke":36}'::jsonb),
(13,'Uçurum Gözü','Büyücü','{"Saldırı":10,"Sihir":802,"Savunma":255,"Sihir Savunma":255,"Can":875,"Kritik":52,"Bloke":39}'::jsonb),
(14,'Kara Şövalye','Savaşçı','{"Saldırı":963,"Sihir":10,"Savunma":301,"Sihir Savunma":301,"Can":1032,"Kritik":56,"Bloke":42}'::jsonb),
(15,'Gölge Kralı','Büyücü','{"Saldırı":10,"Sihir":1156,"Savunma":355,"Sihir Savunma":355,"Can":1218,"Kritik":60,"Bloke":45}'::jsonb),
(16,'Kızıl Rahip','Büyücü','{"Saldırı":10,"Sihir":1387,"Savunma":419,"Sihir Savunma":419,"Can":1437,"Kritik":64,"Bloke":48}'::jsonb),
(17,'Kan Paladini','Savaşçı','{"Saldırı":1664,"Sihir":10,"Savunma":495,"Sihir Savunma":495,"Can":1695,"Kritik":68,"Bloke":51}'::jsonb),
(18,'Taş Kanat','Savaşçı','{"Saldırı":1997,"Sihir":10,"Savunma":584,"Sihir Savunma":584,"Can":2001,"Kritik":72,"Bloke":54}'::jsonb),
(19,'Lav Devi','Savaşçı','{"Saldırı":2396,"Sihir":10,"Savunma":689,"Sihir Savunma":689,"Can":2361,"Kritik":76,"Bloke":57}'::jsonb),
(20,'Kor Ejderhası','Büyücü','{"Saldırı":10,"Sihir":2875,"Savunma":813,"Sihir Savunma":813,"Can":2786,"Kritik":80,"Bloke":60}'::jsonb),
(21,'Kadim Otomat','Savaşçı','{"Saldırı":3450,"Sihir":10,"Savunma":959,"Sihir Savunma":959,"Can":3287,"Kritik":84,"Bloke":63}'::jsonb),
(22,'Dört Kollu Muhafız','Savaşçı','{"Saldırı":4140,"Sihir":10,"Savunma":1131,"Sihir Savunma":1131,"Can":3879,"Kritik":88,"Bloke":66}'::jsonb),
(23,'Yıldırım Devi','Savaşçı','{"Saldırı":4969,"Sihir":10,"Savunma":1335,"Sihir Savunma":1335,"Can":4577,"Kritik":92,"Bloke":69}'::jsonb),
(24,'Ölümsüz Kral','Büyücü','{"Saldırı":10,"Sihir":5962,"Savunma":1575,"Sihir Savunma":1575,"Can":5401,"Kritik":96,"Bloke":72}'::jsonb),
(25,'Gece Hükümdarı','Büyücü','{"Saldırı":10,"Sihir":7155,"Savunma":1859,"Sihir Savunma":1859,"Can":6373,"Kritik":100,"Bloke":75}'::jsonb),
(26,'Zümrüt Lich','Büyücü','{"Saldırı":10,"Sihir":8586,"Savunma":2193,"Sihir Savunma":2193,"Can":7520,"Kritik":104,"Bloke":78}'::jsonb),
(27,'Zincirli Şövalye','Savaşçı','{"Saldırı":10303,"Sihir":10,"Savunma":2588,"Sihir Savunma":2588,"Can":8874,"Kritik":108,"Bloke":81}'::jsonb),
(28,'Uçurum Prensi','Büyücü','{"Saldırı":10,"Sihir":12363,"Savunma":3054,"Sihir Savunma":3054,"Can":10471,"Kritik":112,"Bloke":84}'::jsonb),
(29,'Düşmüş Melek','Büyücü','{"Saldırı":10,"Sihir":14836,"Savunma":3604,"Sihir Savunma":3604,"Can":12356,"Kritik":116,"Bloke":87}'::jsonb),
(30,'Valor Hükümdarı','Büyücü','{"Saldırı":10,"Sihir":17803,"Savunma":4253,"Sihir Savunma":4253,"Can":14580,"Kritik":120,"Bloke":90}'::jsonb)
on conflict(floor) do update set name=excluded.name,cls=excluded.cls,stats=excluded.stats;
commit;
