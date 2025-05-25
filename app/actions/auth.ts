"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { SpecificPermission } from "@/types/auth";

// Type for user details
export type UserDetails = {
  id: number;
  username: string;
  officeId: number;
  officeName: string;
  firstname: string;
  lastname: string;
  email: string;
  passwordNeverExpires: boolean;
  availableRoles: Array<{
    id: number;
    name: string;
    description: string;
    disabled: boolean;
  }>;
  selectedRoles: Array<any>;
  isSelfServiceUser: boolean;
};

// Schema for login credentials validation
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Type for login credentials
type LoginCredentials = z.infer<typeof loginSchema>;

// Type for authentication result
type AuthResult = {
  success: boolean;
  error?: string;
  accessToken?: string;
};

// Secret key for JWT signing
const secretKey = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "your-secret-key-change-in-production"
);

/**
 * Server action to authenticate a user with the Fineract API
 */
export async function loginAction(
  formData: FormData | LoginCredentials
): Promise<AuthResult> {
  try {
    // Parse and validate credentials
    const rawCredentials =
      formData instanceof FormData
        ? {
            username: formData.get("username") as string,
            password: formData.get("password") as string,
          }
        : formData;

    const validationResult = loginSchema.safeParse(rawCredentials);

    if (!validationResult.success) {
      return {
        success: false,
        error: "Invalid credentials format",
      };
    }

    const { username, password } = validationResult.data;

    // Using node-fetch for server-side to handle SSL certificate issues
    const https = require("https");
    const fetch = require("node-fetch");

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
        body: JSON.stringify({ username, password }),
        // Skip SSL verification for local development
        agent: new https.Agent({
          rejectUnauthorized: false,
        }),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `Authentication failed: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    const accessToken = data.base64EncodedAuthenticationKey;

    // Create a JWT token with the user info and access token
    const token = await new SignJWT({
      id: username,
      name: username,
      email: `${username}@example.com`, // Placeholder email
      accessToken,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h") // Token expires in 8 hours
      .sign(secretKey);

    // Set the token in a secure HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60, // 8 hours in seconds
      path: "/",
    });

    return {
      success: true,
      accessToken,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during authentication",
    };
  }
}

/**
 * Server action to log out a user
 */
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
  redirect("/auth/login");
}

/**
 * Get the current user's session from the auth token
 */
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, secretKey);
    return verified.payload as {
      id: string;
      name: string;
      email: string;
      accessToken: string;
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

/**
 * Get the current user's access token
 */
export async function getAccessToken() {
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
 * Makes an authenticated request to the Fineract API
 */
export async function fetchFineractAPI(
  endpoint: string,
  options: RequestInit = {}
) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("No access token available");
  }

  const url = `https://localhost:8443/fineract-provider/api/v1${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  const headers = {
    ...options.headers,
    Authorization: `Basic ${accessToken}`,
    "Fineract-Platform-TenantId": "default",
    "Content-Type": "application/json",
  };

  // Skip SSL verification for local development
  const https = require("https");
  const fetch = require("node-fetch");
  const agent = new https.Agent({ rejectUnauthorized: false });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      agent,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

/**
 * Fetch user details from the Fineract API
 * @param userId - The ID of the user to fetch details for
 * @returns Promise with the user details
 */
export async function fetchUserDetails(
  userId: number = 2
): Promise<UserDetails> {
  try {
    const userDetails = await fetchFineractAPI(`/users/${userId}`);
    return userDetails as UserDetails;
  } catch (error) {
    console.error("Failed to fetch user details:", error);
    throw error;
  }
}

/**
 * Get the current tenant ID
 * @returns The current tenant ID (default is "default")
 */
export async function getCurrentTenant(): Promise<string> {
  // In a real application, this might be fetched from the API or stored in the session
  // For now, we'll return the default tenant ID
  return "default";
}
