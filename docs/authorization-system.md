# Authorization System Documentation

This document provides an overview of the authorization system implemented in the Loan Matrix application.

## Overview

The authorization system is designed to provide three main types of access control:

1. **Permission-based access control**: Controls access based on specific permissions assigned to users
2. **Role-based access control**: Controls access based on roles assigned to users
3. **Resource-based access control**: Controls access based on access levels to specific resources

## Key Components

### Types and Enums

- `SpecificPermission`: Enum of all available permissions in the system
- `AccessLevel`: Enum of access levels (NONE, READ, WRITE, ADMIN)
- `Resource`: Enum of resources that can be accessed (CLIENT, LOAN, OFFICE, USER, SYSTEM)

### React Components

- `PermissionGate`: Conditionally renders children based on user permissions
- `RoleGate`: Conditionally renders children based on user roles
- `ResourceGate`: Conditionally renders children based on user's access level to resources
- `UserPermissionsDisplay`: Displays the current user's permissions and roles

### Client-Side Hooks

- `usePermission`: React hook to check if the user has a specific permission
- `useRole`: React hook to check if the user has a specific role
- `useResourceAccessLevel`: React hook to get the user's access level for a resource
- `useCanAccess`: React hook to check if the user can perform a specific action on a resource

### Server-Side Authorization

- `hasPermissionServer`: Check if the user has a specific permission
- `hasRoleServer`: Check if the user has a specific role
- `getResourceAccessLevelServer`: Get the user's access level for a resource
- `canAccessServer`: Check if the user can perform a specific action on a resource
- `mapApiPermissionsToSpecific`: Map API permissions to our specific permissions

### Middleware and Server Actions

- `withPermission`, `withRole`, `withResourceAccess`: Middleware functions for route handlers
- `createPermissionHandler`, `createRoleHandler`, `createResourceAccessHandler`: Higher-order functions for route handlers
- `withPermissionAction`, `withRoleAction`, `withResourceAccessAction`: Higher-order functions for server actions

## Usage Examples

### In React Components

```tsx
// Using the gate components
import { PermissionGate } from "@/components/auth/permission-gate";
import { RoleGate } from "@/components/auth/role-gate";
import { ResourceGate } from "@/components/auth/resource-gate";
import { SpecificPermission, Resource, AccessLevel } from "@/types/auth";

// Permission-based access control
<PermissionGate permission={SpecificPermission.CREATE_CLIENT}>
  <button>Create Client</button>
</PermissionGate>

// Role-based access control
<RoleGate role="Super user">
  <button>Admin Action</button>
</RoleGate>

// Resource-based access control
<ResourceGate resource={Resource.CLIENT} requiredLevel={AccessLevel.WRITE}>
  <button>Edit Client</button>
</ResourceGate>

// Using the hooks
import { usePermission, useRole, useCanAccess } from "@/hooks/use-authorization";
import { SpecificPermission, Resource, AccessLevel } from "@/types/auth";

function MyComponent() {
  const canCreateClient = usePermission(SpecificPermission.CREATE_CLIENT);
  const isSuperUser = useRole("Super user");
  const canEditClient = useCanAccess(Resource.CLIENT, AccessLevel.WRITE);

  return (
    <div>
      {canCreateClient && <button>Create Client</button>}
      {isSuperUser && <button>Admin Action</button>}
      {canEditClient && <button>Edit Client</button>}
    </div>
  );
}
```

### In API Routes

```tsx
// Using the middleware functions
import { NextRequest, NextResponse } from "next/server";
import {
  createPermissionHandler,
  createResourceAccessHandler,
} from "@/middleware/auth-middleware";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";

// Handler for GET requests - list all clients
async function handleGetClients(req: NextRequest) {
  // Implementation...
}

// Handler for POST requests - create a new client
async function handleCreateClient(req: NextRequest) {
  // Implementation...
}

// Export the handlers with authorization checks
export const GET = createResourceAccessHandler(
  Resource.CLIENT,
  AccessLevel.READ,
  handleGetClients
);

export const POST = createPermissionHandler(
  SpecificPermission.CREATE_CLIENT,
  handleCreateClient
);
```

### In Server Actions

```tsx
// Using the higher-order functions
import {
  withPermissionAction,
  withResourceAccessAction,
  isAuthError,
} from "@/lib/auth-actions";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";

// Original client creation action
async function createClientAction(data: any) {
  // Implementation...
}

// Wrap the action with authorization check
export const createClient = withPermissionAction(
  SpecificPermission.CREATE_CLIENT,
  createClientAction
);

// Example of how to use these actions in a component:
async function handleCreateClient(data) {
  const result = await createClient(data);
  
  if (isAuthError(result)) {
    // Handle authorization error
    console.error("Authorization error:", result.error);
    return;
  }
  
  if (!result.success) {
    // Handle other errors
    console.error("Error:", result.error);
    return;
  }
  
  // Handle success
  console.log("Client created:", result.data);
}
```

## Integration with NextAuth.js

The authorization system is integrated with NextAuth.js to provide a seamless authentication and authorization experience. The session object is extended to include the user's permissions and roles, which are used by the authorization system to control access to different parts of the application.

```tsx
// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    base64EncodedAuthenticationKey?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      userId: number;
      officeId: number;
      officeName: string;
      roles: Role[];
      permissions: SpecificPermission[];
      rawPermissions?: string[];
      shouldRenewPassword: boolean;
      isTwoFactorAuthenticationRequired: boolean;
    };
  }

  interface User {
    id: string;
    userId: number;
    name?: string | null;
    email?: string | null;
    accessToken: string;
    base64EncodedAuthenticationKey: string;
    officeId: number;
    officeName: string;
    roles: Role[];
    permissions: SpecificPermission[];
    rawPermissions?: string[];
    shouldRenewPassword: boolean;
    isTwoFactorAuthenticationRequired: boolean;
  }
}
```

## Conclusion

The authorization system provides a robust way to control access to different parts of the application based on user permissions, roles, and resource access levels. It is designed to be flexible and extensible, allowing for easy integration with other parts of the application.
