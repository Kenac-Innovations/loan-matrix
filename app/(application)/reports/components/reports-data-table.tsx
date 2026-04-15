"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Users,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { FineractReport } from "@/shared/types/fineract-report";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn, DataTableFilter } from "@/shared/types/data-table";

interface ReportsDataTableProps {
  reports: FineractReport[];
  onReportSelect?: (reportName: string) => void;
  selectedReport?: string;
}

export function ReportsDataTable({
  reports,
  onReportSelect,
  selectedReport,
}: ReportsDataTableProps) {
  const router = useRouter();
  const [customFilters, setCustomFilters] = useState<DataTableFilter[]>([
    { columnId: "reportCategory", value: "", type: "select" },
    { columnId: "reportType", value: "", type: "select" },
    { columnId: "coreReport", value: "", type: "select" },
  ]);

  // Get unique values for filters
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(reports.map((report) => report.reportCategory))
    );
    return uniqueCategories.sort();
  }, [reports]);

  const types = useMemo(() => {
    const uniqueTypes = Array.from(
      new Set(reports.map((report) => report.reportType))
    );
    return uniqueTypes.sort();
  }, [reports]);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "client":
        return Users;
      case "loan":
        return DollarSign;
      case "financial":
        return TrendingUp;
      default:
        return FileText;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "client":
        return "bg-blue-500/20 text-blue-500";
      case "loan":
        return "bg-green-500/20 text-green-500";
      case "financial":
        return "bg-purple-500/20 text-purple-500";
      default:
        return "bg-gray-500/20 text-gray-500";
    }
  };

  const handleReportClick = (report: FineractReport) => {
    // Always navigate to report detail page
    router.push(`/reports/${encodeURIComponent(report.reportName)}`);
  };

  const handleReportSelect = (reportName: string) => {
    if (onReportSelect) {
      onReportSelect(reportName);
    }
  };

  // Define columns for the generic data table
  const columns: DataTableColumn<FineractReport>[] = [
    {
      id: "reportName",
      header: "Report Name",
      accessorKey: "reportName",
      cell: ({ getValue, row }) => {
        const reportName = getValue() as string;
        const report = row.original;
        const IconComponent = getCategoryIcon(report.reportCategory);
        const colorClass = getCategoryColor(report.reportCategory);

        return (
          <div className="flex items-center gap-2">
            <div className={`rounded-full p-1 ${colorClass}`}>
              <IconComponent className="h-3 w-3" />
            </div>
            <span className="font-medium text-sm">{reportName}</span>
          </div>
        );
      },
    },
    {
      id: "reportCategory",
      header: "Category",
      accessorKey: "reportCategory",
      filterType: "select",
      filterOptions: categories.map((category) => ({
        label: category,
        value: category,
      })),
    },
    {
      id: "reportType",
      header: "Type",
      accessorKey: "reportType",
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return (
          <Badge variant="outline" className="text-xs">
            {type}
          </Badge>
        );
      },
      filterType: "select",
      filterOptions: types.map((type) => ({
        label: type,
        value: type,
      })),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "coreReport",
      cell: ({ getValue, row }) => {
        const isCore = getValue() as boolean;
        return (
          <div className="flex gap-1">
            {isCore && (
              <Badge
                variant="outline"
                className="bg-blue-500 text-white border-0 text-xs"
              >
                Core
              </Badge>
            )}
            <Badge
              variant="outline"
              className="bg-green-500 text-white border-0 text-xs"
            >
              Active
            </Badge>
          </div>
        );
      },
      filterType: "select",
      filterOptions: [
        { label: "All Reports", value: "" },
        { label: "Core Only", value: "true" },
        { label: "Non-Core", value: "false" },
      ],
    },
    {
      id: "actions",
      header: "Actions",
      accessorKey: "reportName",
      enableSorting: false,
      cell: ({ getValue }) => {
        const reportName = getValue() as string;
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleReportClick({ reportName } as FineractReport);
            }}
            className="h-7 px-2 py-1 text-xs"
          >
            {onReportSelect ? "Select" : "Configure"}
          </Button>
        );
      },
    },
  ];

  return (
    <GenericDataTable
      data={reports}
      columns={columns}
      searchPlaceholder="Search reports..."
      enablePagination={true}
      enableColumnVisibility={true}
      enableExport={true}
      enableFilters={true}
      pageSize={10}
      tableId="reports-table"
      onRowClick={handleReportClick}
      exportFileName="reports"
      emptyMessage="No reports found"
      customFilters={customFilters}
      onFilterChange={setCustomFilters}
    />
  );
}
