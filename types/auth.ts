import "next-auth";

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    base64EncodedAuthenticationKey?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      userId?: number;
      officeId?: number;
      officeName?: string;
      roles?: Role[];
      permissions?: SpecificPermission[];
      rawPermissions?: string[];
      shouldRenewPassword?: boolean;
      isTwoFactorAuthenticationRequired?: boolean;
    };
  }

  interface User {
    id?: string;
    userId?: number;
    name?: string | null;
    email?: string | null;
    accessToken?: string;
    base64EncodedAuthenticationKey?: string;
    officeId?: number;
    officeName?: string;
    roles?: Role[];
    permissions?: SpecificPermission[];
    rawPermissions?: string[];
    shouldRenewPassword?: boolean;
    isTwoFactorAuthenticationRequired?: boolean;
  }
}

// Define the Role type
export interface Role {
  id: number;
  name: string;
  description: string;
  disabled: boolean;
}

// Define Permission types
export type Permission = string;

// Define a more specific permission type that can be used for granular control
export enum SpecificPermission {
  // Client permissions
  CREATE_CLIENT = "CREATE_CLIENT",
  READ_CLIENT = "READ_CLIENT",
  UPDATE_CLIENT = "UPDATE_CLIENT",
  DELETE_CLIENT = "DELETE_CLIENT",

  // Loan permissions
  CREATE_LOAN = "CREATE_LOAN",
  READ_LOAN = "READ_LOAN",
  UPDATE_LOAN = "UPDATE_LOAN",
  DELETE_LOAN = "DELETE_LOAN",
  APPROVE_LOAN = "APPROVE_LOAN",
  REJECT_LOAN = "REJECT_LOAN",
  DISBURSE_LOAN = "DISBURSE_LOAN",

  // Office permissions
  READ_OFFICE = "READ_OFFICE",
  CREATE_OFFICE = "CREATE_OFFICE",
  UPDATE_OFFICE = "UPDATE_OFFICE",

  // User permissions
  CREATE_USER = "CREATE_USER",
  READ_USER = "READ_USER",
  UPDATE_USER = "UPDATE_USER",
  DELETE_USER = "DELETE_USER",

  // System permissions
  SYSTEM_ADMIN = "SYSTEM_ADMIN",

  // Special permission that grants all access
  ALL_FUNCTIONS = "ALL_FUNCTIONS",
}

// Define a type for resource access levels
export enum AccessLevel {
  NONE = "NONE",
  READ = "READ",
  WRITE = "WRITE",
  ADMIN = "ADMIN",
}

// Define a type for resources that can be accessed
export enum Resource {
  CLIENT = "CLIENT",
  LOAN = "LOAN",
  OFFICE = "OFFICE",
  USER = "USER",
  SYSTEM = "SYSTEM",
}
