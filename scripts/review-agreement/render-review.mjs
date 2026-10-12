import {readFile,writeFile} from "node:fs/promises";
import {createCanvas} from "@napi-rs/canvas";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";
const populated=process.argv.includes("--populated");
const data=new Uint8Array(await readFile(`output/pdf/urban-cowboy-jason-agreement-${populated?"populated-":""}review.pdf`));
const pdf=await getDocument({data,standardFontDataUrl:path.resolve("node_modules/pdfjs-dist/standard_fonts")+"/",useSystemFonts:false}).promise;
for(let n=1;n<=pdf.numPages;n++){
  const page=await pdf.getPage(n);const viewport=page.getViewport({scale:1.5});
  const canvas=createCanvas(viewport.width,viewport.height);
  await page.render({canvasContext:canvas.getContext("2d"),canvas,viewport}).promise;
  await writeFile(`tmp/pdfs/jason-review/${populated?"populated-verified":"final-layout"}-page-${n}.png`,canvas.toBuffer("image/png"));
}
console.log(`Rendered ${pdf.numPages} review pages with PDF.js.`);
