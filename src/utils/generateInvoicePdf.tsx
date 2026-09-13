import { pdf } from "@react-pdf/renderer";

import InvoicePdfDocument from "../components/agreement/pdf/InvoicePdfDocument";
import type { Invoice } from "../types/invoice";
import {
  InvoicePdfWindowClosedError,
  type InvoicePdfPrintDestination,
} from "./invoicePdfWindow";

export const invoicePdfObjectUrlRevokeDelayMs = 60_000;
export const invoicePdfFallbackRevokeDelayMs = 120_000;
export const invoicePdfPopupClosePollDelayMs = 1_000;

interface InvoicePdfDownloadLink {
  href: string;
  download: string;
  click: () => void;
  remove: () => void;
}

export interface InvoicePdfBrowserDependencies {
  renderPdf: (invoice: Invoice) => Promise<Blob>;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  schedule: (callback: () => void, delayMs: number) => unknown;
  createDownloadLink: () => InvoicePdfDownloadLink;
  reportCleanupError: (error: unknown) => void;
}

export const createInvoicePdfBlob = async (invoice: Invoice): Promise<Blob> =>
  pdf(<InvoicePdfDocument invoice={invoice} />).toBlob();

export const invoicePdfBrowserDependencies: InvoicePdfBrowserDependencies = {
  renderPdf: createInvoicePdfBlob,
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
  createDownloadLink: () => {
    const link = document.createElement("a");
    link.style.display = "none";
    document.body.append(link);
    return link;
  },
  reportCleanupError: (error) =>
    console.error("INVOICE PDF CLEANUP ERROR:", error),
};

const dependenciesWith = (
  overrides: Partial<InvoicePdfBrowserDependencies>
): InvoicePdfBrowserDependencies => ({
  ...invoicePdfBrowserDependencies,
  ...overrides,
});

const createRetryableOnce = (operation: () => void): (() => void) => {
  let complete = false;
  let running = false;

  return () => {
    if (complete || running) return;
    running = true;
    try {
      operation();
      complete = true;
    } finally {
      running = false;
    }
  };
};

const captureError = (operation: () => void): unknown => {
  try {
    operation();
    return undefined;
  } catch (error) {
    return error;
  }
};

const reportSecondaryErrors = (
  dependencies: InvoicePdfBrowserDependencies,
  errors: unknown[]
): void => {
  for (const error of errors) {
    if (error !== undefined) dependencies.reportCleanupError(error);
  }
};

const scheduleCleanup = (
  dependencies: InvoicePdfBrowserDependencies,
  cleanup: () => void,
  delayMs: number
): void => {
  dependencies.schedule(() => {
    const cleanupError = captureError(cleanup);
    if (cleanupError !== undefined) {
      dependencies.reportCleanupError(cleanupError);
    }
  }, delayMs);
};

export const safeInvoicePdfFilename = (invoiceNumber: string): string => {
  const stem = invoiceNumber
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  return `${stem || "invoice"}.pdf`;
};

export async function downloadInvoicePdf(
  invoice: Invoice,
  overrides: Partial<InvoicePdfBrowserDependencies> = {}
): Promise<void> {
  const dependencies = dependenciesWith(overrides);
  const blob = await dependencies.renderPdf(invoice);
  const objectUrl = dependencies.createObjectUrl(blob);
  const revokeObjectUrl = createRetryableOnce(() =>
    dependencies.revokeObjectUrl(objectUrl)
  );
  let link: InvoicePdfDownloadLink | undefined;
  let operationError: unknown;

  try {
    link = dependencies.createDownloadLink();
    link.href = objectUrl;
    link.download = safeInvoicePdfFilename(invoice.invoice_number);
    link.click();
    scheduleCleanup(
      dependencies,
      revokeObjectUrl,
      invoicePdfObjectUrlRevokeDelayMs
    );
  } catch (error) {
    operationError = error;
  }

  const linkCleanupError = link
    ? captureError(() => link?.remove())
    : undefined;

  if (operationError !== undefined || linkCleanupError !== undefined) {
    const urlCleanupError = captureError(revokeObjectUrl);
    const primaryError = operationError ?? linkCleanupError ?? urlCleanupError;
    reportSecondaryErrors(
      dependencies,
      [linkCleanupError, urlCleanupError].filter(
        (error) => error !== undefined && error !== primaryError
      )
    );
    throw primaryError;
  }
}

export async function printInvoicePdf(
  invoice: Invoice,
  destination: InvoicePdfPrintDestination,
  overrides: Partial<InvoicePdfBrowserDependencies> = {}
): Promise<void> {
  const dependencies = dependenciesWith(overrides);
  let disposeObjectUrl: (() => void) | undefined;

  try {
    const blob = await dependencies.renderPdf(invoice);

    if (destination.closed) {
      throw new InvoicePdfWindowClosedError();
    }

    const destinationUrl = dependencies.createObjectUrl(blob);
    const revokeObjectUrl = createRetryableOnce(() =>
      dependencies.revokeObjectUrl(destinationUrl)
    );
    let disposed = false;
    let listenerAttached = false;

    const dispose = () => {
      let listenerCleanupError: unknown;
      if (!disposed) {
        disposed = true;
        listenerCleanupError = listenerAttached
          ? captureError(() => {
              listenerAttached = false;
              destination.removeEventListener("load", handleLoad);
            })
          : undefined;
      }
      const urlCleanupError = captureError(revokeObjectUrl);
      reportSecondaryErrors(dependencies, [listenerCleanupError, urlCleanupError]);
    };
    disposeObjectUrl = dispose;

    const monitorPopupClosure = () => {
      if (disposed) return;
      if (destination.closed) {
        dispose();
        return;
      }

      try {
        dependencies.schedule(
          monitorPopupClosure,
          invoicePdfPopupClosePollDelayMs
        );
      } catch (error) {
        dispose();
        dependencies.reportCleanupError(error);
      }
    };

    const handleLoad: EventListener = () => {
      if (disposed) return;

      if (listenerAttached) {
        listenerAttached = false;
        const listenerCleanupError = captureError(() =>
          destination.removeEventListener("load", handleLoad)
        );
        if (listenerCleanupError !== undefined) {
          dependencies.reportCleanupError(listenerCleanupError);
        }
      }

      try {
        scheduleCleanup(
          dependencies,
          dispose,
          invoicePdfObjectUrlRevokeDelayMs
        );
      } catch (error) {
        dispose();
        dependencies.reportCleanupError(error);
      }
    };

    scheduleCleanup(
      dependencies,
      dispose,
      invoicePdfFallbackRevokeDelayMs
    );
    dependencies.schedule(
      monitorPopupClosure,
      invoicePdfPopupClosePollDelayMs
    );

    listenerAttached = true;
    destination.addEventListener("load", handleLoad, { once: true });
    destination.location.replace(destinationUrl);

    if (destination.closed) {
      throw new InvoicePdfWindowClosedError();
    }
  } catch (error) {
    disposeObjectUrl?.();
    const popupCleanupError = captureError(() => {
      if (!destination.closed) destination.close();
    });
    if (popupCleanupError !== undefined) {
      dependencies.reportCleanupError(popupCleanupError);
    }
    throw error;
  }
}

export const generateInvoicePdf = downloadInvoicePdf;
