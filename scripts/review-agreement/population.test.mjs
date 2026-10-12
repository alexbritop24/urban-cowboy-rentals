import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {populateReview} from "./populate-review.mjs";
import {sampleAgreement} from "./sample-snapshot.mjs";
const source=JSON.parse(await readFile(new URL("./jason-review.fixture.json",import.meta.url),"utf8"));
const renderText=fixture=>JSON.stringify(fixture.blocks);

test("maps snapshot data without mutating source or substituting reference tables",()=>{
  const sourceBefore=JSON.stringify(source),snapshotBefore=JSON.stringify(sampleAgreement);
  const result=populateReview(source,sampleAgreement,{sample:true});
  const text=renderText(result);
  assert.match(text,/Jordan Sample/);assert.match(text,/High Desert Sample Services LLC/);
  assert.match(text,/UCR-2028-000042/);assert.match(text,/Jun 1, 2028/);
  assert.match(text,/1000 Sample Canyon Road/);assert.match(text,/Operations Manager/);
  const items=result.blocks.find(b=>b.kind==="transactionItems");
  assert.equal(items.rows.length,3);assert.equal(items.rows[0][1],"B57T133070");
  assert.equal(items.rows[0][4],"$120.00");assert.equal(items.rows[2][4],"$225.00");
  assert.notEqual(items.rows[0][2],items.rows[1][2]);
  assert.deepEqual(result.blocks.filter(b=>b.kind==="table"),source.blocks.filter(b=>b.kind==="table"));
  assert.equal(JSON.stringify(source),sourceBefore);assert.equal(JSON.stringify(sampleAgreement),snapshotBefore);
  assert.doesNotMatch(text,/\[LESSEE NAME\]|\[LESSEE PHONE NUMBER\]|\[DATE\]/);
  assert.match(text,/lessor execution\/signature not recorded/);
  assert.match(text,/cardholder identity not recorded/);
  assert.match(text,/UNRECORDED: operational evidence/);
  assert.equal(result.population.optionalOmissions.length,4);
});

test("pending evidence cannot fabricate acceptance dates, signer, card authority, or lessor execution",()=>{
  const pending={...sampleAgreement,signature_status:"pending",acceptance_acknowledged:false,
    authorized_signer_name:null,authorized_signer_title:null,
    // Deliberately stale timestamps must not masquerade as completed evidence.
    signed_at:sampleAgreement.signed_at,credit_card_authorization_acknowledged:false,
    credit_card_authorization_acknowledged_at:sampleAgreement.credit_card_authorization_acknowledged_at};
  const result=populateReview(source,pending);const evidence=result.blocks.find(b=>b.title==="Stored Acceptance and Authorization Evidence");
  const entries=Object.fromEntries(evidence.rows);
  assert.equal(entries["Stored Agreement acceptance"],"Not recorded");
  assert.match(entries["Recorded acceptance timestamp"],/UNRESOLVED/);
  assert.equal(entries["Recorded signer"],"Not recorded");
  assert.equal(entries["Card acknowledgment of stored terms"],"Not recorded");
  assert.equal(entries["Recorded card acknowledgment timestamp"],"Not recorded");
});

test("individual renter does not acquire fabricated entity fields, business name, or signer title",()=>{
  const result=populateReview(source,{...sampleAgreement,customer_type:"individual",business_name:null,authorized_signer_title:null});
  const text=renderText(result);
  assert.match(text,/INDIVIDUAL RENTER/);assert.match(text,/entity type not recorded/);
  assert.doesNotMatch(text,/High Desert Sample Services LLC|Operations Manager/);
  assert.ok(result.population.blockers.some(b=>b.key==="individual_wording"));
  assert.ok(result.population.optionalOmissions.includes("Individual lessee Title field: no applicable recorded title."));
});

test("zero recorded amounts stay zero; missing dates/addresses never use convenient equivalents",()=>{
  const result=populateReview(source,{...sampleAgreement,deposit_amount:0,delivery_fee:0,tax_amount:0,total_amount:0,
    effective_at:null,rental_start_date:null,rental_end_date:null,service_address:null,fulfillment_type:"pickup"});
  const rows=Object.fromEntries(result.blocks.find(b=>b.kind==="financials").rows);
  assert.equal(rows["Recorded deposit"],"$0.00");assert.equal(rows["Recorded total"],"$0.00");
  for(const key of ["effective_at","rental_start_date","rental_end_date","delivery_location","delivery_date","legal_address"])
    assert.ok(result.population.blockers.some(b=>b.key===key));
});

test("unverified snapshots are refused and prohibited provider properties are never mapped",()=>{
  assert.throws(()=>populateReview(source,{...sampleAgreement,snapshot_availability:{status:"missing"}}),/verified persisted/);
  const prohibited="4"+"1".repeat(15);
  const result=populateReview(source,{...sampleAgreement,card_number:prohibited,cvv:"987",
    items:sampleAgreement.items.map(i=>({...i,notes:`Stored note ${prohibited} CVV: 987`}))});
  const text=renderText(result);
  assert.ok(!text.includes(prohibited));assert.ok(!text.includes("CVV: 987"));
  assert.match(text,/REDACTED/);
});
