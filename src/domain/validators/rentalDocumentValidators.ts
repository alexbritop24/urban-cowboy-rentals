import type { RentalDocumentFile } from "../models/rentalDocument.ts";

export const DEFAULT_RENTAL_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const allowedFileTypes = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
} as const;

export type RentalDocumentExtension = keyof typeof allowedFileTypes;

const extensionOf = (filename: string): string => {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
};

const hasPdfSignature = (bytes: Uint8Array): boolean =>
  bytes.length >= 5 &&
  bytes[0] === 0x25 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x44 &&
  bytes[3] === 0x46 &&
  bytes[4] === 0x2d;

const hasJpegSignature = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 &&
  bytes[0] === 0xff &&
  bytes[1] === 0xd8 &&
  bytes[2] === 0xff;

const hasPngSignature = (bytes: Uint8Array): boolean =>
  bytes.length >= 8 &&
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x4e &&
  bytes[3] === 0x47 &&
  bytes[4] === 0x0d &&
  bytes[5] === 0x0a &&
  bytes[6] === 0x1a &&
  bytes[7] === 0x0a;

export const normalizeRentalDocumentFilename = (filename: string): string => {
  const finalSegment = filename.replaceAll("\\", "/").split("/").at(-1) ?? "";
  return [...finalSegment]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .trim()
    .slice(0, 255);
};

export const validateRentalDocumentFile = async (
  file: RentalDocumentFile,
  maxBytes = DEFAULT_RENTAL_DOCUMENT_MAX_BYTES
): Promise<string> => {
  const normalizedName = normalizeRentalDocumentFilename(file.name);
  if (!normalizedName) throw new Error("A valid document filename is required.");
  if (file.size < 1) throw new Error("The selected document is empty.");
  if (file.size > maxBytes) {
    throw new Error(`The selected document exceeds the ${Math.floor(maxBytes / 1048576)} MB limit.`);
  }

  const extension = extensionOf(normalizedName) as RentalDocumentExtension;
  const expectedMime = allowedFileTypes[extension];
  if (!expectedMime) {
    throw new Error("Only PDF, JPEG, JPG, and PNG documents are supported.");
  }
  if (file.type.toLowerCase() !== expectedMime) {
    throw new Error("The document extension and MIME type do not match.");
  }

  const signature = await file.readSignature();
  const signatureMatches =
    extension === "pdf"
      ? hasPdfSignature(signature)
      : extension === "png"
        ? hasPngSignature(signature)
        : hasJpegSignature(signature);

  if (!signatureMatches) {
    throw new Error("The document content does not match its declared file type.");
  }

  return normalizedName;
};
