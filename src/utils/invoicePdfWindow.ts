import type { Invoice } from "../types/invoice";

export const invoicePdfPopupBlockedMessage =
  "The Invoice PDF window was blocked. Allow pop-ups for this site, then select Print Invoice again.";
export const invoicePdfWindowClosedMessage =
  "The Invoice PDF window was closed before the document was ready. Select Print Invoice to try again.";
export const invoicePdfGenericPrintErrorMessage =
  "Could not prepare the Invoice PDF for printing. Please try again. If the problem continues, download the PDF and print it from your browser.";

export class InvoicePdfWindowClosedError extends Error {
  constructor() {
    super(invoicePdfWindowClosedMessage);
    this.name = "InvoicePdfWindowClosedError";
  }
}

export interface InvoicePdfPrintDestination {
  readonly closed: boolean;
  readonly document?: {
    title: string;
    body: { textContent: string | null } | null;
  };
  readonly location: {
    replace: (url: string) => void;
  };
  addEventListener: (
    type: "load",
    listener: EventListener,
    options?: AddEventListenerOptions | boolean
  ) => void;
  removeEventListener: (type: "load", listener: EventListener) => void;
  close: () => void;
}

export type InvoicePdfWindowOpener = () => InvoicePdfPrintDestination | null;

type InvoicePdfPrinter = (
  invoice: Invoice,
  destination: InvoicePdfPrintDestination
) => Promise<void>;

interface InvoicePdfPrintModule {
  printInvoicePdf: InvoicePdfPrinter;
}

export interface StartInvoicePdfPrintDependencies {
  openDestination: () => InvoicePdfPrintDestination;
  loadPrintModule: () => Promise<InvoicePdfPrintModule>;
  onError: (error: unknown, userMessage: string) => void;
  reportCleanupError: (error: unknown) => void;
}

const openBrowserWindow: InvoicePdfWindowOpener = () =>
  window.open("", "_blank") as InvoicePdfPrintDestination | null;

const closeDestination = (
  destination: InvoicePdfPrintDestination,
  reportCleanupError: (error: unknown) => void
): void => {
  try {
    if (!destination.closed) destination.close();
  } catch (error) {
    reportCleanupError(error);
  }
};

export const openInvoicePdfPrintDestination = (
  openWindow: InvoicePdfWindowOpener = openBrowserWindow
): InvoicePdfPrintDestination => {
  const destination = openWindow();

  if (!destination) {
    throw new Error(invoicePdfPopupBlockedMessage);
  }

  try {
    if (destination.document) {
      destination.document.title = "Preparing Invoice PDF";
      if (destination.document.body) {
        destination.document.body.textContent =
          "Preparing the official Invoice PDF...";
      }
    }
  } catch (error) {
    closeDestination(destination, (cleanupError) =>
      console.error("INVOICE PDF POPUP CLEANUP ERROR:", cleanupError)
    );
    throw error;
  }

  return destination;
};

export const getInvoicePdfPrintUserMessage = (error: unknown): string => {
  if (
    error instanceof InvoicePdfWindowClosedError ||
    (error instanceof Error && error.message === invoicePdfWindowClosedMessage)
  ) {
    return invoicePdfWindowClosedMessage;
  }

  if (error instanceof Error && error.message === invoicePdfPopupBlockedMessage) {
    return invoicePdfPopupBlockedMessage;
  }

  return invoicePdfGenericPrintErrorMessage;
};

const defaultStartDependencies: StartInvoicePdfPrintDependencies = {
  openDestination: () => openInvoicePdfPrintDestination(),
  loadPrintModule: () => import("./generateInvoicePdf"),
  onError: () => undefined,
  reportCleanupError: (error) =>
    console.error("INVOICE PDF POPUP CLEANUP ERROR:", error),
};

export const startInvoicePdfPrint = (
  invoice: Invoice,
  overrides: Partial<StartInvoicePdfPrintDependencies> = {}
): Promise<void> => {
  const dependencies = { ...defaultStartDependencies, ...overrides };
  let destination: InvoicePdfPrintDestination;

  try {
    destination = dependencies.openDestination();
  } catch (error) {
    dependencies.onError(error, getInvoicePdfPrintUserMessage(error));
    return Promise.resolve();
  }

  let printModule: Promise<InvoicePdfPrintModule>;
  try {
    printModule = dependencies.loadPrintModule();
  } catch (error) {
    closeDestination(destination, dependencies.reportCleanupError);
    dependencies.onError(error, getInvoicePdfPrintUserMessage(error));
    return Promise.resolve();
  }

  return printModule
    .then(({ printInvoicePdf }) => printInvoicePdf(invoice, destination))
    .catch((error: unknown) => {
      closeDestination(destination, dependencies.reportCleanupError);
      dependencies.onError(error, getInvoicePdfPrintUserMessage(error));
    });
};
