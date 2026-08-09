import { createClient } from "npm:@supabase/supabase-js@2";

import {
  normalizeRentalDocumentFilename,
  validateRentalDocumentFile,
} from "../../../src/domain/validators/rentalDocumentValidators.ts";

interface DenoRuntime {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
}

const runtime = (globalThis as typeof globalThis & { Deno: DenoRuntime }).Deno;
const bucket = "rental-documents";
const allowedDocumentTypes = ["driver_license", "insurance"] as const;
type DocumentType = (typeof allowedDocumentTypes)[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const requiredEnvironmentValue = (name: string): string => {
  const value = runtime.env.get(name);
  if (!value) throw new Error(`Missing required function configuration: ${name}.`);
  return value;
};

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const maxBytes = positiveInteger(
  runtime.env.get("RENTAL_DOCUMENT_MAX_BYTES"),
  10 * 1024 * 1024
);
const signedUrlTtlSeconds = Math.min(
  300,
  Math.max(
    60,
    positiveInteger(runtime.env.get("RENTAL_DOCUMENT_SIGNED_URL_TTL_SECONDS"), 120)
  )
);

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

const isDocumentType = (value: string): value is DocumentType =>
  allowedDocumentTypes.includes(value as DocumentType);

const extensionFor = (filename: string): string =>
  filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

runtime.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Staff authorization is required." }, 401);

    const supabaseUrl = requiredEnvironmentValue("SUPABASE_URL");
    const anonKey = requiredEnvironmentValue("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    const role = userData.user?.app_metadata?.role ?? userData.user?.app_metadata?.app_role;
    if (userError || !userData.user || (role !== "staff" && role !== "admin")) {
      return json({ error: "Staff authorization is required." }, 403);
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const action = formData.get("action");
      const rentalRequestId = formData.get("rentalRequestId");
      const documentType = formData.get("documentType");
      const file = formData.get("file");

      if (
        action !== "upload" ||
        typeof rentalRequestId !== "string" ||
        !isUuid(rentalRequestId) ||
        typeof documentType !== "string" ||
        !isDocumentType(documentType) ||
        !(file instanceof File)
      ) {
        return json({ error: "The rental document upload request is invalid." }, 400);
      }

      const normalizedFilename = await validateRentalDocumentFile(
        {
          name: file.name,
          type: file.type,
          size: file.size,
          source: file,
          readSignature: async () =>
            new Uint8Array(await file.slice(0, 8).arrayBuffer()),
        },
        maxBytes
      );
      const extension = extensionFor(normalizedFilename);
      const storagePath = `${rentalRequestId}/${documentType}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await serviceClient.storage
        .from(bucket)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: "no-store",
        });
      if (uploadError) throw new Error("The rental document could not be stored.");

      const { data: documentId, error: registrationError } = await callerClient.rpc(
        "register_rental_document",
        {
          target_rental_request_id: rentalRequestId,
          document_type_value: documentType,
          storage_bucket_value: bucket,
          storage_path_value: storagePath,
          original_filename_value: normalizeRentalDocumentFilename(normalizedFilename),
          mime_type_value: file.type,
          size_bytes_value: file.size,
        }
      );

      if (registrationError) {
        const { error: cleanupError } = await serviceClient.storage
          .from(bucket)
          .remove([storagePath]);
        if (cleanupError) {
          throw new Error(
            "Document registration failed and its unregistered object requires operator cleanup."
          );
        }
        throw new Error(registrationError.message);
      }

      return json({ documentId });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    if (payload.action !== "signed_url" || typeof payload.documentId !== "string") {
      return json({ error: "The signed document request is invalid." }, 400);
    }

    const { data: document, error: documentError } = await callerClient
      .from("rental_documents")
      .select("storage_bucket,storage_path,is_current")
      .eq("id", payload.documentId)
      .eq("is_current", true)
      .single();
    if (documentError || !document) {
      return json({ error: "The current rental document was not found." }, 404);
    }

    const { data: signedData, error: signedError } = await serviceClient.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, signedUrlTtlSeconds, {
        download: false,
      });
    if (signedError || !signedData.signedUrl) {
      throw new Error("A temporary rental document URL could not be generated.");
    }

    return json({ signedUrl: signedData.signedUrl, expiresIn: signedUrlTtlSeconds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rental document operation failed.";
    return json({ error: message }, 400);
  }
});
