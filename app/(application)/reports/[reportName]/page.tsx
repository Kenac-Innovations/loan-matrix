"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  Download,
  RefreshCw,
  FileText,
  Filter,
  Play,
  Clock,
  BarChart3,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

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

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportName = decodeURIComponent(params.reportName as string);

  const [reportParameters, setReportParameters] = useState<ReportParameter[]>(
    []
  );
  const [parameterOptions, setParameterOptions] = useState<
    Record<string, ParameterOption[]>
  >({});
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingParameters, setLoadingParameters] = useState(true);
  const [parameters, setParameters] = useState<Record<string, string>>({});

  useEffect(() => {
    if (reportName) {
      fetchReportParameters(reportName);
    }
  }, [reportName]);

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
    setLoading(true);
    try {
      const params = new URLSearchParams({
        reportName: reportName,
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
    link.download = `${reportName}-report-${
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

  return (
    <>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{reportName}</h2>
            <p className="text-muted-foreground">
              Configure and generate report
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {reportData && (
            <Button onClick={exportCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
          <Button
            onClick={runReport}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {loading ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Generate Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Parameters</CardTitle>
            <Filter className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportParameters.length}</div>
            <p className="text-xs text-muted-foreground">
              Configuration options
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData ? "Generated" : "Ready"}
            </div>
            <p className="text-xs text-green-400">
              {reportData ? "Data available" : "Awaiting generation"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rows</CardTitle>
            <FileText className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData ? reportData.data.length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Data records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            <Clock className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData ? "Just now" : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">Generation time</p>
          </CardContent>
        </Card>
      </div>

      {/* Parameters Configuration */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Report Parameters
          </CardTitle>
          <CardDescription>
            Configure the parameters for this report
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingParameters ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading parameters...
            </div>
          ) : reportParameters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportParameters.map((param, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={param.parameter_variable} className="text-sm">
                    {param.parameter_label}
                    {param.parameter_name
                      .toLowerCase()
                      .includes("mandatory") && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>
                  {renderParameterInput(param)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                No Parameters Required
              </h3>
              <p className="text-muted-foreground">
                This report can be generated without any configuration
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Results */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Report Results
          </CardTitle>
          <CardDescription>
            Generated report data and export options
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reportData ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <Badge
                    variant="outline"
                    className="bg-green-500 text-white border-0"
                  >
                    {reportData.data.length} rows
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-blue-500 text-white border-0"
                  >
                    {reportData.columnHeaders.length} columns
                  </Badge>
                </div>
              </div>
              <div className="border rounded-md overflow-hidden">
                <div className="overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {reportData.columnHeaders.map((header, index) => (
                          <TableHead key={index} className="font-medium">
                            {header.columnName}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.data.slice(0, 100).map((item, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {item.row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex}>
                              {formatCellValue(cell)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {reportData.data.length > 100 && (
                  <div className="text-center text-sm text-muted-foreground p-4 border-t bg-muted/30">
                    Showing first 100 rows of {reportData.data.length} total
                    rows
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-muted rounded-lg">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Data Generated</h3>
              <p className="text-muted-foreground mb-4">
                Configure the parameters above and click "Generate Report" to
                view the data
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
