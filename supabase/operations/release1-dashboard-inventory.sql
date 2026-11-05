-- READ ONLY. Use the intended production project; never paste credentials here.
begin read only;
select r.id, r.created_at, r.full_name, r.status, r.source,
  r.rental_start_date, r.rental_end_date,
  coalesce((to_jsonb(r)->>'is_test_data')::boolean,false) as already_hidden_as_test,
  (select count(*) from public.rental_agreements a where a.rental_request_id=r.id) as agreements,
  (select count(*) from public.rental_agreements a where a.rental_request_id=r.id and a.locked_at is not null) as locked_agreements,
  (select count(*) from public.invoices i where i.rental_request_id=r.id or exists (select 1 from public.rental_agreements a where a.id=i.rental_agreement_id and a.rental_request_id=r.id)) as invoices,
  (select count(*) from public.payments p join public.invoices i on i.id=p.invoice_id where i.rental_request_id=r.id or exists (select 1 from public.rental_agreements a where a.id=i.rental_agreement_id and a.rental_request_id=r.id)) as payments,
  (select count(*) from public.rental_documents d where d.rental_request_id=r.id) as documents,
  (select count(*) from public.rental_approval_events e where e.rental_request_id=r.id) as approval_events,
  (select count(*) from public.rental_availability_checks c where c.rental_request_id=r.id) as availability_checks,
  (select count(*) from public.rental_driver_license_reviews v where v.rental_request_id=r.id) as license_reviews
from public.rental_requests r order by r.created_at,r.id;

select id,clause_key,category,version,enabled
from public.agreement_clauses
where clause_key='ucr-approved-equipment-lease-20261014'
order by enabled desc,created_at,id;
select feature_key,enabled from private.release_feature_flags
where feature_key='multi_item_rental_requests';
select configuration_key,configuration_value
from private.rental_approval_configuration where configuration_key='payment_policy';
commit;
