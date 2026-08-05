-- Run after local migrations. The transaction is always rolled back.
begin;

update private.release_feature_flags
set enabled = true
where feature_key = 'multi_item_rental_requests';

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"role":"staff"}}',
  true
);

do $$
declare
  test_case record;
  request_id uuid;
  stored_quote numeric;
  item_payload jsonb;
begin
  item_payload := jsonb_build_array(
    jsonb_build_object(
      'equipment_id', 'plate-compactor',
      'start_date', now() + interval '2 days',
      'end_date', now() + interval '3 days',
      'quantity', 1,
      'notes', 'Legacy conversion validation'
    )
  );

  for test_case in
    select *
    from (
      values
        ('one-day', 120.00::numeric),
        ('multi-day', 425.00::numeric),
        ('zero', 0.00::numeric),
        ('null', null::numeric),
        ('manually-edited', 333.33::numeric)
    ) as cases(case_name, expected_quote)
  loop
    insert into public.rental_requests (
      full_name,
      phone,
      email,
      equipment_requested,
      rental_start_date,
      rental_end_date,
      agreement_accepted,
      quote_amount
    ) values (
      'Legacy Quote Validation',
      '8015550100',
      test_case.case_name || '@example.test',
      'Legacy Equipment',
      current_date + 2,
      case when test_case.case_name = 'multi-day'
        then current_date + 6
        else current_date + 2
      end,
      true,
      test_case.expected_quote
    )
    returning id into request_id;

    perform public.replace_rental_request_items(
      request_id,
      item_payload,
      '{}'::jsonb
    );

    select quote_amount
    into stored_quote
    from public.rental_requests
    where id = request_id;

    if stored_quote is distinct from test_case.expected_quote then
      raise exception
        'Legacy quote case % changed from % to %',
        test_case.case_name,
        test_case.expected_quote,
        stored_quote;
    end if;
  end loop;
end;
$$;

rollback;
