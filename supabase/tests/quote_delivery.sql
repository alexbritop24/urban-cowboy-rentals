-- Run only inside the rollback transaction created by validate-quote-staging.mjs.
create temporary table quote_fixture(request_id uuid,delivery_id uuid,claim_token uuid);
grant all on quote_fixture to authenticated,service_role,anon;
insert into quote_fixture(request_id) values(gen_random_uuid());
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"role":"staff"}}',true);
select public.create_staff_rental_request((select request_id from quote_fixture),jsonb_build_object(
 'customer_type','individual','full_name','Controlled staging quote test',
 'phone','8015550100','email','delivered@resend.dev','source','phone',
 'equipment_requested','2024 Bobcat T550 Track Loader','fulfillment_type','Pickup',
 'pickup_date','2027-08-01T16:00:00Z','return_date','2027-08-02T16:00:00Z'
));
update public.rental_requests set quote_amount=280 where id=(select request_id from quote_fixture);
do $$ declare q jsonb; again jsonb; begin
 q:=public.prepare_rental_quote((select request_id from quote_fixture),280,'delivered@resend.dev');
 again:=public.prepare_rental_quote((select request_id from quote_fixture),280.00,'DELIVERED@RESEND.DEV');
 if q->>'id' is distinct from again->>'id' then raise exception 'Duplicate quote created'; end if;
 update quote_fixture set delivery_id=(q->>'id')::uuid;
 begin perform public.prepare_rental_quote((select request_id from quote_fixture),300,'delivered@resend.dev'); raise exception 'Stale amount accepted'; exception when raise_exception then if sqlerrm='Stale amount accepted' then raise; end if; end;
end $$;
reset role;
set local role service_role;
do $$ declare lease jsonb; second jsonb; q jsonb; provider_id text; begin
 lease:=public.claim_rental_quote((select delivery_id from quote_fixture),'{"to":["delivered@resend.dev"],"text":"Staging verification only; no email sent."}','11111111-1111-4111-8111-111111111111');
 if lease->>'acquired'<>'true' then raise exception 'Lease not acquired'; end if;
 update quote_fixture set claim_token=(lease->'quote'->>'attempt_token')::uuid;
 second:=public.claim_rental_quote((select delivery_id from quote_fixture),'{}','11111111-1111-4111-8111-111111111111');
 if second->>'acquired'<>'false' then raise exception 'Duplicate lease acquired'; end if;
 provider_id:='staging-only-'||(select delivery_id::text from quote_fixture);
 q:=public.finish_rental_quote((select delivery_id from quote_fixture),(select claim_token from quote_fixture),provider_id,null,null,false);
 if q->>'status'<>'sent' then raise exception 'Incorrect sent state'; end if;
 perform public.record_rental_quote_event('staging-event-'||provider_id,provider_id,'email.delivered',now());
 q:=public.finish_rental_quote((select delivery_id from quote_fixture),(select claim_token from quote_fixture),provider_id,null,null,false);
 if q->>'status'<>'delivered' then raise exception 'Verified delivery not applied'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222","user_metadata":{"role":"staff"}}',true);
do $$ begin
 if exists(select 1 from public.rental_quote_deliveries) then raise exception 'Customer can read quotes'; end if;
 begin perform public.prepare_rental_quote((select request_id from quote_fixture),280,'delivered@resend.dev'); raise exception 'Customer can prepare quotes'; exception when insufficient_privilege then null; end;
 begin perform public.record_rental_quote_event('forged','unknown','email.delivered',now()); raise exception 'Customer can forge delivery'; exception when insufficient_privilege then null; end;
end $$;
reset role;
