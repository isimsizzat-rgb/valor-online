-- Valor Zindanı. Apply after schema.sql, arena.sql, chat.sql, guard3.sql and profiles.sql.
-- All room membership, turns, skills and chest balances are server-authoritative. Safe to re-run.
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
-- Turn-based rooms: when the current turn started (7-second auto attack) and how many rounds the archer's damage boost has left.
alter table public.valor_dungeon_runs add column if not exists turn_at timestamptz;
alter table public.valor_dungeon_runs add column if not exists boost integer not null default 0;
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


-- ---- Turn-based battle rules (mirror of assets/valor-dungeon/core.js) ----
create or replace function public.vzd_now_ms() returns bigint language sql stable set search_path=public as $$ select (extract(epoch from now())*1000)::bigint $$;
-- Boss HP scales with party size (1, 2 or 3 players).
create or replace function public.vzd_party_boss(f integer, n integer) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare b jsonb:=vzd_boss(f); k numeric:=case when n>=3 then 3 when n=2 then 2 else 1 end; m numeric;
begin m:=round((b->>'maxHp')::numeric*k); return b||jsonb_build_object('maxHp',m,'hp',m); end; $$;
create or replace function public.vzd_raw(a jsonb,b jsonb,mult numeric) returns jsonb language plpgsql volatile set search_path=public as $$
declare atk numeric:=greatest(1,(a->>'attack')::numeric); def numeric:=greatest(0,coalesce((b->'stats'->>(case when a->>'cls'='Büyücü' then 'Sihir Savunma' else 'Savunma' end))::numeric,0));
 c numeric:=greatest(0,coalesce((a->'stats'->>'Kritik')::numeric,0)); bl numeric:=greatest(0,coalesce((b->'stats'->>'Bloke')::numeric,0)); crit boolean; blocked boolean;
begin
 crit:=random()<least(.75,c/(c+1000)); blocked:=random()<least(.75,bl/(bl+1000));
 return jsonb_build_object('damage',greatest(1,round(atk*atk/(atk+def)*mult*(1+case when crit then .25 else 0 end-case when blocked then .25 else 0 end))),'critical',crit,'blocked',blocked);
end; $$;
create or replace function public.vzd_logged(l jsonb, e jsonb) returns jsonb language sql immutable set search_path=public as $$
 select coalesce(jsonb_agg(value order by ord),'[]') from (select value,ord from jsonb_array_elements(coalesce(l,'[]')||jsonb_build_array(e)) with ordinality x(value,ord) order by ord desc limit 6) q $$;
create or replace function public.vzd_first_alive(m jsonb) returns integer language plpgsql immutable set search_path=public as $$
declare i integer:=0; begin while i<jsonb_array_length(m) and (m->i->>'hp')::numeric<=0 loop i:=i+1; end loop; return i; end; $$;
-- Damage to a member: shield absorbs first. Returns the member and how much the shield took.
create or replace function public.vzd_wound(p jsonb, dmg numeric) returns jsonb language plpgsql immutable set search_path=public as $$
declare sh numeric:=coalesce((p->>'shield')::numeric,0); ab numeric:=least(sh,dmg);
begin return jsonb_build_object('p',p||jsonb_build_object('shield',sh-ab,'hp',greatest(0,(p->>'hp')::numeric-(dmg-ab))),'absorbed',ab); end; $$;
create or replace function public.vzd_boss_turn(r public.valor_dungeon_runs) returns public.valor_dungeon_runs language plpgsql volatile security definer set search_path=public as $$
declare n integer:=jsonb_array_length(r.members); i integer; k integer; t integer; live integer[]; h jsonb; w jsonb;
begin
 if r.round%3=0 then
  -- Every third round the boss hits the whole team at 150%.
  for i in 0..n-1 loop if (r.members->i->>'hp')::numeric>0 then
   h:=vzd_raw(r.boss,r.members->i,1.5);w:=vzd_wound(r.members->i,(h->>'damage')::numeric);r.members:=jsonb_set(r.members,array[i::text],w->'p');
  end if; end loop;
  r.log:=vzd_logged(r.log,jsonb_build_object('kind','aoe','name',r.boss->>'name'));
 else
  -- Otherwise one strike per living member, each at a random living target.
  for k in 1..(select count(*) from jsonb_array_elements(r.members) e where (e->>'hp')::numeric>0) loop
   select array_agg(x.i-1) into live from jsonb_array_elements(r.members) with ordinality x(e,i) where (x.e->>'hp')::numeric>0;
   exit when live is null;
   t:=live[1+floor(random()*array_length(live,1))::integer];
   h:=vzd_raw(r.boss,r.members->t,1);w:=vzd_wound(r.members->t,(h->>'damage')::numeric);r.members:=jsonb_set(r.members,array[t::text],w->'p');
   r.log:=vzd_logged(r.log,h||jsonb_build_object('kind','hit','name',r.boss->>'name','target',r.members->t->>'name','absorbed',w->'absorbed'));
  end loop;
 end if;
 -- The archer's boost lasts 3 rounds (counted down at the end of each round).
 if r.boost>0 then r.boost:=r.boost-1; end if;
 r.round:=r.round+1;r.turn:=vzd_first_alive(r.members);
 if r.turn>=n then r.status:='lost'; end if;
 return r;
