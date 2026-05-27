"use server";

import * as https from "https";
import { getAccessToken, getFineractTenantId } from "@/lib/api";

export interface DownloadLoanDocumentResult {
  success: boolean;
  fileName?: string;
  contentType?: string;
  fileBuffer?: ArrayBuffer;
  error?: string;
}

function getFileNameFromContentDisposition(
  contentDisposition: string | null
): string | undefined {
  if (!contentDisposition) return undefined;

  const encodedMatch = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i
  );
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return encodedMatch[1];
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1];
}

export async function downloadLoanDocumentAttachment(
  loanId: number | string,
  documentId: number | string
): Promise<DownloadLoanDocumentResult> {
  try {
    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();
    const baseUrl =
      process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";
    const url = `${baseUrl.replace(
      /\/$/,
      ""
    )}/fineract-provider/api/v1/loans/${loanId}/documents/${documentId}/attachment`;

    const headers = {
      Authorization: `Basic ${accessToken}`,
      "Fineract-Platform-TenantId": fineractTenantId,
      Accept: "application/json, text/plain, */*",
    };

    let response: Response;

    if (baseUrl.startsWith("http://")) {
      response = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
      });
    } else {
      const agent = new https.Agent({ rejectUnauthorized: false });

      response = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
        // @ts-expect-error - Node fetch accepts `agent` for HTTPS requests
        agent,
      });
    }

    if (!response.ok) {
      let errorMessage = "Failed to download document";

      try {
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage =
            errorData.defaultUserMessage ||
            errorData.developerMessage ||
            errorData.error ||
            errorMessage;
        } else {
          const errorText = await response.text();
          if (errorText.trim()) {
            errorMessage = errorText;
          }
        }
      } catch {
        // Keep the default error message when the response body is not readable.
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    const fileBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition");

    return {
      success: true,
      fileBuffer,
      contentType,
      fileName:
        getFileNameFromContentDisposition(contentDisposition) ||
        `document-${documentId}`,
    };
  } catch (error) {
    console.error("Error downloading loan document:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to download document",
    };
  }
}
