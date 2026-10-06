update public.lagerkollen_state
set payload = jsonb_set(jsonb_set(jsonb_set(payload,'{schemaVersion}','4'::jsonb,true),'{groups}',coalesce(payload->'groups','[]'::jsonb),true),'{deletedOrders}',coalesce(payload->'deletedOrders','{}'::jsonb),true),
revision=revision+1,updated_at=now()
where coalesce((payload->>'schemaVersion')::integer,0)<4;

alter table public.lagerkollen_state drop constraint lagerkollen_payload_min_version;
alter table public.lagerkollen_state add constraint lagerkollen_payload_min_version
check (coalesce((payload->>'schemaVersion')::integer,0)>=4
and coalesce(jsonb_typeof(payload->'groups'),'')='array'
and coalesce(jsonb_typeof(payload->'deletedOrders'),'')='object');
