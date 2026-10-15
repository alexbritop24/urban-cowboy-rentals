// Local, read-only source extraction. Never loads application services or active terms.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createHash } from "node:crypto";

const input = process.argv[2] || "/Users/alexbrito/Downloads/Rental Agreement for Alex to view.pdf";
const bytes = await readFile(input);
const pdf = await getDocument({ data: new Uint8Array(bytes), disableFontFace: true }).promise;
// The source embeds ligatures with incorrect Unicode mappings. Restore only glyphs,
// using the visible PDF as reference; do not repair its substantive wording.
const clean = s => s.replaceAll("М", "fl").replaceAll("Й", "fi").replaceAll("А", "ff").replaceAll("Г", "ffi");
const pages = [];
for (let n = 1; n <= pdf.numPages; n++) {
  const content = await (await pdf.getPage(n)).getTextContent();
  const rows = [];
  for (const item of content.items.filter(i => i.str?.trim())) {
    const y = item.transform[5];
    let row = rows.find(r => Math.abs(r.y - y) < 0.8);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x: item.transform[4], width: item.width, text: clean(item.str) });
  }
  rows.sort((a,b) => b.y - a.y);
  for (const row of rows) {
    row.items.sort((a,b) => a.x - b.x);
    row.text = row.items.map((i,k) => {
      if (!k) return i.text;
      const prev = row.items[k-1];
      const gap = i.x - prev.x - prev.width;
      return (gap > 0.9 && !/^\s/.test(i.text) && !/\s$/.test(prev.text) ? " " : "") + i.text;
    }).join("");
  }
  pages.push(rows);
}

const blocks = [];
const isHeading = s => /^(?:\d+\.(?:\d+[A-Z]?)?\s|SCHEDULE [12]$|EXHIBIT [A-D]$|Authorization$|Security Deposit Disclosure$|INCORPORATION AND PURPOSE$|CHECK-OUT CONDITION AND ACCEPTANCE$|RETURN \/ CHECK-IN ACKNOWLEDGMENT$|REPRESENTATIVE CERTIFICATION$)/.test(s);
const isField = s => /_{3,}|^LESSOR:$|^LESSEE:$|^By:$|^Name:|^Title:|^Date:|^Phone Number:|^\[NAME\]$|^Card Type:/.test(s);
function appendRows(rows, page, { fresh = false } = {}) {
  let previousY;
  let paragraph = fresh ? null : blocks.at(-1);
  for (const row of rows) {
    const field = isField(row.text);
    const heading = (isHeading(row.text) && !(row.text.startsWith("2. ") && paragraph?.text.endsWith("Schedule"))) || /^\([a-z]\)/.test(row.text);
    const gap = previousY === undefined ? 0 : previousY - row.y;
    if (!paragraph || paragraph.kind !== "paragraph" || heading || field || gap > 13.2) {
      paragraph = { kind: field ? "field" : "paragraph", text: row.text, sourcePages: [page] };
      blocks.push(paragraph);
    } else {
      paragraph.text += " " + row.text;
      if (!paragraph.sourcePages.includes(page)) paragraph.sourcePages.push(page);
    }
    previousY = row.y;
  }
}

// Replace repeated source identity/graphic chrome with the existing application chrome.
for (let n=1;n<=12;n++) {
  let rows = pages[n-1];
  if (n===1) rows = rows.slice(rows.findIndex(r=>r.text === "EQUIPMENT LEASE AGREEMENT")+1);
  appendRows(rows,n);
}

for (const n of [13,14]) {
  const rows = pages[n-1];
  blocks.push({kind:"section",title:rows[0].text,subtitle:rows[1].text,sourcePages:[n]});
  let body = rows.slice(n===13 ? 6 : 2);
  if(n===13) {
    body = body.filter(r=>!/^Card Number:|^CVV:/.test(r.text));
    blocks.push({kind:"notice",text:"Provider-safe replacement wording pending review.",sourcePages:[13]});
  }
  appendRows(body,n,{fresh:true});
  if(n===13) {
    // The field classifier treats this authorization paragraph as a field because
    // it begins with a blank name. Find its source paragraph across those blocks.
    const start = blocks.findIndex(b=>b.sourcePages?.includes(13) && b.text?.startsWith("I, "));
    const end = blocks.findIndex((b,i)=>i>start && b.text?.startsWith("Cardholder Signature:"));
    const text = blocks.slice(start,end).map(b=>b.text).join(" ");
    const omission = " and authorize Urban Cowboy Rentals, LLC to retain this authorization form and card information for future transactions related to my rental account.";
    if(!text.includes(omission)) throw new Error("Retention omission did not match source exactly.");
    blocks.splice(start,end-start,{kind:"paragraph",text:text.replace(omission,"."),sourcePages:[13]});
  }
}

for(const n of [15,16,17]) {
  const rows=pages[n-1];
  blocks.push({kind:"section",title:rows[0].text,subtitle:rows[1].text,sourcePages:[n]});
  const columns=n===15?[60.4,308.8]:n===16?[74.8,276.4,398.8]:[60.4,159.7,259.1,358.4,457.8];
  const tableItems=rows.slice(2).flatMap(r=>r.items.map(i=>({...i,y:r.y}))).filter(i=>n!==17||i.y>480);
  const rowCenters=tableItems.filter(i=>Math.abs(i.x-columns[1])<2).map(i=>i.y).sort((a,b)=>b-a);
  if(n===15) rowCenters.push(...rows.filter(r=>r.y<590).map(r=>r.y).filter(y=>!rowCenters.some(c=>Math.abs(c-y)<1)));
  const tableRows=rowCenters.map(y=>columns.map((x,c)=>tableItems.filter(i=>Math.abs(i.x-x)<2 && Math.abs(i.y-y)<(n===17?6:1)).sort((a,b)=>b.y-a.y).map(i=>i.text).join(" ")));
  // Exhibit C's final header cell uses two source lines around the row center.
  if(n===17) tableRows[0][4]="Suggested Security Deposit";
  blocks.push({kind:"table",rows:tableRows,widths:n===15?[50,50]:n===16?[44,26,30]:[36,14,16,16,18],sourcePages:[n]});
  if(n===17) appendRows(rows.filter(r=>r.y<480),n,{fresh:true});
}
blocks.push({kind:"section",title:pages[17][0].text,subtitle:pages[17][1].text,sourcePages:[18]});
appendRows(pages[17].slice(2),18,{fresh:true});

const fixture = { sourceName:input.split("/").at(-1),sourceSha256:createHash("sha256").update(bytes).digest("hex"),sourcePages:pdf.numPages,blocks };
await mkdir("scripts/review-agreement",{recursive:true});
await writeFile("scripts/review-agreement/jason-review.fixture.json",JSON.stringify(fixture,null,2)+"\n");
await mkdir("tmp/pdfs/jason-review",{recursive:true});
await writeFile("tmp/pdfs/jason-review/source-transcription.txt",pages.map((rows,i)=>`SOURCE PAGE ${i+1}\n${rows.map(r=>r.text).join("\n")}`).join("\n\n"));
console.log(`Extracted ${pdf.numPages} source pages into ${blocks.length} review blocks.`);
