"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveMakerCheckerEntryAction,
  deleteMakerCheckerEntryAction,
  listMakerCheckerEntriesAction,
  rejectMakerCheckerEntryAction,
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
import { Label } from "@/components/ui/label";
import { SearchableSelect, type Option } from "@/components/searchable-select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AuditTrail,
  AuditTrailSearchTemplate,
  MakerCheckerSearchInput,
} from "@/shared/types/system";
import {
  formatFineractDate,
  formatSystemLabel,
} from "../../system/components/system-helpers";

type CheckerInboxClientProps = {
  template: AuditTrailSearchTemplate;
  initialEntries: AuditTrail[];
};

const allValue = "__all";

type FilterForm = {
  actionName: string;
  entityName: string;
  resourceId: string;
  makerDateTimeFrom: string;
  makerDateTimeTo: string;
};

const emptyFilters: FilterForm = {
  actionName: allValue,
  entityName: allValue,
  resourceId: "",
  makerDateTimeFrom: "",
  makerDateTimeTo: "",
};

function toSearchInput(filters: FilterForm): MakerCheckerSearchInput {
  return {
    actionName: filters.actionName === allValue ? undefined : filters.actionName,
    entityName: filters.entityName === allValue ? undefined : filters.entityName,
    resourceId: filters.resourceId.trim() || undefined,
    makerDateTimeFrom: filters.makerDateTimeFrom || undefined,
    makerDateTimeTo: filters.makerDateTimeTo || undefined,
  };
}

type BulkAction = "approve" | "reject" | "delete" | null;

export function CheckerInboxClient({
  template,
  initialEntries,
}: CheckerInboxClientProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [confirmAction, setConfirmAction] = useState<BulkAction>(null);
  const [isPending, startTransition] = useTransition();

  const actionOptions = useMemo<Option[]>(
    () => [
      { value: allValue, label: "All actions" },
      ...template.actionNames.map((actionName) => ({
        value: actionName,
        label: formatSystemLabel(actionName),
      })),
    ],
    [template.actionNames]
  );
  const entityOptions = useMemo<Option[]>(
    () => [
      { value: allValue, label: "All entities" },
      ...template.entityNames.map((entityName) => ({
        value: entityName,
        label: formatSystemLabel(entityName),
      })),
    ],
    [template.entityNames]
  );

  const allSelected = entries.length > 0 && selected.size === entries.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)));
  }

  function toggleOne(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function runSearch() {
    setIsSearching(true);
    try {
      const next = await listMakerCheckerEntriesAction(
        toSearchInput(filters)
      );
      setEntries(next);
      setSelected(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to search entries"
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function resetFilters() {
    setFilters(emptyFilters);
    setIsSearching(true);
    try {
      const next = await listMakerCheckerEntriesAction();
      setEntries(next);
      setSelected(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset entries"
      );
    } finally {
      setIsSearching(false);
    }
  }

  function refresh() {
    startTransition(async () => {
      try {
        const next = await listMakerCheckerEntriesAction(
          toSearchInput(filters)
        );
        setEntries(next);
        setSelected(new Set());
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to refresh entries"
        );
      }
    });
  }

  function runBulkAction() {
    const action = confirmAction;
    if (!action) return;
    setConfirmAction(null);

    const ids = Array.from(selected);
    const actionFn =
      action === "approve"
        ? approveMakerCheckerEntryAction
        : action === "reject"
          ? rejectMakerCheckerEntryAction
          : deleteMakerCheckerEntryAction;

    startTransition(async () => {
      const results = await Promise.all(ids.map((id) => actionFn(id)));
      const failures = results.filter((result) => !result.success);

      if (failures.length > 0) {
        toast.error(
          `${failures.length} of ${ids.length} entries failed: ${
            failures[0].error ?? "Unknown error"
          }`
        );
      } else {
        toast.success(
          `${ids.length} ${ids.length === 1 ? "entry" : "entries"} ${
            action === "approve"
              ? "approved"
              : action === "reject"
                ? "rejected"
                : "deleted"
          }`
        );
      }

      refresh();
    });
  }

  const confirmCopy: Record<
    NonNullable<BulkAction>,
    { title: string; description: string }
  > = {
    approve: {
      title: "Approve selected entries?",
      description:
        "This will approve and execute every selected pending request. This cannot be undone.",
    },
    reject: {
      title: "Reject selected entries?",
      description:
        "This will reject every selected pending request. The requests will not be applied.",
    },
    delete: {
      title: "Delete selected entries?",
      description:
        "This will permanently remove the selected pending requests without executing or rejecting them.",
    },
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2">
              <Label>Action</Label>
              <SearchableSelect
                value={filters.actionName}
                options={actionOptions}
                placeholder="All actions"
                emptyMessage="No actions found."
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, actionName: value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Entity</Label>
              <SearchableSelect
                value={filters.entityName}
                options={entityOptions}
                placeholder="All entities"
                emptyMessage="No entities found."
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, entityName: value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="resource-id">Resource ID</Label>
              <Input
                id="resource-id"
                value={filters.resourceId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    resourceId: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="made-on-from">Made on (from)</Label>
              <Input
                id="made-on-from"
                type="date"
                value={filters.makerDateTimeFrom}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    makerDateTimeFrom: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="made-on-to">Made on (to)</Label>
              <Input
                id="made-on-to"
                type="date"
                value={filters.makerDateTimeTo}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    makerDateTimeTo: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={runSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Search
            </Button>
            <Button
              variant="outline"
              onClick={resetFilters}
              disabled={isSearching}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Pending Entries</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{entries.length} pending</Badge>
            <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {selected.size} selected
              </span>
              <Button
                size="sm"
                onClick={() => setConfirmAction("approve")}
                disabled={isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction("reject")}
                disabled={isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction("delete")}
                disabled={isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected || (someSelected ? "indeterminate" : false)}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Resource ID</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Maker</TableHead>
                <TableHead>Made On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(entry.id)}
                      onCheckedChange={() => toggleOne(entry.id)}
                      aria-label={`Select entry ${entry.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/checker-inbox/${entry.id}`}
                      className="text-primary hover:underline"
                    >
                      {entry.id}
                    </Link>
                  </TableCell>
                  <TableCell>{formatSystemLabel(entry.actionName)}</TableCell>
                  <TableCell>{formatSystemLabel(entry.entityName)}</TableCell>
                  <TableCell>{entry.resourceId ?? "N/A"}</TableCell>
                  <TableCell>{entry.officeName || "N/A"}</TableCell>
                  <TableCell>{entry.maker || "N/A"}</TableCell>
                  <TableCell>{formatFineractDate(entry.madeOnDate)}</TableCell>
                </TableRow>
              ))}

              {entries.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nothing is waiting on your approval right now.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? confirmCopy[confirmAction].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? confirmCopy[confirmAction].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkAction}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
