import { NextRequest, NextResponse } from "next/server";
import { getFineractTenantId } from "@/lib/api";
import { getSearchAuthToken } from "@/lib/fineract-search-auth";
import { toInlineContentDisposition } from "@/lib/document-viewing";
import {
  buildFineractErrorResponse,
  createFineractErrorResponsePayload,
} from "@/lib/fineract-route-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const accessToken = getSearchAuthToken();
    const fineractTenantId = await getFineractTenantId();

    const { id: clientId, documentId } = await params;
    const baseUrl = process.env.FINERACT_BASE_URL;

    // For file downloads, we need to handle the response differently
    const url = `${baseUrl}/fineract-provider/api/v1/clients/${clientId}/documents/${documentId}/attachment`;

    let response;

    // Check if it's HTTP and use different approach
    if (baseUrl?.startsWith("http://")) {
      // Use Node.js built-in http module for HTTP URLs
      const http = require("http");
      const urlObj = new URL(url);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "*/*",
        },
        rejectUnauthorized: false,
      };

      response = await new Promise((resolve, reject) => {
        const req = http.request(options, (res: any) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: {
                get: (key: string) => res.headers[key.toLowerCase()],
              },
              arrayBuffer: async () => buffer,
            });
          });
        });
        req.on("error", reject);
        req.end();
      });
    } else {
      // Use fetch for HTTPS URLs
      const https = require("https");
      const agent = new https.Agent({ rejectUnauthorized: false });

      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "*/*",
        },
        //@ts-ignore
        agent,
      });
    }

    if (!response.ok) {
      const errorResponse = createFineractErrorResponsePayload(
        {
          status: response.status,
          errorData: {
            defaultUserMessage: "Failed to download document",
            developerMessage: response.statusText,
          },
          response: { statusText: response.statusText },
        },
        {
          action: "download",
          resource: "document",
        }
      );

      console.error(
        "Failed to download document:",
        response.status,
        response.statusText
      );
      return NextResponse.json(errorResponse.body, {
        status: errorResponse.status,
      });
    }

    // Get the file data
    const fileBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition =
      response.headers.get("content-disposition") || "";
    const responseContentDisposition =
      request.nextUrl.searchParams.get("disposition") === "inline"
        ? toInlineContentDisposition(contentDisposition)
        : contentDisposition;

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": responseContentDisposition,
      },
    });
  } catch (error) {
    console.error("Error downloading document:", error);
    return buildFineractErrorResponse(error, {
      action: "download",
      resource: "document",
    });
  }
}
