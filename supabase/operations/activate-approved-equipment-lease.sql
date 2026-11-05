-- Run after deploying the compatible app. Identical inactive copies are retained.
-- Existing Agreement snapshots, hashes, and acceptance records are untouched.
begin;
lock table public.agreement_clauses in share row exclusive mode;
do $$
declare
  selected_clause uuid;
begin
  if not exists (select 1 from public.agreement_clauses
    where clause_key='ucr-approved-equipment-lease-20261014') then
    raise exception 'Prepared approved terms are missing; activation aborted.';
  end if;
  if exists (select 1 from public.agreement_clauses
    where clause_key='ucr-approved-equipment-lease-20261014'
      and (category is distinct from 'ucr_document_v1' or version is distinct from 1))
    or (select count(distinct (body,title,version,state_code,equipment_category))
      from public.agreement_clauses
      where clause_key='ucr-approved-equipment-lease-20261014') <> 1 then
    raise exception 'Prepared copies differ; activation aborted without changes.';
  end if;
  select id into selected_clause from public.agreement_clauses
    where clause_key='ucr-approved-equipment-lease-20261014'
    order by enabled desc, created_at, id limit 1;
  update public.agreement_clauses set enabled=false
    where enabled and id<>selected_clause;
  update public.agreement_clauses set enabled=true where id=selected_clause;
end;
$$;
commit;

select id, clause_key, enabled from public.agreement_clauses
where clause_key='ucr-approved-equipment-lease-20261014'
order by enabled desc, created_at, id;
