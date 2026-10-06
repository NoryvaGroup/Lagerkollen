update public.lagerkollen_state
set payload=jsonb_set(jsonb_set(payload,'{schemaVersion}','5'::jsonb,true),'{sections}',coalesce(payload->'sections','[{"name":"H1","updated":0,"deleted":false,"replacement":""},{"name":"H2","updated":0,"deleted":false,"replacement":""},{"name":"H3","updated":0,"deleted":false,"replacement":""},{"name":"Elförmontage","updated":0,"deleted":false,"replacement":""}]'::jsonb),true),
revision=revision+1,updated_at=now()
where coalesce((payload->>'schemaVersion')::integer,0)<5;
alter table public.lagerkollen_state drop constraint lagerkollen_payload_min_version;
alter table public.lagerkollen_state add constraint lagerkollen_payload_min_version
check(coalesce((payload->>'schemaVersion')::integer,0)>=5
and coalesce(jsonb_typeof(payload->'sections'),'')='array'
and coalesce(jsonb_typeof(payload->'groups'),'')='array'
and coalesce(jsonb_typeof(payload->'deletedOrders'),'')='object');
