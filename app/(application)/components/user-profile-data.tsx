import { getSession } from "@/lib/auth";

export type UserProfileData = {
  user: {
    name: string;
    email: string;
    role: string;
  };
  tenantId: string;
  isLoggedIn: boolean;
};

// Default user details for when user is not authenticated
const defaultUser = {
  name: "Guest User",
  email: "guest@example.com",
  role: "Guest",
};

export async function getUserProfileData(): Promise<UserProfileData> {
  try {
    // Get session from NextAuth
    const session = await getSession();

    if (session && session.user) {
      // Extract user details from session
      const name = session.user.name || "User";
      const email = session.user.email || "user@example.com";

      // In a real app, you might want to fetch additional user details
      // like role from an API using the session token
      const role = "User"; // Default role

      return {
        user: {
          name,
          email,
          role,
        },
        tenantId: "default", // You might want to fetch this from an API
        isLoggedIn: true,
      };
    } else {
      // Return default values when not authenticated
      return {
        user: defaultUser,
        tenantId: "default",
        isLoggedIn: false,
      };
    }
  } catch (error) {
    console.error("Failed to fetch user profile data:", error);

    // Return default values on error
    return {
      user: defaultUser,
      tenantId: "default",
      isLoggedIn: false,
    };
  }
}
