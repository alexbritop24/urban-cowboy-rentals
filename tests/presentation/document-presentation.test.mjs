import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";

import { renderToBuffer } from "@react-pdf/renderer";
import { parse } from "node-html-parser";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import {
  agreementEvidenceLimitation,
  formatDocumentCurrency,
  formatDocumentDate,
  formatDocumentDateTime,
  formatDocumentSerial,
  formatDocumentStatus,
  getAgreementEvidenceRows,
  getAgreementPrintReadiness,
  getInvoicePrintReadiness,
  urbanCowboyDocumentBrand,
} from "../../src/utils/documentPresentation.ts";
import {
  agreementFixture,
  invoiceFixture,
  invoicePayments,
  unverifiedAgreementFixture,
} from "./document-fixtures.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const source = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
const noop = () => {};

let vite;
let AgreementDocumentActions;
let AgreementPdfDocument;
let DocumentBrandHeader;
let DocumentPrintBoundary;
let InvoiceDocumentActions;
let InvoicePdfDocument;
let PaymentHistoryContent;

before(async () => {
  vite = await createServer({
    root: repository,
    configFile: false,
    cacheDir: "/tmp/ucr-document-presentation-vite-cache",
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [
      {
        name: "local-document-image",
        enforce: "pre",
        resolveId(id, importer) {
          if (!importer || !/\.(?:jpe?g|png)$/.test(id)) return null;
          return `\0local-document-image:${path.resolve(
            path.dirname(
              importer.startsWith("file:") ? fileURLToPath(importer) : importer
            ),
            id
          )}`;
        },
        load(id) {
          const prefix = "\0local-document-image:";
          if (!id.startsWith(prefix)) return null;
          return `export default ${JSON.stringify(id.slice(prefix.length))};`;
        },
      },
    ],
  });

  [
    { default: AgreementDocumentActions },
    { default: AgreementPdfDocument },
    { default: DocumentBrandHeader },
    { default: DocumentPrintBoundary },
    { default: InvoiceDocumentActions },
    { default: InvoicePdfDocument },
    { default: PaymentHistoryContent },
  ] = await Promise.all([
    vite.ssrLoadModule(
      "/src/components/agreement/AgreementDocumentActions.tsx"
    ),
    vite.ssrLoadModule(
      "/src/components/agreement/pdf/AgreementPdfDocument.tsx"
    ),
    vite.ssrLoadModule("/src/components/document/DocumentBrandHeader.tsx"),
    vite.ssrLoadModule("/src/components/document/DocumentPrintBoundary.tsx"),
    vite.ssrLoadModule("/src/components/invoice/InvoiceDocumentActions.tsx"),
    vite.ssrLoadModule(
      "/src/components/agreement/pdf/InvoicePdfDocument.tsx"
    ),
    vite.ssrLoadModule("/src/components/invoice/PaymentHistoryContent.tsx"),
  ]);
});

after(async () => {
  await vite?.close();
});

const renderHtml = (component, props, children) =>
  parse(
    renderToStaticMarkup(
      React.createElement(component, props, children)
    )
  );

const buttonWithText = (root, label) => {
  const button = root
    .querySelectorAll("button")
    .find((candidate) => candidate.text.trim() === label);
  assert.ok(button, `Expected rendered button: ${label}`);
  return button;
};

const inspectPdf = async (buffer) => {
  const bytes = new Uint8Array(buffer);
  const raw = Buffer.from(bytes).toString("latin1");
  const loadingTask = getDocument({ data: bytes, useSystemFonts: true });
  const document = await loadingTask.promise;

  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return {
      pageCount: document.numPages,
      text: pages.join("\n"),
      metadata: (await document.getMetadata()).info,
      raw,
    };
  } finally {
    await loadingTask.destroy();
  }
};

