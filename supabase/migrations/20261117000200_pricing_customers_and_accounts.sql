alter table private.rental_equipment_catalog add column if not exists rate_options jsonb;
update private.rental_equipment_catalog c set rate_options=(
 select jsonb_agg(case when item->>'label'='1 Day' then jsonb_set(item,'{price}',to_jsonb(c.daily_rate)) else item end order by position)
 from jsonb_array_elements(seed.rates) with ordinality r(item,position)
) from (values
('bobcat-t550-skid-steer', '[{"label": "1 Day", "price": 280.0}, {"label": "1 Week", "price": 1200.0}, {"label": "2 Weeks", "price": 2000.0}, {"label": "4 Weeks", "price": 2800.0}]'::jsonb),
('bobcat-e35r2-compact-excavator', '[{"label": "1 Day", "price": 280.0}, {"label": "1 Week", "price": 1200.0}, {"label": "2 Weeks", "price": 2000.0}, {"label": "4 Weeks", "price": 2800.0}]'::jsonb),
('lamar-telescopic-dump-9-ton', '[{"label": "4hr", "price": 130.0}, {"label": "1 Day", "price": 175.0}, {"label": "1 Week", "price": 900.0}, {"label": "2 Weeks", "price": 1800.0}, {"label": "3 Weeks", "price": 2100.0}, {"label": "4 Weeks", "price": 2400.0}]'::jsonb),
('rawmax-tilt-deck-22', '[{"label": "4hr", "price": 125.0}, {"label": "1 Day", "price": 150.0}, {"label": "2 Days", "price": 300.0}, {"label": "1 Week", "price": 600.0}, {"label": "2 Weeks", "price": 1200.0}, {"label": "4 Weeks", "price": 1800.0}]'::jsonb),
('rawmaxx-dtx-24-tilt-deck', '[{"label": "1 Day", "price": 150.0}, {"label": "1 Week", "price": 800.0}, {"label": "4 Weeks", "price": 2000.0}]'::jsonb),
('utility-trailer', '[{"label": "4hr", "price": 75.0}, {"label": "1 Day", "price": 100.0}, {"label": "1 Week", "price": 450.0}, {"label": "2 Weeks", "price": 850.0}, {"label": "4 Weeks", "price": 1500.0}]'::jsonb),
('scissor-lift', '[{"label": "1 Day", "price": 140.0}, {"label": "1 Week", "price": 700.0}, {"label": "2 Weeks", "price": 1300.0}, {"label": "4 Weeks", "price": 2400.0}]'::jsonb),
('hercules-sds-max-demolition-hammer', '[{"label": "1 Day", "price": 50.0}, {"label": "1 Week", "price": 200.0}, {"label": "4 Weeks", "price": 600.0}]'::jsonb),
('bauer-65j-demolition-hammer', '[{"label": "1 Day", "price": 50.0}, {"label": "1 Week", "price": 200.0}, {"label": "4 Weeks", "price": 600.0}]'::jsonb),
('plate-compactor', '[{"label": "1 Day", "price": 60.0}, {"label": "1 Week", "price": 280.0}, {"label": "4 Weeks", "price": 900.0}]'::jsonb),
('wacker-rd12-roller', '[{"label": "1 Day", "price": 180.0}, {"label": "1 Week", "price": 800.0}, {"label": "4 Weeks", "price": 1800.0}]'::jsonb),
('kobalt-hand-tamper', '[{"label": "1 Day", "price": 10.0}, {"label": "1 Week", "price": 40.0}, {"label": "4 Weeks", "price": 120.0}]'::jsonb),
('harley-road-glide-2003', '[{"label": "1 Day", "price": 180.0}, {"label": "1 Week", "price": 980.0}, {"label": "2 Weeks", "price": 1680.0}, {"label": "3 Weeks", "price": 2520.0}, {"label": "4 Weeks", "price": 3300.0}]'::jsonb),
('harley-fld-switchback-2012', '[{"label": "4hr", "price": 150.0}, {"label": "1 Day", "price": 130.0}, {"label": "1 Week", "price": 600.0}, {"label": "2 Weeks", "price": 1100.0}, {"label": "3 Weeks", "price": 1600.0}, {"label": "4 Weeks", "price": 2000.0}]'::jsonb)) as seed(id,rates) where c.equipment_id=seed.id and c.rate_options is null;

