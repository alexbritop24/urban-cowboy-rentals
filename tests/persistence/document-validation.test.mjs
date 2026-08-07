import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

const validatorUrl = new URL(
  "../../src/domain/validators/rentalDocumentValidators.ts",
  import.meta.url
);

const loadValidators = async () => {
  const source = await readFile(validatorUrl, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
};

const file = (name, type, bytes, size = bytes.length) => ({
  name,
  type,
  size,
  source: null,
  readSignature: async () => Uint8Array.from(bytes),
});

test("document validation accepts PDF, JPEG, and PNG signatures", async () => {
  const { validateRentalDocumentFile } = await loadValidators();

  assert.equal(
    await validateRentalDocumentFile(file("license.pdf", "application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d])),
    "license.pdf"
  );
  assert.equal(
    await validateRentalDocumentFile(file("insurance.JPG", "image/jpeg", [0xff, 0xd8, 0xff])),
    "insurance.JPG"
  );
  assert.equal(
    await validateRentalDocumentFile(
      file("insurance.png", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),
    "insurance.png"
  );
});

test("document validation rejects empty, oversized, unsupported, mismatched, and forged files", async () => {
  const { validateRentalDocumentFile } = await loadValidators();
  const pdf = [0x25, 0x50, 0x44, 0x46, 0x2d];

  await assert.rejects(
    () => validateRentalDocumentFile(file("empty.pdf", "application/pdf", [], 0)),
    /empty/i
  );
  await assert.rejects(
    () => validateRentalDocumentFile(file("large.pdf", "application/pdf", pdf, 101), 100),
    /limit/i
  );
  await assert.rejects(
    () => validateRentalDocumentFile(file("document.exe", "application/octet-stream", pdf)),
    /only pdf/i
  );
  await assert.rejects(
    () => validateRentalDocumentFile(file("document.pdf", "image/png", pdf)),
    /do not match/i
  );
  await assert.rejects(
    () => validateRentalDocumentFile(file("document.pdf", "application/pdf", [0x00, 0x01, 0x02])),
    /content does not match/i
  );
});

test("document filenames are normalized for display without changing storage identity", async () => {
  const { normalizeRentalDocumentFilename } = await loadValidators();
  assert.equal(normalizeRentalDocumentFilename("../../private/license.pdf"), "license.pdf");
  assert.equal(normalizeRentalDocumentFilename("folder\\insurance\u0000.png"), "insurance.png");
  assert.equal(normalizeRentalDocumentFilename("   "), "");
});
