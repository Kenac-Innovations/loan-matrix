"use client";

import { useMemo, useState, useTransition } from "react";
import { Edit, Loader2, Save, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  listMakerCheckerPermissionsAction,
  updateMakerCheckerPermissionsAction,
} from "@/app/actions/system-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { SystemPermission } from "@/shared/types/system";
import { formatSystemLabel, groupPermissions } from "./system-helpers";

type MakerCheckerClientProps = {
  initialPermissions: SystemPermission[];
  canUpdatePermission: boolean;
};

function buildState(permissions: SystemPermission[]) {
  return permissions.reduce<Record<string, boolean>>((state, permission) => {
    state[permission.code] = permission.selected;
    return state;
  }, {});
}

export function MakerCheckerClient({
  initialPermissions,
  canUpdatePermission,
}: MakerCheckerClientProps) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [selected, setSelected] = useState(() => buildState(initialPermissions));
  const [query, setQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const groupedPermissions = useMemo(() => {
    const groups = groupPermissions(permissions);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return groups;

    return Object.entries(groups).reduce<Record<string, SystemPermission[]>>(
      (matches, [group, items]) => {
        const groupText = `${group} ${formatSystemLabel(group)}`.toLowerCase();

        if (groupText.includes(normalizedQuery)) {
          matches[group] = items;
          return matches;
        }

        const filteredItems = items.filter((permission) => {
          const taskText = [
            permission.code,
            formatSystemLabel(permission.code),
            selected[permission.code] ? "enabled" : "disabled",
          ]
            .join(" ")
            .toLowerCase();

          return taskText.includes(normalizedQuery);
        });

        if (filteredItems.length > 0) {
          matches[group] = filteredItems;
        }

        return matches;
      },
      {}
    );
  }, [permissions, query, selected]);
  const filteredPermissionCount = useMemo(
    () =>
      Object.values(groupedPermissions).reduce(
        (total, items) => total + items.length,
        0
      ),
    [groupedPermissions]
  );

  function refreshPermissions() {
    startTransition(async () => {
      const nextPermissions = await listMakerCheckerPermissionsAction();
      setPermissions(nextPermissions);
      setSelected(buildState(nextPermissions));
    });
  }

  function cancelEdit() {
    setSelected(buildState(permissions));
    setIsEditing(false);
  }

  function toggleGroup(group: string, value: boolean) {
    const groupPermissionsList = groupedPermissions[group] ?? [];
    setSelected((current) => {
      const next = { ...current };
      groupPermissionsList.forEach((permission) => {
        next[permission.code] = value;
      });
      return next;
    });
  }

  function submitChanges() {
    startTransition(async () => {
      const result = await updateMakerCheckerPermissionsAction({
        permissions: selected,
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to update maker checker tasks");
        return;
      }

      toast.success("Maker checker tasks updated");
      setIsEditing(false);
      refreshPermissions();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Configure Maker Checker Tasks
          </h1>
          <p className="mt-1 text-muted-foreground">
            Turn maker-checker review on or off for eligible Fineract tasks.
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={cancelEdit}
                disabled={isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={submitChanges} disabled={isPending}>
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
              onClick={() => setIsEditing(true)}
              disabled={!canUpdatePermission || isPending}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {!canUpdatePermission && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Your current Fineract permissions allow viewing this configuration but
          not editing it.
        </div>
      )}

      <Card className="rounded-lg">
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Maker Checker Tasks</CardTitle>
          <Badge variant="secondary">
            {query.trim()
              ? `${filteredPermissionCount} of ${permissions.length} tasks`
              : `${permissions.length} tasks`}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks or groups"
              className="pl-9"
            />
          </div>

          {Object.entries(groupedPermissions).map(([group, items]) => {
            const selectedCount = items.filter((item) => selected[item.code])
              .length;

            return (
              <section key={group} className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{formatSystemLabel(group)}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedCount} of {items.length} enabled
                    </p>
                  </div>
                  {isEditing && (
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
                  {items.map((permission) => (
                    <label
                      key={permission.code}
                      className="flex min-h-12 items-start gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={Boolean(selected[permission.code])}
                        disabled={!isEditing}
                        onCheckedChange={(checked) =>
                          setSelected((current) => ({
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

          {filteredPermissionCount === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No maker checker tasks match your search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
