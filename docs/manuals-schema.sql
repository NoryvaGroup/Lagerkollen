begin;
create table public.lagerkollen_manuals (
 id text primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 160),
 description text not null default '',
 storage_path text not null unique,
 file_name text not null,
 page_count integer not null check(page_count>0),
 file_bytes bigint not null check(file_bytes>0),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now()
);
create index lagerkollen_manuals_owner_title_idx on public.lagerkollen_manuals(owner_id,title);
alter table public.lagerkollen_manuals enable row level security;
revoke all on public.lagerkollen_manuals from anon,authenticated;
grant select on public.lagerkollen_manuals to authenticated;
grant all on public.lagerkollen_manuals to service_role;
create policy manuals_read_own on public.lagerkollen_manuals for select to authenticated using ((select auth.uid())=owner_id);
create policy manuals_files_read_own on storage.objects for select to authenticated using (
 bucket_id='lagerkollen-manuals' and exists (
 select 1 from public.lagerkollen_manuals m where m.owner_id=(select auth.uid()) and m.storage_path=name
 ));
commit;
