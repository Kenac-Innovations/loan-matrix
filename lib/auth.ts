import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import https from "https";
import fetch from "node-fetch";
import { fetchFineractAPI } from "./api";

// Define the NextAuth options
export const authOptions: NextAuthOptions = {
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
          // Make a request to the Fineract API for authentication
          const response = await fetch(
            "https://localhost:8443/fineract-provider/api/v1/authentication",
            {
              method: "POST",
              headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "Fineract-Platform-TenantId": "default",
              },
              body: JSON.stringify({
                username: credentials.username,
                password: credentials.password,
              }),
              // Skip SSL verification for local development
              agent: new https.Agent({
                rejectUnauthorized: false,
              }),
            }
          );

          if (!response.ok) {
            console.error("Authentication failed:", response.statusText);
            return null;
          }

          const data = await response.json();
          const accessToken = data.base64EncodedAuthenticationKey;

          if (!accessToken) {
            return null;
          }

          console.log("Data::", data);

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
            permissions: data.permissions,
            shouldRenewPassword: data.shouldRenewPassword, //TODO handle scenario where user must set a new password
            //TODO handle scenario where 2FA is enabled and required
            isTwoFactorAuthenticationRequired:
              data.isTwoFactorAuthenticationRequired,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
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
        token.shouldRenewPassword = user.shouldRenewPassword;
        token.isTwoFactorAuthenticationRequired =
          user.isTwoFactorAuthenticationRequired;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user data to the session
      session.accessToken = token.accessToken;
      session.base64EncodedAuthenticationKey =
        token.base64EncodedAuthenticationKey;

      // Add user data to session.user
      if (session.user) {
        session.user.id = token.sub;
        session.user.userId = token.userId as number;
        session.user.officeId = token.officeId as number;
        session.user.officeName = token.officeName as string;
        session.user.roles = token.roles as any[];
        session.user.permissions = token.permissions as string[];
        session.user.shouldRenewPassword = token.shouldRenewPassword as boolean;
        session.user.isTwoFactorAuthenticationRequired =
          token.isTwoFactorAuthenticationRequired as boolean;
      }

      return session;
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
export async function getAccessToken() {
  const session = await getSession();
  return session?.accessToken as string | undefined;
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
    const url = `https://localhost:8443/fineract-provider/api/v1/users/${userId}`;
    const headers = {
      Accept: "application/json, text/plain, */*",
      Authorization: "Basic a3VkemFpbWFjaGV5bzpVbmxlYXNoZWQuYjNhc3Q0Mio=",
      "Fineract-Platform-TenantId": "default",
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