const assertNoSensitiveCardData = (text) => {
  assert.doesNotMatch(text, /\b(?:PAN|card number|expiration date|expiry|CVV)\s*:/i);
  const numericCandidates = text.match(/\b[\d -]{13,25}\b/g) ?? [];
  const luhnValid = numericCandidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let double = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (double) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      double = !double;
    }
    return sum % 10 === 0;
  });
  assert.equal(luhnValid, false, "No card-number-shaped Luhn value may render");
};

test("shared document presentation preserves authoritative labels and deterministic values", () => {
  assert.deepEqual(urbanCowboyDocumentBrand, {
    legalName: "Urban Cowboy Rentals LLC",
    streetAddress: "1032 E 1700 S",
    locality: "Salt Lake City, Utah 84105",
    phone: "801-903-9380",
    email: "urbancowboyrentals@gmail.com",
  });
  assert.equal(formatDocumentStatus("partially_paid"), "Partially Paid");
  assert.equal(formatDocumentDate("2028-06-10"), "Jun 10, 2028");
  assert.equal(formatDocumentDate(null, "Not issued"), "Not issued");
  assert.equal(
    formatDocumentDateTime("2028-06-01T16:15:30.000Z"),
    "Jun 1, 2028, 10:15 AM MDT"
  );
  assert.equal(formatDocumentDateTime(null), "Not recorded");
  assert.equal(formatDocumentCurrency(120, "USD"), "$120.00");
  assert.equal(formatDocumentSerial("WNCRD12AEPUM06214"), "WNCRD1 2AEPUM 06214");
});

test("Agreement print controls render the verified snapshot boundary", () => {
  const commonProps = {
    documentPrerequisitesSatisfied: true,
    isCreatingInvoice: false,
    isFinalizing: false,
    isGeneratingPdf: false,
    isSaving: false,
    isSavingAcceptance: false,
    notice: "",
    onCreateInvoice: noop,
    onDownloadPdf: noop,
    onFinalize: noop,
    onPrint: noop,
  };

  const unverified = renderHtml(AgreementDocumentActions, {
    ...commonProps,
    agreement: unverifiedAgreementFixture,
  });
  assert.equal(buttonWithText(unverified, "Print Agreement").hasAttribute("disabled"), true);
  assert.equal(
    buttonWithText(unverified, "Download Agreement PDF").hasAttribute("disabled"),
    true
  );
  assert.match(unverified.text, /lacks a verified immutable Release 1 snapshot/);

  const verified = renderHtml(AgreementDocumentActions, {
    ...commonProps,
    agreement: agreementFixture,
  });
  assert.equal(buttonWithText(verified, "Print Agreement").hasAttribute("disabled"), false);
  assert.equal(
    buttonWithText(verified, "Download Agreement PDF").hasAttribute("disabled"),
    false
  );
});

