import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import https from "https";
import fetch from "node-fetch";

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

          // Return the user object with the access token
          return {
            id: credentials.username,
            name: credentials.username,
            email: `${credentials.username}@example.com`, // Placeholder email
            accessToken,
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
      // Add access token to the token right after sign in
      if (user) {
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      // Add access token to the session
      session.accessToken = token.accessToken;
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