end; $$;
create or replace function public.vzd_attack(r public.valor_dungeon_runs, auto boolean) returns public.valor_dungeon_runs language plpgsql volatile security definer set search_path=public as $$
declare n integer:=jsonb_array_length(r.members); p jsonb:=r.members->r.turn; h jsonb; i integer;
begin
 if r.status<>'battle' or p is null or (p->>'hp')::numeric<=0 then return r; end if;
 h:=vzd_raw(p,r.boss,case when r.boost>0 then 1.25 else 1 end);
 r.boss:=jsonb_set(r.boss,'{hp}',to_jsonb(greatest(0,(r.boss->>'hp')::numeric-(h->>'damage')::numeric)));
 r.members:=jsonb_set(r.members,array[r.turn::text,'skillUsedTurn'],'false');
 r.log:=vzd_logged(r.log,h||jsonb_build_object('kind','hit','name',p->>'name','target',r.boss->>'name','auto',auto));
 if (r.boss->>'hp')::numeric<=0 then
  r.cleared:=r.floor;r.last:=jsonb_build_object('floor',r.floor,'name',r.boss->>'name','won',true,'rounds',r.round);
  if r.floor>=30 then r.status:='complete';
  else
   r.floor:=r.floor+1;r.boss:=vzd_party_boss(r.floor,n);r.boost:=0;r.round:=1;r.turn:=vzd_first_alive(r.members);r.turn_at:=now();
   r.log:=vzd_logged(r.log,jsonb_build_object('kind','floor','floor',r.floor-1));
  end if;
  r.version:=r.version+1;return r;
 end if;
 i:=r.turn+1;while i<n and (r.members->i->>'hp')::numeric<=0 loop i:=i+1;end loop;r.turn:=i;
 if i>=n then r:=vzd_boss_turn(r); end if;
 r.turn_at:=now();r.version:=r.version+1;
 return r;
end; $$;

