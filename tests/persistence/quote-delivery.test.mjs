import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const migration=await readFile(new URL('../../supabase/migrations/20261118000100_automated_rental_quotes.sql',import.meta.url),'utf8');
const staffId='11111111-1111-4111-8111-111111111111';
const requestId='22222222-2222-4222-8222-222222222222';
async function database(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema private;grant usage on schema private to authenticated;
 create function private.current_jwt_claims() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function private.is_staff() returns boolean language sql stable as $$ select coalesce(private.current_jwt_claims()->'app_metadata'->>'role' in ('staff','admin'),false) $$;
 create table public.rental_requests(id uuid primary key,full_name text,email text,equipment_requested text,rental_start_date date,rental_end_date date,fulfillment_type text,quote_amount numeric(12,2));
 insert into public.rental_requests values('${requestId}','<Customer>','delivered@resend.dev','Bobcat','2027-01-01','2027-01-02','Pickup',280);`);
 await db.exec(migration);await db.exec(migration);
 return db;
}
async function role(db,name,claims={}){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:name,sub:staffId,...claims})]);await db.exec(`set role ${name}`);}
const prepare=(db,amount=280,email='delivered@resend.dev')=>db.query('select public.prepare_rental_quote($1,$2,$3) as q',[requestId,amount,email]).then(r=>r.rows[0].q);
const claim=(db,id,payload={to:['delivered@resend.dev'],text:'Frozen content'})=>db.query('select public.claim_rental_quote($1,$2,$3) as q',[id,JSON.stringify(payload),staffId]).then(r=>r.rows[0].q);
const finish=(db,q,id=null)=>db.query('select public.finish_rental_quote($1,$2,$3,$4,$5,$6) as q',[q.id,q.attempt_token,id,id?null:'provider_unconfirmed',id?null:'Retry safely',!id]).then(r=>r.rows[0].q);
const event=(db,id,kind='email.delivered',message='provider-1')=>db.query('select public.record_rental_quote_event($1,$2,$3,now())',[id,message,kind]);

test('quote authorization, stale confirmation, canonical idempotency, and immutable saved pricing',async t=>{
 const db=await database(t);
 await role(db,'anon');await assert.rejects(()=>prepare(db),/permission denied/);
 await role(db,'authenticated',{user_metadata:{role:'staff'}});await assert.rejects(()=>prepare(db),/Staff authorization/);
 assert.deepEqual((await db.query('select id,status from public.rental_quote_deliveries')).rows,[]);
 await assert.rejects(()=>claim(db,requestId),/permission denied/);
 await role(db,'authenticated',{app_metadata:{role:'staff'}});
 for(const [amount,email]of[[281,'delivered@resend.dev'],[280,'other@resend.dev'],[280,'bad,email@resend.dev'],[280.001,'delivered@resend.dev']])await assert.rejects(()=>prepare(db,amount,email),/changed|invalid/);
 const q=await prepare(db);const repeat=await prepare(db,'280.00','DELIVERED@RESEND.DEV');assert.equal(q.id,repeat.id);
 await assert.rejects(()=>db.query("update public.rental_quote_deliveries set status='delivered'"),/permission denied/);
 await assert.rejects(()=>event(db,'forged'),/permission denied/);
 await db.exec('reset role');assert.equal(Number((await db.query('select quote_amount from public.rental_requests')).rows[0].quote_amount),280);
 assert.equal(q.snapshot.customerName,'<Customer>');assert.equal(q.created_by,staffId);
 await db.exec('update public.rental_requests set quote_amount=300');
 await role(db,'authenticated',{app_metadata:{role:'staff'}});const next=await prepare(db,300);assert.notEqual(q.id,next.id);assert.equal(Number(q.amount),280);
});

test('lease prevents duplicates; safe retry keeps the payload and provider key; old attempts cannot finish',async t=>{
 const db=await database(t);await role(db,'authenticated',{app_metadata:{role:'staff'}});const q=await prepare(db);
 await role(db,'service_role');const first=await claim(db,q.id);assert.ok(first.acquired);
 assert.equal((await claim(db,q.id)).acquired,false);
 const failure=await finish(db,first.quote);assert.equal(failure.status,'failed');assert.equal(failure.retryable,true);
 assert.equal((await claim(db,q.id)).acquired,false);
 await db.exec('reset role');await db.query("update public.rental_quote_deliveries set lease_until=now()-interval '1 second' where id=$1",[q.id]);await role(db,'service_role');
 const retry=await claim(db,q.id,{text:'MUTATED CONTENT'});assert.ok(retry.acquired);assert.deepEqual(retry.quote.email_payload,first.quote.email_payload);assert.notEqual(retry.quote.attempt_token,first.quote.attempt_token);
 await finish(db,first.quote,'stale-provider');const sent=await finish(db,retry.quote,'provider-1');assert.equal(sent.status,'sent');assert.equal(sent.provider_message_id,'provider-1');assert.equal(sent.sent_by,staffId);assert.ok(sent.sent_at);
 assert.equal((await claim(db,q.id)).acquired,false);
 await event(db,'delivered');assert.equal((await finish(db,retry.quote,'provider-1')).status,'delivered');
});

test('verified webhook inbox handles early/repeated/out-of-order events and terminal bounce',async t=>{
 const db=await database(t);await role(db,'authenticated',{app_metadata:{role:'staff'}});const q=await prepare(db);await role(db,'service_role');const lease=await claim(db,q.id);
 await event(db,'early');await event(db,'early');const delivered=await finish(db,lease.quote,'provider-1');assert.equal(delivered.status,'delivered');assert.ok(delivered.delivered_at);
 await event(db,'late-sent','email.sent');assert.equal((await finish(db,lease.quote,'provider-1')).status,'delivered');
 await event(db,'bounce','email.bounced');await event(db,'older-delivered');const failed=await finish(db,lease.quote,'provider-1');assert.equal(failed.status,'failed');assert.equal(failed.retryable,false);assert.equal(failed.error_code,'email.bounced');
 assert.equal((await claim(db,q.id)).acquired,false);
});

test('uncertain sends outside provider idempotency window fail closed',async t=>{
 const db=await database(t);await role(db,'authenticated',{app_metadata:{role:'staff'}});const q=await prepare(db);await role(db,'service_role');await claim(db,q.id);
 await db.exec('reset role');await db.query("update public.rental_quote_deliveries set first_attempt_at=now()-interval '24 hours',lease_until=now()-interval '1 second' where id=$1",[q.id]);await role(db,'service_role');
 const expired=await claim(db,q.id);assert.equal(expired.acquired,false);assert.equal(expired.quote.status,'failed');assert.equal(expired.quote.error_code,'reconciliation_required');assert.equal(expired.quote.retryable,false);
});
