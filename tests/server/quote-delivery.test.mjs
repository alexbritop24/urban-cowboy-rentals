import assert from 'node:assert/strict';
import test from 'node:test';
import {createQuoteSendHandler,verifyQuoteWebhook} from '../../supabase/functions/_shared/quoteDelivery.ts';
import {rentalQuoteMessage,validQuoteEmail} from '../../src/domain/quotes/rentalQuoteMessage.ts';
const requestId='22222222-2222-4222-8222-222222222222';
const quoteId='33333333-3333-4333-8333-333333333333';
const snapshot={templateVersion:1,customerName:'<Jason & customer>',equipment:'Bobcat\r\nQuoted',startDate:'2027-02-01',endDate:'2027-02-02',fulfillment:'Pickup',amount:280,currency:'USD',recipient:'delivered@resend.dev'};
const request=(body={},token='staff')=>new Request('https://example.test/functions/v1/rental-quotes',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({requestId,amount:280,recipient:'delivered@resend.dev',confirmed:true,...body})});
function setup(overrides={}){
 let q={id:quoteId,status:'draft',snapshot,recipient_email:snapshot.recipient,amount:280,retryable:true,error_details:null,attempt_token:'claim-1',email_payload:null};
 const calls=[];
 const deps={
  authorize:async token=>token==='Bearer staff',
  env:name=>({RESEND_API_KEY:'secret-never-in-browser',QUOTE_FROM_EMAIL:'quotes@example.test',QUOTE_REPLY_TO_EMAIL:'staff@example.test',QUOTE_DELIVERY_MODE:'test',QUOTE_TEST_RECIPIENTS:'delivered@resend.dev'})[name],
  prepare:async()=>q,
  claim:async(_id,payload)=>{if(q.status!=='draft')return{acquired:false,quote:q};q={...q,status:'sending',email_payload:payload};return{acquired:true,quote:q};},
  finish:async(_id,_token,result)=>{q={...q,status:result.messageId?'sent':'failed',retryable:result.retryable,error_details:result.detail};return q;},
  fetch:async(url,options)=>{calls.push({url,options});return Response.json({id:'provider-1'});},
  ...overrides,
 };
 return {handler:createQuoteSendHandler(deps),calls};
}
test('successful quote sends server-rendered content and only reports Sent, not Delivered',async()=>{
 const {handler,calls}=setup();const response=await handler(request());assert.equal(response.status,200);const body=await response.json();assert.equal(body.status,'sent');assert.equal(calls.length,1);
 assert.equal(calls[0].options.headers['Idempotency-Key'],`rental-quote/${quoteId}`);
 const sent=JSON.parse(calls[0].options.body);assert.equal(sent.to[0],snapshot.recipient);assert.match(sent.html,/&lt;Jason &amp; customer&gt;/);assert.match(sent.text,/\$280\.00/);assert.equal(sent.subject.includes('\r'),false);
 assert.equal(JSON.stringify(body).includes('secret-never'),false);
 await handler(request());assert.equal(calls.length,1);
});
test('simultaneous staff submissions produce one provider request',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});let count=0;
 const {handler}=setup({fetch:async()=>{count++;await pending;return Response.json({id:'provider-1'});}});
 const first=handler(request());await new Promise(resolve=>setTimeout(resolve,10));const second=await handler(request());assert.equal((await second.json()).status,'sending');release();await first;assert.equal(count,1);
});
test('unauthorized, unconfirmed, malformed email, and test-recipient requests never send',async()=>{
 const {handler,calls}=setup();for(const req of[request({},'customer'),request({confirmed:false}),request({recipient:'bad,email@example.test'}),request({recipient:'realcustomer@example.com'}),request({amount:280.001})])assert.ok((await handler(req)).status>=400);assert.equal(calls.length,0);
 assert.equal(validQuoteEmail('bad\r\n@example.test'),false);
});
test('server configuration and stale confirmations fail before provider calls',async()=>{
 const absent=setup({env:()=>undefined});assert.equal((await absent.handler(request())).status,503);assert.equal(absent.calls.length,0);
 const stale=setup({prepare:async()=>{throw new Error('The saved amount changed. Reload and confirm it again.');}});assert.equal((await stale.handler(request())).status,409);assert.equal(stale.calls.length,0);
});
test('transient failure is retryable, permanent rejection is terminal, and errors do not leak provider details',async()=>{
 for(const [status,retryable]of[[429,true],[500,true],[422,false],[409,false]]){
  const {handler}=setup({fetch:async()=>Response.json({message:'sensitive-provider-details'}, {status})});const result=await(await handler(request())).json();assert.equal(result.status,'failed');assert.equal(result.retryable,retryable);assert.equal(JSON.stringify(result).includes('sensitive-provider-details'),false);
 }
 const timeout=setup({fetch:async()=>{throw new Error('timeout');}});const result=await(await timeout.handler(request())).json();assert.equal(result.status,'failed');assert.equal(result.retryable,true);
});
test('provider acceptance followed by persistence failure remains unconfirmed',async()=>{
 const {handler,calls}=setup({finish:async()=>{throw new Error('database unavailable');}});assert.equal((await handler(request())).status,503);assert.equal((await(await handler(request())).json()).status,'sending');assert.equal(calls.length,1);
});
test('frozen payload cannot evade the test-recipient allowlist',async()=>{
 const {handler,calls}=setup({claim:async()=>({acquired:true,quote:{id:quoteId,status:'sending',attempt_token:'claim-1',email_payload:{to:['actual-customer@example.com']}}})});const result=await(await handler(request())).json();assert.equal(result.status,'failed');assert.equal(result.retryable,false);assert.equal(calls.length,0);
});
test('Svix official signature vector verifies; forged, modified and stale webhooks fail',async()=>{
 const body='{"event_type":"ping","data":{"success":true}}';
 const secret='whsec_plJ3nmyCDGBKInavdOK15jsl';
 const headers={'svix-id':'msg_loFOjxBNrRLzqYUf','svix-timestamp':'1731705121','svix-signature':'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0='};
 const make=(payload=body,extra={})=>new Request('https://example.test/quote-events',{method:'POST',body:payload,headers:{...headers,...extra}});
 assert.equal((await verifyQuoteWebhook(make(),secret,1731705121000)).id,headers['svix-id']);
 await assert.rejects(()=>verifyQuoteWebhook(make(body+' '),secret,1731705121000));
 await assert.rejects(()=>verifyQuoteWebhook(make(),secret,1731705500000));
 await assert.rejects(()=>verifyQuoteWebhook(make(body,{'svix-signature':'v1,ZmFrZQ=='}),secret,1731705121000));
});
test('quote template preserves preview data and explicitly avoids booking confirmation',()=>{
 const message=rentalQuoteMessage(snapshot);assert.match(message.text,/subject to confirmation/);assert.match(message.html,/Your rental quote/);assert.equal(message.html.includes('<Jason'),false);assert.match(message.text,/Feb 1, 2027/);
});
