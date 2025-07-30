"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  FileText,
  Users,
  DollarSign,
  TrendingUp,
} from "lucide-react";

interface FineractReport {
  id: number;
  reportName: string;
  reportType: string;
  reportCategory: string;
  description?: string;
  coreReport: boolean;
  useReport: boolean;
  reportParameters: Array<{
    id: number;
    parameterId: number;
    parameterName: string;
  }>;
}

interface ReportsDataTableProps {
  reports: FineractReport[];
  onReportSelect?: (reportName: string) => void;
  selectedReport?: string;
}

type SortField = "reportName" | "reportCategory" | "reportType";
type SortDirection = "asc" | "desc";

export function ReportsDataTable({
  reports,
  onReportSelect,
  selectedReport,
}: ReportsDataTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [coreFilter, setCoreFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("reportName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Filter and sort data
  const filteredAndSortedReports = useMemo(() => {
    let filtered = reports.filter((report) => {
      const matchesSearch =
        report.reportName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.reportCategory
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        report.reportType.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" || report.reportCategory === categoryFilter;

      const matchesType =
        typeFilter === "all" || report.reportType === typeFilter;

      const matchesCore =
        coreFilter === "all" ||
        (coreFilter === "core" && report.coreReport) ||
        (coreFilter === "non-core" && !report.coreReport);

      return matchesSearch && matchesCategory && matchesType && matchesCore;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
      }
      if (typeof bValue === "string") {
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [
    reports,
    searchTerm,
    categoryFilter,
    typeFilter,
    coreFilter,
    sortField,
    sortDirection,
  ]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReports = filteredAndSortedReports.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setTypeFilter("all");
    setCoreFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    coreFilter !== "all";

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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const handleReportClick = (reportName: string) => {
    // Always navigate to report detail page
    router.push(`/reports/${encodeURIComponent(reportName)}`);
  };

  const handleReportSelect = (reportName: string) => {
    if (onReportSelect) {
      onReportSelect(reportName);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={coreFilter}
            onValueChange={(value) => {
              setCoreFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Core" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="core">Core Only</SelectItem>
              <SelectItem value="non-core">Non-Core</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => {
              setItemsPerPage(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {startIndex + 1} to{" "}
          {Math.min(endIndex, filteredAndSortedReports.length)} of{" "}
          {filteredAndSortedReports.length} reports
          {hasActiveFilters && ` (filtered from ${reports.length} total)`}
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>Filters active</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("reportName")}
                >
                  Report Name
                  {getSortIcon("reportName")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("reportCategory")}
                >
                  Category
                  {getSortIcon("reportCategory")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("reportType")}
                >
                  Type
                  {getSortIcon("reportType")}
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No reports found</p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedReports.map((report) => {
                const IconComponent = getCategoryIcon(report.reportCategory);
                const colorClass = getCategoryColor(report.reportCategory);

                return (
                  <TableRow
                    key={report.id}
                    className={`cursor-pointer hover:bg-muted/50 ${
                      selectedReport === report.reportName
                        ? "bg-blue-50/50"
                        : ""
                    }`}
                    onClick={() => handleReportClick(report.reportName)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`rounded-full p-1 ${colorClass}`}>
                          <IconComponent className="h-3 w-3" />
                        </div>
                        <span className="font-medium text-sm">
                          {report.reportName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {report.reportCategory}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {report.reportType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {report.coreReport && (
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
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReportClick(report.reportName);
                        }}
                        className="h-7 px-2 py-1 text-xs"
                      >
                        {onReportSelect ? "Select" : "Configure"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) {
                      handlePageChange(currentPage - 1);
                    }
                  }}
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map((page, index, array) => {
                  const showEllipsisBefore =
                    index > 0 && page - array[index - 1] > 1;

                  return (
                    <React.Fragment key={page}>
                      {showEllipsisBefore && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(page);
                          }}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </React.Fragment>
                  );
                })}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) {
                      handlePageChange(currentPage + 1);
                    }
                  }}
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
