-- Immutable quote snapshots; all sending state is controlled server-side.
create table if not exists public.rental_quote_deliveries (
 id uuid primary key default gen_random_uuid(),
 rental_request_id uuid not null references public.rental_requests(id),
 fingerprint text not null,
 amount numeric(12,2) not null check(amount>=0),
 recipient_email text not null,
 snapshot jsonb not null,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 status text not null default 'draft' check(status in ('draft','sending','sent','delivered','failed')),
 provider text not null default 'resend' check(provider='resend'),
 provider_message_id text unique,
 sent_at timestamptz, delivered_at timestamptz, sent_by uuid,
 error_code text, error_details text,
 retryable boolean not null default true,
 attempts integer not null default 0,
 first_attempt_at timestamptz, lease_until timestamptz, attempt_token uuid,
 email_payload jsonb,
 unique(rental_request_id,fingerprint)
);
create index if not exists rental_quote_deliveries_request_idx on public.rental_quote_deliveries(rental_request_id,created_at desc);
alter table public.rental_quote_deliveries enable row level security;
revoke all on public.rental_quote_deliveries from public,anon,authenticated;
grant select(id,rental_request_id,snapshot,amount,recipient_email,created_by,created_at,sent_by,status,provider,provider_message_id,sent_at,delivered_at,error_code,error_details,retryable,attempts,first_attempt_at) on public.rental_quote_deliveries to authenticated;
drop policy if exists "staff read quote delivery history" on public.rental_quote_deliveries;
create policy "staff read quote delivery history" on public.rental_quote_deliveries for select to authenticated using(private.is_staff());

