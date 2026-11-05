-- Reversible display classification, not cancellation/deletion or an availability override.
-- All existing records remain visible until explicitly classified after inventory review.
alter table public.rental_requests
  add column if not exists is_test_data boolean not null default false;
comment on column public.rental_requests.is_test_data is
  'Explicitly confirmed test record: omitted from default Admin dashboard and totals only. Preserves all history and availability rules.';
