import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: loanId, documentId } = await params;
    const baseUrl = process.env.FINERACT_BASE_URL;
    const tenantId = process.env.FINERACT_TENANT_ID || "goodfellow";

    // For file downloads, we need to handle the response differently
    const url = `${baseUrl}/fineract-provider/api/v1/loans/${loanId}/documents/${documentId}/attachment`;

    let response;
    
    // Check if it's HTTP and use different approach
    if (baseUrl?.startsWith('http://')) {
      // Use Node.js built-in http module for HTTP URLs
      const http = require('http');
      const urlModule = require('url');
      
      const parsedUrl = urlModule.parse(url);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'Accept': '*/*',
          'Authorization': `Basic ${session.base64EncodedAuthenticationKey}`,
          'Fineract-Platform-TenantId': tenantId,
        },
      };
      
      response = await new Promise<any>((resolve, reject) => {
        const req = http.request(options, (res: any) => {
          const chunks: Buffer[] = [];
          
          res.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          
          res.on('end', () => {
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
        
        req.on('error', reject);
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
          Authorization: `Basic ${session.base64EncodedAuthenticationKey}`,
          "Fineract-Platform-TenantId": tenantId,
        },
        // Skip SSL verification for local development
        agent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });
    }

    if (!response.ok) {
      console.error("Failed to download document:", response.status, response.statusText);
      return NextResponse.json(
        { error: "Failed to download document" },
        { status: response.status }
      );
    }

    // Get the file data
    const fileBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition') || '';

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });

  } catch (error) {
    console.error("Error downloading document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
