"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  BarChart3,
  Download,
  RefreshCw,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  Filter,
  Play,
  Search,
  Clock,
  Grid3X3,
  List,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { ReportsDataTable } from "./components/reports-data-table";

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

interface ReportParameter {
  parameter_name: string;
  parameter_variable: string;
  parameter_label: string;
  parameter_displayType: string;
  parameter_FormatType: string;
  parameter_default?: string;
  selectOne?: string;
  selectAll?: string;
  parentparametername?: string;
}

interface ParameterOption {
  id: number;
  tc: string;
}

interface ReportData {
  columnHeaders: Array<{
    columnName: string;
    columnType: string;
    columnDisplayType: string;
    isColumnNullable: boolean;
    isColumnPrimaryKey: boolean;
    isColumnUnique: boolean;
    isColumnIndexed: boolean;
    columnValues: any[];
  }>;
  data: Array<{
    row: any[];
  }>;
}

export default function ReportsPage() {
  const [availableReports, setAvailableReports] = useState<FineractReport[]>(
    []
  );
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [reportParameters, setReportParameters] = useState<ReportParameter[]>(
    []
  );
  const [parameterOptions, setParameterOptions] = useState<
    Record<string, ParameterOption[]>
  >({});
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingParameters, setLoadingParameters] = useState(false);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Load available reports on component mount
  useEffect(() => {
    fetchAvailableReports();
  }, []);

  // Load report parameters when a report is selected
  useEffect(() => {
    if (selectedReport) {
      fetchReportParameters(selectedReport);
      // Clear previous report data when selecting a new report
      setReportData(null);
    } else {
      setReportParameters([]);
      setParameters({});
      setParameterOptions({});
      setReportData(null);
    }
  }, [selectedReport]);

  const fetchAvailableReports = async () => {
    try {
      setLoadingReports(true);
      const response = await fetch("/api/fineract/reports?action=list");
      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }
      const reports = await response.json();
      setAvailableReports(
        reports.filter((report: FineractReport) => report.useReport)
      );
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Error",
        description: "Failed to load available reports",
        variant: "destructive",
      });
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchReportParameters = async (reportName: string) => {
    try {
      setLoadingParameters(true);
      const response = await fetch(
        `/api/fineract/reports?action=parameters&reportName=${encodeURIComponent(
          reportName
        )}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch report parameters");
      }
      const parameterData = await response.json();

      if (parameterData.data && parameterData.data.length > 0) {
        const params: ReportParameter[] = parameterData.data.map(
          (item: any) => ({
            parameter_name: item.row[0],
            parameter_variable: item.row[1],
            parameter_label: item.row[2],
            parameter_displayType: item.row[3],
            parameter_FormatType: item.row[4],
            parameter_default: item.row[5],
            selectOne: item.row[6],
            selectAll: item.row[7],
            parentparametername: item.row[8],
          })
        );

        setReportParameters(params);

        // Initialize parameters with default values
        const defaultParams: Record<string, string> = {};
        params.forEach((param) => {
          if (param.parameter_default && param.parameter_default !== "0") {
            defaultParams[param.parameter_variable] = param.parameter_default;
          }
        });
        setParameters(defaultParams);

        // Load options for select parameters
        await loadParameterOptions(params);
      } else {
        setReportParameters([]);
      }
    } catch (error) {
      console.error("Error fetching report parameters:", error);
      toast({
        title: "Error",
        description: "Failed to load report parameters",
        variant: "destructive",
      });
    } finally {
      setLoadingParameters(false);
    }
  };

  const loadParameterOptions = async (params: ReportParameter[]) => {
    const options: Record<string, ParameterOption[]> = {};

    for (const param of params) {
      if (
        param.parameter_displayType === "select" &&
        (param.selectOne === "Y" || param.selectAll === "Y")
      ) {
        try {
          const response = await fetch(
            `/api/fineract/reports?action=parameterOptions&parameterName=${encodeURIComponent(
              param.parameter_name
            )}`
          );
          if (response.ok) {
            const optionData = await response.json();
            if (optionData.data && optionData.data.length > 0) {
              options[param.parameter_name] = optionData.data.map(
                (item: any) => ({
                  id: item.row[0],
                  tc: item.row[1],
                })
              );
            }
          }
        } catch (error) {
          console.error(
            `Error loading options for ${param.parameter_name}:`,
            error
          );
        }
      }
    }

    setParameterOptions(options);
  };

  const runReport = async () => {
    if (!selectedReport) {
      toast({
        title: "Error",
        description: "Please select a report",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        reportName: selectedReport,
        ...parameters,
      });

      const response = await fetch(`/api/fineract/reports?${params}`);
      if (!response.ok) {
        throw new Error("Failed to run report");
      }

      const data = await response.json();
      setReportData(data);
      toast({
        title: "Success",
        description: "Report generated successfully",
      });
    } catch (error) {
      console.error("Error running report:", error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!reportData || !reportData.columnHeaders || !reportData.data) return;

    const headers = reportData.columnHeaders.map((h) => h.columnName).join(",");
    const rows = reportData.data
      .map((item) =>
        item.row
          .map((cell: any) => {
            if (cell === null || cell === undefined) return "";
            if (
              Array.isArray(cell) &&
              cell.length === 3 &&
              typeof cell[0] === "number"
            ) {
              const [year, month, day] = cell;
              return `${year}-${month.toString().padStart(2, "0")}-${day
                .toString()
                .padStart(2, "0")}`;
            }
            const str = String(cell);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      )
      .join("\n");

    const csvContent = `${headers}\n${rows}`;
    const dataBlob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedReport}-report-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleParameterChange = (paramVariable: string, value: string) => {
    setParameters((prev) => ({
      ...prev,
      [paramVariable]: value,
    }));
  };

  const renderParameterInput = (param: ReportParameter) => {
    const value = parameters[param.parameter_variable] || "";
    const options = parameterOptions[param.parameter_name] || [];

    switch (param.parameter_displayType) {
      case "select":
        return (
          <Select
            value={value}
            onValueChange={(val) =>
              handleParameterChange(param.parameter_variable, val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${param.parameter_label}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id.toString()}>
                  {option.tc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) =>
              handleParameterChange(param.parameter_variable, e.target.value)
            }
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) =>
              handleParameterChange(param.parameter_variable, e.target.value)
            }
            placeholder={param.parameter_label}
          />
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) =>
              handleParameterChange(param.parameter_variable, e.target.value)
            }
            placeholder={param.parameter_label}
          />
        );
    }
  };

  const formatCellValue = (cell: any) => {
    if (cell === null || cell === undefined) {
      return <span className="text-muted-foreground">-</span>;
    }

    if (
      Array.isArray(cell) &&
      cell.length === 3 &&
      typeof cell[0] === "number"
    ) {
      const [year, month, day] = cell;
      return `${year}-${month.toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
    }

    return String(cell);
  };

  const getReportsByCategory = () => {
    const categories = availableReports.reduce((acc, report) => {
      if (!acc[report.reportCategory]) {
        acc[report.reportCategory] = [];
      }
      acc[report.reportCategory].push(report);
      return acc;
    }, {} as Record<string, FineractReport[]>);
    return categories;
  };

  const reportCategories = getReportsByCategory();
  const filteredReports = availableReports.filter(
    (report) =>
      report.reportName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportCategory.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(availableReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReports = availableReports.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getCategoryIcon = (category: string | undefined) => {
    if (!category) return FileText;
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

  const getCategoryColor = (category: string | undefined) => {
    if (!category) return "bg-gray-500/20 text-gray-500";
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

  return (
    <>
      {/* Header Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableReports.length}</div>
            <p className="text-xs text-green-400">Available for use</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(reportCategories).length}
            </div>
            <p className="text-xs text-green-400">Report categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Last Generated
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData ? "Just now" : "None"}
            </div>
            <p className="text-xs text-muted-foreground">
              {reportData
                ? `${reportData.data.length} rows`
                : "No reports generated"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Export Ready</CardTitle>
            <Download className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData ? "Yes" : "No"}
            </div>
            <p className="text-xs text-green-400">CSV & JSON formats</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Categories Overview with Tabs */}
      {Object.keys(reportCategories).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Browse Reports by Category</CardTitle>
            <CardDescription>
              Explore available reports organized by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cards" className="w-full">
              <TabsList className="w-full sm:w-auto overflow-x-auto">
                <TabsTrigger
                  value="cards"
                  className="data-[state=active]:bg-blue-500"
                >
                  <Grid3X3 className="mr-2 h-4 w-4" />
                  <span className="whitespace-nowrap">Cards View</span>
                </TabsTrigger>
                <TabsTrigger
                  value="table"
                  className="data-[state=active]:bg-blue-500"
                >
                  <List className="mr-2 h-4 w-4" />
                  <span className="whitespace-nowrap">Table View</span>
                </TabsTrigger>
              </TabsList>

              {/* Cards View */}
              <TabsContent value="cards" className="mt-6">
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(reportCategories).map(
                    ([category, reports]) => {
                      const IconComponent = getCategoryIcon(category);
                      const colorClass = getCategoryColor(category);

                      return (
                        <Card key={category}>
                          <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center">
                                <div
                                  className={`rounded-full p-1.5 mr-2 ${colorClass}`}
                                >
                                  <IconComponent className="h-4 w-4" />
                                </div>
                                {category} Reports
                              </CardTitle>
                              <CardDescription>
                                {reports.length} available reports
                              </CardDescription>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {reports.slice(0, 3).map((report) => (
                                <div
                                  key={report.id}
                                  className="flex items-center justify-between rounded-md border p-2 cursor-pointer hover:bg-muted/50"
                                  onClick={() =>
                                    (window.location.href = `/reports/${encodeURIComponent(
                                      report.reportName
                                    )}`)
                                  }
                                >
                                  <div>
                                    <p className="text-sm font-medium">
                                      {report.reportName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {report.reportType}
                                    </p>
                                  </div>
                                  {report.coreReport && (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-500 text-white border-0 text-xs"
                                    >
                                      Core
                                    </Badge>
                                  )}
                                </div>
                              ))}
                              {reports.length > 3 && (
                                <p className="text-xs text-muted-foreground text-center">
                                  +{reports.length - 3} more reports
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }
                  )}
                </div>
              </TabsContent>

              {/* Table View */}
              <TabsContent value="table" className="mt-6">
                <ReportsDataTable
                  reports={availableReports}
                  onReportSelect={setSelectedReport}
                  selectedReport={selectedReport}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </>
  );
}
