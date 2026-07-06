"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  Edit,
  Loader2,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteSystemRoleAction,
  getSystemRoleAction,
  setSystemRoleEnabledAction,
  updateSystemRoleAction,
  updateSystemRolePermissionsAction,
} from "@/app/actions/system-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SystemRoleDetail } from "@/shared/types/system";
import { formatSystemLabel, groupPermissions } from "./system-helpers";

type RoleDetailClientProps = {
  initialRole: SystemRoleDetail;
};

function buildPermissionState(role: SystemRoleDetail) {
  return role.permissionUsageData.reduce<Record<string, boolean>>(
    (state, permission) => {
      state[permission.code] = permission.selected;
      return state;
    },
    {}
  );
}

function confirmActionDescription(
  action: "delete" | "enable" | "disable" | null
) {
  if (action === "delete") {
    return "This role will be removed and can no longer be assigned to users.";
  }

  if (action === "enable") {
    return "Users assigned to this role will regain the access configured here.";
  }

  if (action === "disable") {
    return "Users assigned to this role will lose access granted only through this role.";
  }

  return "";
}

export function RoleDetailClient({ initialRole }: RoleDetailClientProps) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole);
  const [permissionState, setPermissionState] = useState(() =>
    buildPermissionState(initialRole)
  );
  const [isEditingPermissions, setIsEditingPermissions] = useState(false);
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [permissionQuery, setPermissionQuery] = useState("");
  const [description, setDescription] = useState(initialRole.description);
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "enable" | "disable" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const isSuperUser = role.name.toLowerCase() === "super user";
  const filteredPermissions = useMemo(() => {
    const query = permissionQuery.trim().toLowerCase();
    if (!query) return role.permissionUsageData;

    return role.permissionUsageData.filter((permission) =>
      [
        permission.code,
        permission.grouping,
        formatSystemLabel(permission.code),
        formatSystemLabel(permission.grouping),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [permissionQuery, role.permissionUsageData]);
  const groupedPermissions = useMemo(
    () => groupPermissions(filteredPermissions),
    [filteredPermissions]
  );
  const groupedPermissionEntries = useMemo(
    () => Object.entries(groupedPermissions),
    [groupedPermissions]
  );

  function refreshRole() {
    startTransition(async () => {
      const nextRole = await getSystemRoleAction(role.id);
      setRole(nextRole);
      setPermissionState(buildPermissionState(nextRole));
      setDescription(nextRole.description);
    });
  }

  function toggleGroup(group: string, selected: boolean) {
    const permissions = groupedPermissions[group] ?? [];
    setPermissionState((current) => {
      const next = { ...current };
      permissions.forEach((permission) => {
        next[permission.code] = selected;
      });
      return next;
    });
  }

  function cancelPermissionEdit() {
    setPermissionState(buildPermissionState(role));
    setIsEditingPermissions(false);
  }

  function savePermissionChanges() {
    startTransition(async () => {
      const result = await updateSystemRolePermissionsAction({
        roleId: role.id,
        permissions: permissionState,
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to update permissions");
        return;
      }

      toast.success("Role permissions updated");
      setIsEditingPermissions(false);
      const nextRole = await getSystemRoleAction(role.id);
      setRole(nextRole);
      setPermissionState(buildPermissionState(nextRole));
    });
  }

  function saveRoleMetadata() {
    startTransition(async () => {
      const result = await updateSystemRoleAction({
        id: role.id,
        description,
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to update role");
        return;
      }

      toast.success("Role updated");
      setIsEditRoleOpen(false);
      refreshRole();
    });
  }

  function runConfirmAction() {
    if (!confirmAction) return;

    startTransition(async () => {
      const result =
        confirmAction === "delete"
          ? await deleteSystemRoleAction(role.id)
          : await setSystemRoleEnabledAction(role.id, confirmAction === "enable");

      if (!result.success) {
        toast.error(result.error ?? "Action failed");
        return;
      }

      toast.success(
        confirmAction === "delete"
          ? "Role deleted"
          : `Role ${confirmAction === "enable" ? "enabled" : "disabled"}`
      );
      setConfirmAction(null);

      if (confirmAction === "delete") {
        router.push("/system/roles-and-permissions");
        return;
      }

      refreshRole();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{role.name}</h1>
            <Badge variant={role.disabled ? "secondary" : "default"}>
              {role.disabled ? "Disabled" : "Enabled"}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            {role.description || "No description provided."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditRoleOpen(true)}
            disabled={isPending || isSuperUser}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setConfirmAction(role.disabled ? "enable" : "disable")
            }
            disabled={isPending || isSuperUser}
          >
            {role.disabled ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Ban className="mr-2 h-4 w-4" />
            )}
            {role.disabled ? "Enable" : "Disable"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setConfirmAction("delete")}
            disabled={isPending || isSuperUser}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {isSuperUser && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Super user role actions are locked, matching Mifos behavior.
        </div>
      )}

      <Card className="rounded-lg">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Permission Assignments</CardTitle>
          <div className="flex gap-2">
            {isEditingPermissions ? (
              <>
                <Button
                  variant="outline"
                  onClick={cancelPermissionEdit}
                  disabled={isPending}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={savePermissionChanges} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Submit
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditingPermissions(true)}
                disabled={isPending || isSuperUser}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Permissions
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={permissionQuery}
                onChange={(event) => setPermissionQuery(event.target.value)}
                placeholder="Search permissions"
                className="pl-9 pr-10"
              />
              {permissionQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                  onClick={() => setPermissionQuery("")}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear permission search</span>
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Showing {filteredPermissions.length} of{" "}
              {role.permissionUsageData.length} permissions
            </p>
          </div>

          {groupedPermissionEntries.map(([group, permissions]) => {
            const selectedCount = permissions.filter(
              (permission) => permissionState[permission.code]
            ).length;

            return (
              <section key={group} className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{formatSystemLabel(group)}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedCount} of {permissions.length} selected
                    </p>
                  </div>
                  {isEditingPermissions && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleGroup(group, true)}
                      >
                        Select all
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleGroup(group, false)}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {permissions.map((permission) => (
                    <label
                      key={permission.code}
                      className="flex min-h-12 items-start gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={Boolean(permissionState[permission.code])}
                        disabled={!isEditingPermissions || isSuperUser}
                        onCheckedChange={(checked) =>
                          setPermissionState((current) => ({
                            ...current,
                            [permission.code]: checked === true,
                          }))
                        }
                      />
                      <span className="break-all leading-5">
                        {permission.code}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}

          {groupedPermissionEntries.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No permissions match your search.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Fineract allows changing the role description from this form.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input id="role-name" value={role.name} disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditRoleOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={saveRoleMetadata} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "delete"
                ? "Delete role?"
                : `${confirmAction === "enable" ? "Enable" : "Disable"} role?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmActionDescription(confirmAction)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmAction} disabled={isPending}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
