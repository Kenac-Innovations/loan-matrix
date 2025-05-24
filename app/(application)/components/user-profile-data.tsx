import { getSession, getCurrentUserDetails } from "@/lib/auth";

// Define the role interface based on the authentication response
export interface Role {
  id: number;
  name: string;
  description: string;
  disabled: boolean;
}

export type UserProfileData = {
  user: {
    name: string;
    email: string;
    roles?: Role[];
    role?: string; // Keeping for backward compatibility
    officeName?: string;
    username?: string;
    isSelfServiceUser?: boolean;
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
      try {
        console.log("Session::", JSON.stringify(session));
        // Fetch detailed user information from Fineract API
        if (!session.user.id) {
          throw new Error("User ID is undefined");
        }
        const userData = await getCurrentUserDetails(session.user.id as string);

        // Extract user details from API response
        const firstName = userData.firstname || "";
        const lastName = userData.lastname || "";
        const name =
          `${firstName} ${lastName}`.trim() || session.user.name || "User";
        const email =
          userData.email || session.user.email || "user@example.com";

        // Get roles from session or API
        const roles =
          session.user.roles ||
          (userData.selectedRoles && userData.selectedRoles.length > 0
            ? userData.selectedRoles
            : [
                {
                  id: 0,
                  name: "User",
                  description: "Default user role",
                  disabled: false,
                },
              ]);

        // Keep a single role for backward compatibility
        const role = roles.length > 0 ? roles[0].name : "User";

        // Get additional user details
        const officeName = session.user.officeName || userData.officeName;
        const username = userData.username;
        const isSelfServiceUser = userData.isSelfServiceUser;

        return {
          user: {
            name,
            email,
            roles,
            role, // For backward compatibility
            officeName,
            username,
            isSelfServiceUser,
          },
          tenantId: "default", // You might want to fetch this from an API
          isLoggedIn: true,
        };
      } catch (error) {
        console.error("Failed to fetch detailed user data:", error);

        // Fallback to basic session data if API call fails
        const name = session.user.name || "User";
        const email = session.user.email || "user@example.com";

        // Get roles from session or use default
        const roles = session.user.roles || [
          {
            id: 0,
            name: "User",
            description: "Default user role",
            disabled: false,
          },
        ];
        const role = roles.length > 0 ? roles[0].name : "User"; // For backward compatibility

        return {
          user: {
            name,
            email,
            roles,
            role,
            officeName: session.user.officeName,
          },
          tenantId: "default",
          isLoggedIn: true,
        };
      }
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
