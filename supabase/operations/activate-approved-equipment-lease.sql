-- Execute after the compatible application is deployed and its version verified.
-- This changes selection for future Agreements only; existing snapshots are untouched.
begin;
lock table public.agreement_clauses in share row exclusive mode;
do $$
begin
  if (select count(*) from public.agreement_clauses where clause_key='ucr-approved-equipment-lease-20261014' and category='ucr_document_v1') <> 1 then
    raise exception 'Expected exactly one prepared approved terms version; activation aborted.';
  end if;
end;
$$;
update public.agreement_clauses set enabled=false where enabled and clause_key is distinct from 'ucr-approved-equipment-lease-20261014';
update public.agreement_clauses set enabled=true where clause_key='ucr-approved-equipment-lease-20261014' and category='ucr_document_v1';
commit;
