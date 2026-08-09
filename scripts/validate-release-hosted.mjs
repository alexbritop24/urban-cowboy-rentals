#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { File } from "node:buffer";
import { performance } from "node:perf_hooks";

import { createClient } from "@supabase/supabase-js";

const command = process.argv[2] ?? "help";
const nilUuid = "00000000-0000-4000-8000-000000000000";
const mutationConfirmation = "YES_I_UNDERSTAND_PREVIEW_ONLY";
const sensitiveNames = new Set([
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RELEASE_VALIDATION_STAFF_ACCESS_TOKEN",
  "RELEASE_VALIDATION_STAFF_2_ACCESS_TOKEN",
  "RELEASE_VALIDATION_ADMIN_ACCESS_TOKEN",
  "RELEASE_VALIDATION_CUSTOMER_ACCESS_TOKEN",
  "RELEASE_VALIDATION_SPOOFED_CUSTOMER_ACCESS_TOKEN",
  "RELEASE_VALIDATION_DATABASE_URL",
]);

const usage = `
Release 1 hosted validation (isolated hosted preview only)

Commands:
  preflight         Verify target confirmation and required variable status.
  authorization     Exercise protected RPC/RLS boundaries without real records.
  fail-closed       Verify unconfigured payment policy against an eligible fixture.
  approval-races    Run same-resource, multi-resource, and disjoint Approval races.
  documents         Exercise private Storage and the rental-documents Edge Function.

Use docs/urban-cowboy-rentals-release-1-readiness.md for required variables,
fixture prerequisites, psql concurrency checks, and safe execution order.
`;

const fail = (message) => {
  throw new Error(message);
};

const value = (name) => process.env[name]?.trim() ?? "";

const required = (name) => {
  const configured = value(name);
  if (!configured) fail(`Missing required environment variable: ${name}.`);
  return configured;
};

const projectRef = (urlValue) => {
  const hostname = new URL(urlValue).hostname;
  const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(hostname);
  if (!match?.[1]) {
    fail("VITE_SUPABASE_URL must be a hosted Supabase project URL.");
  }
  return match[1];
};

const assertPreviewTarget = ({ mutating = false } = {}) => {
  const url = required("VITE_SUPABASE_URL");
  required("VITE_SUPABASE_ANON_KEY");
  if (value("RELEASE_VALIDATION_ENVIRONMENT") !== "preview") {
    fail("RELEASE_VALIDATION_ENVIRONMENT must equal preview.");
  }
  const actualRef = projectRef(url);
  if (value("RELEASE_VALIDATION_CONFIRM_PROJECT_REF") !== actualRef) {
    fail(
      "RELEASE_VALIDATION_CONFIRM_PROJECT_REF must exactly match the hosted preview project reference."
    );
  }
  if (
    mutating &&
    value("RELEASE_VALIDATION_ALLOW_MUTATIONS") !== mutationConfirmation
  ) {
    fail(
      `Mutating validation requires RELEASE_VALIDATION_ALLOW_MUTATIONS=${mutationConfirmation}.`
    );
  }
  return { url, anonKey: required("VITE_SUPABASE_ANON_KEY") };
};

