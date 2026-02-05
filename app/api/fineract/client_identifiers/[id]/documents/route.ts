import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getFineractTenantId } from "@/lib/api";

/**
 * GET /api/fineract/client_identifiers/[id]/documents
 * Fetches documents linked to a specific identifier
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: identifierId } = await params;
    const baseUrl = process.env.FINERACT_BASE_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Fineract base URL not configured" },
        { status: 500 }
      );
    }

    const url = `${baseUrl}/fineract-provider/api/v1/client_identifiers/${identifierId}/documents`;

    let response;

    if (baseUrl?.startsWith("http://")) {
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
          Accept: "application/json, text/plain, */*",
        },
        rejectUnauthorized: false,
      };

      response = await new Promise((resolve, reject) => {
        const req = http.request(options, (res: any) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const buffer = Buffer.concat(chunks);
            let data;
            try {
              data = JSON.parse(buffer.toString());
            } catch (e) {
              data = { message: buffer.toString() };
            }
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              json: async () => data,
            });
          });
        });
        req.on("error", reject);
        req.end();
      });
    } else {
      const https = require("https");
      const agent = new https.Agent({ rejectUnauthorized: false });

      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json, text/plain, */*",
        },
        //@ts-ignore
        agent,
      });
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = {
          defaultUserMessage: `HTTP ${response.status}: ${response.statusText}`,
          developerMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return NextResponse.json(
        {
          error:
            errorData.defaultUserMessage ||
            errorData.developerMessage ||
            "Failed to fetch documents",
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching identifier documents:", error);
    return NextResponse.json(
      {
        error: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fineract/client_identifiers/[id]/documents
 * Uploads a document to a specific identifier
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: identifierId } = await params;
    const baseUrl = process.env.FINERACT_BASE_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Fineract base URL not configured" },
        { status: 500 }
      );
    }

    // Get the form data from the request
    const formData = await request.formData();

    // Build the URL
    const url = `${baseUrl}/fineract-provider/api/v1/client_identifiers/${identifierId}/documents`;

    let response;

    // Check if it's HTTP and use different approach
    if (baseUrl?.startsWith("http://")) {
      // Use Node.js built-in http module for HTTP URLs
      const http = require("http");
      const urlObj = new URL(url);
      const FormData = require("form-data");
      const form = new FormData();

      // Append all fields from the incoming form data
      for (const [key, value] of formData.entries()) {
        // Check if value is a Blob (files from formData are Blob in Node.js, not File)
        if (typeof value === "object" && value !== null && typeof (value as Blob).arrayBuffer === "function") {
          const blobValue = value as Blob;
          const buffer = Buffer.from(await blobValue.arrayBuffer());
          // Get filename from the Blob if it has a name property (like File does)
          const filename = (value as any).name || "file";
          form.append(key, buffer, {
            filename: filename,
            contentType: blobValue.type || "application/octet-stream",
          });
        } else {
          form.append(key, value);
        }
      }

      // Calculate content length - required by Fineract API
      let contentLength: number;
      try {
        contentLength = form.getLengthSync();
      } catch (lengthError) {
        console.error("Error calculating form content length:", lengthError);
        return NextResponse.json(
          {
            error: "Failed to calculate upload content length",
            details: "The file may be too large or in an unsupported format",
          },
          { status: 400 }
        );
      }

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        headers: {
          ...form.getHeaders(),
          "Content-Length": contentLength,
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json, text/plain, */*",
        },
        rejectUnauthorized: false,
      };

      response = await new Promise((resolve, reject) => {
        const req = http.request(options, (res: any) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const buffer = Buffer.concat(chunks);
            let data;
            try {
              data = JSON.parse(buffer.toString());
            } catch (e) {
              data = { message: buffer.toString() };
            }
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              json: async () => data,
            });
          });
        });
        req.on("error", reject);
        form.pipe(req);
      });
    } else {
      // Use fetch for HTTPS URLs
      const https = require("https");
      const agent = new https.Agent({ rejectUnauthorized: false });

      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json, text/plain, */*",
        },
        body: formData,
        //@ts-ignore
        agent,
      });
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = {
          defaultUserMessage: `HTTP ${response.status}: ${response.statusText}`,
          developerMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      console.error(
        "Failed to upload document to identifier:",
        response.status,
        response.statusText,
        errorData
      );

      return NextResponse.json(
        {
          error:
            errorData.defaultUserMessage ||
            errorData.developerMessage ||
            "Failed to upload document",
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error uploading document to identifier:", error);
    return NextResponse.json(
      {
        error: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
