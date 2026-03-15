import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSession as getCustomSession } from "@/app/actions/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * Get access token from either NextAuth session or custom JWT session
 */
async function getAccessToken(): Promise<string | undefined> {
  try {
    const nextAuthSession = await getSession();
    if (nextAuthSession?.accessToken) {
      return nextAuthSession.accessToken;
    }

    const customSession = await getCustomSession();
    if (customSession?.accessToken) {
      return customSession.accessToken;
    }

    return undefined;
  } catch (error) {
    console.error("Error getting access token:", error);
    return undefined;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: loanId, documentId } = await params;

    console.log("=== DOWNLOADING LOAN DOCUMENT ===");
    console.log("Loan ID:", loanId);
    console.log("Document ID:", documentId);

    // For file downloads, we need to handle the response differently
    const url = `${baseUrl}/fineract-provider/api/v1/loans/${loanId}/documents/${documentId}/attachment`;
    console.log("Download URL:", url);

    let response;

    // Check if it's HTTP and use different approach
    if (baseUrl.startsWith("http://")) {
      // Use Node.js built-in http module for HTTP URLs
      const http = require("http");
      const urlModule = require("url");

      const parsedUrl = urlModule.parse(url);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.path,
        method: "GET",
        headers: {
          Accept: "*/*",
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
        },
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
        headers: {
          Accept: "*/*",
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
        },
        // Skip SSL verification for local development
        agent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });
    }

    console.log("Response status:", response.status);

    if (!response.ok) {
      let errorMessage = "Failed to download document";
      try {
        if (response.arrayBuffer) {
          const errorBuffer = await response.arrayBuffer();
          const errorText = Buffer.from(errorBuffer).toString();
          console.error("Error response body:", errorText);
          errorMessage = errorText || errorMessage;
        }
      } catch (e) {
        console.error("Could not parse error response");
      }

      console.error(
        "Failed to download document:",
        response.status,
        response.statusText,
        errorMessage
      );
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // Get the file data
    const fileBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition =
      response.headers.get("content-disposition") || "";

    console.log("Document downloaded successfully");
    console.log("Content-Type:", contentType);
    console.log("Content-Disposition:", contentDisposition);
    console.log("File size:", fileBuffer.byteLength, "bytes");

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error downloading document:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: `Failed to download document: ${errorMessage}` },
      { status: 500 }
    );
  }
}
