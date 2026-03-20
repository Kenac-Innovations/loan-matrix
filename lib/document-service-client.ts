/**
 * Document Service client for Loan Matrix.
 * All logo uploads use tenantId: "loanmatrix" in the document service.
 */

const DOCUMENT_SERVICE_TENANT_ID = "loanmatrix";

export interface DocumentUploadResponse {
  success: boolean;
  message?: string;
  data?: {
    documentId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    checksum?: string;
    /** URL to use for display or download (path may use documentId/linkId) */
    fileUrl: string;
    status: string;
  };
}

/**
 * Upload a file (e.g. logo) to the document service under the loanmatrix tenant.
 * Expects document service to accept multipart with: uploadMetadata (JSON), file (binary).
 * Returns the response data including fileUrl and documentId (use as linkId for download).
 */
export async function uploadDocument(
  file: File | Blob,
  fileName: string,
  baseUrl: string
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append(
    "uploadMetadata",
    JSON.stringify({ tenantId: DOCUMENT_SERVICE_TENANT_ID })
  );
  // Ensure the file part is sent with the expected name "file" and a filename.
  // Do not use global File (not defined in all runtimes); FormData.append accepts Blob + filename.
  const blob = file as Blob;
  const name =
    typeof (file as { name?: string }).name === "string" && (file as { name?: string }).name
      ? (file as { name: string }).name
      : fileName;
  formData.append("file", blob, name);

  const url = `${baseUrl.replace(/\/$/, "")}/api/documents/upload`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    // Do not set Content-Type; let fetch set multipart/form-data with boundary
  });

  const text = await res.text();
  let json: DocumentUploadResponse & { error?: string };
  try {
    json = text ? (JSON.parse(text) as DocumentUploadResponse & { error?: string }) : {};
  } catch {
    throw new Error(
      res.ok
        ? "Document service returned invalid JSON"
        : `Document service error (${res.status}): ${text.slice(0, 200) || res.statusText}`
    );
  }
  if (!res.ok) {
    const msg = json.error || json.message || `Document service upload failed: ${res.status}`;
    throw new Error(msg);
  }
  return json;
}
