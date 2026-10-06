update public.lagerkollen_state s
set payload=jsonb_set(jsonb_set(s.payload,'{schemaVersion}','6'::jsonb),'{orders}',
 coalesce((select jsonb_agg(o.value || jsonb_build_object('articles',
 coalesce((select jsonb_agg(case when a.value->>'statusVersion'='2' then a.value else
 a.value || jsonb_build_object('status','neutral','statusVersion',2,'previousStatus',
 coalesce(a.value->'previousStatus',jsonb_build_object('status',a.value->>'status','updated',coalesce(a.value->'updated','0'::jsonb)))) end order by a.ordinality)
 from jsonb_array_elements(coalesce(o.value->'articles','[]'::jsonb)) with ordinality a(value,ordinality)),'[]'::jsonb)) order by o.ordinality)
 from jsonb_array_elements(s.payload->'orders') with ordinality o(value,ordinality)),'[]'::jsonb)),
 revision=revision+1,updated_at=now()
where coalesce((s.payload->>'schemaVersion')::integer,0)<6;
alter table public.lagerkollen_state drop constraint lagerkollen_payload_min_version;
alter table public.lagerkollen_state add constraint lagerkollen_payload_min_version
check(coalesce((payload->>'schemaVersion')::integer,0)>=6
and coalesce(jsonb_typeof(payload->'sections'),'')='array'
and coalesce(jsonb_typeof(payload->'groups'),'')='array'
and coalesce(jsonb_typeof(payload->'deletedOrders'),'')='object');
