import { getServerSession } from "next-auth";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import https from "https";
import fetch from "node-fetch";
import { SpecificPermission } from "@/types/auth";
import { mapApiPermissionsToSpecific } from "./authorization";

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
          const baseUrl = process.env.FINERACT_BASE_URL || "https://demo.mifos.io";
          const authUrl = `${baseUrl}/fineract-provider/api/v1/authentication`;
          
          console.log("Auth Debug - baseUrl:", baseUrl);
          console.log("Auth Debug - authUrl:", authUrl);
          console.log("Auth Debug - isHTTP:", baseUrl.startsWith('http://'));
          console.log("Auth Debug - FINERACT_TENANT_ID:", process.env.FINERACT_TENANT_ID);
          console.log("Auth Debug - All env vars:", {
            FINERACT_BASE_URL: process.env.FINERACT_BASE_URL,
            FINERACT_TENANT_ID: process.env.FINERACT_TENANT_ID,
            FINERACT_USERNAME: process.env.FINERACT_USERNAME,
            FINERACT_PASSWORD: process.env.FINERACT_PASSWORD
          });
          
          let response;
          
          // Check if it's HTTP and use different approach
          if (baseUrl.startsWith('http://')) {
            console.log("Auth Debug - Using HTTP path");
            // Use Node.js built-in http module for HTTP URLs
            const http = require('http');
            const url = require('url');
            
            const parsedUrl = url.parse(authUrl);
            const postData = JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            });
            
            const options = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || 80,
              path: parsedUrl.path,
              method: 'POST',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Fineract-Platform-TenantId': "goodfellow",
                'Content-Length': Buffer.byteLength(postData),
              },
            };
            
            console.log("Auth Debug - HTTP request options:", options);
            console.log("Auth Debug - POST data:", postData);
            
            response = await new Promise<any>((resolve, reject) => {
              const req = http.request(options, (res: any) => {
                let data = '';
                console.log("Auth Debug - HTTP response status:", res.statusCode);
                res.on('data', (chunk: any) => {
                  data += chunk;
                });
                res.on('end', () => {
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
              
              req.on('error', (error) => {
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
                "Fineract-Platform-TenantId": "goodfellow",
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

          console.log("Auth Debug - Response status:", response.status, response.statusText);
          
          if (!response.ok) {
            console.error("Authentication failed:", response.status, response.statusText);
            const errorText = await response.text();
            console.error("Error response body:", errorText);
            return null;
          }

          const data = await response.json();
          console.log("Auth Debug - Response data keys:", Object.keys(data));
          const accessToken = data.base64EncodedAuthenticationKey;

          if (!accessToken) {
            return null;
          }

          // Map API permissions to our specific permissions
          const mappedPermissions = mapApiPermissionsToSpecific(
            data.permissions
          );

          // Return the user object with all the authentication data
          return {
            id: data.userId.toString(),
            userId: data.userId,
            name: data.username,
            email: data.username,
            accessToken,
            base64EncodedAuthenticationKey: data.base64EncodedAuthenticationKey,
            officeId: data.officeId,
            officeName: data.officeName,
            roles: data.roles,
            permissions: mappedPermissions,
            rawPermissions: data.permissions, // Keep the original permissions
            shouldRenewPassword: data.shouldRenewPassword, //TODO handle scenario where user must set a new password
            //TODO handle scenario where 2FA is enabled and required
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
    async jwt({ token, user }) {
      try {
        // Add user data to the token right after sign in
        if (user) {
          token.accessToken = user.accessToken;
          token.userId = user.userId;
          token.base64EncodedAuthenticationKey =
            user.base64EncodedAuthenticationKey;
          token.officeId = user.officeId;
          token.officeName = user.officeName;
          token.roles = user.roles;
          token.permissions = user.permissions;
          token.rawPermissions = user.rawPermissions;
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
          session.user.userId = token.userId as number;
          session.user.officeId = token.officeId as number;
          session.user.officeName = token.officeName as string;
          session.user.roles = token.roles as any[];
          session.user.permissions = token.permissions as SpecificPermission[];
          session.user.rawPermissions = token.rawPermissions as string[];
          session.user.shouldRenewPassword = token.shouldRenewPassword as boolean;
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
    // Use the hardcoded Basic authentication token from the curl command
    const url = `https://demo.mifos.io/fineract-provider/api/v1/users/${userId}`;
    const headers = {
      Accept: "application/json, text/plain, */*",
      Authorization: "Basic bWlmb3M6cGFzc3dvcmQ=",
      "Fineract-Platform-TenantId": "goodfellow",
      Origin: "http://localhost:4200",
      Referer: "http://localhost:4200/",
    };

    // Skip SSL verification for local development
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    const response = await fetch(url, {
      method: "GET",
      headers,
      // @ts-ignore
      agent: httpsAgent,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch user details:", error);
    throw error;
  }
}