test("historical Agreement boundary renders a print-only warning around the suppressed legal region", async () => {
  const readiness = getAgreementPrintReadiness(
    unverifiedAgreementFixture.snapshot_availability
  );
  const root = renderHtml(
    DocumentPrintBoundary,
    {
      className: "document-route",
      documentType: "Agreement",
      readiness,
    },
    React.createElement(
      "article",
      { className: "document-page" },
      "Historical Agreement screen record"
    )
  );

  const boundary = root.querySelector("[data-print-ready=false]");
  assert.ok(boundary?.classList.contains("document-print-unverified"));
  assert.ok(boundary.querySelector("article.document-page"));
  const warning = boundary.querySelector(
    ".document-print-only.document-historical-print-warning"
  );
  assert.ok(warning);
  assert.match(warning.text, /not an authoritative printable Agreement/);

  const printCss = await source("src/index.css");
  assert.match(
    printCss,
    /\.document-print-unverified \.document-page,[\s\S]*?display:\s*none\s*!important/
  );
  assert.match(
    printCss,
    /@media print[\s\S]*?\.document-print-only\s*\{[\s\S]*?display:\s*block\s*!important/
  );
});

test("Invoice print controls render loading, failure, empty-ready, and populated-ready states", () => {
  const renderState = (paymentHistoryState) =>
    renderHtml(InvoiceDocumentActions, {
      invoice: invoiceFixture,
      isIssuing: false,
      notice: "",
      onDownloadPdf: noop,
      onIssue: noop,
      onPrint: noop,
      paymentHistoryState,
    });

  const loading = renderState({ status: "loading", paymentCount: 0 });
  assert.equal(buttonWithText(loading, "Print Invoice").hasAttribute("disabled"), true);
  assert.match(loading.text, /payment history is loading/);

  const failed = renderState({
    status: "error",
    paymentCount: 0,
    message: "Could not load payment history.",
  });
  assert.equal(buttonWithText(failed, "Print Invoice").hasAttribute("disabled"), true);
  assert.match(failed.text, /payment history could not be loaded/);

  const emptyReady = renderState({ status: "ready", paymentCount: 0 });
  assert.equal(
    buttonWithText(emptyReady, "Print Invoice").hasAttribute("disabled"),
    false
  );
  assert.match(emptyReady.text, /No payments are recorded/);
  assert.doesNotMatch(emptyReady.text, /Loading payments/i);

  const populatedReady = renderState({ status: "ready", paymentCount: 2 });
  assert.equal(
    buttonWithText(populatedReady, "Print Invoice").hasAttribute("disabled"),
    false
  );
  assert.match(populatedReady.text, /loaded with 2 payments/);
  assert.doesNotMatch(populatedReady.text, /Loading payments/i);

  const renderedEmptyHistory = renderHtml(PaymentHistoryContent, {
    payments: [],
    state: { status: "ready", paymentCount: 0 },
  });
  assert.match(renderedEmptyHistory.text, /No payments have been recorded/);
  assert.doesNotMatch(renderedEmptyHistory.text, /Loading payments/i);

  const renderedPaymentHistory = renderHtml(PaymentHistoryContent, {
    payments: invoicePayments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      payment_method: payment.paymentMethod,
      reference_number: payment.referenceNumber,
      notes: payment.notes,
      received_at: payment.receivedAt,
    })),
    state: { status: "ready", paymentCount: invoicePayments.length },
  });
  assert.match(renderedPaymentHistory.text, /SAFE-REF-001/);
  assert.match(renderedPaymentHistory.text, /Jun 3, 2028, 10:30 AM MDT/);
  assert.doesNotMatch(renderedPaymentHistory.text, /Loading payments/i);
});

test("DocumentBrandHeader renders valid labeled description-list semantics", () => {
  const root = renderHtml(DocumentBrandHeader, {
    documentType: "Invoice",
    documentNumber: invoiceFixture.invoice_number,
    status: invoiceFixture.status,
    dateLabel: "Issued",
    dateValue: invoiceFixture.issued_at,
  });
  const list = root.querySelector("dl");
  assert.ok(list);

  const directElements = list.childNodes.filter((node) => node.tagName);
  assert.ok(directElements.length > 0);
  for (const element of directElements) {
    assert.equal(element.tagName, "DIV");
    assert.equal(element.querySelectorAll("dt").length, 1);
    assert.equal(element.querySelectorAll("dd").length, 1);
  }
  assert.equal(directElements.some((element) => element.tagName === "SPAN"), false);

  const statusTerm = list
    .querySelectorAll("dt")
    .find((term) => term.text.trim() === "Status");
  assert.ok(statusTerm);
  assert.equal(statusTerm.parentNode.querySelector("dd").text.trim(), "Partially Paid");
  assert.match(root.text, /Invoice/);
  assert.match(root.text, /INV-2028-000037/);
});

