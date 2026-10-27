-- Run after titles.sql. Wallets and popularity are authoritative server values.
begin;
create table if not exists public.heart_wallets (
 user_id uuid primary key references public.saves(user_id) on delete cascade,
 balance bigint not null default 0 check(balance >= 0)
);
create table if not exists public.heart_operations (
 sender uuid not null references public.saves(user_id) on delete cascade,
 request_id uuid not null,
 kind text not null,
 payload jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(sender,request_id)
);
alter table public.heart_wallets enable row level security;
alter table public.heart_operations enable row level security;
revoke all on public.heart_wallets,public.heart_operations from public,anon,authenticated;
-- Ordinary save uploads cannot create popularity, including trusted/test accounts.
create or replace function public.heart_protect_popularity() returns trigger
language plpgsql set search_path=public as $$
begin
 if auth.uid() is not null and coalesce(current_setting('valor.server_write',true),'') <> '1' then
  if tg_op='INSERT' then new.popularity:=0; else new.popularity:=old.popularity; end if;
 end if;
 return new;
end $$;
drop trigger if exists heart_protect_popularity on public.saves;
create trigger heart_protect_popularity before insert or update on public.saves for each row execute function public.heart_protect_popularity();

create or replace function public.heart_balance() returns bigint
language sql stable security definer set search_path=public as $$
 select coalesce((select balance from heart_wallets where user_id=auth.uid()),0);
$$;
create or replace function public.heart_buy(pack integer, expected_rev integer, request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); s saves%rowtype; cost integer; b bigint; previous heart_operations%rowtype; answer jsonb; args jsonb:=jsonb_build_object('pack',pack);
begin
 if me is null or request_id is null then raise exception 'Oturum gerekli'; end if;
 if pack=99 then cost:=49; elsif pack=999 then cost:=499; elsif pack=9999 then cost:=4999; else raise exception 'Geçersiz paket'; end if;
 select * into s from saves where user_id=me for update;
 if not found or s.class is null then raise exception 'Önce karakter oluştur'; end if;
 if public.is_banned(me) then raise exception 'Hesap engelli'; end if;
 select * into previous from heart_operations o where o.sender=me and o.request_id=heart_buy.request_id;
 if found then
  if previous.kind<>'buy' or previous.payload<>args then raise exception 'İstek kimliği farklı bir işlemde kullanılmış'; end if;
  return previous.result;
 end if;
 if s.rev<>expected_rev then raise exception 'Kayıt değişti. Güncel kaydı yükle'; end if;
 if coalesce((s.data->'state'->>'diamonds')::bigint,0)<cost then raise exception 'Yeterli elmasın yok'; end if;
 perform set_config('valor.server_write','1',true);
 update saves set data=jsonb_set(data,'{state,diamonds}',to_jsonb((s.data->'state'->>'diamonds')::bigint-cost)),rev=rev+1,updated_at=now() where user_id=me;
 insert into heart_wallets(user_id,balance) values(me,pack) on conflict(user_id) do update set balance=heart_wallets.balance+pack returning balance into b;
 answer:=jsonb_build_object('balance',b,'diamonds',(s.data->'state'->>'diamonds')::bigint-cost,'rev',s.rev+1);
 insert into heart_operations(sender,request_id,kind,payload,result) values(me,request_id,'buy',args,answer);
 return answer;
end $$;
create or replace function public.heart_send(recipient_name text, amount integer, request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); target uuid; target_name text; b bigint; score bigint; previous heart_operations%rowtype; answer jsonb;
 args jsonb:=jsonb_build_object('name',lower(btrim(recipient_name)),'amount',amount);
begin
 if me is null or request_id is null then raise exception 'Oturum gerekli'; end if;
 if amount is null or amount<1 or amount>1000000 then raise exception '1–1.000.000 arasında kalp seç'; end if;
 if public.is_banned(me) then raise exception 'Hesap engelli'; end if;
 -- Serializes duplicate and concurrent requests from one sender before any recipient write.
 perform pg_advisory_xact_lock(hashtextextended(me::text,713));
 select * into previous from heart_operations o where o.sender=me and o.request_id=heart_send.request_id;
 if found then
  if previous.kind<>'send' or previous.payload<>args then raise exception 'İstek kimliği farklı bir işlemde kullanılmış'; end if;
  return previous.result;
 end if;
 select user_id,name into target,target_name from saves where lower(name)=lower(btrim(recipient_name)) and class is not null and not hidden;
 if target is null then raise exception 'Oyuncu bulunamadı'; end if;
 if target=me then raise exception 'Kendine kalp gönderemezsin'; end if;
 update heart_wallets set balance=balance-amount where user_id=me and balance>=amount returning balance into b;
 if not found then raise exception 'Yeterli kalbin yok'; end if;
 perform set_config('valor.server_write','1',true);
 update saves set popularity=popularity+amount where user_id=target returning popularity into score;
 answer:=jsonb_build_object('balance',b,'recipient',target_name,'popularity',score,'amount',amount);
 insert into heart_operations(sender,request_id,kind,payload,result) values(me,request_id,'send',args,answer);
 return answer;
end $$;
revoke all on function public.heart_balance(),public.heart_buy(integer,integer,uuid),public.heart_send(text,integer,uuid) from public,anon;
grant execute on function public.heart_balance(),public.heart_buy(integer,integer,uuid),public.heart_send(text,integer,uuid) to authenticated;
commit;