const clientFor = (token) => {
  const { url, anonKey } = assertPreviewTarget();
  return createClient(url, anonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const serviceClient = () => {
  const { url } = assertPreviewTarget({ mutating: true });
  return createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const errorText = (error) =>
  [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ");

const isAuthorizationError = (error) =>
  /authorization|required|permission denied|not allowed|row-level security|jwt/i.test(
    errorText(error)
  );

const expectDenied = async (label, operation) => {
  const result = await operation();
  if (!result.error) fail(`${label} unexpectedly succeeded.`);
  if (!isAuthorizationError(result.error)) {
    fail(`${label} failed for a non-authorization reason: ${errorText(result.error)}`);
  }
};

const expectAuthorizedBoundary = async (label, operation) => {
  const result = await operation();
  if (result.error && isAuthorizationError(result.error)) {
    fail(`${label} did not cross the expected authorization boundary.`);
  }
};

const rpcCalls = (client) => [
  [
    "Agreement finalization",
    () => client.rpc("finalize_rental_agreement", { target_agreement_id: nilUuid }),
  ],
  [
    "Invoice creation",
    () =>
      client.rpc("create_invoice_for_agreement", {
        target_rental_agreement_id: nilUuid,
      }),
  ],
  [
    "Invoice issuance",
    () => client.rpc("issue_invoice", { target_invoice_id: nilUuid }),
  ],
  [
    "Payment recording",
    () =>
      client.rpc("record_invoice_payment", {
        target_invoice_id: nilUuid,
        payment_amount: 1,
        payment_method_value: "other",
        reference_number_value: null,
        notes_value: "Synthetic hosted authorization probe",
      }),
  ],
  [
    "Insurance review",
    () =>
      client.rpc("review_rental_insurance", {
        target_rental_request_id: nilUuid,
        verification_status_value: "verified",
        review_note_value: "Synthetic hosted authorization probe",
      }),
  ],
  [
    "Initial availability",
    () =>
      client.rpc("confirm_rental_request_initial_availability", {
        target_rental_request_id: nilUuid,
        note_value: "Synthetic hosted authorization probe",
      }),
  ],
  [
    "Approval",
    () =>
      client.rpc("approve_rental_request", {
        target_rental_request_id: nilUuid,
        note_value: "Synthetic hosted authorization probe",
      }),
  ],
  [
    "Approval reversal",
    () =>
      client.rpc("reverse_rental_approval", {
        target_rental_request_id: nilUuid,
        note_value: "Synthetic hosted authorization probe",
      }),
  ],
];

const runPreflight = () => {
  const names = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RELEASE_VALIDATION_ENVIRONMENT",
    "RELEASE_VALIDATION_CONFIRM_PROJECT_REF",
    "RELEASE_VALIDATION_ALLOW_MUTATIONS",
    "RELEASE_VALIDATION_STAFF_ACCESS_TOKEN",
    "RELEASE_VALIDATION_STAFF_2_ACCESS_TOKEN",
    "RELEASE_VALIDATION_ADMIN_ACCESS_TOKEN",
    "RELEASE_VALIDATION_CUSTOMER_ACCESS_TOKEN",
    "RELEASE_VALIDATION_SPOOFED_CUSTOMER_ACCESS_TOKEN",
    "RELEASE_VALIDATION_DATABASE_URL",
  ];
  const statuses = Object.fromEntries(
    names.map((name) => [
      name,
      value(name) ? (sensitiveNames.has(name) ? "configured (redacted)" : "configured") : "missing",
    ])
  );
  console.log(JSON.stringify({ command: "preflight", variables: statuses }, null, 2));
  assertPreviewTarget();
  console.log("Hosted preview target confirmation: PASS");
};

const runAuthorization = async () => {
  assertPreviewTarget();
  const anon = clientFor("");
  const customer = clientFor(required("RELEASE_VALIDATION_CUSTOMER_ACCESS_TOKEN"));
  const spoofed = clientFor(
    required("RELEASE_VALIDATION_SPOOFED_CUSTOMER_ACCESS_TOKEN")
  );
  const staff = clientFor(required("RELEASE_VALIDATION_STAFF_ACCESS_TOKEN"));
  const admin = clientFor(required("RELEASE_VALIDATION_ADMIN_ACCESS_TOKEN"));

  for (const [label, operation] of rpcCalls(anon)) {
    await expectDenied(`anon ${label}`, operation);
  }
  for (const [label, operation] of rpcCalls(customer)) {
    await expectDenied(`customer ${label}`, operation);
  }
  for (const [label, operation] of rpcCalls(spoofed)) {
    await expectDenied(`user_metadata spoof ${label}`, operation);
  }
  for (const [label, operation] of rpcCalls(staff)) {
    await expectAuthorizedBoundary(`staff ${label}`, operation);
  }
  for (const [label, operation] of rpcCalls(admin)) {
    await expectAuthorizedBoundary(`admin ${label}`, operation);
  }

  for (const [label, client, allowed] of [
    ["anon", anon, false],
    ["customer", customer, false],
    ["user_metadata spoof", spoofed, false],
    ["staff", staff, true],
    ["admin", admin, true],
  ]) {
    const { data, error } = await client.from("rental_documents").select("id").limit(1);
    if (allowed && error) fail(`${label} document metadata read was denied.`);
    if (!allowed && !error && data?.length) {
      fail(`${label} could read protected document metadata.`);
    }
  }

  console.log("Hosted authorization matrix: PASS");
};

const requestState = async (client, requestIds) => {
  const { data, error } = await client
    .from("rental_requests")
    .select("id,approval_status,approved_by,approved_at")
    .in("id", requestIds);
  if (error) fail(`Could not inspect Approval state: ${errorText(error)}`);
  return data ?? [];
};

const approvalEvents = async (client, requestIds) => {
  const { data, error } = await client
    .from("rental_approval_events")
    .select("rental_request_id,event_type,payment_policy")
    .in("rental_request_id", requestIds)
    .eq("event_type", "approved");
  if (error) fail(`Could not inspect Approval events: ${errorText(error)}`);
  return data ?? [];
};

const raceApprovalPair = async ({ label, requestA, requestB, expectedApprovals }) => {
  const clientA = clientFor(required("RELEASE_VALIDATION_STAFF_ACCESS_TOKEN"));
  const clientB = clientFor(required("RELEASE_VALIDATION_STAFF_2_ACCESS_TOKEN"));
  const requestIds = [requestA, requestB];
  const before = await requestState(clientA, requestIds);
  const beforeEvents = await approvalEvents(clientA, requestIds);
  if (
    before.length !== 2 ||
    before.some((row) => row.approval_status !== "pending") ||
    beforeEvents.length !== 0
  ) {
    fail(`${label} fixtures must both be pending with no prior Approved event.`);
  }

  const start = performance.now();
  const execute = async (client, requestId) => {
    const operationStart = performance.now();
    const result = await client.rpc("approve_rental_request", {
      target_rental_request_id: requestId,
      note_value: `Synthetic hosted ${label} concurrency validation`,
    });
    return { ...result, durationMs: Math.round(performance.now() - operationStart) };
  };
  const [resultA, resultB] = await Promise.all([
    execute(clientA, requestA),
    execute(clientB, requestB),
  ]);
  for (const result of [resultA, resultB]) {
    if (result.error) fail(`${label} RPC failed unexpectedly: ${errorText(result.error)}`);
  }

  const after = await requestState(clientA, requestIds);
  const events = await approvalEvents(clientA, requestIds);
  const approvedRows = after.filter((row) => row.approval_status === "approved");
  if (approvedRows.length !== expectedApprovals || events.length !== expectedApprovals) {
    fail(`${label} produced an unexpected number of authoritative Approvals.`);
  }
  for (const row of after.filter((candidate) => candidate.approval_status !== "approved")) {
    if (row.approved_by || row.approved_at) {
      fail(`${label} losing request retained fabricated Approval evidence.`);
    }
    if (events.some((event) => event.rental_request_id === row.id)) {
      fail(`${label} losing request received an Approved event.`);
    }
  }
  if (
    events.some(
      (event) =>
        event.payment_policy !== "deposit_required" &&
        event.payment_policy !== "invoice_paid"
    )
  ) {
    fail(`${label} Approved event did not snapshot a configured payment policy.`);
  }

  console.log(
    JSON.stringify({
      scenario: label,
      totalMs: Math.round(performance.now() - start),
      operations: [
        { fixture: "A", durationMs: resultA.durationMs, code: resultA.data?.code ?? "none" },
        { fixture: "B", durationMs: resultB.durationMs, code: resultB.data?.code ?? "none" },
      ],
      approvedCount: approvedRows.length,
    })
  );
};

const runApprovalRaces = async () => {
  assertPreviewTarget({ mutating: true });
  await raceApprovalPair({
    label: "same-resource",
    requestA: required("RELEASE_VALIDATION_SAME_RESOURCE_REQUEST_A"),
    requestB: required("RELEASE_VALIDATION_SAME_RESOURCE_REQUEST_B"),
    expectedApprovals: 1,
  });
  await raceApprovalPair({
    label: "multi-resource-reversed-order",
    requestA: required("RELEASE_VALIDATION_MULTI_RESOURCE_REQUEST_A"),
    requestB: required("RELEASE_VALIDATION_MULTI_RESOURCE_REQUEST_B"),
    expectedApprovals: 1,
  });
  await raceApprovalPair({
    label: "disjoint-resources",
    requestA: required("RELEASE_VALIDATION_DISJOINT_REQUEST_A"),
    requestB: required("RELEASE_VALIDATION_DISJOINT_REQUEST_B"),
    expectedApprovals: 2,
  });
};

const runFailClosed = async () => {
  assertPreviewTarget({ mutating: true });
  const client = clientFor(required("RELEASE_VALIDATION_STAFF_ACCESS_TOKEN"));
  const requestId = required("RELEASE_VALIDATION_FAIL_CLOSED_REQUEST_ID");
  const beforeState = await requestState(client, [requestId]);
  const beforeEvents = await approvalEvents(client, [requestId]);
  const checklist = await client.rpc("get_rental_approval_checklist", {
    target_rental_request_id: requestId,
  });
  if (checklist.error) fail(`Checklist failed: ${errorText(checklist.error)}`);
  if (
    checklist.data?.paymentPolicy !== "unconfigured" ||
    checklist.data?.checks?.payment_requirement?.state !== "configuration_required"
  ) {
    fail("Hosted payment policy is not in the expected fail-closed state.");
  }
  const approval = await client.rpc("approve_rental_request", {
    target_rental_request_id: requestId,
    note_value: "Synthetic hosted fail-closed validation",
  });
  if (!approval.error) fail("Approval unexpectedly succeeded with unconfigured policy.");
  const afterState = await requestState(client, [requestId]);
  const afterEvents = await approvalEvents(client, [requestId]);
  if (
    beforeEvents.length !== afterEvents.length ||
    JSON.stringify(beforeState) !== JSON.stringify(afterState)
  ) {
    fail("Fail-closed Approval changed state or created an Approved event.");
  }
  console.log("Hosted fail-closed payment policy: PASS");
};

const syntheticPdf = () =>
  new File(["%PDF-1.4\n% synthetic Release 1 validation\n%%EOF\n"], "synthetic.pdf", {
    type: "application/pdf",
  });

const syntheticPng = () =>
  new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
    "synthetic.png",
    { type: "image/png" }
  );

const uploadDocument = (client, requestId, documentType, file) => {
  const form = new FormData();
  form.set("action", "upload");
  form.set("rentalRequestId", requestId);
  form.set("documentType", documentType);
  form.set("file", file, file.name);
  return client.functions.invoke("rental-documents", { body: form });
};

const expectFunctionRejected = async (label, operation) => {
  const result = await operation();
  if (!result.error) fail(`${label} unexpectedly succeeded.`);
};

const runDocuments = async () => {
  assertPreviewTarget({ mutating: true });
  const requestId = required("RELEASE_VALIDATION_DOCUMENT_REQUEST_ID");
  const staff = clientFor(required("RELEASE_VALIDATION_STAFF_ACCESS_TOKEN"));
  const admin = clientFor(required("RELEASE_VALIDATION_ADMIN_ACCESS_TOKEN"));
  const customer = clientFor(required("RELEASE_VALIDATION_CUSTOMER_ACCESS_TOKEN"));
  const spoofed = clientFor(
    required("RELEASE_VALIDATION_SPOOFED_CUSTOMER_ACCESS_TOKEN")
  );
  const anon = clientFor("");
  const service = serviceClient();

  const { data: buckets, error: bucketError } = await service.storage.listBuckets();
  if (bucketError) fail(`Could not inspect Storage buckets: ${errorText(bucketError)}`);
  const bucket = buckets?.find((candidate) => candidate.id === "rental-documents");
  const mimeTypes = [...(bucket?.allowed_mime_types ?? [])].sort();
  if (
    !bucket ||
    bucket.public ||
    Number(bucket.file_size_limit) !== 10 * 1024 * 1024 ||
    JSON.stringify(mimeTypes) !==
      JSON.stringify(["application/pdf", "image/jpeg", "image/png"])
  ) {
    fail("The hosted rental-documents bucket configuration is unsafe or incomplete.");
  }

  await expectFunctionRejected("anon document upload", () =>
    uploadDocument(anon, requestId, "driver_license", syntheticPdf())
  );
  await expectFunctionRejected("customer document upload", () =>
    uploadDocument(customer, requestId, "driver_license", syntheticPdf())
  );
  await expectFunctionRejected("user_metadata spoof document upload", () =>
    uploadDocument(spoofed, requestId, "driver_license", syntheticPdf())
  );
  await expectFunctionRejected("empty document", () =>
    uploadDocument(
      staff,
      requestId,
      "driver_license",
      new File([], "empty.pdf", { type: "application/pdf" })
    )
  );
  await expectFunctionRejected("forged PDF", () =>
    uploadDocument(
      staff,
      requestId,
      "driver_license",
      new File(["not a PDF"], "forged.pdf", { type: "application/pdf" })
    )
  );
  await expectFunctionRejected("MIME/extension mismatch", () =>
    uploadDocument(
      staff,
      requestId,
      "driver_license",
      new File(["%PDF-1.4"], "mismatch.png", { type: "application/pdf" })
    )
  );
  await expectFunctionRejected("oversized document", () =>
    uploadDocument(
      staff,
      requestId,
      "driver_license",
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "oversized.pdf", {
        type: "application/pdf",
      })
    )
  );

  const staffUpload = await uploadDocument(
    staff,
    requestId,
    "driver_license",
    syntheticPdf()
  );
  if (staffUpload.error) fail(`Staff upload failed: ${errorText(staffUpload.error)}`);
  const adminUpload = await uploadDocument(admin, requestId, "insurance", syntheticPng());
  if (adminUpload.error) fail(`Admin upload failed: ${errorText(adminUpload.error)}`);

  const { data: documents, error: documentError } = await staff
    .from("rental_documents")
    .select("id,storage_path,document_type,is_current")
    .eq("rental_request_id", requestId)
    .eq("is_current", true);
  if (documentError || !documents?.length) {
    fail(`Could not inspect uploaded document metadata: ${errorText(documentError)}`);
  }
  for (const document of documents) {
    const expectedPath = new RegExp(
      `^${requestId}/${document.document_type}/[0-9a-f-]+\\.(pdf|jpg|jpeg|png)$`,
      "i"
    );
    if (!expectedPath.test(document.storage_path)) {
      fail("A hosted document path was not randomized or contained unexpected data.");
    }
    const publicUrl = service.storage
      .from("rental-documents")
      .getPublicUrl(document.storage_path).data.publicUrl;
    const publicResponse = await fetch(publicUrl);
    if (publicResponse.ok) fail("A private rental document was publicly readable.");
  }

  const currentDocument = documents[0];
  const signed = await staff.functions.invoke("rental-documents", {
    body: { action: "signed_url", documentId: currentDocument.id },
  });
  if (
    signed.error ||
    typeof signed.data?.signedUrl !== "string" ||
    signed.data.expiresIn < 60 ||
    signed.data.expiresIn > 300
  ) {
    fail(`Signed URL generation failed: ${errorText(signed.error)}`);
  }
  if (!(await fetch(signed.data.signedUrl)).ok) {
    fail("The generated signed URL was not readable during its validity window.");
  }
  await expectFunctionRejected("customer signed URL", () =>
    customer.functions.invoke("rental-documents", {
      body: { action: "signed_url", documentId: currentDocument.id },
    })
  );
  await expectFunctionRejected("unrelated signed URL", () =>
    staff.functions.invoke("rental-documents", {
      body: { action: "signed_url", documentId: randomUUID() },
    })
  );

  const beforeCompensationIds = documents.map((document) => document.id).sort();
  const missingRequestId = randomUUID();
  await expectFunctionRejected("registration compensation", () =>
    uploadDocument(staff, missingRequestId, "driver_license", syntheticPdf())
  );
  const { data: leftoverObjects, error: listError } = await service.storage
    .from("rental-documents")
    .list(`${missingRequestId}/driver_license`, { limit: 10 });
  if (listError || leftoverObjects?.length) {
    fail("Failed registration left an unregistered Storage object behind.");
  }
  const { data: failedMetadata, error: failedMetadataError } = await staff
    .from("rental_documents")
    .select("id")
    .eq("rental_request_id", missingRequestId);
  if (failedMetadataError || failedMetadata?.length) {
    fail("Failed registration created document metadata.");
  }
  const { data: afterDocuments, error: afterError } = await staff
    .from("rental_documents")
    .select("id")
    .in("id", beforeCompensationIds);
  if (afterError || afterDocuments?.length !== beforeCompensationIds.length) {
    fail("Compensation removed or changed an existing registered document.");
  }

  console.log(
    JSON.stringify({
      hostedDocumentWorkflow: "PASS",
      bucketPrivate: true,
      currentSyntheticDocuments: documents.length,
      signedUrlTtlSeconds: signed.data.expiresIn,
      compensationCleanup: "PASS",
    })
  );
};

const main = async () => {
  if (command === "help" || command === "--help" || command === "-h") {
    console.log(usage.trim());
    return;
  }
  if (command === "preflight") return runPreflight();
  if (command === "authorization") return runAuthorization();
  if (command === "fail-closed") return runFailClosed();
  if (command === "approval-races") return runApprovalRaces();
  if (command === "documents") return runDocuments();
  fail(`Unknown hosted validation command: ${command}.`);
};

main().catch((error) => {
  console.error(`Hosted validation failed: ${errorText(error) || "Unknown error"}`);
  process.exitCode = 1;
});
