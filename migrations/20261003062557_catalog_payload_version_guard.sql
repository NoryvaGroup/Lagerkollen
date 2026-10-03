-- Apply after deploying the schemaVersion 3 client to the dedicated Lagerkollen project.
-- Old clients omit new catalog fields; reject those writes rather than losing names and quantities.
update public.lagerkollen_state
set payload = jsonb_set(payload, '{schemaVersion}', '3'::jsonb, true),
    revision = revision + 1,
    updated_at = now()
where coalesce((payload->>'schemaVersion')::integer, 0) < 3;

alter table public.lagerkollen_state
add constraint lagerkollen_payload_min_version
check (coalesce((payload->>'schemaVersion')::integer, 0) >= 3);
