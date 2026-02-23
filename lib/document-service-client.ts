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
  formData.append("file", file, fileName);

  const url = `${baseUrl.replace(/\/$/, "")}/api/documents/upload`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const json = (await res.json()) as DocumentUploadResponse;
  if (!res.ok) {
    throw new Error(json.message || `Document service upload failed: ${res.status}`);
  }
  return json;
}
