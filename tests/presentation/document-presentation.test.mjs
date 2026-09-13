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
  urbanCowboyDocumentBrand,
} from "../../src/utils/documentPresentation.ts";
import {
  agreementFixture,
  invoiceFixture,
  invoicePayments,
  legacyInvoiceFixture,
  sensitiveInvoiceFixture,
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
let createInvoicePdfBlob;
let downloadInvoicePdf;
let generateInvoicePdf;
let invoicePdfBrowserDependencies;
let invoicePdfFallbackRevokeDelayMs;
let invoicePdfObjectUrlRevokeDelayMs;
let invoicePdfPopupClosePollDelayMs;
let printInvoicePdf;
let safeInvoicePdfFilename;
let invoicePdfGenericPrintErrorMessage;
let invoicePdfPopupBlockedMessage;
let invoicePdfWindowClosedMessage;
let openInvoicePdfPrintDestination;
let startInvoicePdfPrint;
let invoicePdfRedactionLabel;
let sanitizeInvoicePdfText;

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
    {
      createInvoicePdfBlob,
      downloadInvoicePdf,
      generateInvoicePdf,
      invoicePdfBrowserDependencies,
      invoicePdfFallbackRevokeDelayMs,
      invoicePdfObjectUrlRevokeDelayMs,
      invoicePdfPopupClosePollDelayMs,
      printInvoicePdf,
      safeInvoicePdfFilename,
    },
    {
      invoicePdfGenericPrintErrorMessage,
      invoicePdfPopupBlockedMessage,
      invoicePdfWindowClosedMessage,
      openInvoicePdfPrintDestination,
      startInvoicePdfPrint,
    },
    { invoicePdfRedactionLabel, sanitizeInvoicePdfText },
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
    vite.ssrLoadModule("/src/utils/generateInvoicePdf.tsx"),
    vite.ssrLoadModule("/src/utils/invoicePdfWindow.ts"),
    vite.ssrLoadModule(
      "/src/components/agreement/pdf/sanitizeInvoicePdfText.ts"
    ),
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
    const pageSizes = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      pages.push(content.items.map((item) => item.str).join(" "));
      pageSizes.push({ height: viewport.height, width: viewport.width });
    }
    return {
      pageCount: document.numPages,
      pageSizes,
      text: pages.join("\n"),
      metadata: (await document.getMetadata()).info,
      raw,
    };
  } finally {
    await loadingTask.destroy();
  }
};

