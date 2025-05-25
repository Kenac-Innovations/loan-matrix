import { UserPermissionsDisplay } from "@/components/auth/user-permissions-display";
import { PermissionGate } from "@/components/auth/permission-gate";
import { RoleGate } from "@/components/auth/role-gate";
import { ResourceGate } from "@/components/auth/resource-gate";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, UserCheck, Lock, Key } from "lucide-react";

export default function AuthDemoPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Authorization System Demo</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              Permission-Based Access
            </CardTitle>
            <CardDescription>
              Control access based on specific permissions assigned to users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Permissions are specific actions that a user is allowed to
              perform, such as creating a client or approving a loan.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              Role-Based Access
            </CardTitle>
            <CardDescription>
              Control access based on roles assigned to users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Roles are collections of permissions that are assigned to users,
              such as "Super user" or "Loan Officer".
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-purple-500" />
              Resource-Based Access
            </CardTitle>
            <CardDescription>
              Control access based on access levels to specific resources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Resources are entities that users can access, such as clients or
              loans, with different access levels (READ, WRITE, ADMIN).
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Your Permissions & Roles
            </CardTitle>
            <CardDescription>
              View your current permissions and roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserPermissionsDisplay />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="permission" className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="permission">Permission Gates</TabsTrigger>
          <TabsTrigger value="role">Role Gates</TabsTrigger>
          <TabsTrigger value="resource">Resource Gates</TabsTrigger>
        </TabsList>

        <TabsContent value="permission">
          <Card>
            <CardHeader>
              <CardTitle>Permission Gates Demo</CardTitle>
              <CardDescription>
                These components conditionally render their children based on
                user permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">
                    Client Permissions
                  </h3>
                  <div className="space-y-2">
                    <PermissionGate
                      permission={SpecificPermission.CREATE_CLIENT}
                    >
                      <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertTitle>CREATE_CLIENT</AlertTitle>
                        <AlertDescription>
                          You have permission to create clients
                        </AlertDescription>
                      </Alert>
                    </PermissionGate>

                    <PermissionGate permission={SpecificPermission.READ_CLIENT}>
                      <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertTitle>READ_CLIENT</AlertTitle>
                        <AlertDescription>
                          You have permission to read clients
                        </AlertDescription>
                      </Alert>
                    </PermissionGate>

                    <PermissionGate
                      permission={SpecificPermission.UPDATE_CLIENT}
                    >
                      <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertTitle>UPDATE_CLIENT</AlertTitle>
                        <AlertDescription>
                          You have permission to update clients
                        </AlertDescription>
                      </Alert>
                    </PermissionGate>

                    <PermissionGate
                      permission={SpecificPermission.DELETE_CLIENT}
                    >
                      <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertTitle>DELETE_CLIENT</AlertTitle>
                        <AlertDescription>
                          You have permission to delete clients
                        </AlertDescription>
                      </Alert>
                    </PermissionGate>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Loan Permissions</h3>
                  <div className="space-y-2">
                    <PermissionGate permission={SpecificPermission.CREATE_LOAN}>
                      <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertTitle>CREATE_LOAN</AlertTitle>
                        <AlertDescription>
                          You have permission to create loans
                        </AlertDescription>
                      </Alert>
                    </PermissionGate>

                    <PermissionGate
                      permission={SpecificPermission.APPROVE_LOAN}
                    >
                      <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertTitle>APPROVE_LOAN</AlertTitle>
                        <AlertDescription>
                          You have permission to approve loans
                        </AlertDescription>
                      </Alert>
                    </PermissionGate>

                    <PermissionGate permission={SpecificPermission.REJECT_LOAN}>
                      <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertTitle>REJECT_LOAN</AlertTitle>
                        <AlertDescription>
                          You have permission to reject loans
                        </AlertDescription>
                      </Alert>
                    </PermissionGate>

                    <PermissionGate
                      permission={SpecificPermission.DISBURSE_LOAN}
                    >
                      <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertTitle>DISBURSE_LOAN</AlertTitle>
                        <AlertDescription>
                          You have permission to disburse loans
                        </AlertDescription>
                      </Alert>
                    </PermissionGate>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="role">
          <Card>
            <CardHeader>
              <CardTitle>Role Gates Demo</CardTitle>
              <CardDescription>
                These components conditionally render their children based on
                user roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <RoleGate role="Super user">
                  <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                    <UserCheck className="h-4 w-4 text-blue-500" />
                    <AlertTitle>Super user</AlertTitle>
                    <AlertDescription>
                      You have the Super user role
                    </AlertDescription>
                  </Alert>
                </RoleGate>

                <RoleGate role="Loan Officer">
                  <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                    <UserCheck className="h-4 w-4 text-blue-500" />
                    <AlertTitle>Loan Officer</AlertTitle>
                    <AlertDescription>
                      You have the Loan Officer role
                    </AlertDescription>
                  </Alert>
                </RoleGate>

                <RoleGate role="Branch Manager">
                  <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                    <UserCheck className="h-4 w-4 text-blue-500" />
                    <AlertTitle>Branch Manager</AlertTitle>
                    <AlertDescription>
                      You have the Branch Manager role
                    </AlertDescription>
                  </Alert>
                </RoleGate>

                <RoleGate role="System Administrator">
                  <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                    <UserCheck className="h-4 w-4 text-blue-500" />
                    <AlertTitle>System Administrator</AlertTitle>
                    <AlertDescription>
                      You have the System Administrator role
                    </AlertDescription>
                  </Alert>
                </RoleGate>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resource">
          <Card>
            <CardHeader>
              <CardTitle>Resource Gates Demo</CardTitle>
              <CardDescription>
                These components conditionally render their children based on
                user's access level to resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Client Resource</h3>
                  <div className="space-y-2">
                    <ResourceGate
                      resource={Resource.CLIENT}
                      requiredLevel={AccessLevel.READ}
                    >
                      <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
                        <Lock className="h-4 w-4 text-purple-500" />
                        <AlertTitle>CLIENT - READ</AlertTitle>
                        <AlertDescription>
                          You have READ access to clients
                        </AlertDescription>
                      </Alert>
                    </ResourceGate>

                    <ResourceGate
                      resource={Resource.CLIENT}
                      requiredLevel={AccessLevel.WRITE}
                    >
                      <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
                        <Lock className="h-4 w-4 text-purple-500" />
                        <AlertTitle>CLIENT - WRITE</AlertTitle>
                        <AlertDescription>
                          You have WRITE access to clients
                        </AlertDescription>
                      </Alert>
                    </ResourceGate>

                    <ResourceGate
                      resource={Resource.CLIENT}
                      requiredLevel={AccessLevel.ADMIN}
                    >
                      <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
                        <Lock className="h-4 w-4 text-purple-500" />
                        <AlertTitle>CLIENT - ADMIN</AlertTitle>
                        <AlertDescription>
                          You have ADMIN access to clients
                        </AlertDescription>
                      </Alert>
                    </ResourceGate>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Loan Resource</h3>
                  <div className="space-y-2">
                    <ResourceGate
                      resource={Resource.LOAN}
                      requiredLevel={AccessLevel.READ}
                    >
                      <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
                        <Lock className="h-4 w-4 text-purple-500" />
                        <AlertTitle>LOAN - READ</AlertTitle>
                        <AlertDescription>
                          You have READ access to loans
                        </AlertDescription>
                      </Alert>
                    </ResourceGate>

                    <ResourceGate
                      resource={Resource.LOAN}
                      requiredLevel={AccessLevel.WRITE}
                    >
                      <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
                        <Lock className="h-4 w-4 text-purple-500" />
                        <AlertTitle>LOAN - WRITE</AlertTitle>
                        <AlertDescription>
                          You have WRITE access to loans
                        </AlertDescription>
                      </Alert>
                    </ResourceGate>

                    <ResourceGate
                      resource={Resource.LOAN}
                      requiredLevel={AccessLevel.ADMIN}
                    >
                      <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
                        <Lock className="h-4 w-4 text-purple-500" />
                        <AlertTitle>LOAN - ADMIN</AlertTitle>
                        <AlertDescription>
                          You have ADMIN access to loans
                        </AlertDescription>
                      </Alert>
                    </ResourceGate>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>API Integration</CardTitle>
          <CardDescription>
            Test the authorization system with API calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Client API</h3>
              <div className="space-y-2">
                {/* <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    fetch("/api/clients")
                      .then((res) => res.json())
                      .then((data) => {
                        alert(JSON.stringify(data, null, 2));
                      })
                      .catch((err) => {
                        alert(`Error: ${err.message}`);
                      });
                  }}
                >
                  GET /api/clients
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    fetch("/api/clients/1")
                      .then((res) => res.json())
                      .then((data) => {
                        alert(JSON.stringify(data, null, 2));
                      })
                      .catch((err) => {
                        alert(`Error: ${err.message}`);
                      });
                  }}
                >
                  GET /api/clients/1
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    fetch("/api/clients", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        officeId: 1,
                        legalFormId: 1,
                        firstname: "John",
                        lastname: "Doe",
                        mobileNo: "1234567890",
                        emailAddress: "john.doe@example.com",
                        dateOfBirth: "1990-01-01",
                        clientTypeId: 1,
                        genderId: 1,
                      }),
                    })
                      .then((res) => res.json())
                      .then((data) => {
                        alert(JSON.stringify(data, null, 2));
                      })
                      .catch((err) => {
                        alert(`Error: ${err.message}`);
                      });
                  }}
                >
                  POST /api/clients
                </Button> */}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
