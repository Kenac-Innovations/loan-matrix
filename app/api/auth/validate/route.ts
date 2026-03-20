import { NextRequest, NextResponse } from "next/server";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import https from "https";
import fetch from "node-fetch";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    const fineractTenantId = await getFineractTenantId();
    const baseUrl =
      process.env.FINERACT_BASE_URL || "https://demo.mifos.io";
    const authUrl = `${baseUrl}/fineract-provider/api/v1/authentication`;

    const body = JSON.stringify({ username, password });
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Fineract-Platform-TenantId": fineractTenantId,
    };

    let response;

    if (baseUrl.startsWith("http://")) {
      const http = require("http");
      const url = require("url");
      const parsedUrl = url.parse(authUrl);

      response = await new Promise<{
        ok: boolean;
        status: number;
        json: () => Promise<any>;
      }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.path,
            method: "POST",
            headers: {
              ...headers,
              "Content-Length": Buffer.byteLength(body),
            },
          },
          (res: any) => {
            let data = "";
            res.on("data", (chunk: any) => {
              data += chunk;
            });
            res.on("end", () => {
              resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                json: async () => JSON.parse(data),
              });
            });
          }
        );
        req.on("error", reject);
        req.write(body);
        req.end();
      });
    } else {
      response = await fetch(authUrl, {
        method: "POST",
        headers,
        body,
        agent: new https.Agent({ rejectUnauthorized: false }),
      });
    }

    if (!response.ok) {
      let errorMessage = "Authentication failed";
      try {
        const errorData = await response.json();
        if (errorData.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        } else if (errorData.developerMessage) {
          errorMessage = errorData.developerMessage;
        } else if (
          errorData.errors?.length > 0 &&
          errorData.errors[0].defaultUserMessage
        ) {
          errorMessage = errorData.errors[0].defaultUserMessage;
        }
      } catch {
        errorMessage = `Authentication failed (${response.status})`;
      }
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 401 }
      );
    }

    const data = await response.json();

    if (!data.base64EncodedAuthenticationKey) {
      return NextResponse.json(
        { success: false, error: "Authentication failed. Please check your credentials." },
        { status: 401 }
      );
    }

    const userPermissions: string[] = data.permissions || [];

    if (userPermissions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your account does not have any permissions assigned. Please contact your administrator.",
        },
        { status: 403 }
      );
    }

    const hasAllFunctions =
      userPermissions.includes("ALL_FUNCTIONS") ||
      userPermissions.includes("ALL_FUNCTIONS_READ");

    if (!hasAllFunctions) {
      const requiredPermissions = [
        "READ_USER",
        "READ_CURRENCY",
        "READ_REPORT",
      ];
      const missing = requiredPermissions.filter(
        (p) => !userPermissions.includes(p)
      );

      if (missing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient privileges. Your account is missing required permissions: ${missing.join(", ")}. Please contact your administrator.`,
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Validation route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to connect to authentication service",
      },
      { status: 500 }
    );
  }
}