test("Agreement PDF renders exact persisted evidence and supported metadata", async () => {
  const buffer = await renderToBuffer(
    React.createElement(AgreementPdfDocument, { agreement: agreementFixture })
  );
  const pdf = await inspectPdf(buffer);

  assert.match(pdf.text, /UCR-2028-000042/);
  assert.match(pdf.text, /Signature status\s+Accepted/);
  assert.match(pdf.text, /Jun 1, 2028, 10:15 AM MDT/);
  assert.match(pdf.text, /Card authorization\s+Acknowledged/);
  assert.match(pdf.text, /Jun 1, 2028, 10:16 AM MDT/);
  assert.match(pdf.text, /Initial availability status\s+Available/);
  assert.match(pdf.text, /Insurance verification status\s+Verified/);
  assert.match(pdf.text, /Final Agreement status\s+Finalized and locked/);
  assert.match(pdf.text, /Snapshot schema version\s+1/);
  assert.match(pdf.text, /Accepted snapshot matches current snapshot/);
  assertNoSensitiveCardData(pdf.text);

  assert.equal(pdf.metadata.Title, "Equipment Rental Agreement UCR-2028-000042");
  assert.equal(pdf.metadata.Author, "Urban Cowboy Rentals LLC");
  assert.equal(pdf.metadata.Subject, "Immutable equipment rental Agreement snapshot");
  assert.equal(pdf.metadata.Creator, "Urban Cowboy Rentals application");
  assert.match(pdf.raw, /\/Lang \(en-US\)/);
});

test("three-item Invoice PDF renders one complete snapshot-summary page", async () => {
  const buffer = await renderToBuffer(
    React.createElement(InvoicePdfDocument, {
      invoice: invoiceFixture,
    })
  );
  const pdf = await inspectPdf(buffer);

  assert.equal(pdf.pageCount, 1);
  for (const item of invoiceFixture.items) {
    assert.match(pdf.text, new RegExp(item.equipmentName));
  }
  assert.match(pdf.text, /Agreement Traceability/);
  assert.match(pdf.text, new RegExp(invoiceFixture.rental_agreement_id));
  assert.match(pdf.text, /Synthetic local render fixture/);
  assert.match(pdf.text, /Partially Paid/);
  assert.match(pdf.text, /PAYMENT STATUS\s+Partially Paid/);
  assert.match(pdf.text, /Rental subtotal\s+\$1,680\.00/);
  assert.match(pdf.text, /Total\s+\$2,522\.31/);
  assert.match(pdf.text, /Amount paid\s+\$1,000\.00/);
  assert.match(pdf.text, /Balance due\s+\$1,522\.31/);
  assert.doesNotMatch(pdf.text, /Payment History/i);
  assert.doesNotMatch(pdf.text, /SAFE-REF-001/);
  assertNoSensitiveCardData(pdf.text);

  assert.equal(pdf.metadata.Title, "Equipment Rental Invoice INV-2028-000037");
  assert.equal(pdf.metadata.Author, "Urban Cowboy Rentals LLC");
  assert.equal(pdf.metadata.Subject, "Immutable equipment rental Invoice snapshot");
  assert.equal(pdf.metadata.Creator, "Urban Cowboy Rentals application");
  assert.match(pdf.raw, /\/Lang \(en-US\)/);
});

test("helper evidence remains exact and counsel brief remains non-approved", async () => {
  const evidence = Object.fromEntries(
    getAgreementEvidenceRows(agreementFixture).map(({ label, value }) => [label, value])
  );
  assert.equal(evidence["Signature status"], "Accepted");
  assert.equal(evidence["Acceptance recorded"], "Jun 1, 2028, 10:15 AM MDT");
  assert.equal(evidence["Card authorization recorded"], "Jun 1, 2028, 10:16 AM MDT");
  assert.match(agreementEvidenceLimitation, /not embedded in the Agreement record/);
  assert.equal(
    getInvoicePrintReadiness({ status: "ready", paymentCount: 0 }).enabled,
    true
  );

  const brief = await source(
    "docs/urban-cowboy-rentals-agreement-counsel-review.md"
  );
  assert.match(brief, /COUNSEL REVIEW REQUIRED — NOT APPROVED FOR CUSTOMER USE/);
  assert.match(brief, /does not expose properly tagged-PDF output/);
  assert.match(brief, /semantic browser Agreement and Invoice HTML/);
  assert.doesNotMatch(brief, /\/Users\/alexbrito\/Downloads/);
  assert.doesNotMatch(brief, /attorney-approved/i);
});
