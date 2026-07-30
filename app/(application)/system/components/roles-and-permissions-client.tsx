"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import {
  createSystemRoleAction,
  listSystemRolesAction,
} from "@/app/actions/system-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { SystemRoleSummary } from "@/shared/types/system";

type RolesAndPermissionsClientProps = {
  initialRoles: SystemRoleSummary[];
};

const emptyCreateForm = {
  name: "",
  description: "",
};

export function RolesAndPermissionsClient({
  initialRoles,
}: RolesAndPermissionsClientProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredRoles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return roles;

    return roles.filter((role) =>
      [role.name, role.description, String(role.id)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [query, roles]);

  function refreshRoles() {
    startTransition(async () => {
      try {
        setRoles(await listSystemRolesAction());
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to refresh roles"
        );
      }
    });
  }

  function createRole() {
    startTransition(async () => {
      const result = await createSystemRoleAction(createForm);
      if (!result.success) {
        toast.error(result.error ?? "Failed to create role");
        return;
      }

      setCreateForm(emptyCreateForm);
      setIsCreateOpen(false);

      if (result.pending) {
        toast.info("Submitted - awaiting checker approval", { duration: Infinity });
        return;
      }

      toast.success("Role created");
      setRoles(await listSystemRolesAction());
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Roles & Permissions
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage Fineract roles and the permissions assigned to each role.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshRoles} disabled={isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Role
          </Button>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Roles</CardTitle>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search roles"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>{role.id}</TableCell>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="max-w-xl whitespace-normal text-muted-foreground">
                    {role.description || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.disabled ? "secondary" : "default"}>
                      {role.disabled ? "Disabled" : "Enabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/system/roles-and-permissions/${role.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRoles.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No roles found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>
              Add a Fineract role, then assign permissions from the role detail
              page.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input
                id="role-name"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={createRole} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
