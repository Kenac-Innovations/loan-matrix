import { getServerSession } from "next-auth";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import https from "https";
import fetch from "node-fetch";
import { SpecificPermission } from "@/shared/types/auth";
import { mapApiPermissionsToSpecific } from "./authorization";
import { getFineractTenantId } from "./fineract-tenant-service";

// Define the NextAuth options
export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Fineract API",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          // Get the Fineract tenant ID based on the current subdomain
          const fineractTenantId = await getFineractTenantId();

          const baseUrl =
            process.env.FINERACT_BASE_URL || "https://demo.mifos.io";
          const authUrl = `${baseUrl}/fineract-provider/api/v1/authentication`;

          console.log("Auth Debug - baseUrl:", baseUrl);
          console.log("Auth Debug - authUrl:", authUrl);
          console.log("Auth Debug - fineractTenantId:", fineractTenantId);
          console.log("Auth Debug - isHTTP:", baseUrl.startsWith("http://"));
          console.log(
            "Auth Debug - FINERACT_TENANT_ID:",
            process.env.FINERACT_TENANT_ID
          );
          console.log("Auth Debug - All env vars:", {
            FINERACT_BASE_URL: process.env.FINERACT_BASE_URL,
            FINERACT_TENANT_ID: process.env.FINERACT_TENANT_ID,
            FINERACT_USERNAME: process.env.FINERACT_USERNAME,
            FINERACT_PASSWORD: process.env.FINERACT_PASSWORD,
          });

          let response;

          // Check if it's HTTP and use different approach
          if (baseUrl.startsWith("http://")) {
            console.log("Auth Debug - Using HTTP path");
            // Use Node.js built-in http module for HTTP URLs
            const http = require("http");
            const url = require("url");

            const parsedUrl = url.parse(authUrl);
            const postData = JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            });

            const options = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || 80,
              path: parsedUrl.path,
              method: "POST",
              headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "Fineract-Platform-TenantId": fineractTenantId,
                "Content-Length": Buffer.byteLength(postData),
              },
            };

            console.log("Auth Debug - HTTP request options:", options);
            console.log("Auth Debug - POST data:", postData);

            response = await new Promise<any>((resolve, reject) => {
              const req = http.request(options, (res: any) => {
                let data = "";
                console.log(
                  "Auth Debug - HTTP response status:",
                  res.statusCode
                );
                res.on("data", (chunk: any) => {
                  data += chunk;
                });
                res.on("end", () => {
                  console.log("Auth Debug - HTTP response data:", data);
                  resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    json: async () => JSON.parse(data),
                    text: async () => data,
                  });
                });
              });

              req.on("error", (error: Error) => {
                console.error("Auth Debug - HTTP request error:", error);
                reject(error);
              });
              req.write(postData);
              req.end();
            });
          } else {
            console.log("Auth Debug - Using HTTPS path");
            // Use fetch for HTTPS URLs (original code)
            response = await fetch(authUrl, {
              method: "POST",
              headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "Fineract-Platform-TenantId": fineractTenantId,
              },
              body: JSON.stringify({
                username: credentials.username,
                password: credentials.password,
              }),
              // Skip SSL verification for local development
              agent: new https.Agent({
                rejectUnauthorized: false,
              }),
            });
          }

          console.log(
            "Auth Debug - Response status:",
            response.status,
            response.statusText
          );

          if (!response.ok) {
            console.error(
              "Authentication failed:",
              response.status,
              response.statusText
            );
            const errorText = await response.text();
            console.error("Error response body:", errorText);
            return null;
          }

          const data = await response.json();
          console.log("=== AUTH LOGIN ===", data.username, "roles:", JSON.stringify(data.roles));
          console.log("Auth Debug - Response data keys:", Object.keys(data));
          console.log(
            "Auth Debug - base64EncodedAuthenticationKey from Fineract:",
            data.base64EncodedAuthenticationKey
          );

          // Compute Basic auth token ourselves: base64(username:password)
          const computedBasicAuth = Buffer.from(
            `${credentials.username}:${credentials.password}`
          ).toString("base64");
          console.log(
            "Auth Debug - Computed Basic auth token:",
            computedBasicAuth
          );

          // Use our computed token instead of Fineract's response
          const accessToken = computedBasicAuth;

          if (!data.base64EncodedAuthenticationKey) {
            // Auth failed if Fineract didn't return the key
            return null;
          }

          // Map API permissions to our specific permissions
          const mappedPermissions = mapApiPermissionsToSpecific(
            data.permissions
          );

          // If auth response has empty roles, fetch from user details endpoint as fallback
          let userRoles = data.roles || [];
          if (userRoles.length === 0 && data.userId) {
            try {
              console.log("Auth Debug - Roles empty from auth endpoint, fetching from /users/" + data.userId);
              const userDetailUrl = `${baseUrl}/fineract-provider/api/v1/users/${data.userId}`;
              let userDetailResponse;

              if (baseUrl.startsWith("http://")) {
                const http = require("http");
                const url = require("url");
                const parsedUrl = url.parse(userDetailUrl);
                userDetailResponse = await new Promise<any>((resolve, reject) => {
                  const req = http.request({
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || 80,
                    path: parsedUrl.path,
                    method: "GET",
                    headers: {
                      Accept: "application/json",
                      Authorization: `Basic ${computedBasicAuth}`,
                      "Fineract-Platform-TenantId": fineractTenantId,
                    },
                  }, (res: any) => {
                    let body = "";
                    res.on("data", (chunk: any) => { body += chunk; });
                    res.on("end", () => {
                      resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        json: async () => JSON.parse(body),
                      });
                    });
                  });
                  req.on("error", reject);
                  req.end();
                });
              } else {
                userDetailResponse = await fetch(userDetailUrl, {
                  method: "GET",
                  headers: {
                    Accept: "application/json",
                    Authorization: `Basic ${computedBasicAuth}`,
                    "Fineract-Platform-TenantId": fineractTenantId,
                  },
                  agent: new https.Agent({ rejectUnauthorized: false }),
                });
              }

              if (userDetailResponse.ok) {
                const userData = await userDetailResponse.json();
                if (userData.selectedRoles && userData.selectedRoles.length > 0) {
                  userRoles = userData.selectedRoles;
                  console.log("Auth Debug - Fetched roles from user details:", userRoles.map((r: any) => r.name));
                }
              }
            } catch (roleError) {
              console.error("Auth Debug - Failed to fetch user roles fallback:", roleError);
            }
          }

          // Return the user object with all the authentication data
          return {
            id: data.userId.toString(),
            userId: data.userId,
            name: data.username,
            email: data.username,
            accessToken,
            base64EncodedAuthenticationKey: computedBasicAuth,
            officeId: data.officeId,
            officeName: data.officeName,
            roles: userRoles,
            permissions: mappedPermissions,
            rawPermissions: data.permissions,
            shouldRenewPassword: data.shouldRenewPassword,
            isTwoFactorAuthenticationRequired:
              data.isTwoFactorAuthenticationRequired,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          console.error("Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allow relative URLs (they resolve against the browser's current origin)
      if (url.startsWith("/")) return url;

      try {
        const urlObj = new URL(url);
        const baseObj = new URL(baseUrl);

        if (
          urlObj.hostname.endsWith(".kenacloanmatrix.com") ||
          urlObj.hostname.endsWith(".kenac.co.zw") ||
          urlObj.hostname === baseObj.hostname ||
          urlObj.hostname === "localhost"
        ) {
          return url;
        }
      } catch {
        // Malformed URL — fall through to default
      }

      return baseUrl;
    },
    async jwt({ token, user }) {
      try {
        // Add user data to the token right after sign in
        // NOTE: Only store essential data to avoid 431 "Request Header Fields Too Large" error
        // rawPermissions can be very large and causes the JWT cookie to exceed size limits
        if (user) {
          token.name = user.name;
          token.email = user.email;
          token.accessToken = user.accessToken;
          token.userId = user.userId;
          token.base64EncodedAuthenticationKey =
            user.base64EncodedAuthenticationKey;
          token.officeId = user.officeId;
          token.officeName = user.officeName;
          // Only store role IDs and names to reduce token size
          token.roles = user.roles?.map((r: any) => ({ id: r.id, name: r.name, disabled: r.disabled })) || [];
          token.permissions = user.permissions;
          // Don't store rawPermissions - it can contain hundreds of items and causes 431 errors
          token.shouldRenewPassword = user.shouldRenewPassword;
          token.isTwoFactorAuthenticationRequired =
            user.isTwoFactorAuthenticationRequired;
        }
        return token;
      } catch (error) {
        console.error("JWT callback error:", error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        // Add user data to the session
        session.accessToken = token.accessToken;
        session.base64EncodedAuthenticationKey =
          token.base64EncodedAuthenticationKey;

        // Add user data to session.user
        if (session.user) {
          session.user.id = token.sub ?? "";
          session.user.name = token.name as string;
          session.user.email = token.email as string;
          session.user.userId = token.userId as number;
          session.user.officeId = token.officeId as number;
          session.user.officeName = token.officeName as string;
          session.user.roles = token.roles as any[];
          session.user.permissions = token.permissions as SpecificPermission[];
          // rawPermissions not stored in JWT to avoid 431 errors - use permissions instead
          session.user.rawPermissions = [];
          session.user.shouldRenewPassword =
            token.shouldRenewPassword as boolean;
          session.user.isTwoFactorAuthenticationRequired =
            token.isTwoFactorAuthenticationRequired as boolean;
        }

        return session;
      } catch (error) {
        console.error("Session callback error:", error);
        return session;
      }
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
};

/**
 * Get the current user's session
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Get the current user's access token
 */
export async function getAccessToken(): Promise<string | undefined> {
  const session = await getSession();
  return session?.accessToken;
}

/**
 * Check if the user is authenticated
 */
export async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

/**
 * Get the current logged-in user details
 * @returns Promise with the user details
 */
export async function getCurrentUserDetails(userId: String) {
  try {
    const { getFineractTenantId } = await import("./fineract-tenant-service");
    const fineractTenantId = await getFineractTenantId();
    const fineractBaseURL =
      process.env.FINERACT_BASE_URL || "http://41.174.125.165:4032";
    const url = `${fineractBaseURL}/fineract-provider/api/v1/users/${userId}`;
    const headers = {
      Accept: "application/json, text/plain, */*",
      Authorization: "Basic bWlmb3M6cGFzc3dvcmQ=",
      "Fineract-Platform-TenantId": fineractTenantId,
    };

    let response;

    // Check if it's HTTP and use different approach
    if (url.startsWith("http://")) {
      // Use standard fetch for HTTP URLs (no agent needed)
      response = await fetch(url, {
        method: "GET",
        headers,
      });
    } else {
      // Skip SSL verification for local development (HTTPS only)
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });

      response = await fetch(url, {
        method: "GET",
        headers,
        // @ts-ignore
        agent: httpsAgent,
      });
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch user details:", error);
    throw error;
  }
}
