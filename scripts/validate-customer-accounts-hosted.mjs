import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const url=process.env.VITE_SUPABASE_URL;assert.equal(url,'https://cmqsvywbhswrycgxvbgy.supabase.co');assert.equal(process.env.RELEASE_VALIDATION_CONFIRM_PROJECT_REF,'cmqsvywbhswrycgxvbgy');
assert.equal(process.env.RELEASE_VALIDATION_ALLOW_MUTATIONS,'true','Explicit staging mutation opt-in required');
const auth={persistSession:false,autoRefreshToken:false};const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth});const guest=createClient(url,process.env.VITE_SUPABASE_ANON_KEY,{auth});
const sessions=[];
async function user(key){const claims=JSON.parse(Buffer.from(process.env[key].split('.')[1],'base64url'));const found=await admin.auth.admin.getUserById(claims.sub);assert.ifError(found.error);assert.match(found.data.user.email,/@(?:example\.(?:test|com|org|net)|[^@]+\.(?:test|invalid|localhost))$/i);const link=await admin.auth.admin.generateLink({type:'magiclink',email:found.data.user.email});assert.ifError(link.error);const client=createClient(url,process.env.VITE_SUPABASE_ANON_KEY,{auth});const result=await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});assert.ifError(result.error);sessions.push(result.data.session);return {client,user:result.data.user};}
const fixtures=[];const run=Date.now().toString(36);
try{
 const staff=await user('RELEASE_VALIDATION_STAFF_ACCESS_TOKEN');const owner=await user('RELEASE_VALIDATION_CUSTOMER_ACCESS_TOKEN');const other=await user('RELEASE_VALIDATION_SPOOFED_CUSTOMER_ACCESS_TOKEN');assert.notEqual(owner.user.id,other.user.id);
 const rateResult=await guest.rpc('get_rental_rates');assert.ifError(rateResult.error);const rate=rateResult.data.find(r=>r.equipment_id==='bobcat-t550-skid-steer');assert.ok(rate);
 const params={equipment_key:rate.equipment_id,expected_rates:rate.rates,next_rates:rate.rates};assert.ok((await guest.rpc('save_rental_rates',params)).error);assert.equal((await other.client.rpc('save_rental_rates',params)).error?.code,'42501');assert.ifError((await staff.client.rpc('save_rental_rates',params)).error);
 const payload={full_name:'Staging accounts '+run,email:'accounts-'+run+'@example.test',phone:'8015550100',equipment_requested:rate.equipment_name,agreement_accepted:true,customer_type:'individual',source:'website',status:'new',priority:'normal',payment_status:'unpaid',deposit_status:'not_required',delivery_status:'not_scheduled',availability_status:'pending_review',rental_start_date:'2027-06-01',rental_end_date:'2027-06-02'};
 assert.ifError((await guest.from('rental_requests').insert(payload)).error);
 const locate=await staff.client.from('rental_requests').select('id,customer_id,customer_user_id').eq('email',payload.email);assert.ifError(locate.error);assert.equal(locate.data.length,1);fixtures.push(locate.data[0].id);assert.equal(locate.data[0].customer_user_id,null);
 let mine=await owner.client.rpc('get_my_rentals');assert.ifError(mine.error);assert.ok(!mine.data.some(r=>r.id===fixtures[0]));
 assert.ifError((await owner.client.from('rental_requests').insert({...payload,customer_user_id:owner.user.id})).error);
 const all=await staff.client.from('rental_requests').select('id,customer_id,customer_user_id').eq('email',payload.email);assert.ifError(all.error);const signed=all.data.find(r=>r.customer_user_id===owner.user.id);assert.ok(signed);fixtures.push(signed.id);
 mine=await owner.client.rpc('get_my_rentals');assert.ifError(mine.error);assert.ok(mine.data.some(r=>r.id===signed.id));assert.ok(!mine.data.some(r=>r.id===fixtures[0]));assert.equal('internal_notes' in mine.data.find(r=>r.id===signed.id),false);
 const theirs=await other.client.rpc('get_my_rentals');assert.ifError(theirs.error);assert.ok(!theirs.data.some(r=>fixtures.includes(r.id)));
 assert.deepEqual((await owner.client.from('rental_requests').select('*').eq('id',signed.id)).data,[]);
 assert.deepEqual((await owner.client.from('rental_customers').select('*')).data,[]);
 assert.equal((await other.client.rpc('link_rental_customer_account',{customer_key:signed.customer_id,account_email:other.user.email})).error?.code,'42501');
 assert.ifError((await staff.client.rpc('link_rental_customer_account',{customer_key:signed.customer_id,account_email:owner.user.email})).error);
 mine=await owner.client.rpc('get_my_rentals');assert.ok(fixtures.every(id=>mine.data.some(r=>r.id===id)));
 assert.ok((await owner.client.from('rental_requests').insert({...payload,full_name:'Forged '+run,customer_user_id:other.user.id})).error);
 const settings=await fetch(url+'/auth/v1/settings',{headers:{apikey:process.env.VITE_SUPABASE_ANON_KEY}}).then(r=>r.json());
 assert.ifError((await staff.client.from('rental_requests').update({is_test_data:true}).in('id',fixtures)).error);
 const evidence={project:'cmqsvywbhswrycgxvbgy',fixtures,passed:true,emailEnabled:settings.external?.email,requiresConfirmation:!settings.mailer_autoconfirm,signupDisabled:settings.disable_signup,notes:'No emails sent. Rates saved without changing amounts. Existing synthetic users only; fixtures retained on staging.'};await writeFile(process.env.CUSTOMER_ACCOUNTS_EVIDENCE_PATH || '/private/tmp/ucr-accounts-hosted-evidence.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{for(const session of sessions)await admin.auth.admin.signOut(session.access_token,'local');}
