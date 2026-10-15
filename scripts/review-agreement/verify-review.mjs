// Focused artifact verification only; does not run the application test suite.
import { readFile, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";
const clean=process.argv.includes("--clean");
const populated=process.argv.includes("--populated");
const fixture=JSON.parse(await readFile(populated?"tmp/pdfs/jason-review/populated-fixture.json":"scripts/review-agreement/jason-review.fixture.json","utf8"));
const bytes=await readFile(`output/pdf/urban-cowboy-jason-agreement-${clean?"clean-":populated?"populated-":""}review.pdf`);
const pdf=await getDocument({data:new Uint8Array(bytes),standardFontDataUrl:path.resolve("node_modules/pdfjs-dist/standard_fonts")+"/"}).promise;
const body=[];const pages=[];
for(let n=1;n<=pdf.numPages;n++) {
  const content=await(await pdf.getPage(n)).getTextContent();
  const text=content.items.map(i=>i.str).join(" ");
  body.push(content.items.filter(i=>i.transform[5]>44&&i.transform[5]<770).map(i=>i.str).join(" "));
  pages.push({page:n,reviewMarker:text.includes("REVIEW DRAFT"),sampleMarker:!populated||text.includes("SAMPLE DATA"),footer:text.includes(`Agreement ${fixture.population?.agreementNumber||"REVIEW-JASON"}`),firstBodyY:Math.max(...content.items.filter(i=>i.transform[5]<770&&i.transform[5]>44).map(i=>i.transform[5]))});
}
const normalize=s=>s.replaceAll("☐","[ ]").replace(/\s/g,"").toLowerCase();
const combined=normalize(body.join(" "));
const missing=fixture.blocks.flatMap((block,index)=>{
  const strings=["table","details","transactionItems","financials"].includes(block.kind)
    ? [...block.rows.flat(),...(block.notes||[]).map(s=>`Stored item note: ${s}`)]
    :[block.text||[block.title,block.subtitle].join(" ")];
  return strings.filter(s=>!combined.includes(normalize(s))).map(text=>({index,text}));
});
const result={pageCount:pdf.numPages,pages,missingFixtureContent:missing,forbiddenSchedule1Fields:body.join(" ").match(/Card Number:|CVV:|LLC to retain this authorization form and card information/g)||[]};
await writeFile(`tmp/pdfs/jason-review/${clean?"clean-":populated?"populated-":""}content-verification.json`,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
if(missing.length||result.forbiddenSchedule1Fields.length||pages.some(p=>!p.reviewMarker||!p.footer||!p.sampleMarker))process.exitCode=1;
