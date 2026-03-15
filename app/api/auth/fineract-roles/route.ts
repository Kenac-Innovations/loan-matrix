import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ roles: [] }, { status: 200 });
    }

    const fineractTenantId = await getFineractTenantId();
    const baseUrl = process.env.FINERACT_BASE_URL || "http://mifos-be.kenac.co.zw";
    const userDetailUrl = `${baseUrl}/fineract-provider/api/v1/users/${session.user.userId}`;

    const authToken = session.base64EncodedAuthenticationKey || session.accessToken;

    let response;
    if (baseUrl.startsWith("http://")) {
      const http = require("http");
      const url = require("url");
      const parsedUrl = url.parse(userDetailUrl);
      response = await new Promise<any>((resolve, reject) => {
        const req = http.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.path,
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Basic ${authToken}`,
              "Fineract-Platform-TenantId": fineractTenantId,
            },
          },
          (res: any) => {
            let body = "";
            res.on("data", (chunk: any) => {
              body += chunk;
            });
            res.on("end", () => {
              resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                json: () => JSON.parse(body),
              });
            });
          }
        );
        req.on("error", reject);
        req.end();
      });
    } else {
      const https = require("https");
      response = await fetch(userDetailUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${authToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
        },
        // @ts-ignore
        agent: new https.Agent({ rejectUnauthorized: false }),
      });
    }

    if (!response.ok) {
      return NextResponse.json({ roles: [] }, { status: 200 });
    }

    const userData = response.json();
    const roles = userData.selectedRoles || [];

    return NextResponse.json({
      roles,
      officeName: userData.officeName,
      username: userData.username,
    });
  } catch (error) {
    console.error("Error fetching Fineract roles:", error);
    return NextResponse.json({ roles: [] }, { status: 200 });
  }
}
