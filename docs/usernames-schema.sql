begin;
create table public.lagerkollen_usernames (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-zåäö0-9][a-zåäö0-9._-]{2,31}$'),
 updated_at timestamptz not null default now()
);
alter table public.lagerkollen_usernames enable row level security;
revoke all on public.lagerkollen_usernames from anon,authenticated;
grant select,insert,update on public.lagerkollen_usernames to authenticated;
grant all on public.lagerkollen_usernames to service_role;
create policy username_read_own on public.lagerkollen_usernames for select to authenticated using ((select auth.uid())=user_id);
create policy username_create_own on public.lagerkollen_usernames for insert to authenticated with check ((select auth.uid())=user_id);
create policy username_update_own on public.lagerkollen_usernames for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create table public.lagerkollen_login_attempts (
 key text primary key check(key ~ '^[0-9a-f]{64}$'),
 window_start timestamptz not null default now(),
 attempts integer not null default 1 check(attempts>0)
);
create index lagerkollen_login_attempts_window_idx on public.lagerkollen_login_attempts(window_start);
alter table public.lagerkollen_login_attempts enable row level security;
revoke all on public.lagerkollen_login_attempts from public,anon,authenticated;
grant all on public.lagerkollen_login_attempts to service_role;
create policy login_attempts_server_only on public.lagerkollen_login_attempts for all to service_role using(true) with check(true);
create function public.consume_username_login(p_key text) returns boolean language plpgsql security invoker set search_path='' as $fn$
declare allowed boolean;
begin
 delete from public.lagerkollen_login_attempts where window_start<now()-interval '1 day';
 insert into public.lagerkollen_login_attempts as t (key,window_start,attempts) values(p_key,now(),1)
 on conflict(key) do update set
 attempts=case when t.window_start<now()-interval '10 minutes' then 1 else t.attempts+1 end,
 window_start=case when t.window_start<now()-interval '10 minutes' then now() else t.window_start end
 returning attempts<=20 into allowed;
 return allowed;
end;$fn$;
revoke all on function public.consume_username_login(text) from public,anon,authenticated;
grant execute on function public.consume_username_login(text) to service_role;
insert into public.lagerkollen_usernames(user_id,username) values('f19d6523-e574-4526-97e7-b6fad341a75c','affe');
commit;
