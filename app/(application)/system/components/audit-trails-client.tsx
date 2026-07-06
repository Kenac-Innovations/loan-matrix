"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { searchAuditTrailsAction } from "@/app/actions/system-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type Option } from "@/components/searchable-select";
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
  AuditTrailFilters,
  AuditTrailPage,
  AuditTrailSearchTemplate,
} from "@/shared/types/system";
import {
  downloadCsv,
  formatDateInputForFineract,
  formatFineractDate,
  formatSystemLabel,
} from "./system-helpers";

type AuditTrailsClientProps = {
  template: AuditTrailSearchTemplate;
  initialPage: AuditTrailPage;
};

type AuditFilterForm = {
  actionName: string;
  entityName: string;
  resourceId: string;
  makerId: string;
  makerDateTimeFrom: string;
  makerDateTimeTo: string;
  checkerDateTimeFrom: string;
  checkerDateTimeTo: string;
  checkerId: string;
  processingResult: string;
};

const allValue = "__all";
const pageSize = 10;

const emptyFilters: AuditFilterForm = {
  actionName: allValue,
  entityName: allValue,
  resourceId: "",
  makerId: allValue,
  makerDateTimeFrom: "",
  makerDateTimeTo: "",
  checkerDateTimeFrom: "",
  checkerDateTimeTo: "",
  checkerId: allValue,
  processingResult: allValue,
};

function toAuditFilters(filters: AuditFilterForm): AuditTrailFilters {
  const nextFilters: AuditTrailFilters = {
    actionName: filters.actionName === allValue ? undefined : filters.actionName,
    entityName: filters.entityName === allValue ? undefined : filters.entityName,
    resourceId: filters.resourceId.trim() || undefined,
    makerId: filters.makerId === allValue ? undefined : filters.makerId,
    makerDateTimeFrom: formatDateInputForFineract(filters.makerDateTimeFrom),
    makerDateTimeTo: formatDateInputForFineract(filters.makerDateTimeTo),
    checkerDateTimeFrom: formatDateInputForFineract(
      filters.checkerDateTimeFrom
    ),
    checkerDateTimeTo: formatDateInputForFineract(filters.checkerDateTimeTo),
    checkerId: filters.checkerId === allValue ? undefined : filters.checkerId,
    processingResult:
      filters.processingResult === allValue
        ? undefined
        : filters.processingResult,
  };

  if (
    nextFilters.makerDateTimeFrom ||
    nextFilters.makerDateTimeTo ||
    nextFilters.checkerDateTimeFrom ||
    nextFilters.checkerDateTimeTo
  ) {
    nextFilters.dateFormat = "dd MMMM yyyy";
    nextFilters.locale = "en";
  }

  return nextFilters;
}

function auditRowsForCsv(audits: AuditTrail[]) {
  return [
    [
      "ID",
      "Action",
      "Entity",
      "Resource ID",
      "Processing Result",
      "Maker",
      "Made On",
      "Checker",
      "Checked On",
      "Office",
    ],
    ...audits.map((audit) => [
      String(audit.id),
      audit.actionName ?? "",
      audit.entityName ?? "",
      String(audit.resourceId ?? ""),
      audit.processingResult ?? "",
      audit.maker ?? "",
      formatFineractDate(audit.madeOnDate),
      audit.checker ?? "",
      formatFineractDate(audit.checkedOnDate),
      audit.officeName ?? "",
    ]),
  ];
}

