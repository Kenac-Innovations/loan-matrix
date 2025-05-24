import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

// Define the role interface based on the authentication response
interface Role {
  id: number;
  name: string;
  description: string;
  disabled: boolean;
}

declare module "next-auth" {
  /**
   * Extend the built-in session types
   */
  interface Session {
    accessToken?: string;
    base64EncodedAuthenticationKey?: string;
    user: {
      id?: string;
      userId?: number;
      officeId?: number;
      officeName?: string;
      roles?: Role[];
      permissions?: string[];
      shouldRenewPassword?: boolean;
      isTwoFactorAuthenticationRequired?: boolean;
    } & DefaultSession["user"];
  }

  /**
   * Extend the built-in user types
   */
  interface User {
    accessToken?: string;
    userId?: number;
    base64EncodedAuthenticationKey?: string;
    officeId?: number;
    officeName?: string;
    roles?: Role[];
    permissions?: string[];
    shouldRenewPassword?: boolean;
    isTwoFactorAuthenticationRequired?: boolean;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extend the built-in JWT types
   */
  interface JWT {
    accessToken?: string;
    userId?: number;
    base64EncodedAuthenticationKey?: string;
    officeId?: number;
    officeName?: string;
    roles?: Role[];
    permissions?: string[];
    shouldRenewPassword?: boolean;
    isTwoFactorAuthenticationRequired?: boolean;
  }
}
