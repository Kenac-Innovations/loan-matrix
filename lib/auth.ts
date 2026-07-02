import { getServerSession } from "next-auth";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import https from "https";
import fetch from "node-fetch";
import { Role, SpecificPermission } from "@/shared/types/auth";
import {
  authenticateWithFineractCredentials,
  getPermissionValidationError,
} from "@/lib/fineract-auth";
import { consumeVerifiedMfaChallenge, getTenantMfaConfig } from "@/lib/mfa";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  getUserLoginByFineractUserId,
  isUserLoginBlocked,
  updateUserLoginLastLogin,
} from "@/lib/user-login-service";

if (process.env.NODE_ENV === "development" && !process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}

function isTrustedLocalDevHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost")
  );
}

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
        challengeId: { label: "Challenge ID", type: "text" },
        verificationToken: { label: "Verification Token", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (credentials?.challengeId && credentials?.verificationToken) {
            return await consumeVerifiedMfaChallenge({
              challengeId: credentials.challengeId,
              verificationToken: credentials.verificationToken,
            });
          }

          if (!credentials?.username || !credentials?.password) {
            return null;
          }

          const tenant = await getTenantFromHeaders();
          if (!tenant) {
            console.error(
              "Blocking direct sign-in because tenant could not be resolved for credentials flow"
            );
            return null;
          }

          const authUser = await authenticateWithFineractCredentials({
            username: credentials.username,
            password: credentials.password,
          });

          const validationError = getPermissionValidationError(
            authUser.rawPermissions
          );
          if (validationError) {
            console.error("Auth validation blocked session creation:", validationError);
            return null;
          }

          const userLogin = await getUserLoginByFineractUserId(
            tenant.id,
            authUser.userId
          );

          if (isUserLoginBlocked(userLogin)) {
            console.warn(
              `Blocking direct sign-in because user ${authUser.username} is blocked for tenant ${tenant.slug || tenant.id}`
            );
            return null;
          }

          const tenantMfaConfig = getTenantMfaConfig(tenant.settings);
          if (tenantMfaConfig.usesMfa) {
            console.warn(
              `Blocking direct sign-in because MFA is enabled for tenant ${tenant.slug || authUser.tenantId}`
            );
            return null;
          }

          return {
            ...authUser,
            tenantId: tenant.id,
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
      // NextAuth client helpers may parse the returned URL with `new URL(...)`,
      // so normalize relative callback paths to absolute URLs here.
      if (url.startsWith("/")) {
        return new URL(url, baseUrl).toString();
      }

      try {
        const urlObj = new URL(url);
        const baseObj = new URL(baseUrl);

        if (
          urlObj.hostname.endsWith(".kenacloanmatrix.com") ||
          urlObj.hostname.endsWith(".kenac.co.zw") ||
          urlObj.hostname === baseObj.hostname ||
          (isTrustedLocalDevHost(urlObj.hostname) &&
            isTrustedLocalDevHost(baseObj.hostname))
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
          token.tenantId = user.tenantId;
          token.userId = user.userId;
          token.base64EncodedAuthenticationKey =
            user.base64EncodedAuthenticationKey;
          token.officeId = user.officeId;
          token.officeName = user.officeName;
          // Keep the role payload compact while preserving the shared Role type.
          token.roles =
            user.roles?.map((role) => ({
              id: role.id,
              name: role.name,
              description: role.description ?? "",
              disabled: Boolean(role.disabled),
            })) || [];
          token.permissions = user.permissions;
          // Don't store rawPermissions - it can contain hundreds of items and causes 431 errors
          token.shouldRenewPassword = user.shouldRenewPassword;
          token.isTwoFactorAuthenticationRequired =
            user.isTwoFactorAuthenticationRequired;

          if (user.tenantId && user.userId && user.name) {
            await updateUserLoginLastLogin({
              tenantId: user.tenantId,
              fineractUserId: user.userId,
              username: user.name,
            });
          }
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
          session.user.tenantId = token.tenantId as string;
          session.user.userId = token.userId as number;
          session.user.officeId = token.officeId as number;
          session.user.officeName = token.officeName as string;
          session.user.roles = token.roles as Role[];
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
export async function getCurrentUserDetails(userId: string) {
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