-- The only public entrypoint. Optimistic version checks reject double taps and stale turns.
create or replace function public.valor_dungeon_action(op text, rid uuid default null, expected_version integer default null, quantity integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); r valor_dungeon_runs%rowtype; room_id uuid; p jsonb; members jsonb; h jsonb;
 i integer; j integer; k integer; n integer; alive integer; target integer; new_id uuid; bal integer:=0; hp0 numeric; hp1 numeric; dealt numeric; fought integer; bname text; qty integer; revn integer; inv jsonb; d jsonb; st jsonb; response text:='ok'; x numeric; w_luck integer; w_dia integer; w_food integer; w_epic integer; w_energy integer; w_paper integer;
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
  -- One prize per chest, rarer the more valuable (must match CHEST in core.js):
  -- Sv.1 Şans Taşı 42%, 25 Elmas 17%, Pet Yemi 17%, Epik Taşı 11%, Enerji Şişesi 9%, Sefer Kağıdı 4%.
  w_luck:=0;w_dia:=0;w_food:=0;w_epic:=0;w_energy:=0;w_paper:=0;
  for k in 1..qty loop x:=random()*100;
   if x<42 then w_luck:=w_luck+1; elsif x<59 then w_dia:=w_dia+25; elsif x<76 then w_food:=w_food+1;
   elsif x<87 then w_epic:=w_epic+1; elsif x<96 then w_energy:=w_energy+1; else w_paper:=w_paper+1; end if;
  end loop;
  st:=d->'state';inv:=coalesce(st->'inventory','[]');
  if w_energy>0 then inv:=vzd_stack(inv,'energyBottle','Enerji Şişesi',w_energy); end if;
  if w_paper>0 then inv:=vzd_stack(inv,'expeditionPaper','Sefer Kağıdı',w_paper); end if;
  if w_food>0 then inv:=vzd_stack(inv,'petFood','Pet Yemi',w_food); end if;
  st:=st||jsonb_build_object('inventory',inv,'diamonds',coalesce((st->>'diamonds')::numeric,0)+w_dia,
   'shards',coalesce((st->>'shards')::numeric,0)+w_epic,
   'stones',coalesce(st->'stones','{}')||jsonb_build_object('1',coalesce((st->'stones'->>'1')::integer,0)+w_luck));
  perform set_config('valor.server_write','1',true);
  update saves set data=jsonb_set(d,'{state}',st),rev=rev+1,updated_at=now() where user_id=me returning rev into revn;
  update valor_dungeon_wallets set balance=balance-qty where user_id=me returning balance into bal;
  return jsonb_build_object('status','ok','opened',qty,'balance',bal,'rev',revn,
   'won',jsonb_build_object('luck',w_luck,'diamonds',w_dia,'petFood',w_food,'epic',w_epic,'energyBottle',w_energy,'expeditionPaper',w_paper));
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
 if op not in ('state','create','join','leave','invite','tick') and (expected_version is null or expected_version<>r.version) then response:='stale';
 elsif op='start' then
  if r.leader<>me then response:='not_leader';
  elsif r.status<>'waiting' then response:='invalid';
  else
   members:='[]';for p in select value from jsonb_array_elements(r.members) loop members:=members||jsonb_build_array(vzd_player((p->>'uid')::uuid));end loop;
   r.members:=members;r.status:='battle';r.round:=1;r.turn:=0;r.boost:=0;r.log:='[]';r.turn_at:=now();
   r.boss:=vzd_party_boss(r.floor,jsonb_array_length(r.members));r.version:=r.version+1;
  end if;
 elsif op='attack' then
  if r.status<>'battle' then response:='invalid';
  elsif r.members->r.turn->>'uid'<>me::text then response:='not_turn';
  else r:=vzd_attack(r,false);
  end if;
 elsif op='skill' then
  -- Free action on your own turn, once per minute: shield (Savaşçı), heal (Büyücü) or team damage boost (Okçu).
  if r.status<>'battle' then response:='invalid';
  elsif r.members->r.turn->>'uid'<>me::text then response:='not_turn';
  elsif coalesce((r.members->r.turn->>'cdUntil')::bigint,0)>vzd_now_ms() or coalesce((r.members->r.turn->>'skillUsedTurn')::boolean,false) then response:='cooldown';
  else
   p:=r.members->r.turn;n:=jsonb_array_length(r.members);
   for i in 0..n-1 loop if (r.members->i->>'hp')::numeric>0 then
    if p->>'cls'='Büyücü' then
     r.members:=jsonb_set(r.members,array[i::text,'hp'],to_jsonb(least((r.members->i->>'maxHp')::numeric,(r.members->i->>'hp')::numeric+round((r.members->i->>'maxHp')::numeric*.25))));
    elsif p->>'cls'<>'Okçu' then
     r.members:=jsonb_set(r.members,array[i::text,'shield'],to_jsonb(greatest(coalesce((r.members->i->>'shield')::numeric,0),round((r.members->i->>'maxHp')::numeric*.25))));
    end if;
   end if; end loop;
   if p->>'cls'='Okçu' then r.boost:=3; end if;
   r.members:=jsonb_set(r.members,array[r.turn::text,'cdUntil'],to_jsonb(vzd_now_ms()+60000));
   r.members:=jsonb_set(r.members,array[r.turn::text,'skillUsedTurn'],'true');
   r.log:=vzd_logged(r.log,jsonb_build_object('kind','skill','name',p->>'name','skill',case p->>'cls' when 'Büyücü' then 'Şifa Dalgası' when 'Okçu' then 'Av Ruhu' else 'Kalkan Duvarı' end));
   r.version:=r.version+1;
  end if;
 elsif op='tick' then
  -- Anyone in the room may ask; the server attacks for the idle player only after 7 seconds.
  if r.status<>'battle' or r.turn_at is null or now()-r.turn_at<interval '7 seconds' then response:='wait';
  else r:=vzd_attack(r,true);
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
    r.turn_at:=now();
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
  update valor_dungeon_runs set leader=r.leader,status=r.status,floor=r.floor,cleared=r.cleared,members=r.members,boss=r.boss,
   turn=r.turn,round=r.round,version=r.version,log=r.log,last=r.last,turn_at=r.turn_at,boost=r.boost,invite_at=r.invite_at,updated_at=now() where id=r.id;
  perform vzd_settle(r.id);
 end if;
 select * into r from valor_dungeon_runs where id=room_id;
 select balance into bal from valor_dungeon_wallets where user_id=me;
 return jsonb_build_object('status',response,'balance',coalesce(bal,0),'now',vzd_now_ms(),'room',case when op='leave' and response='ok' then null else (to_jsonb(r)-'invite_at'-'turn_at')||jsonb_build_object('turnAt',(extract(epoch from r.turn_at)*1000)::bigint) end);
