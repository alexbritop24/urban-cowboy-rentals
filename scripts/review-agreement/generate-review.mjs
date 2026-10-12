import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToBuffer, StyleSheet, Font } from "@react-pdf/renderer";
import { createServer } from "vite";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { populateReview } from "./populate-review.mjs";
import { sampleAgreement } from "./sample-snapshot.mjs";

const root=fileURLToPath(new URL("../../",import.meta.url));
Font.registerHyphenationCallback(word=>[word]);
const source=JSON.parse(await readFile(new URL("./jason-review.fixture.json",import.meta.url),"utf8"));
const populated=process.argv.includes("--populated");
const fixture=populated?populateReview(source,sampleAgreement,{sample:true}):source;
const name=populated?"urban-cowboy-jason-agreement-populated-review":"urban-cowboy-jason-agreement-review";
// Use the current Agreement styling verbatim without exporting or changing active code.
const production=await readFile(path.join(root,"src/components/agreement/pdf/AgreementPdfDocument.tsx"),"utf8");
const styleLiteral=production.match(/const styles = StyleSheet\.create\((\{[\s\S]*?\n\})\);/)[1];
const styles=Function("StyleSheet",`return StyleSheet.create(${styleLiteral});`)(StyleSheet);
const vite=await createServer({root,configFile:false,cacheDir:"/private/tmp/ucr-review-vite-cache",appType:"custom",logLevel:"error",server:{middlewareMode:true,hmr:false,ws:false},plugins:[{
  name:"review-local-image",enforce:"pre",
  resolveId(id,importer){ if(!importer||! /\.(?:jpe?g|png)$/.test(id))return null;return `\0review-image:${path.resolve(path.dirname(importer.startsWith("file:")?fileURLToPath(importer):importer),id)}`; },
  load(id){ const p="\0review-image:";if(id.startsWith(p))return `export default ${JSON.stringify(id.slice(p.length))};`; }
}]});
try {
  const {default:Review}=await vite.ssrLoadModule("/scripts/review-agreement/ReviewAgreementPdf.tsx");
  const buffer=await renderToBuffer(React.createElement(Review,{fixture,styles}));
  const output=path.join(root,"output/pdf");await mkdir(output,{recursive:true});
  await writeFile(path.join(output,`${name}.pdf`),buffer);
  await mkdir(path.join(root,"tmp/pdfs/jason-review"),{recursive:true});
  if(populated)await writeFile(path.join(root,"tmp/pdfs/jason-review/populated-fixture.json"),JSON.stringify(fixture,null,2)+"\n");
  const pdf=await getDocument({data:new Uint8Array(buffer),standardFontDataUrl:path.join(root,"node_modules/pdfjs-dist/standard_fonts/")}).promise;
  const pageTexts=[];
  for(let n=1;n<=pdf.numPages;n++) {
    const page=await pdf.getPage(n);const content=await page.getTextContent();
    pageTexts.push(content.items.map(i=>i.str).join(" "));
  }
  await writeFile(path.join(root,`tmp/pdfs/jason-review/${populated?"populated-":""}review-text.txt`),pageTexts.map((t,i)=>`REVIEW PAGE ${i+1}\n${t}`).join("\n\n"));
  await writeFile(path.join(root,`tmp/pdfs/jason-review/${populated?"populated-":""}render-metadata.json`),JSON.stringify({pageCount:pdf.numPages,sourcePageCount:fixture.sourcePages,sourceSha256:fixture.sourceSha256},null,2)+"\n");
  console.log(`Review PDF: ${pdf.numPages} pages. Active application code unchanged.`);
} finally { await vite.close(); }
