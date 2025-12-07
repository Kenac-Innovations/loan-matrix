import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getFineractTenantId } from "@/lib/api";

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

    const { id: identifierId, documentId } = await params;
    const baseUrl = process.env.FINERACT_BASE_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Fineract base URL not configured" },
        { status: 500 }
      );
    }

    // For file downloads, we need to handle the response differently
    const url = `${baseUrl}/fineract-provider/api/v1/client_identifiers/${identifierId}/documents/${documentId}/attachment`;

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
      console.error(
        "Failed to download identifier document:",
        response.status,
        response.statusText
      );
      return NextResponse.json(
        { error: "Failed to download document" },
        { status: response.status }
      );
    }

    // Get the file data
    const fileBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition =
      response.headers.get("content-disposition") || "";

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error) {
    console.error("Error downloading identifier document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