end; $$;

revoke all on function public.vzd_unit(jsonb), public.vzd_player(uuid), public.vzd_boss(integer), public.vzd_hit(jsonb,jsonb), public.vzd_settle(uuid), public.vzd_stack(jsonb,text,text,integer) from public,anon,authenticated;
revoke all on function public.vzd_party_boss(integer,integer), public.vzd_raw(jsonb,jsonb,numeric), public.vzd_boss_turn(public.valor_dungeon_runs), public.vzd_attack(public.valor_dungeon_runs,boolean) from public,anon,authenticated;
revoke all on function public.valor_dungeon_action(text,uuid,integer,integer) from public,anon;
grant execute on function public.valor_dungeon_action(text,uuid,integer,integer) to authenticated;
-- Calibrated with tools/valor-dungeon/balance.cjs (must match BOSS_STATS in core.js).
insert into public.valor_dungeon_bosses(floor,name,cls,stats) values
(1,'Paslı Nöbetçi','Savaşçı','{"Saldırı":1224,"Sihir":10,"Savunma":1128,"Sihir Savunma":1128,"Can":9417,"Kritik":455,"Bloke":456}'::jsonb),
(2,'Lağım Kralı','Savaşçı','{"Saldırı":1818,"Sihir":10,"Savunma":1223,"Sihir Savunma":1223,"Can":14227,"Kritik":468,"Bloke":470}'::jsonb),
(3,'Mağara Trolü','Savaşçı','{"Saldırı":2504,"Sihir":10,"Savunma":1327,"Sihir Savunma":1327,"Can":19916,"Kritik":481,"Bloke":484}'::jsonb),
(4,'Zümrüt Örümcek','Savaşçı','{"Saldırı":3291,"Sihir":10,"Savunma":1440,"Sihir Savunma":1440,"Can":26613,"Kritik":494,"Bloke":498}'::jsonb),
(5,'Demir Gardiyan','Savaşçı','{"Saldırı":4193,"Sihir":10,"Savunma":1562,"Sihir Savunma":1562,"Can":34466,"Kritik":508,"Bloke":513}'::jsonb),
(6,'Ayaz Hayaleti','Büyücü','{"Saldırı":10,"Sihir":5222,"Savunma":1694,"Sihir Savunma":1694,"Can":43638,"Kritik":522,"Bloke":528}'::jsonb),
(7,'Buz Şövalyesi','Savaşçı','{"Saldırı":5658,"Sihir":10,"Savunma":1838,"Sihir Savunma":1838,"Can":48070,"Kritik":536,"Bloke":544}'::jsonb),
(8,'Ak Kurt','Savaşçı','{"Saldırı":6131,"Sihir":10,"Savunma":1994,"Sihir Savunma":1994,"Can":52951,"Kritik":551,"Bloke":560}'::jsonb),
(9,'Kristal Dev','Büyücü','{"Saldırı":10,"Sihir":6992,"Savunma":2266,"Sihir Savunma":2266,"Can":57227,"Kritik":564,"Bloke":599}'::jsonb),
(10,'Ayaz Ejderhası','Büyücü','{"Saldırı":10,"Sihir":7973,"Savunma":2576,"Sihir Savunma":2576,"Can":61848,"Kritik":578,"Bloke":640}'::jsonb),
(11,'Gölge Celladı','Savaşçı','{"Saldırı":9093,"Sihir":10,"Savunma":2929,"Sihir Savunma":2929,"Can":66842,"Kritik":592,"Bloke":684}'::jsonb),
(12,'Karanlık Büyücü','Büyücü','{"Saldırı":10,"Sihir":10369,"Savunma":3329,"Sihir Savunma":3329,"Can":72240,"Kritik":606,"Bloke":731}'::jsonb),
(13,'Uçurum Gözü','Büyücü','{"Saldırı":10,"Sihir":11825,"Savunma":3784,"Sihir Savunma":3784,"Can":78074,"Kritik":621,"Bloke":782}'::jsonb),
(14,'Kara Şövalye','Savaşçı','{"Saldırı":13485,"Sihir":10,"Savunma":4302,"Sihir Savunma":4302,"Can":84378,"Kritik":636,"Bloke":835}'::jsonb),
(15,'Gölge Kralı','Büyücü','{"Saldırı":10,"Sihir":15378,"Savunma":4890,"Sihir Savunma":4890,"Can":91192,"Kritik":651,"Bloke":893}'::jsonb),
(16,'Kızıl Rahip','Büyücü','{"Saldırı":10,"Sihir":16655,"Savunma":5295,"Sihir Savunma":5295,"Can":97140,"Kritik":664,"Bloke":939}'::jsonb),
(17,'Kan Paladini','Savaşçı','{"Saldırı":18038,"Sihir":10,"Savunma":5734,"Sihir Savunma":5734,"Can":103475,"Kritik":678,"Bloke":986}'::jsonb),
(18,'Taş Kanat','Savaşçı','{"Saldırı":19535,"Sihir":10,"Savunma":6210,"Sihir Savunma":6210,"Can":110224,"Kritik":692,"Bloke":1037}'::jsonb),
(19,'Lav Devi','Savaşçı','{"Saldırı":21157,"Sihir":10,"Savunma":6725,"Sihir Savunma":6725,"Can":117413,"Kritik":706,"Bloke":1090}'::jsonb),
(20,'Kor Ejderhası','Büyücü','{"Saldırı":10,"Sihir":22914,"Savunma":7282,"Sihir Savunma":7282,"Can":125071,"Kritik":721,"Bloke":1145}'::jsonb),
(21,'Kadim Otomat','Savaşçı','{"Saldırı":24816,"Sihir":10,"Savunma":7886,"Sihir Savunma":7886,"Can":133228,"Kritik":736,"Bloke":1204}'::jsonb),
(22,'Dört Kollu Muhafız','Savaşçı','{"Saldırı":26877,"Sihir":10,"Savunma":8540,"Sihir Savunma":8540,"Can":141917,"Kritik":751,"Bloke":1265}'::jsonb),
(23,'Yıldırım Devi','Savaşçı','{"Saldırı":32212,"Sihir":10,"Savunma":10188,"Sihir Savunma":10188,"Can":152372,"Kritik":763,"Bloke":1476}'::jsonb),
(24,'Ölümsüz Kral','Büyücü','{"Saldırı":10,"Sihir":38606,"Savunma":12155,"Sihir Savunma":12155,"Can":163597,"Kritik":775,"Bloke":1722}'::jsonb),
(25,'Gece Hükümdarı','Büyücü','{"Saldırı":10,"Sihir":46270,"Savunma":14501,"Sihir Savunma":14501,"Can":175648,"Kritik":787,"Bloke":2009}'::jsonb),
(26,'Zümrüt Lich','Büyücü','{"Saldırı":10,"Sihir":55455,"Savunma":17299,"Sihir Savunma":17299,"Can":188588,"Kritik":799,"Bloke":2344}'::jsonb),
(27,'Zincirli Şövalye','Savaşçı','{"Saldırı":66463,"Sihir":10,"Savunma":20638,"Sihir Savunma":20638,"Can":202481,"Kritik":812,"Bloke":2735}'::jsonb),
(28,'Uçurum Prensi','Büyücü','{"Saldırı":10,"Sihir":79656,"Savunma":24622,"Sihir Savunma":24622,"Can":217397,"Kritik":825,"Bloke":3192}'::jsonb),
(29,'Düşmüş Melek','Büyücü','{"Saldırı":10,"Sihir":95469,"Savunma":29374,"Sihir Savunma":29374,"Can":233412,"Kritik":838,"Bloke":3724}'::jsonb),
(30,'Valor Hükümdarı','Büyücü','{"Saldırı":10,"Sihir":114420,"Savunma":35043,"Sihir Savunma":35043,"Can":250607,"Kritik":851,"Bloke":4345}'::jsonb)
on conflict(floor) do update set name=excluded.name,cls=excluded.cls,stats=excluded.stats;
commit;
