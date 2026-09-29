-- Apply only to a dedicated Lagerkollen Supabase project.
create table if not exists public.lagerkollen_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint payload_size check (octet_length(payload::text) <= 5000000)
);
alter table public.lagerkollen_state enable row level security;
revoke all on public.lagerkollen_state from anon;
grant select, insert, update on public.lagerkollen_state to authenticated;
create policy "Read own Lagerkollen data" on public.lagerkollen_state for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Insert own Lagerkollen data" on public.lagerkollen_state for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update own Lagerkollen data" on public.lagerkollen_state for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
