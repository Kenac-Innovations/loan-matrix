"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, UsersRound } from "lucide-react";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DataTableColumn } from "@/shared/types/data-table";
import type { UserSummary } from "@/shared/types/user-management";

interface UsersPageClientProps {
  users: UserSummary[];
  canCreate: boolean;
}

export function UsersPageClient({
  users,
  canCreate,
}: Readonly<UsersPageClientProps>) {
  const router = useRouter();

  const columns: DataTableColumn<UserSummary>[] = [
    {
      id: "firstname",
      header: "First Name",
      accessorKey: "firstname",
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-medium">{row.original.firstname || "-"}</p>
          <p className="text-xs text-muted-foreground">
            @{row.original.username}
          </p>
        </div>
      ),
    },
    {
      id: "lastname",
      header: "Last Name",
      accessorKey: "lastname",
      cell: ({ row }) => row.original.lastname || "-",
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      cell: ({ row }) =>
        row.original.email ? (
          <span className="truncate">{row.original.email}</span>
        ) : (
          <span className="text-muted-foreground">Not set</span>
        ),
    },
    {
      id: "officeName",
      header: "Office",
      accessorKey: "officeName",
      cell: ({ row }) => row.original.officeName || "-",
    },
    {
      id: "roles",
      header: "Roles",
      accessorKey: "roles",
      enableSorting: false,
      cell: ({ row }) => {
        if (row.original.roles.length === 0) {
          return <span className="text-muted-foreground">No roles</span>;
        }

        return (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.slice(0, 2).map((role) => (
              <Badge key={role} variant="secondary">
                {role}
              </Badge>
            ))}
            {row.original.roles.length > 2 && (
              <Badge variant="outline">+{row.original.roles.length - 2}</Badge>
            )}
          </div>
        );
      },
      getExportValue: (item) => item.roles.join(", "),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="mt-1 text-muted-foreground">
            Manage Mifos user accounts, roles, and branch assignment.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/organization/users/create">
              <Plus className="h-4 w-4" />
              Create User
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="h-5 w-5" />
            User Directory
          </CardTitle>
          <CardDescription>
            {users.length} user{users.length === 1 ? "" : "s"} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenericDataTable
            data={users}
            columns={columns}
            searchPlaceholder="Filter users..."
            tableId="organization-users"
            exportFileName="users"
            emptyMessage="No users found."
            onRowClick={(row) => router.push(`/organization/users/${row.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
