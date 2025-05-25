import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Role } from "@/types/auth";

/**
 * Component to display the current user's permissions and roles
 */
export async function UserPermissionsDisplay() {
  const session = await getSession();

  if (session?.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">User Information</h3>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-sm font-medium">Username:</div>
                <div className="text-sm">{session.user.name}</div>
                <div className="text-sm font-medium">User ID:</div>
                <div className="text-sm">{session.user.userId}</div>
                <div className="text-sm font-medium">Office:</div>
                <div className="text-sm">{session.user.officeName}</div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium">Roles</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {session.user.roles?.map((role: Role) => (
                  <Badge
                    key={role.id}
                    variant={role.disabled ? "outline" : "default"}
                    className={role.disabled ? "opacity-50" : ""}
                  >
                    {role.name}
                    {role.disabled && " (Disabled)"}
                  </Badge>
                ))}
                {(!session.user.roles || session.user.roles.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No roles assigned
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium">Permissions</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {session.user.permissions?.map((permission, index) => (
                  <Badge key={index} variant="secondary">
                    {permission}
                  </Badge>
                ))}
                {(!session.user.permissions ||
                  session.user.permissions.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No permissions assigned
                  </p>
                )}
              </div>
            </div>

            {session.user.rawPermissions && (
              <div>
                <h3 className="text-lg font-medium">Raw API Permissions</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {session.user.rawPermissions?.map((permission, index) => (
                    <Badge key={index} variant="outline">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
}