const assertNoSensitiveCardData = (text) => {
  assert.doesNotMatch(
    text,
    /\b(?:CVV2?|CVC2?|security[ -]?code)\b[ \t]*(?:(?::|=)|(?:is|was)|(?:value(?:[ \t]+is)?))?[ \t]*\d{3,4}\b/i
  );
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

const createPrintDestination = ({
  addEventListener,
  removeEventListener,
  replace,
} = {}) => {
  const listeners = new Map();
  const navigation = [];
  const state = { closeCalls: 0 };
  const destination = {
    closed: false,
    document: { title: "", body: { textContent: "" } },
    location: {
      replace(url) {
        navigation.push(url);
        replace?.(url, destination, listeners);
      },
    },
    addEventListener(type, listener, options) {
      if (addEventListener) {
        addEventListener(type, listener, options, destination, listeners);
        return;
      }
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (removeEventListener) {
        removeEventListener(type, listener, destination, listeners);
        return;
      }
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    close() {
      state.closeCalls += 1;
      this.closed = true;
    },
  };

  return { destination, listeners, navigation, state };
};

const createPdfBrowserHarness = (overrides = {}) => {
  const blob = new Blob(["canonical invoice PDF"], {
    type: "application/pdf",
  });
  const renderedInvoices = [];
  const revokedUrls = [];
  const scheduled = [];
  const cleanupErrors = [];
  const links = [];
  let urlSequence = 0;

  const dependencies = {
    renderPdf: async (invoice) => {
      renderedInvoices.push(invoice);
      return blob;
    },
    createObjectUrl: () => `blob:invoice-${++urlSequence}`,
    revokeObjectUrl: (url) => revokedUrls.push(url),
    schedule: (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
      return scheduled.length;
    },
    createDownloadLink: () => {
      const link = {
        href: "",
        download: "",
        clicked: false,
        removed: false,
        click() {
          this.clicked = true;
        },
        remove() {
          this.removed = true;
        },
      };
      links.push(link);
      return link;
    },
    reportCleanupError: (error) => cleanupErrors.push(error),
    ...overrides,
  };

  return {
    blob,
    cleanupErrors,
    dependencies,
    links,
    renderedInvoices,
    revokedUrls,
    scheduled,
  };
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

test("Invoice PDF text sanitizer redacts plausible PANs and labeled security codes only", () => {
  const adversarial =
    "Visa 4111111111111111; spaced Visa 4012 8888 8888 1881; Mastercard 5555-5555-5555-4444; Amex 3782 822463 10005; CVV: 123; CVC=999; security-code value is 1234.";
  const sanitized = sanitizeInvoicePdfText(adversarial);

  for (const sensitiveValue of [
    "4111111111111111",
    "4012 8888 8888 1881",
    "5555-5555-5555-4444",
    "3782 822463 10005",
    "CVV: 123",
    "CVC=999",
    "security-code value is 1234",
  ]) {
    assert.doesNotMatch(sanitized, new RegExp(sensitiveValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(
    sanitized.split(invoicePdfRedactionLabel).length - 1,
    7
  );
  assert.match(sanitized, /CVV: \[REDACTED\]/);
  assert.match(sanitized, /CVC=\[REDACTED\]/);
  assert.match(sanitized, /security-code value is \[REDACTED\]/);

  const benign =
    "Order ID 1234567890123; phone 801-903-9380; date 2028-06-10; amount $149.95; Agreement 574aef93-27a9-48e9-b34d-9def16ebc1d4; request 39fb00aa-3b06-4ce4-bb83-f86e713c5137.";
  assert.equal(sanitizeInvoicePdfText(benign), benign);
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

test("Invoice PDF actions stay available independently of browser payment-history state", async () => {
  const actions = renderHtml(InvoiceDocumentActions, {
    invoice: invoiceFixture,
    isIssuing: false,
    notice: "",
    onDownloadPdf: noop,
    onIssue: noop,
    onPrint: noop,
  });

  assert.equal(
    buttonWithText(actions, "Download Invoice PDF").hasAttribute("disabled"),
    false
  );
  assert.equal(
    buttonWithText(actions, "Print Invoice").hasAttribute("disabled"),
    false
  );
  assert.match(actions.text, /same official Invoice PDF snapshot/);
  assert.match(actions.text, /Payment history remains available on this page/);

  const loadingHistory = renderHtml(PaymentHistoryContent, {
    payments: [],
    state: { status: "loading", paymentCount: 0 },
  });
  assert.match(loadingHistory.text, /Loading payments/);

  const failedHistory = renderHtml(PaymentHistoryContent, {
    payments: [],
    state: {
      status: "error",
      paymentCount: 0,
      message: "Could not load payment history.",
    },
  });
  assert.match(failedHistory.text, /Could not load payment history/);

  const emptyHistory = renderHtml(PaymentHistoryContent, {
    payments: [],
    state: { status: "ready", paymentCount: 0 },
  });
  assert.match(emptyHistory.text, /No payments have been recorded/);
  assert.doesNotMatch(emptyHistory.text, /Loading payments/i);

  const populatedHistory = renderHtml(PaymentHistoryContent, {
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
  assert.match(populatedHistory.text, /SAFE-REF-001/);
  assert.match(populatedHistory.text, /Jun 3, 2028, 10:30 AM MDT/);
  assert.doesNotMatch(populatedHistory.text, /Loading payments/i);

  const invoicePageSource = await source("src/pages/InvoicePage.tsx");
  assert.doesNotMatch(invoicePageSource, /window\.print\s*\(/);
  assert.doesNotMatch(invoicePageSource, /getInvoicePrintReadiness/);
  assert.doesNotMatch(invoicePageSource, /paymentHistoryState/);
  assert.match(invoicePageSource, /startInvoicePdfPrint\(invoice/);
});

test("Invoice print prepares its popup before loading or rendering the PDF", async () => {
  const order = [];
  const { destination } = createPrintDestination();

  const operation = startInvoicePdfPrint(invoiceFixture, {
    openDestination: () => {
      order.push("popup");
      return openInvoicePdfPrintDestination(() => destination);
    },
    loadPrintModule: () => {
      order.push("dynamic import");
      return Promise.resolve({
        printInvoicePdf: async (_invoice, preparedDestination) => {
          order.push("render");
          assert.strictEqual(preparedDestination, destination);
          assert.equal(destination.document.title, "Preparing Invoice PDF");
          assert.match(
            destination.document.body.textContent,
            /Preparing the official Invoice PDF/
          );
        },
      });
    },
  });

  assert.deepEqual(order, ["popup", "dynamic import"]);
  await operation;
  assert.deepEqual(order, ["popup", "dynamic import", "render"]);
});

test("Invoice print closes its prepared popup after render and dynamic-import rejection", async () => {
  for (const failurePoint of ["render", "dynamic import"]) {
    const { destination, state } = createPrintDestination();
    const messages = [];
    const technicalError = new Error(failurePoint + " technical detail");

    await startInvoicePdfPrint(invoiceFixture, {
      openDestination: () => destination,
      loadPrintModule: () =>
        failurePoint === "dynamic import"
          ? Promise.reject(technicalError)
          : Promise.resolve({
              printInvoicePdf: async () => {
                throw technicalError;
              },
            }),
      onError: (error, message) => messages.push({ error, message }),
    });

    assert.equal(destination.closed, true);
    assert.equal(state.closeCalls, 1);
    assert.strictEqual(messages[0].error, technicalError);
    assert.equal(messages[0].message, invoicePdfGenericPrintErrorMessage);
    assert.doesNotMatch(messages[0].message, /technical detail/);
  }
});

test("Invoice print detects a destination closed during PDF generation", async () => {
  const { destination } = createPrintDestination();
  const harness = createPdfBrowserHarness({
    renderPdf: async () => {
      destination.closed = true;
      return new Blob(["PDF"], { type: "application/pdf" });
    },
  });

  await assert.rejects(
    printInvoicePdf(invoiceFixture, destination, harness.dependencies),
    new RegExp(invoicePdfWindowClosedMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
  assert.deepEqual(harness.revokedUrls, []);
  assert.deepEqual(harness.scheduled, []);

  const messages = [];
  await startInvoicePdfPrint(invoiceFixture, {
    openDestination: () => createPrintDestination().destination,
    loadPrintModule: () =>
      Promise.resolve({
        printInvoicePdf: async () => {
          throw new Error(invoicePdfWindowClosedMessage);
        },
      }),
    onError: (_error, message) => messages.push(message),
  });
  assert.deepEqual(messages, [invoicePdfWindowClosedMessage]);
});

test("Invoice print revokes and closes after listener or navigation failure", async () => {
  for (const failurePoint of ["listener", "navigation"]) {
    const technicalError = new Error(failurePoint + " failed");
    const fixture =
      failurePoint === "listener"
        ? createPrintDestination({
            addEventListener: () => {
              throw technicalError;
            },
          })
        : createPrintDestination({
            replace: () => {
              throw technicalError;
            },
          });
    const harness = createPdfBrowserHarness();

    await assert.rejects(
      printInvoicePdf(
        invoiceFixture,
        fixture.destination,
        harness.dependencies
      ),
      technicalError
    );
    assert.deepEqual(harness.revokedUrls, ["blob:invoice-1"]);
    assert.equal(fixture.destination.closed, true);
    assert.equal(fixture.state.closeCalls, 1);

    for (const timer of harness.scheduled) timer.callback();
    assert.deepEqual(
      harness.revokedUrls,
      ["blob:invoice-1"],
      "Cleanup timers must remain idempotent after setup failure"
    );
  }
});

test("Invoice print handles timer and cleanup-operation failures without losing the primary error", async () => {
  const timerFailure = new Error("timer failed");
  const timerFixture = createPrintDestination();
  const timerHarness = createPdfBrowserHarness({
    schedule: () => {
      throw timerFailure;
    },
  });

  await assert.rejects(
    printInvoicePdf(
      invoiceFixture,
      timerFixture.destination,
      timerHarness.dependencies
    ),
    timerFailure
  );
  assert.deepEqual(timerHarness.revokedUrls, ["blob:invoice-1"]);
  assert.equal(timerFixture.destination.closed, true);

  const navigationFailure = new Error("navigation failed");
  const revokeFailure = new Error("revoke failed");
  const closeFailure = new Error("close failed");
  const cleanupFixture = createPrintDestination({
    replace: () => {
      throw navigationFailure;
    },
  });
  cleanupFixture.destination.close = () => {
    throw closeFailure;
  };
  const cleanupHarness = createPdfBrowserHarness({
    revokeObjectUrl: () => {
      throw revokeFailure;
    },
  });

  await assert.rejects(
    printInvoicePdf(
      invoiceFixture,
      cleanupFixture.destination,
      cleanupHarness.dependencies
    ),
    navigationFailure
  );
  assert.ok(cleanupHarness.cleanupErrors.includes(revokeFailure));
  assert.ok(cleanupHarness.cleanupErrors.includes(closeFailure));
});

test("Invoice print handles a synchronous load/navigation race without early revocation", async () => {
  const fixture = createPrintDestination({
    replace: (_url, _destination, listeners) => {
      listeners.get("load")(new Event("load"));
    },
  });
  const harness = createPdfBrowserHarness();

  await printInvoicePdf(
    invoiceFixture,
    fixture.destination,
    harness.dependencies
  );

  assert.deepEqual(fixture.navigation, ["blob:invoice-1"]);
  assert.deepEqual(harness.revokedUrls, []);
  assert.equal(fixture.listeners.has("load"), false);
  assert.ok(
    harness.scheduled.some(
      ({ delayMs }) => delayMs === invoicePdfFallbackRevokeDelayMs
    )
  );
  const postLoadCleanup = harness.scheduled.find(
    ({ delayMs }) => delayMs === invoicePdfObjectUrlRevokeDelayMs
  );
  assert.ok(postLoadCleanup);
  postLoadCleanup.callback();
  postLoadCleanup.callback();
  for (const timer of harness.scheduled) timer.callback();
  assert.deepEqual(harness.revokedUrls, ["blob:invoice-1"]);
});

test("Invoice print fallback handles missing load and early popup closure", async () => {
  const missingLoad = createPrintDestination();
  const missingLoadHarness = createPdfBrowserHarness();
  await printInvoicePdf(
    invoiceFixture,
    missingLoad.destination,
    missingLoadHarness.dependencies
  );
  assert.deepEqual(missingLoadHarness.revokedUrls, []);

  const fallback = missingLoadHarness.scheduled.find(
    ({ delayMs }) => delayMs === invoicePdfFallbackRevokeDelayMs
  );
  assert.ok(fallback);
  fallback.callback();
  assert.deepEqual(missingLoadHarness.revokedUrls, ["blob:invoice-1"]);
  assert.equal(missingLoad.listeners.has("load"), false);

  const earlyClose = createPrintDestination();
  const earlyCloseHarness = createPdfBrowserHarness();
  await printInvoicePdf(
    invoiceFixture,
    earlyClose.destination,
    earlyCloseHarness.dependencies
  );
  earlyClose.destination.closed = true;
  const closurePoll = earlyCloseHarness.scheduled.find(
    ({ delayMs }) => delayMs === invoicePdfPopupClosePollDelayMs
  );
  assert.ok(closurePoll);
  closurePoll.callback();
  assert.deepEqual(earlyCloseHarness.revokedUrls, ["blob:invoice-1"]);
  assert.equal(earlyClose.listeners.has("load"), false);
});

test("Invoice download revokes after link creation, click, scheduling, or removal failure", async () => {
  for (const failurePoint of ["creation", "click", "scheduling", "removal"]) {
    const technicalError = new Error(failurePoint + " failed");
    const harness = createPdfBrowserHarness();
    const baseCreateLink = harness.dependencies.createDownloadLink;

    if (failurePoint === "creation") {
      harness.dependencies.createDownloadLink = () => {
        throw technicalError;
      };
    } else {
      harness.dependencies.createDownloadLink = () => {
        const link = baseCreateLink();
        if (failurePoint === "click") {
          link.click = () => {
            throw technicalError;
          };
        }
        if (failurePoint === "removal") {
          link.remove = () => {
            throw technicalError;
          };
        }
        return link;
      };
      if (failurePoint === "scheduling") {
        harness.dependencies.schedule = () => {
          throw technicalError;
        };
      }
    }

    await assert.rejects(
      downloadInvoicePdf(invoiceFixture, harness.dependencies),
      technicalError
    );
    assert.deepEqual(harness.revokedUrls, ["blob:invoice-1"]);
    if (failurePoint !== "creation" && failurePoint !== "removal") {
      assert.equal(harness.links[0].removed, true);
    }
  }
});

test("Invoice download cleanup is delayed, idempotent, and uses a safe filename", async () => {
  const harness = createPdfBrowserHarness();
  await downloadInvoicePdf(invoiceFixture, harness.dependencies);

  assert.strictEqual(harness.renderedInvoices[0], invoiceFixture);
  assert.equal(harness.links[0].download, "INV-2028-000037.pdf");
  assert.equal(harness.links[0].clicked, true);
  assert.equal(harness.links[0].removed, true);
  assert.deepEqual(harness.revokedUrls, []);
  assert.equal(
    harness.scheduled[0].delayMs,
    invoicePdfObjectUrlRevokeDelayMs
  );
  harness.scheduled[0].callback();
  harness.scheduled[0].callback();
  assert.deepEqual(harness.revokedUrls, ["blob:invoice-1"]);

  assert.equal(safeInvoicePdfFilename(" INV / 2028 \\ 37 "), "INV-2028-37.pdf");
  assert.equal(safeInvoicePdfFilename("Fáctura № １２３"), "Factura-No-123.pdf");
  assert.equal(safeInvoicePdfFilename("東京"), "invoice.pdf");
  assert.equal(safeInvoicePdfFilename("   "), "invoice.pdf");
});

test("Invoice PDF compatibility export and browser operations share the canonical renderer", async () => {
  assert.strictEqual(generateInvoicePdf, downloadInvoicePdf);
  assert.strictEqual(
    invoicePdfBrowserDependencies.renderPdf,
    createInvoicePdfBlob
  );

  const harness = createPdfBrowserHarness();
  const fixture = createPrintDestination();
  await downloadInvoicePdf(invoiceFixture, harness.dependencies);
  await printInvoicePdf(
    invoiceFixture,
    fixture.destination,
    harness.dependencies
  );
  assert.deepEqual(harness.renderedInvoices, [invoiceFixture, invoiceFixture]);

  const generatorSource = await source("src/utils/generateInvoicePdf.tsx");
  assert.doesNotMatch(generatorSource, /payment(?:History|Rows|Events)/i);
  const invoicePageSource = await source("src/pages/InvoicePage.tsx");
  assert.doesNotMatch(invoicePageSource, /window\.print\s*\(/);
});

test("Invoice popup-blocked errors retain their specific retry guidance", async () => {
  assert.throws(
    () => openInvoicePdfPrintDestination(() => null),
    new RegExp(invoicePdfPopupBlockedMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );

  const messages = [];
  await startInvoicePdfPrint(invoiceFixture, {
    openDestination: () => openInvoicePdfPrintDestination(() => null),
    onError: (_error, message) => messages.push(message),
  });
  assert.deepEqual(messages, [invoicePdfPopupBlockedMessage]);
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

test("official Invoice PDF visibly redacts adversarial notes without changing benign identifiers", async () => {
  const blob = await createInvoicePdfBlob(sensitiveInvoiceFixture);
  const pdf = await inspectPdf(await blob.arrayBuffer());

  assert.equal(pdf.pageCount, 1);
  assert.deepEqual(pdf.pageSizes, [{ height: 792, width: 612 }]);
  assertNoSensitiveCardData(pdf.text);
  for (const sensitiveValue of [
    "4111111111111111",
    "4012 8888 8888 1881",
    "5555-5555-5555-4444",
    "3782 822463 10005",
    "CVV: 123",
    "CVC=999",
    "security-code value is 1234",
  ]) {
    assert.doesNotMatch(pdf.text, new RegExp(sensitiveValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.ok(
    pdf.text.split(invoicePdfRedactionLabel).length - 1 >= 7,
    "Every adversarial value should render as a visible redaction label"
  );
  assert.match(pdf.text, /1234567890123/);
  assert.match(pdf.text, /801-903-9380/);
  assert.match(pdf.text, /2028-06-10/);
  assert.match(pdf.text, /\$149\.95/);
  assert.match(pdf.text, new RegExp(sensitiveInvoiceFixture.rental_agreement_id));
  assert.match(pdf.text, new RegExp(sensitiveInvoiceFixture.rental_request_id));
});

test("production Invoice generator renders the known legacy snapshot as one Letter page", async () => {
  const blob = await createInvoicePdfBlob(legacyInvoiceFixture);
  const pdf = await inspectPdf(await blob.arrayBuffer());

  assert.equal(pdf.pageCount, 1);
  assert.deepEqual(pdf.pageSizes, [{ height: 792, width: 612 }]);
  assert.match(pdf.text, /INV-1785282138953/);
  assert.match(pdf.text, /Issued/i);
  assert.match(pdf.text, /Payment status\s+Unpaid/i);
  assert.match(pdf.text, /Historical Invoice/);
  assert.match(pdf.text, /2025 RawMax Tilt Deck 22'/);
  assert.match(pdf.text, /Rental subtotal\s+\$100\.00/);
  assert.match(pdf.text, /Deposit required\s+\$49\.95/);
  assert.match(pdf.text, /Total\s+\$149\.95/);
  assert.match(pdf.text, /Amount paid\s+\$0\.00/);
  assert.match(pdf.text, /Balance due\s+\$149\.95/);
  assert.match(pdf.text, new RegExp(legacyInvoiceFixture.rental_agreement_id));
  assert.match(pdf.text, new RegExp(legacyInvoiceFixture.rental_request_id));
  assert.doesNotMatch(pdf.text, /Payment History/i);
  assert.doesNotMatch(pdf.text, /SAFE-REF-001/);
  assertNoSensitiveCardData(pdf.text);

  assert.equal(
    pdf.metadata.Title,
    "Equipment Rental Invoice INV-1785282138953"
  );
  assert.equal(pdf.metadata.Author, "Urban Cowboy Rentals LLC");
  assert.equal(
    pdf.metadata.Subject,
    "Immutable equipment rental Invoice snapshot"
  );
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

  const brief = await source(
    "docs/urban-cowboy-rentals-agreement-counsel-review.md"
  );
  assert.match(brief, /COUNSEL REVIEW REQUIRED — NOT APPROVED FOR CUSTOMER USE/);
  assert.match(brief, /does not expose properly tagged-PDF output/);
  assert.match(brief, /semantic browser Agreement and Invoice HTML/);
  assert.doesNotMatch(brief, /\/Users\/alexbrito\/Downloads/);
  assert.doesNotMatch(brief, /attorney-approved/i);
});
