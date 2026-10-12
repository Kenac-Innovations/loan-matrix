import { NextRequest, NextResponse } from "next/server";
import { buildFineractRequest } from "@/lib/api";
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
    const { id: loanId, documentId } = await params;

    console.log("=== DOWNLOADING LOAN DOCUMENT ===");
    console.log("Loan ID:", loanId);
    console.log("Document ID:", documentId);

    // For file downloads, we need to handle the response differently
    const { headers, url } = await buildFineractRequest(
      `/loans/${loanId}/documents/${documentId}/attachment`,
      {
        authMode: "service",
        headers: {
          Accept: "*/*",
        },
      }
    );
    console.log("Download URL:", url);

    let response;

    // Check if it's HTTP and use different approach
    if (url.startsWith("http://")) {
      // Use Node.js built-in http module for HTTP URLs
      const http = require("http");
      const urlModule = require("url");

      const parsedUrl = urlModule.parse(url);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.path,
        method: "GET",
        headers,
      };

      response = await new Promise<any>((resolve, reject) => {
        const req = http.request(options, (res: any) => {
          const chunks: Buffer[] = [];

          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });

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
      const fetch = require("node-fetch");

      response = await fetch(url, {
        method: "GET",
        headers,
        // Skip SSL verification for local development
        agent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });
    }

    console.log("Response status:", response.status);

    if (!response.ok) {
      let errorBody: string | undefined;
      try {
        if (response.arrayBuffer) {
          const errorBuffer = await response.arrayBuffer();
          errorBody = Buffer.from(errorBuffer).toString();
          console.error("Error response body:", errorBody);
        }
      } catch (e) {
        console.error("Could not parse error response");
      }

      const errorResponse = createFineractErrorResponsePayload(
        {
          status: response.status,
          errorData: errorBody
            ? {
                defaultUserMessage: errorBody,
                developerMessage: errorBody,
              }
            : {
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

    console.log("Document downloaded successfully");
    console.log("Content-Type:", contentType);
    console.log("Content-Disposition:", contentDisposition);
    console.log("File size:", fileBuffer.byteLength, "bytes");

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": responseContentDisposition,
        "Cache-Control": "no-cache",
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