export function AuditTrailsClient({
  template,
  initialPage,
}: AuditTrailsClientProps) {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(initialPage);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const pageNumber = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(
    1,
    Math.ceil(page.totalFilteredRecords / pageSize)
  );
  const hasPrevious = offset > 0;
  const hasNext = offset + pageSize < page.totalFilteredRecords;

  const processingResults = useMemo(
    () =>
      template.processingResults.filter(
        (item) => item.processingResult && item.processingResult !== "invalid"
      ),
    [template.processingResults]
  );
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
  const processingResultOptions = useMemo<Option[]>(
    () => [
      { value: allValue, label: "All results" },
      ...processingResults.map((result) => ({
        value: result.processingResult,
        label: formatSystemLabel(result.processingResult),
      })),
    ],
    [processingResults]
  );
  const makerOptions = useMemo<Option[]>(
    () => [
      { value: allValue, label: "All makers" },
      ...template.appUsers.map((user) => ({
        value: String(user.id),
        label: user.username,
      })),
    ],
    [template.appUsers]
  );
  const checkerOptions = useMemo<Option[]>(
    () => [
      { value: allValue, label: "All checkers" },
      ...template.appUsers.map((user) => ({
        value: String(user.id),
        label: user.username,
      })),
    ],
    [template.appUsers]
  );

  async function runSearch(nextOffset = 0) {
    setIsLoading(true);
    try {
      const nextPage = await searchAuditTrailsAction({
        filters: toAuditFilters(filters),
        offset: nextOffset,
        limit: pageSize,
      });
      setOffset(nextOffset);
      setPage(nextPage);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to search audit trails"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function resetFilters() {
    setFilters(emptyFilters);
    setIsLoading(true);
    try {
      const nextPage = await searchAuditTrailsAction({
        offset: 0,
        limit: pageSize,
      });
      setOffset(0);
      setPage(nextPage);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset audit trails"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function exportCsv() {
    setIsExporting(true);
    try {
      const exportPage = await searchAuditTrailsAction({
        filters: toAuditFilters(filters),
        offset: 0,
        limit: -1,
      });
      downloadCsv("audit-trails.csv", auditRowsForCsv(exportPage.pageItems));
      toast.success("Audit trails exported");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export audit trails"
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Trails</h1>
          <p className="mt-1 text-muted-foreground">
            Search Fineract audit activity and inspect command payloads.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export CSV
        </Button>
      </div>

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
              <Label>Processing result</Label>
              <SearchableSelect
                value={filters.processingResult}
                options={processingResultOptions}
                placeholder="All results"
                emptyMessage="No results found."
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    processingResult: value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Maker</Label>
              <SearchableSelect
                value={filters.makerId}
                options={makerOptions}
                placeholder="All makers"
                emptyMessage="No makers found."
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, makerId: value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Maker from</Label>
              <Input
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
              <Label>Maker to</Label>
              <Input
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

            <div className="grid gap-2">
              <Label>Checker</Label>
              <SearchableSelect
                value={filters.checkerId}
                options={checkerOptions}
                placeholder="All checkers"
                emptyMessage="No checkers found."
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, checkerId: value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Checker from</Label>
              <Input
                type="date"
                value={filters.checkerDateTimeFrom}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    checkerDateTimeFrom: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Checker to</Label>
              <Input
                type="date"
                value={filters.checkerDateTimeTo}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    checkerDateTimeTo: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => runSearch(0)} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search
            </Button>
            <Button variant="outline" onClick={resetFilters} disabled={isLoading}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Results</CardTitle>
          <Badge variant="secondary">
            {page.totalFilteredRecords} records
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Maker</TableHead>
                <TableHead>Made On</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.pageItems.map((audit) => (
                <TableRow key={audit.id}>
                  <TableCell>{audit.id}</TableCell>
                  <TableCell>{formatSystemLabel(audit.actionName)}</TableCell>
                  <TableCell>{formatSystemLabel(audit.entityName)}</TableCell>
                  <TableCell>{audit.resourceId ?? "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formatSystemLabel(audit.processingResult)}
                    </Badge>
                  </TableCell>
                  <TableCell>{audit.maker || "N/A"}</TableCell>
                  <TableCell>{formatFineractDate(audit.madeOnDate)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/system/audit-trails/${audit.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {page.pageItems.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No audit trail records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pageNumber} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => runSearch(Math.max(0, offset - pageSize))}
                disabled={!hasPrevious || isLoading}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => runSearch(offset + pageSize)}
                disabled={!hasNext || isLoading}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
