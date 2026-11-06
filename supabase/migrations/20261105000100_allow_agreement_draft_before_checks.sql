-- Allow staff to prepare a draft while availability and insurance are pending.
-- Finalization and rental approval retain their separate checks.
do $migration$
declare
  source text;
  old_availability text := $old$  if request_record.availability_status not in ('available', 'approved') then
    raise exception using errcode = '55000',
      message = 'Availability must be confirmed before Agreement creation.';
  end if;
$old$;
  old_insurance text := $old$  if request_record.insurance_verification_status <> 'verified' then
    raise exception using errcode = '55000',
      message = 'Insurance must be verified before Agreement creation.';
  end if;
$old$;
  marker constant text := '-- draft creation permits pending availability and insurance';
begin
  source := pg_get_functiondef('public.create_rental_agreement_for_request(uuid)'::regprocedure);
  if position(marker in source) > 0 then return; end if;
  if (length(source) - length(replace(source, old_availability, ''))) <> length(old_availability)
     or (length(source) - length(replace(source, old_insurance, ''))) <> length(old_insurance) then
    raise exception 'Agreement creation function differs from the expected version; no changes made.';
  end if;
  source := replace(source, old_availability, '  ' || marker || E'\n');
  source := replace(source, old_insurance, '');
  execute source;
end
$migration$;