create or replace function public.get_rental_rates()
returns table(equipment_id text, equipment_name text, daily_rate numeric, rates jsonb)
language sql stable security definer set search_path=pg_catalog,private as $$
 select equipment_id,equipment_name,daily_rate,coalesce(rate_options,jsonb_build_array(jsonb_build_object('label','1 Day','price',daily_rate)))
 from private.rental_equipment_catalog where status='active' and rentable order by equipment_name
$$;
revoke all on function public.get_rental_rates() from public;
grant execute on function public.get_rental_rates() to anon,authenticated;

create or replace function public.save_rental_rates(equipment_key text, expected_rates jsonb, next_rates jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare current_rates jsonb; day_rate numeric;
begin
 if not private.is_staff() then raise exception using errcode='42501',message='Staff access required.'; end if;
 select rate_options into current_rates from private.rental_equipment_catalog where equipment_id=equipment_key for update;
 if not found then raise exception 'Equipment not found.'; end if;
 if current_rates is distinct from expected_rates then raise exception using errcode='40001',message='Prices changed. Reload before saving.'; end if;
 if jsonb_typeof(next_rates) is distinct from 'array' or jsonb_array_length(next_rates)<>jsonb_array_length(current_rates) then raise exception 'Keep the existing rental durations.'; end if;
 if exists(select 1 from jsonb_array_elements(next_rates) with ordinality n(item,position)
   where jsonb_typeof(item->'price') is distinct from 'number' or (item->>'price')::numeric<0
   or (item->>'price')::numeric>99999999.99 or round((item->>'price')::numeric,2)<>(item->>'price')::numeric
   or item->>'label' is distinct from current_rates->(position::integer-1)->>'label') then raise exception 'Enter valid prices with two decimal places.'; end if;
 select (item->>'price')::numeric into day_rate from jsonb_array_elements(next_rates) item where item->>'label'='1 Day';
 if day_rate is null then raise exception 'A daily rate is required.'; end if;
 update private.rental_equipment_catalog set rate_options=next_rates,daily_rate=day_rate,updated_at=now() where equipment_id=equipment_key;
end $$;
revoke all on function public.save_rental_rates(text,jsonb,jsonb) from public,anon;
grant execute on function public.save_rental_rates(text,jsonb,jsonb) to authenticated;

create table if not exists public.rental_customers(
 id uuid primary key default gen_random_uuid(), identity_key text unique not null,
 full_name text not null, business_name text, customer_type text not null,
 phone text not null, email text not null, account_user_id uuid, created_at timestamptz not null default now()
);
alter table public.rental_customers enable row level security;
revoke all on public.rental_customers from public,anon,authenticated;
grant select on public.rental_customers to authenticated;
drop policy if exists "staff read customer records" on public.rental_customers;
create policy "staff read customer records" on public.rental_customers for select to authenticated using(private.is_staff());
alter table public.rental_requests add column if not exists customer_id uuid references public.rental_customers(id), add column if not exists customer_user_id uuid;
create index if not exists rental_requests_customer_id_idx on public.rental_requests(customer_id);
create index if not exists rental_requests_customer_user_id_idx on public.rental_requests(customer_user_id);

create or replace function private.attach_rental_customer()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare identity_value text;
begin
 identity_value:=md5(jsonb_build_array(lower(btrim(new.full_name)),lower(btrim(new.email)),regexp_replace(new.phone,'[^0-9]','','g'),coalesce(new.customer_type,'individual'),lower(btrim(coalesce(new.business_name,''))))::text);
 insert into public.rental_customers(identity_key,full_name,business_name,customer_type,phone,email)
 values(identity_value,new.full_name,new.business_name,coalesce(new.customer_type,'individual'),new.phone,new.email)
 on conflict(identity_key) do update set identity_key=excluded.identity_key returning id into new.customer_id;
 if tg_op='INSERT' and new.source='website' and private.current_jwt_claims()->>'role'='authenticated' then
   if private.verified_customer_id() is null then raise exception 'Verify your account before submitting a rental request.'; end if;
   if new.customer_user_id is null then new.customer_user_id:=private.verified_customer_id(); end if;
 end if;
 if new.customer_user_id is null then
   select account_user_id into new.customer_user_id from public.rental_customers where id=new.customer_id;
 end if;
 return new;
end $$;
revoke all on function private.attach_rental_customer() from public,anon,authenticated;
drop trigger if exists rental_requests_attach_customer on public.rental_requests;
create trigger rental_requests_attach_customer before insert or update of full_name,email,phone,customer_type,business_name on public.rental_requests for each row execute function private.attach_rental_customer();
-- Backfill contact records without assigning account ownership.
update public.rental_requests set full_name=full_name where customer_id is null;

create or replace function private.verified_customer_id()
returns uuid language sql stable security definer set search_path=pg_catalog,auth,private as $$
 select id from auth.users where id=nullif(private.current_jwt_claims()->>'sub','')::uuid and email_confirmed_at is not null
$$;
revoke all on function private.verified_customer_id() from public,anon;
grant execute on function private.verified_customer_id() to authenticated;

grant insert (customer_type,business_name,full_name,phone,email,equipment_requested,rental_start_date,rental_end_date,pickup_date,return_date,rental_duration,fulfillment_type,project_type,notes,agreement_accepted,source,status,priority,payment_status,deposit_status,delivery_status,availability_status,availability_notes,customer_user_id) on public.rental_requests to authenticated;
drop policy if exists "verified customers submit their own requests" on public.rental_requests;
create policy "verified customers submit their own requests" on public.rental_requests for insert to authenticated with check(
 customer_user_id=private.verified_customer_id() and agreement_accepted=true and status='new' and source='website'
 and priority='normal' and payment_status='unpaid' and deposit_status='not_required' and delivery_status='not_scheduled' and availability_status='pending_review'
 and assigned_to is null and internal_notes is null and quote_amount is null and payment_link is null
 and ((customer_type='individual' and business_name is null) or (customer_type='business' and business_name ~ '[^[:space:]]' and length(business_name)<=200))
);

create or replace function private.owns_rental(request_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.rental_requests where id=request_id and customer_user_id=private.verified_customer_id())
$$;
revoke all on function private.owns_rental(uuid) from public,anon;
grant execute on function private.owns_rental(uuid) to authenticated;

drop policy if exists "customers read finalized agreements" on public.rental_agreements;
create policy "customers read finalized agreements" on public.rental_agreements for select to authenticated using(locked_at is not null and private.owns_rental(rental_request_id));
drop policy if exists "customers read finalized agreement items" on public.agreement_items;
create policy "customers read finalized agreement items" on public.agreement_items for select to authenticated using(exists(select 1 from public.rental_agreements a where a.id=rental_agreement_id and a.locked_at is not null and private.owns_rental(a.rental_request_id)));
drop policy if exists "customers read issued invoices" on public.invoices;
create policy "customers read issued invoices" on public.invoices for select to authenticated using(issued_at is not null and private.owns_rental(rental_request_id));
drop policy if exists "customers read issued invoice items" on public.invoice_items;
create policy "customers read issued invoice items" on public.invoice_items for select to authenticated using(exists(select 1 from public.invoices i where i.id=invoice_id and i.issued_at is not null and private.owns_rental(i.rental_request_id)));

create or replace function public.get_my_rentals()
returns jsonb language sql stable security definer set search_path=pg_catalog,public,private as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'equipment',r.equipment_requested,'start_date',r.rental_start_date,'end_date',r.rental_end_date,'status',r.status,'quote_amount',r.quote_amount,
 'agreements',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'number',a.agreement_number)),'[]') from public.rental_agreements a where a.rental_request_id=r.id and a.locked_at is not null),
 'invoices',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'number',i.invoice_number)),'[]') from public.invoices i where i.rental_request_id=r.id and i.issued_at is not null)) order by r.created_at desc),'[]')
 from public.rental_requests r where r.customer_user_id=private.verified_customer_id()
$$;
revoke all on function public.get_my_rentals() from public,anon;
grant execute on function public.get_my_rentals() to authenticated;

create or replace function public.link_rental_customer_account(customer_key uuid, account_email text)
returns void language plpgsql security definer set search_path=pg_catalog,public,private,auth as $$
declare account_id uuid;
begin
 if not private.is_staff() then raise exception using errcode='42501',message='Staff access required.'; end if;
 select id into account_id from auth.users where lower(email)=lower(btrim(account_email)) and email_confirmed_at is not null;
 if account_id is null then raise exception 'Ask the customer to create and verify their account first.'; end if;
 perform 1 from public.rental_customers where id=customer_key for update;
 if not found then raise exception 'Customer not found.'; end if;
 if exists(select 1 from public.rental_requests where customer_id=customer_key and customer_user_id is not null and customer_user_id<>account_id) then raise exception 'A different account already owns these rentals.'; end if;
 update public.rental_customers set account_user_id=account_id where id=customer_key;
 update public.rental_requests set customer_user_id=account_id where customer_id=customer_key;
end $$;
revoke all on function public.link_rental_customer_account(uuid,text) from public,anon;
grant execute on function public.link_rental_customer_account(uuid,text) to authenticated;