create table if not exists private.rental_quote_provider_events (
 event_id text primary key, provider_message_id text not null,
 event_type text not null, occurred_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index if not exists rental_quote_provider_events_message_idx on private.rental_quote_provider_events(provider_message_id,event_type,occurred_at);
revoke all on private.rental_quote_provider_events from public,anon,authenticated;

create or replace function public.prepare_rental_quote(target_request_id uuid,confirmed_amount numeric,confirmed_recipient text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.rental_requests; quote_snapshot jsonb; quote_hash text; q public.rental_quote_deliveries; staff_id uuid;
begin
 if not private.is_staff() then raise exception using errcode='42501',message='Staff authorization is required.'; end if;
 staff_id:=nullif(private.current_jwt_claims()->>'sub','')::uuid;
 if staff_id is null then raise exception using errcode='42501',message='Sign in again before sending.'; end if;
 select * into r from public.rental_requests where id=target_request_id for update;
 if not found then raise exception 'Rental request not found.'; end if;
 if confirmed_amount is null or confirmed_amount<0 or confirmed_amount>9999999999.99 or round(confirmed_amount,2)<>confirmed_amount
 or r.quote_amount is distinct from confirmed_amount then raise exception 'The saved amount changed. Reload and confirm it again.'; end if;
 confirmed_recipient:=lower(btrim(confirmed_recipient));
 if confirmed_recipient is null or length(confirmed_recipient)>254
 or confirmed_recipient !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
 or lower(btrim(r.email)) is distinct from confirmed_recipient then raise exception 'The customer email is invalid or changed. Reload and confirm it again.'; end if;
 confirmed_amount:=round(confirmed_amount,2);
 quote_snapshot:=jsonb_build_object('templateVersion',1,'customerName',r.full_name,'equipment',r.equipment_requested,
 'startDate',r.rental_start_date,'endDate',r.rental_end_date,'fulfillment',r.fulfillment_type,'amount',confirmed_amount,'currency','USD','recipient',confirmed_recipient);
 quote_hash:=md5(quote_snapshot::text);
 select * into q from public.rental_quote_deliveries where rental_request_id=target_request_id and fingerprint=quote_hash;
 if found then return to_jsonb(q); end if;
 if (select count(*) from public.rental_quote_deliveries where created_by=staff_id and created_at>now()-interval '1 hour')>=30 then raise exception 'Quote sending limit reached. Please try again later.'; end if;
 insert into public.rental_quote_deliveries(rental_request_id,fingerprint,amount,recipient_email,snapshot,created_by)
 values(target_request_id,quote_hash,confirmed_amount,confirmed_recipient,quote_snapshot,staff_id) returning * into q;
 return to_jsonb(q);
end $$;
revoke all on function public.prepare_rental_quote(uuid,numeric,text) from public,anon;
grant execute on function public.prepare_rental_quote(uuid,numeric,text) to authenticated;

-- These RPCs are available only to the server service role. A failed/unknown
-- request reuses its persisted payload and Resend key, never a new key.
create or replace function public.claim_rental_quote(quote_id uuid,proposed_payload jsonb,sender_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare q public.rental_quote_deliveries;
begin
 if sender_id is null then raise exception 'Sending staff is required.'; end if;
 select * into q from public.rental_quote_deliveries where id=quote_id for update;
 if not found then raise exception 'Quote not found.'; end if;
 if q.status in ('sent','delivered') or not q.retryable or (q.status='sending' and q.lease_until>now()) then return jsonb_build_object('acquired',false,'quote',to_jsonb(q)); end if;
 if q.first_attempt_at<now()-interval '23 hours' or q.attempts>=5 then
  update public.rental_quote_deliveries set status='failed',retryable=false,error_code='reconciliation_required',error_details='Sending could not be confirmed safely. Check the provider before taking further action.' where id=q.id returning * into q;
  return jsonb_build_object('acquired',false,'quote',to_jsonb(q));
 end if;
 if q.status='failed' and q.lease_until>now() then return jsonb_build_object('acquired',false,'quote',to_jsonb(q)); end if;
 update public.rental_quote_deliveries set status='sending',sent_by=sender_id,attempts=attempts+1,
 first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '2 minutes',attempt_token=gen_random_uuid(),
 email_payload=coalesce(email_payload,proposed_payload),error_code=null,error_details=null where id=q.id returning * into q;
 return jsonb_build_object('acquired',true,'quote',to_jsonb(q));
end $$;

create or replace function private.apply_rental_quote_events(message_id text)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare failure text; delivered timestamptz;
begin
 select event_type into failure from private.rental_quote_provider_events where provider_message_id=message_id and event_type in ('email.bounced','email.failed','email.complained','email.suppressed') order by occurred_at desc limit 1;
 select min(occurred_at) into delivered from private.rental_quote_provider_events where provider_message_id=message_id and event_type='email.delivered';
 if failure is not null then
  update public.rental_quote_deliveries set status='failed',retryable=false,error_code=failure,error_details=case failure when 'email.bounced' then 'The recipient server rejected this email. Verify the address before preparing a corrected quote.' when 'email.complained' then 'The recipient reported this email as spam. Do not retry.' else 'The provider could not deliver this email. Review the provider record.' end where provider_message_id=message_id;
 elsif delivered is not null then
  update public.rental_quote_deliveries set status='delivered',delivered_at=delivered,retryable=false,error_code=null,error_details=null where provider_message_id=message_id;
 end if;
end $$;
revoke all on function private.apply_rental_quote_events(text) from public,anon,authenticated;

create or replace function public.finish_rental_quote(quote_id uuid,claim_token uuid,message_id text,failure_code text,failure_details text,can_retry boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare q public.rental_quote_deliveries;
begin
 if message_id is not null then perform pg_advisory_xact_lock(hashtextextended(message_id,812)); end if;
 select * into q from public.rental_quote_deliveries where id=quote_id for update;
 if not found then raise exception 'Quote not found.'; end if;
 if q.attempt_token is distinct from claim_token then return to_jsonb(q); end if;
 if q.provider_message_id is not null then return to_jsonb(q); end if;
 if message_id is not null then
  update public.rental_quote_deliveries set provider_message_id=message_id,status='sent',sent_at=now(),retryable=false,error_code=null,error_details=null,lease_until=null where id=q.id;
  perform private.apply_rental_quote_events(message_id);
 else
  update public.rental_quote_deliveries set status='failed',error_code=left(failure_code,100),error_details=left(failure_details,500),retryable=coalesce(can_retry,false),lease_until=now()+interval '30 seconds' where id=q.id;
 end if;
 select * into q from public.rental_quote_deliveries where id=quote_id;
 return to_jsonb(q);
end $$;

create or replace function public.record_rental_quote_event(event_key text,message_id text,event_kind text,event_time timestamptz)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if event_kind not in ('email.sent','email.delivered','email.bounced','email.failed','email.complained','email.suppressed') or event_time is null or length(event_key)>200 or length(message_id)>200 then raise exception 'Unsupported email event.'; end if;
 -- Lock in the same order as finish_rental_quote. Events that arrive before
 -- its provider ID is saved remain in the inbox and are applied on completion.
 perform pg_advisory_xact_lock(hashtextextended(message_id,812));
 perform 1 from public.rental_quote_deliveries where provider_message_id=message_id for update;
 insert into private.rental_quote_provider_events(event_id,provider_message_id,event_type,occurred_at) values(event_key,message_id,event_kind,event_time) on conflict(event_id) do nothing;
 perform private.apply_rental_quote_events(message_id);
end $$;
revoke all on function public.claim_rental_quote(uuid,jsonb,uuid),public.finish_rental_quote(uuid,uuid,text,text,text,boolean),public.record_rental_quote_event(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_rental_quote(uuid,jsonb,uuid),public.finish_rental_quote(uuid,uuid,text,text,text,boolean),public.record_rental_quote_event(text,text,text,timestamptz) to service_role;
