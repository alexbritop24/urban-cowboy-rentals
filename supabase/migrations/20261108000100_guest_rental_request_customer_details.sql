-- Keep the existing anonymous intake policy and its protected status fields.
-- This additional check only applies to guest inserts.
grant insert (customer_type, business_name) on public.rental_requests to anon;

drop policy if exists "guest rental requests require consistent customer details"
  on public.rental_requests;
create policy "guest rental requests require consistent customer details"
  on public.rental_requests
  as restrictive
  for insert
  to anon
  with check (
    (customer_type = 'individual' and business_name is null)
    or (
      customer_type = 'business'
      and business_name ~ '[^[:space:]]'
      and char_length(business_name) <= 200
    )
  );
