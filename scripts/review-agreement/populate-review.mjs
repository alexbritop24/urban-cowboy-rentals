// Pure presentation mapping. The caller supplies a persisted Agreement snapshot.
// Never reads a catalog/profile/provider, changes a snapshot, or records consent.
import {
  urbanCowboyDocumentBrand as brand,
  formatDocumentCurrency as money,
  formatDocumentDate as date,
  formatDocumentDateTime as dateTime,
} from "../../src/utils/documentPresentation.ts";
import { sanitizeInvoicePdfText as safe } from "../../src/components/agreement/pdf/sanitizeInvoicePdfText.ts";

export function populateReview(source, agreement, { sample = false } = {}) {
  if (agreement.snapshot_availability?.status !== "verified") {
    throw new Error("Population requires a verified persisted Agreement snapshot; no current-data fallback is allowed.");
  }
  const fixture = structuredClone(source);
  const blockers = new Map();
  const unresolved = (key, meaning) => {
    blockers.set(key, meaning);
    return `[UNRESOLVED: ${meaning}]`;
  };
  const text = value => typeof value === "string" && value.trim() ? safe(value.trim()) : null;
  const required = (key, value, meaning) => text(value) || unresolved(key, meaning);
  const validDate = value => typeof value === "string" && value && !Number.isNaN(new Date(value).getTime());
  const dateValue = (key, value, meaning) => validDate(value) ? date(value) : unresolved(key, meaning);
  const amount = (key, value) => typeof value === "number" && Number.isFinite(value) && value >= 0
    ? money(value) : unresolved(key, `recorded ${key} is missing`);
  const name = required("customer_name", agreement.customer_name, "lessee name not recorded");
  const number = required("agreement_number", agreement.agreement_number, "Agreement number not recorded");
  const effective = dateValue("effective_at", agreement.effective_at, "Agreement effective date not recorded");
  const start = dateValue("rental_start_date", agreement.rental_start_date, "rental commencement date not recorded");
  const end = dateValue("rental_end_date", agreement.rental_end_date, "rental expiration date not recorded");
  const hasAcceptance = agreement.acceptance_acknowledged === true &&
    ["accepted", "signed"].includes(agreement.signature_status);
  const acceptanceDate = hasAcceptance && validDate(agreement.signed_at)
    ? dateTime(agreement.signed_at) : unresolved("acceptance_date", "acceptance timestamp not recorded");
  const signer = text(agreement.authorized_signer_name);
  const signerTitle = text(agreement.authorized_signer_title);
  const cardAcknowledged = agreement.credit_card_authorization_acknowledged === true;
  const cardTime = cardAcknowledged && validDate(agreement.credit_card_authorization_acknowledged_at)
    ? dateTime(agreement.credit_card_authorization_acknowledged_at) : "Not recorded";
  const items = [...(agreement.items || [])].sort((a,b)=>a.displayOrder-b.displayOrder || a.id.localeCompare(b.id));
  if (!items.length) unresolved("items", "persisted equipment items not recorded");

  const details = {
    kind:"details", title:"Persisted Lessee and Rental Details", sourcePages:[],
    rows:[
      ["Agreement",number],["Effective date",effective],["Lessee type",text(agreement.customer_type)||"Not recorded"],
      ["Lessee legal name",name],
      ...(agreement.customer_type==="business" ? [["Business name",required("business_name",agreement.business_name,"Business name not recorded")]] : []),
      ["Email",required("customer_email",agreement.customer_email,"customer email not recorded")],
      ["Phone",required("customer_phone",agreement.customer_phone,"customer phone not recorded")],
      ["Agreement billing address",text(agreement.billing_address)||"Not recorded"],
      ["Service / delivery address",text(agreement.service_address)||"Not recorded"],
      ["Fulfillment",text(agreement.fulfillment_type)||"Not recorded"],
      ["Stored rental summary",`${start} - ${end}`],
    ],
  };
  const itemRows = items.map(item=>[
    required(`item_${item.id}_name`,item.equipmentName,"equipment name not recorded"),
    text(item.serialNumber)||unresolved(`item_${item.id}_serial`,"unit serial/VIN not recorded"),
    `${dateValue(`item_${item.id}_start`,item.startDate,"item start not recorded")} - ${dateValue(`item_${item.id}_end`,item.endDate,"item end not recorded")}`,
    Number.isInteger(item.quantity)&&item.quantity>0?String(item.quantity):unresolved(`item_${item.id}_quantity`,"item quantity not recorded"),
    amount("daily rate",item.dailyRate),Number.isInteger(item.billableDays)&&item.billableDays>0?String(item.billableDays):unresolved(`item_${item.id}_days`,"billable days not recorded"),amount("line amount",item.lineTotal),
  ]);
  const equipment = { kind:"transactionItems", title:"Recorded Transaction Equipment Schedule",rows:itemRows,
    notes:items.flatMap(item=>text(item.notes)?[`${text(item.equipmentName)}: ${text(item.notes)}`]:[]),sourcePages:[] };
  const financials = { kind:"financials",title:"Recorded Agreement Charges", sourcePages:[],rows:[
    ["Rental subtotal",amount("subtotal",agreement.quote_amount)],
    ["Recorded deposit",amount("deposit",agreement.deposit_amount)],
    ["Delivery",amount("delivery charge",agreement.delivery_fee)],
    ["Sales tax",amount("tax",agreement.tax_amount)],
    ["Recorded total",amount("total",agreement.total_amount)],
  ]};
  const evidence = {kind:"details",title:"Stored Acceptance and Authorization Evidence",sourcePages:[],rows:[
    ["Recorded signer",signer||"Not recorded"],["Recorded title",signerTitle||"Not recorded / not applicable"],
    ["Stored Agreement acceptance",hasAcceptance?"Recorded":"Not recorded"],
    ["Recorded acceptance timestamp",acceptanceDate],
    ["Staff attribution (not lessor execution)",text(agreement.signed_by)||"Not recorded"],
    ["Accepted stored terms reference",text(agreement.accepted_terms_version)||"Not recorded"],
    ["Accepted stored material reference",text(agreement.accepted_snapshot_hash)||"Not recorded"],
    ["Card acknowledgment of stored terms",cardAcknowledged?"Recorded":"Not recorded"],
    ["Recorded card acknowledgment timestamp",cardTime],
  ]};

  let party=null;
  let section=null;
  const populated=[];
  const optionalOmissions=[];
  for (const original of fixture.blocks) {
    const block={...original};
    if(block.kind==="section") section=block.title;
    if(block.text==="LESSOR:")party="lessor";
    if(block.text==="LESSEE:")party="lessee";
    if(block.kind==="section")party=null;
    if(block.text) {
      block.text=block.text.replaceAll("URBAN COWBOY RENTALS, LLC",brand.legalName.toUpperCase())
        .replaceAll("Urban Cowboy Rentals, LLC",brand.legalName)
        .replaceAll("1032 E 1700 S, Salt Lake City, Utah 84105",`${brand.streetAddress}, ${brand.locality}`)
        .replaceAll("801-903-9380",brand.phone);
      block.text=block.text.replaceAll("[LESSEE NAME]",name).replaceAll("[LESSEE PHONE NUMBER]",text(agreement.customer_phone)||unresolved("phone","customer phone not recorded"));
      if(block.text.startsWith("This Equipment Lease Agreement")) {
        block.text=block.text.replace("[DATE]",effective)
          .replace("[STATE OF ORGANIZATION]",unresolved("organization_state","state of organization not recorded; source UTAH designation also requires review"))
          .replace("[ENTITY TYPE]",unresolved("entity_type","entity type not recorded"))
          .replace("[its principal place of business/an address]",unresolved("address_alternative","approve principal-business / individual-address wording"))
          .replace("[LESSEE BUSINESS ADDRESS]",unresolved("legal_address","business/principal address not established by Agreement billing address"));
      }
      if(block.text.startsWith("2. Delivery Location.")) block.text=block.text.replace("[LOCATION]",
        agreement.fulfillment_type==="delivery" && text(agreement.service_address) ? text(agreement.service_address)
          : unresolved("delivery_location","delivery/pickup location not established by recorded fulfillment"));
      if(block.text.startsWith("3. Delivery Date."))block.text=block.text.replace("[DATE]",unresolved("delivery_date","distinct delivery date not recorded"));
      if(block.text.startsWith("8. Commencement Date."))block.text=block.text.replace("[DATE]",start);
      if(block.text.startsWith("9. Expiration Date."))block.text=block.text.replace("[DATE]",end);
      if(block.text.startsWith("14.1 "))block.text=block.text.replace("ENTITY TYPE]",unresolved("entity_type","entity type not recorded"));
      if(party==="lessor" && block.text.startsWith("By:"))block.text=`By: ${unresolved("lessor_execution","lessor execution/signature not recorded")}`;
      if(party==="lessor" && block.text==="Date: [DATE]")block.text=`Date: ${unresolved("lessor_date","lessor execution date not recorded")}`;
      if(party==="lessee") {
        if(block.text==="[NAME]")block.text=name;
        if(block.text.startsWith("By:"))block.text=`By: ${unresolved("proposed_execution","execution/acceptance of these proposed terms not recorded")}`;
        if(block.text==="Name:")block.text=`Name: ${signer||unresolved("signer","authorized signer name not recorded")}`;
        if(block.text==="Title:") {
          if(signerTitle)block.text=`Title: ${signerTitle}`;
          else if(agreement.customer_type==="individual") { optionalOmissions.push("Individual lessee Title field: no applicable recorded title.");continue; }
          else block.text=`Title: ${unresolved("signer_title","Business signer title not recorded")}`;
        }
        if(block.text==="Date: [DATE]")block.text=`Date: ${acceptanceDate} (recorded acceptance of stored Agreement only; not execution of this review draft)`;
      }
      if(section==="SCHEDULE 1") {
        if(/^(Expiration Date:|Billing ZIP Code:|Billing Address:|City\/State\/Zip:)/.test(block.text)) {
          optionalOmissions.push(original.text);continue;
        }
        if(block.text.startsWith("Card Type:"))block.text=`Card Type: ${unresolved("provider_identification","provider card identification not recorded in Agreement")}`;
        if(block.text.startsWith("Cardholder Name:"))block.text=`Cardholder Name: ${unresolved("cardholder","cardholder identity not recorded; customer/signer is not automatically the cardholder")}`;
        if(block.text.startsWith("I, "))block.text=block.text.replace(/_{3,}/,unresolved("cardholder","cardholder identity not recorded; customer/signer is not automatically the cardholder"));
        if(block.text.startsWith("Cardholder Signature:"))block.text=`Cardholder Signature: ${unresolved("card_signature","separate cardholder signature not recorded")}`;
        if(block.text.startsWith("Printed Name:"))block.text=`Printed Name: ${unresolved("cardholder","cardholder identity not recorded; customer/signer is not automatically the cardholder")}`;
        if(block.text.startsWith("Date:"))block.text=`Date: ${unresolved("card_signature_date","separate cardholder signature date not recorded; acknowledgment is shown separately")}`;
      }
      if(section==="EXHIBIT D" && block.kind==="field") {
        if(block.text.startsWith("Equipment / Unit:"))block.text=`Equipment / Unit: ${items.map(i=>`${text(i.equipmentName)||"Not recorded"} (quantity ${i.quantity})`).join("; ")}`;
        else if(block.text.startsWith("Serial Number:"))block.text=`Serial Number: ${items.map(i=>`${text(i.equipmentName)||"Unit"}: ${text(i.serialNumber)||"Not recorded"}`).join("; ")} / Invoice No.: [UNRECORDED: invoice number not in Agreement snapshot]`;
        else block.text=block.text.replace(/_{3,}/g,"[UNRECORDED: operational evidence]");
      }
    }
    populated.push(block);
    if(party==="lessor" && block.text==="Title: General Manager") populated.push({kind:"notice",text:"Jason Lovato / General Manager are source-designated printed details only. No lessor execution is recorded.",sourcePages:[]});
    if(block.kind==="section" && section==="SCHEDULE 1") {
      populated.push({kind:"details",title:"Customer and Rental Context (not verified cardholder data)",sourcePages:[],rows:[...details.rows.filter(([label])=>["Agreement","Lessee legal name","Business name","Email","Phone","Agreement billing address","Stored rental summary"].includes(label)),
        ["Equipment",items.map(i=>`${text(i.equipmentName)||"Not recorded"} (quantity ${i.quantity})`).join("; ")],
        ["Recorded deposit",amount("deposit",agreement.deposit_amount)],["Recorded total",amount("total",agreement.total_amount)]]});
      populated.push(evidence);
      populated.push({kind:"notice",text:`Stored provider-safe authorization terms: ${text(agreement.credit_card_authorization_terms)||"Not recorded"}. This evidence belongs to the stored terms reference above, not the proposed Schedule 1 wording.`,sourcePages:[]});
    }
    if(block.kind==="section" && section==="EXHIBIT A") {
      populated.push(equipment);
      populated.push({kind:"notice",text:"Jason source equipment reference follows unchanged. Its list and serial discrepancies are not silently resolved or substituted for the recorded transaction schedule above.",sourcePages:[]});
    }
    if(block.kind==="section" && section==="EXHIBIT C") {
      populated.push(financials);
      populated.push({kind:"notice",text:"Jason source rates and suggested deposits follow unchanged for comparison. They are not substituted for the stored transaction amounts above. Rate, deposit, and precedence decisions remain unresolved.",sourcePages:[]});
    }
  }
  if(agreement.customer_type==="individual")unresolved("individual_wording","approve individual-renter alternatives for entity/business-only representations in preamble and Sections 14-16");
  fixture.blocks=[details,{kind:"notice",sourcePages:[],text:"Stored summary dates and each unit's own dates are displayed without recomputation. Source global-term/per-unit precedence remains a wording decision. Company/entity address representations and provider/cardholder fields are not inferred from contact data. All acceptance evidence below concerns stored terms only; no acceptance of this proposed draft is recorded."},
    ...(agreement.customer_type==="individual"?[{kind:"notice",sourcePages:[],text:"INDIVIDUAL RENTER: the source preamble and Sections 14-16 contain unresolved entity/business-only representations. They remain source wording for review and must not be treated as representations established for this individual."}]:[]),...populated];
  fixture.population={sample,agreementNumber:number,effectiveAt:agreement.effective_at,blockers:[...blockers].map(([key,decision])=>({key,decision})),optionalOmissions};
  return fixture;
}
