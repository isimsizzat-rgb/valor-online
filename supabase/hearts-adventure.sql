-- Valor Online: Kalp from Macera chests (run after hearts.sql). Each mysterious chest gives 1-3 Kalp,
-- rolled here so the device cannot pick the amount. No daily limit. request_id makes retries safe.
create or replace function public.heart_adventure_chest(request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); previous heart_operations%rowtype; got integer; b bigint; answer jsonb;
begin
 if me is null or request_id is null then raise exception 'Oturum gerekli'; end if;
 if not exists(select 1 from saves where user_id=me and class is not null) then raise exception 'Önce karakter oluştur'; end if;
 if public.is_banned(me) then raise exception 'Hesap engelli'; end if;
 perform pg_advisory_xact_lock(hashtext('heart_adventure:'||me::text));
 select * into previous from heart_operations o where o.sender=me and o.request_id=heart_adventure_chest.request_id;
 if found then
  if previous.kind<>'adventure' then raise exception 'İstek kimliği farklı bir işlemde kullanılmış'; end if;
  return previous.result;
 end if;
 got:=1+floor(random()*3)::integer;
 insert into heart_wallets(user_id,balance) values(me,got) on conflict(user_id) do update set balance=heart_wallets.balance+got returning balance into b;
 answer:=jsonb_build_object('hearts',got,'balance',b);
 insert into heart_operations(sender,request_id,kind,payload,result) values(me,request_id,'adventure','{}'::jsonb,answer);
 return answer;
end $$;
revoke all on function public.heart_adventure_chest(uuid) from public, anon;
grant execute on function public.heart_adventure_chest(uuid) to authenticated;
