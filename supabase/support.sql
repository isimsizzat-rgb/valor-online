-- Valor Online: private support tickets. Run after schema.sql and admin.sql.
begin;
create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 player_name text not null,
 subject text not null check (char_length(subject) between 3 and 100),
 category text not null check (category in ('bug','account','purchase','other')),
 status text not null default 'open' check (status in ('open','answered','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.support_messages (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 is_staff boolean not null default false,
 body text not null check (char_length(body) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index if not exists support_owner_updated_idx on public.support_tickets(user_id,updated_at desc);
create index if not exists support_status_updated_idx on public.support_tickets(status,updated_at desc);
create index if not exists support_messages_ticket_idx on public.support_messages(ticket_id,created_at,id);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets,public.support_messages from public,anon,authenticated;
grant select on public.support_tickets,public.support_messages to authenticated;
drop policy if exists support_tickets_read on public.support_tickets;
create policy support_tickets_read on public.support_tickets for select to authenticated
 using (user_id=(select auth.uid()) or (select public.is_admin()));
drop policy if exists support_messages_read on public.support_messages;
create policy support_messages_read on public.support_messages for select to authenticated
 using (exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.user_id=(select auth.uid()) or (select public.is_admin()))));

create or replace function public.support_list(admin_view boolean default false,filter_status text default 'all')
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'support_login_required'; end if;
 if admin_view and not public.is_admin() then raise exception 'support_forbidden'; end if;
 if filter_status not in ('all','open','answered','closed') then raise exception 'support_invalid'; end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.updated_at desc,q.id) from (
  select t.* from public.support_tickets t where (admin_view or t.user_id=auth.uid()) and (filter_status='all' or t.status=filter_status)
  order by t.updated_at desc,t.id limit 100
 ) q),'[]'::jsonb);
end; $$;

create or replace function public.support_thread(ticket uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t public.support_tickets;
begin
 if auth.uid() is null then raise exception 'support_login_required'; end if;
 select * into t from public.support_tickets where id=ticket;
 if not found or (t.user_id<>auth.uid() and not public.is_admin()) then raise exception 'support_forbidden'; end if;
 return jsonb_build_object('ticket',to_jsonb(t),'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id) from public.support_messages m where m.ticket_id=ticket),'[]'::jsonb));
end; $$;

create or replace function public.support_create(request_id uuid,topic text,category text,body text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); n text; t public.support_tickets; title text:=btrim(coalesce(topic,'')); message text:=btrim(coalesce(body,''));
begin
 if uid is null then raise exception 'support_login_required'; end if;
 if request_id is null or char_length(title) not between 3 and 100 or char_length(message) not between 10 and 4000 or category is null or category not in ('bug','account','purchase','other') then raise exception 'support_invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended('support:'||uid::text,0));
 select * into t from public.support_tickets where id=request_id;
 if found then if t.user_id<>uid then raise exception 'support_forbidden'; end if; return to_jsonb(t); end if;
 select s.name into n from public.saves s where s.user_id=uid and coalesce(s.name,'')<>'';
 if n is null then raise exception 'support_character_required'; end if;
 if (select count(*) from public.support_tickets where user_id=uid and status<>'closed')>=5 then raise exception 'support_open_limit'; end if;
 if exists(select 1 from public.support_tickets where user_id=uid and created_at>now()-interval '60 seconds') then raise exception 'support_rate_limit'; end if;
 if (select count(*) from public.support_tickets where user_id=uid and created_at>now()-interval '24 hours')>=10 then raise exception 'support_daily_limit'; end if;
 insert into public.support_tickets(id,user_id,player_name,subject,category) values(request_id,uid,n,title,category) returning * into t;
 insert into public.support_messages(ticket_id,author_id,is_staff,body) values(t.id,uid,false,message);
 return to_jsonb(t);
end; $$;

create or replace function public.support_reply(request_id uuid,ticket uuid,body text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); t public.support_tickets; existing public.support_messages; staff boolean; message text:=btrim(coalesce(body,''));
begin
 if uid is null then raise exception 'support_login_required'; end if;
 if request_id is null or char_length(message) not between 1 and 4000 then raise exception 'support_invalid'; end if;
 staff:=public.is_admin();
 perform pg_advisory_xact_lock(hashtextextended('support:'||uid::text,0));
 select * into t from public.support_tickets where id=ticket for update;
 if not found or (t.user_id<>uid and not staff) then raise exception 'support_forbidden'; end if;
 select * into existing from public.support_messages where id=request_id;
 if found then if existing.ticket_id<>ticket or existing.author_id<>uid then raise exception 'support_forbidden'; end if; return to_jsonb(existing); end if;
 if t.status='closed' then raise exception 'support_closed'; end if;
 if (select count(*) from public.support_messages where ticket_id=ticket)>=100 then raise exception 'support_thread_limit'; end if;
 if exists(select 1 from public.support_messages where author_id=uid and created_at>now()-interval '10 seconds') then raise exception 'support_rate_limit'; end if;
 insert into public.support_messages(id,ticket_id,author_id,is_staff,body) values(request_id,ticket,uid,staff,message) returning * into existing;
 update public.support_tickets set status=case when staff then 'answered' else 'open' end,updated_at=now() where id=ticket;
 return to_jsonb(existing);
end; $$;

create or replace function public.support_set_status(ticket uuid,new_status text)
returns text language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'support_forbidden'; end if;
 if new_status is null or new_status not in ('open','answered','closed') then raise exception 'support_invalid'; end if;
 perform 1 from public.support_tickets where id=ticket for update;
 if not found then raise exception 'support_not_found'; end if;
 update public.support_tickets set status=new_status,updated_at=now() where id=ticket;
 return 'ok';
end; $$;
revoke all on function public.support_list(boolean,text),public.support_thread(uuid),public.support_create(uuid,text,text,text),public.support_reply(uuid,uuid,text),public.support_set_status(uuid,text) from public,anon;
grant execute on function public.support_list(boolean,text),public.support_thread(uuid),public.support_create(uuid,text,text,text),public.support_reply(uuid,uuid,text),public.support_set_status(uuid,text) to authenticated;
commit;
