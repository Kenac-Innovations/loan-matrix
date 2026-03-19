"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  FileEdit,
  Users,
  TrendingUp,
  Target,
  Timer,
  Wallet,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";
import Link from "next/link";
import { GenericDataTable, DataTableColumn } from "@/components/tables/generic-data-table";
import { formatCurrency } from "@/lib/format-currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateRange {
  from: Date;
  to: Date;
}

interface ReportData {
  report: string;
  reportName: string;
  startDate: string;
  endDate: string;
  count: number;
  data: any[];
  rawColumnHeaders?: string[];
  error?: string;
}

interface TabConfig {
  id: string;
  label: string;
  report: string;
  bgColor: string;
  activeBg: string;
  inactiveText: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    id: "drafts",
    label: "Drafts",
    report: "drafts",
    bgColor: "bg-gray-500 dark:bg-gray-600",
    activeBg: "data-[state=active]:bg-gray-500 dark:data-[state=active]:bg-gray-600",
    inactiveText: "text-gray-700 dark:text-gray-400",
    icon: <FileEdit className="h-4 w-4" />,
  },
  {
    id: "pending",
    label: "Pending Approval",
    report: "pending",
    bgColor: "bg-yellow-500 dark:bg-yellow-600",
    activeBg: "data-[state=active]:bg-yellow-500 dark:data-[state=active]:bg-yellow-600",
    inactiveText: "text-yellow-700 dark:text-yellow-400",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: "approved",
    label: "Approved",
    report: "approved",
    bgColor: "bg-blue-500 dark:bg-blue-600",
    activeBg: "data-[state=active]:bg-blue-500 dark:data-[state=active]:bg-blue-600",
    inactiveText: "text-blue-700 dark:text-blue-400",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    id: "disbursed",
    label: "Disbursed",
    report: "disbursed",
    bgColor: "bg-green-500 dark:bg-green-600",
    activeBg: "data-[state=active]:bg-green-500 dark:data-[state=active]:bg-green-600",
    inactiveText: "text-green-700 dark:text-green-400",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    id: "payout",
    label: "Paid Out",
    report: "payout",
    bgColor: "bg-emerald-600 dark:bg-emerald-700",
    activeBg: "data-[state=active]:bg-emerald-600 dark:data-[state=active]:bg-emerald-700",
    inactiveText: "text-emerald-700 dark:text-emerald-400",
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    id: "rejected",
    label: "Rejected",
    report: "rejected",
    bgColor: "bg-red-500 dark:bg-red-600",
    activeBg: "data-[state=active]:bg-red-500 dark:data-[state=active]:bg-red-600",
    inactiveText: "text-red-700 dark:text-red-400",
    icon: <XCircle className="h-4 w-4" />,
  },
];

// Auto-refresh interval (10 seconds)
const REFRESH_INTERVAL = 10000;

// Helper component for date range label
function DateRangeLabel({ dateRange }: { dateRange: DateRange }) {
  if (!dateRange.to) {
    return <>{format(dateRange.from, "MMM d, yyyy")}</>;
  }
  
  return (
    <>
      {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
    </>
  );
}

// Extract tenant slug from hostname (client-side)
function getTenantSlugFromHost(): string {
  if (typeof globalThis.window === "undefined") return "goodfellow";
  
  const host = globalThis.location.hostname;
  
  // Handle plain localhost (no subdomain)
  if (host === "localhost" || host === "127.0.0.1") {
    return "goodfellow";
  }
  
  // Handle subdomain.localhost (e.g. omama.localhost)
  if (host.endsWith(".localhost")) {
    const subdomain = host.replace(".localhost", "");
    return subdomain || "goodfellow";
  }
  
  // Extract subdomain from full domains (e.g. omama.kenacloanmatrix.com)
  const parts = host.split(".");
  if (parts.length > 2) {
    return parts[0];
  }
  
  return "goodfellow";
}

export function LeadsStatusTabs() {
  const { data: session } = useSession();
  const { currencyCode: orgCurrency, locale: tenantLocale } = useCurrency();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("drafts");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  
  // Get tenant slug from hostname
  const tenantSlug = getTenantSlugFromHost();
  
  // Get user info for role-based filtering
  const sessionOfficeName = (session?.user as any)?.officeName;
  const userName = session?.user?.name;
  const sessionRoles = (session?.user as any)?.roles || [];
  
  // Fetch Fineract roles as fallback when session roles are empty
  const [fineractRoles, setFineractRoles] = useState<any[]>([]);
  const [fineractOfficeName, setFineractOfficeName] = useState<string | null>(null);
  useEffect(() => {
    if (session && sessionRoles.length === 0) {
      fetch("/api/auth/fineract-roles")
        .then((res) => res.json())
        .then((data) => {
          if (data.roles && data.roles.length > 0) {
            setFineractRoles(data.roles);
          }
          if (data.officeName) {
            setFineractOfficeName(data.officeName);
          }
        })
        .catch((err) => console.error("Failed to fetch Fineract roles:", err));
    }
  }, [session, sessionRoles.length]);

  const userRoles = sessionRoles.length > 0 ? sessionRoles : fineractRoles;
  const userOfficeName = sessionOfficeName || fineractOfficeName;
  const [tabData, setTabData] = useState<Record<string, ReportData | null>>({
    drafts: null,
    pending: null,
    approved: null,
    disbursed: null,
    payout: null,
    rejected: null,
  });
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({
    drafts: 0,
    pending: 0,
    approved: 0,
    disbursed: 0,
    payout: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({
    drafts: false,
    pending: false,
    approved: false,
    disbursed: false,
    payout: false,
    rejected: false,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({
    drafts: null,
    pending: null,
    approved: null,
    disbursed: null,
    payout: null,
    rejected: null,
  });
  const [navigatingRowId, setNavigatingRowId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Filter states for each tab
  const [filters, setFilters] = useState<Record<string, { branch: string; loanProduct: string; submittedBy: string }>>({
    drafts: { branch: "all", loanProduct: "all", submittedBy: "all" },
    pending: { branch: "all", loanProduct: "all", submittedBy: "all" },
    approved: { branch: "all", loanProduct: "all", submittedBy: "all" },
    disbursed: { branch: "all", loanProduct: "all", submittedBy: "all" },
    payout: { branch: "all", loanProduct: "all", submittedBy: "all" },
    rejected: { branch: "all", loanProduct: "all", submittedBy: "all" },
  });

  // Extract unique filter options from data
  const getFilterOptions = useCallback((data: any[], key: string): string[] => {
    if (!data || data.length === 0) return [];
    const values = new Set<string>();
    for (const row of data) {
      // Try different column name variations
      const value = row[key] || row[key.toLowerCase()] || row[key.replaceAll(" ", "_").toLowerCase()];
      if (value && value !== "-" && value !== "") {
        values.add(String(value));
      }
    }
    return Array.from(values).sort();
  }, []);

  // Get filter options for each tab
  const tabFilterOptions = useMemo(() => {
    const options: Record<string, { branches: string[]; loanProducts: string[]; submittedBy: string[] }> = {};
    for (const tab of TABS) {
      const rawData = tabData[tab.report]?.data || [];
      options[tab.report] = {
        branches: getFilterOptions(rawData, "branch"),
        loanProducts: getFilterOptions(rawData, "loan_product"),
        submittedBy: getFilterOptions(rawData, "submitted_by") || getFilterOptions(rawData, "created_by"),
      };
    }
    return options;
  }, [tabData, getFilterOptions]);

  // Filter data based on selected filters
  const getFilteredData = useCallback((report: string, data: any[]): any[] => {
    if (!data) return [];
    const tabFilters = filters[report];
    
    return data.filter((row) => {
      // Branch filter
      if (tabFilters.branch !== "all") {
        const branch = row.branch || row.Branch || "";
        if (String(branch).toLowerCase() !== tabFilters.branch.toLowerCase()) return false;
      }
      
      // Loan product filter
      if (tabFilters.loanProduct !== "all") {
        const product = row.loan_product || row["Loan Product"] || row.loanProduct || "";
        if (String(product).toLowerCase() !== tabFilters.loanProduct.toLowerCase()) return false;
      }
      
      // Submitted by filter
      if (tabFilters.submittedBy !== "all") {
        const submitter = row.submitted_by || row.created_by || row["Submitted By"] || row["Created By"] || "";
        if (String(submitter).toLowerCase() !== tabFilters.submittedBy.toLowerCase()) return false;
      }
      
      return true;
    });
  }, [filters]);

  // Update filter for a specific tab
  const updateFilter = useCallback((report: string, filterKey: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [report]: {
        ...prev[report],
        [filterKey]: value,
      },
    }));
  }, []);

  // Format date for API
  const formatDateForAPI = (date: Date) => format(date, "yyyy-MM-dd");

  // Fetch report data
  const fetchReport = useCallback(
    async (report: string, showLoader = true) => {
      if (showLoader) {
        setLoading((prev) => ({ ...prev, [report]: true }));
      }
      setErrors((prev) => ({ ...prev, [report]: null }));

      try {
        const params = new URLSearchParams({
          report,
          startDate: formatDateForAPI(dateRange.from),
          endDate: formatDateForAPI(dateRange.to),
        });

        const response = await fetch(`/api/leads/reports?${params}`, {
          headers: {
            "x-tenant-slug": tenantSlug,
          },
        });
        const data: ReportData = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch report");
        }

        console.log(`Tab ${report} received:`, data.count, "rows, columns:", data.rawColumnHeaders);
        
        setTabData((prev) => ({ ...prev, [report]: data }));
        setTabCounts((prev) => ({ ...prev, [report]: data.count }));
        setLastUpdated(new Date());
      } catch (error) {
        console.error(`Error fetching ${report} report:`, error);
        setErrors((prev) => ({ 
          ...prev, 
          [report]: error instanceof Error ? error.message : "Failed to fetch data" 
        }));
      } finally {
        setLoading((prev) => ({ ...prev, [report]: false }));
      }
    },
    [dateRange, tenantSlug]
  );

  // Fetch all counts on mount and when date range changes
  useEffect(() => {
    TABS.forEach((tab) => fetchReport(tab.report));
  }, [dateRange, fetchReport]);

  // Auto-refresh active tab
  useEffect(() => {
    const interval = setInterval(() => {
      fetchReport(activeTab, false); // Silent refresh without loader
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [activeTab, fetchReport]);

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Fetch fresh data when tab is opened
    fetchReport(tabId);
  };

  // Manual refresh
  const handleRefresh = () => {
    fetchReport(activeTab);
  };

  // Get user permissions
  const userPermissions = (session?.user as any)?.permissions || [];
  
  // Check if user has ALL_FUNCTIONS permission (super user)
  const hasAllFunctions = userPermissions.includes("ALL_FUNCTIONS");
  
  // Check if user has specific role
  const hasRole = useCallback((roleName: string) => {
    return userRoles.some((role: any) => 
      role.name?.toLowerCase().includes(roleName.toLowerCase()) && !role.disabled
    );
  }, [userRoles]);

  // Check if user is an admin/super user
  const isAdminUser = useMemo(() => {
    // Check permissions first
    if (hasAllFunctions) return true;
    
    // Check role names - only true admin/super roles, NOT branch manager
    const adminRolePatterns = ["super", "all_functions", "head office", "headquarters"];
    return adminRolePatterns.some(pattern => hasRole(pattern));
  }, [hasAllFunctions, hasRole]);

  // Determine user's filter scope based on role
  const userFilterScope = useMemo(() => {
    // If session is not loaded yet, default to all (will recalculate when loaded)
    if (!session) {
      return { type: "all" as const, label: "All Leads" };
    }
    
    // Check for admin/super admin - they see all
    if (isAdminUser) {
      return { type: "all" as const, label: "All Leads" };
    }
    
    // Authorisers see all leads across branches for loan authorisation
    if (hasRole("authoriser")) {
      return { type: "all" as const, label: "All Leads" };
    }
    
    // Check for branch manager role
    if (hasRole("branch") && userOfficeName) {
      return { type: "branch" as const, value: userOfficeName, label: `${userOfficeName} Branch` };
    }
    
    // Check for loan officer - show their own leads
    if (hasRole("loan officer") || hasRole("officer")) {
      if (userName) {
        return { type: "user" as const, value: userName, label: "My Leads" };
      }
    }
    
    // Default: restrict to user's own leads (safe default)
    if (userName) {
      return { type: "user" as const, value: userName, label: "My Leads" };
    }
    
    return { type: "all" as const, label: "All Leads" };
  }, [session, isAdminUser, hasRole, userOfficeName, userName]);

  // Filter data based on user's role scope
  const getRoleScopedData = useCallback((data: any[]): any[] => {
    if (!data || userFilterScope.type === "all") return data;
    
    return data.filter((row) => {
      if (userFilterScope.type === "branch") {
        const branch = row.branch || row.Branch || row.office || row.Office || "";
        return String(branch).toLowerCase().includes(String(userFilterScope.value).toLowerCase());
      }
      if (userFilterScope.type === "user") {
        const submittedBy = row.submitted_by || row.created_by || row["Submitted By"] || row["Created By"] || row.loan_officer || "";
        return String(submittedBy).toLowerCase().includes(String(userFilterScope.value).toLowerCase());
      }
      return true;
    });
  }, [userFilterScope]);

  // Debug: Log role detection
  useEffect(() => {
    console.log("Pipeline Stats Debug:", {
      sessionLoaded: !!session,
      userName,
      userRoles: userRoles.map((r: any) => r.name),
      userPermissions,
      hasAllFunctions,
      isAdminUser,
      userFilterScope,
    });
  }, [session, userName, userRoles, userPermissions, hasAllFunctions, isAdminUser, userFilterScope]);

  // Calculate pipeline stats based on role-scoped and filtered data
  const pipelineStats = useMemo(() => {
    // Get role-scoped data for each tab
    const draftsData = getRoleScopedData(tabData.drafts?.data || []);
    const pendingData = getRoleScopedData(tabData.pending?.data || []);
    const approvedData = getRoleScopedData(tabData.approved?.data || []);
    const disbursedData = getRoleScopedData(tabData.disbursed?.data || []);
    const payoutData = getRoleScopedData(tabData.payout?.data || []);
    const rejectedData = getRoleScopedData(tabData.rejected?.data || []);
    
    // Debug log
    console.log("Pipeline Stats Calculation:", {
      filterScope: userFilterScope.type,
      rawDrafts: tabData.drafts?.data?.length || 0,
      rawPending: tabData.pending?.data?.length || 0,
      rawApproved: tabData.approved?.data?.length || 0,
      rawDisbursed: tabData.disbursed?.data?.length || 0,
      rawPayout: tabData.payout?.data?.length || 0,
      rawRejected: tabData.rejected?.data?.length || 0,
      scopedDrafts: draftsData.length,
      scopedPending: pendingData.length,
      scopedApproved: approvedData.length,
      scopedDisbursed: disbursedData.length,
      scopedPayout: payoutData.length,
      scopedRejected: rejectedData.length,
    });
    
    // Apply current filters to get filtered counts
    const filteredDrafts = getFilteredData("drafts", draftsData);
    const filteredPending = getFilteredData("pending", pendingData);
    const filteredApproved = getFilteredData("approved", approvedData);
    const filteredDisbursed = getFilteredData("disbursed", disbursedData);
    const filteredPayout = getFilteredData("payout", payoutData);
    const filteredRejected = getFilteredData("rejected", rejectedData);
    
    // Total leads (all statuses)
    const totalLeads = filteredDrafts.length + filteredPending.length + filteredApproved.length + filteredDisbursed.length + filteredRejected.length;
    
    // Conversion rate: Approved / (Approved + Rejected) * 100
    const decidedLeads = filteredApproved.length + filteredDisbursed.length + filteredRejected.length;
    const conversionRate = decidedLeads > 0 
      ? (((filteredApproved.length + filteredDisbursed.length) / decidedLeads) * 100).toFixed(1) 
      : "0.0";
    
    // Submission rate: (Pending + Approved + Disbursed + Rejected) / Total * 100 (how many drafts got submitted)
    const submittedLeads = filteredPending.length + filteredApproved.length + filteredDisbursed.length + filteredRejected.length;
    const submissionRate = totalLeads > 0 
      ? ((submittedLeads / totalLeads) * 100).toFixed(1) 
      : "0.0";
    
    // Average processing time (mock - would need timestamps in data)
    // For now, use pending count as a proxy for processing load
    const processingLoad = filteredPending.length;
    const slaStatus = processingLoad > 10 ? "At Risk" : processingLoad > 5 ? "Warning" : "On Track";
    const slaColor = processingLoad > 10 ? "text-red-500" : processingLoad > 5 ? "text-yellow-500" : "text-green-500";
    
    return {
      totalLeads,
      drafts: filteredDrafts.length,
      pending: filteredPending.length,
      approved: filteredApproved.length,
      disbursed: filteredDisbursed.length,
      payout: filteredPayout.length,
      rejected: filteredRejected.length,
      conversionRate,
      submissionRate,
      processingLoad,
      slaStatus,
      slaColor,
    };
  }, [tabData, getFilteredData, getRoleScopedData]);

  // Columns to hide from display (but keep loan_account visible as link)
  const HIDDEN_COLUMNS = new Set(["lead_id", "loan_id", "client_id", "id", "external_id", "client_external_id", "countrycode", "country_code"]);
  
  // Columns that should be rendered as links
  const LINK_COLUMNS = new Set(["loan_account"]);
  
  // Columns that should be rendered as payout status badges
  const PAYOUT_STATUS_COLUMNS = new Set(["payout_status"]);

  // Columns that should be rendered as payment method (friendly labels)
  const PAYMENT_METHOD_COLUMNS = new Set(["payment_method", "payment_type", "payout_method", "preferredpaymentmethod", "preferredPaymentMethod"]);
  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Cash",
    MOBILE_MONEY: "Mobile Money",
    BANK_TRANSFER: "Bank Transfer",
  };

  // Generate columns for the data table
  const generateColumns = useCallback((data: any[]): DataTableColumn<any>[] => {
    if (!data || data.length === 0) return [];
    
    // Filter out hidden columns and internal columns
    const columnKeys = Object.keys(data[0]).filter(
      (col) => !col.startsWith("_") && !HIDDEN_COLUMNS.has(col.toLowerCase())
    );
    
    const columns: DataTableColumn<any>[] = [];

    // Add row number column first
    columns.push({
      id: "rowNumber",
      header: "#",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-xs">
          {row.index + 1}
        </span>
      ),
    });

    // Add data columns
    for (const col of columnKeys) {
      const isLinkColumn = LINK_COLUMNS.has(col.toLowerCase());
      const isPayoutStatusColumn = PAYOUT_STATUS_COLUMNS.has(col.toLowerCase());
      const isPaymentMethodColumn = PAYMENT_METHOD_COLUMNS.has(col.toLowerCase());
      
      columns.push({
        id: col,
        header: formatColumnHeader(col),
        accessorKey: col as keyof any,
        cell: ({ getValue, row }) => {
          const value = getValue();
          
          // Render payment_method as colored badges
          if (isPaymentMethodColumn) {
            const raw = value ? String(value).toUpperCase().replaceAll(/\s+/g, "_") : "";
            const label = raw ? (PAYMENT_METHOD_LABELS[raw] || raw.replaceAll("_", " ")) : null;
            if (!label) return <span className="text-muted-foreground">—</span>;
            const badgeCls = raw === "CASH"
              ? "bg-amber-100 text-amber-800 border-amber-200"
              : raw === "MOBILE_MONEY"
              ? "bg-blue-100 text-blue-800 border-blue-200"
              : raw === "BANK_TRANSFER"
              ? "bg-purple-100 text-purple-800 border-purple-200"
              : "bg-gray-100 text-gray-800 border-gray-200";
            return <Badge className={`${badgeCls} text-xs`}>{label}</Badge>;
          }
          
          // Render payout_status with colored badges
          if (isPayoutStatusColumn) {
            const status = String(value || "PENDING").toUpperCase();
            if (status === "PAID") {
              return (
                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                  Paid
                </Badge>
              );
            } else if (status === "VOIDED") {
              return (
                <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-xs">
                  Voided
                </Badge>
              );
            } else {
              return (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                  Pending
                </Badge>
              );
            }
          }
          
          // Render loan_account as a clickable link to loan detail page
          if (isLinkColumn && value) {
            const rowData = row.original;
            const clientId = rowData.client_id;
            const loanId = rowData.loan_id;
            
            // Only show as link if we have both client_id and loan_id
            if (clientId && loanId) {
              return (
                <Link
                  href={`/clients/${clientId}/loans/${loanId}`}
                  className="text-primary hover:text-primary/80 hover:underline transition-colors font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {String(value)}
                </Link>
              );
            }
            
            // Otherwise just show the value
            return <span className="font-medium">{String(value)}</span>;
          }
          
          return formatCellValue(col, value, orgCurrency, row.original, tenantLocale.countryCode);
        },
        enableSorting: true,
      });
    }

    return columns;
  }, [orgCurrency, tenantLocale.countryCode]);

  // Memoize columns for each tab
  const tabColumns = useMemo(() => {
    const columns: Record<string, DataTableColumn<any>[]> = {};
    for (const tab of TABS) {
      const data = tabData[tab.report];
      columns[tab.report] = data?.data ? generateColumns(data.data) : [];
    }
    return columns;
  }, [tabData, generateColumns]);

  // Render data table for a tab
  const renderTable = (report: string) => {
    const data = tabData[report];
    const isLoading = loading[report];
    const error = errors[report];
    const columns = tabColumns[report];

    if (isLoading && !data) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-destructive">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p className="font-medium">Error loading data</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchReport(report)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    if (!data || data.data.length === 0) {
      return (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No records found for the selected date range.</p>
          <p className="text-sm mt-2">
            {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
          </p>
        </div>
      );
    }

    const roleScopedData = getRoleScopedData(data.data);
    const filteredData = getFilteredData(report, roleScopedData);
    const filterOpts = tabFilterOptions[report];
    const tabFilters = filters[report];

    return (
      <div className="space-y-4">
        {/* Smart Filters */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:gap-3 p-3 bg-muted/30 dark:bg-muted/10 rounded-lg border dark:border-border">
          {filterOpts.branches.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">Branch:</span>
              <Select
                value={tabFilters.branch}
                onValueChange={(value) => updateFilter(report, "branch", value)}
              >
                <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {filterOpts.branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {filterOpts.loanProducts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">Product:</span>
              <Select
                value={tabFilters.loanProduct}
                onValueChange={(value) => updateFilter(report, "loanProduct", value)}
              >
                <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {filterOpts.loanProducts.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {filterOpts.submittedBy.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">By:</span>
              <Select
                value={tabFilters.submittedBy}
                onValueChange={(value) => updateFilter(report, "submittedBy", value)}
              >
                <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {filterOpts.submittedBy.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(tabFilters.branch !== "all" || tabFilters.loanProduct !== "all" || tabFilters.submittedBy !== "all") && (
            <div className="flex items-center gap-2 sm:ml-auto">
              <Badge variant="secondary" className="text-xs">
                {filteredData.length} of {roleScopedData.length} records
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setFilters((prev) => ({
                  ...prev,
                  [report]: { branch: "all", loanProduct: "all", submittedBy: "all" },
                }))}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        <GenericDataTable
          data={filteredData}
          columns={columns}
          tableId={`leads-${report}-table`}
          searchPlaceholder="Search records..."
          enablePagination={true}
          enableColumnVisibility={true}
          enableExport={true}
          pageSize={20}
          exportFileName={`leads-${report}-${format(dateRange.from, "yyyy-MM-dd")}`}
          onRowClick={navigatingRowId ? undefined : (row: any) => {
            // Get the lead ID from available fields
            const leadId = row.lead_id || row.external_id || row.client_external_id;
            
            if (!leadId) {
              // Log for debugging - row doesn't have a matching local lead
              console.warn("Cannot open lead: no lead_id found in row", row);
              return;
            }
            
            // Set loading state
            setNavigatingRowId(leadId);
            
            // Drafts tab → open new lead form to continue editing
            // Other tabs (pending, approved, rejected) → open lead detail page
            if (report === "drafts") {
              globalThis.location.href = `/leads/new?id=${leadId}`;
            } else {
              globalThis.location.href = `/leads/${leadId}`;
            }
          }}
          emptyMessage="No records found for the selected filters."
          isLoading={isLoading || !!navigatingRowId}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Stats Cards */}
      <div className="grid gap-2 sm:gap-3 lg:gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{pipelineStats.totalLeads}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              {userFilterScope.label}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{pipelineStats.conversionRate}%</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              {pipelineStats.approved} approved / {pipelineStats.approved + pipelineStats.rejected} decided
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Submission Rate</CardTitle>
            <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{pipelineStats.submissionRate}%</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
              {pipelineStats.drafts} drafts pending
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">SLA Status</CardTitle>
            <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className={cn("text-xl sm:text-2xl font-bold", pipelineStats.slaColor)}>
              {pipelineStats.slaStatus}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              {pipelineStats.pending} pending approval
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border dark:border-border">
        <CardHeader className="border-b dark:border-border px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">Loan Applications</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                View loan applications by status for the selected period
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal flex-1 sm:flex-none sm:min-w-[240px] text-xs sm:text-sm",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <DateRangeLabel dateRange={dateRange} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from) {
                        setDateRange({
                          from: range.from,
                          to: range.to || range.from,
                        });
                      }
                    }}
                    numberOfMonths={isMobile ? 1 : 2}
                  />
                  <div className="border-t dark:border-border p-3 flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        setDateRange({
                          from: startOfDay(today),
                          to: endOfDay(today),
                        });
                      }}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const weekAgo = new Date(today);
                        weekAgo.setDate(today.getDate() - 7);
                        setDateRange({
                          from: startOfDay(weekAgo),
                          to: endOfDay(today),
                        });
                      }}
                    >
                      Last 7 days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                        setDateRange({
                          from: startOfDay(monthStart),
                          to: endOfDay(today),
                        });
                      }}
                    >
                      This month
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                onClick={handleRefresh}
                disabled={loading[activeTab]}
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading[activeTab] && "animate-spin")}
                />
              </Button>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-2">
              Last updated: {format(lastUpdated, "HH:mm:ss")} • Auto-refreshes every 10s
            </p>
          )}
        </CardHeader>
      <CardContent className="pt-4 sm:pt-6 px-2 sm:px-4 lg:px-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="overflow-x-auto -mx-1 px-1 mb-4 scrollbar-none">
            <TabsList className="inline-flex w-full lg:grid lg:grid-cols-6 h-auto bg-muted/50 dark:bg-muted/30 p-1 rounded-lg min-w-max lg:min-w-0">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "py-2.5 px-3 sm:py-3 sm:px-4 rounded-md transition-all duration-200 flex-shrink-0",
                    "data-[state=active]:text-white data-[state=active]:shadow-md",
                    "data-[state=inactive]:hover:bg-muted dark:data-[state=inactive]:hover:bg-muted/50",
                    tab.activeBg,
                    activeTab !== tab.id && tab.inactiveText
                  )}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {tab.icon}
                    <span className="font-medium text-xs sm:text-sm">{tab.label}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "ml-0.5 sm:ml-1 transition-colors min-w-[24px] sm:min-w-[28px] justify-center text-[10px] sm:text-xs",
                        activeTab === tab.id
                          ? "bg-white/25 text-white border-white/20"
                          : "bg-background dark:bg-background/50 text-foreground"
                      )}
                    >
                      {loading[tab.id] && !tabData[tab.id] ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        String(pipelineStats[tab.report as keyof typeof pipelineStats] ?? tabCounts[tab.id])
                      )}
                    </Badge>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0">
              {renderTable(tab.report)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
    </div>
  );
}

// Helper to format column headers (snake_case to Title Case)
function formatColumnHeader(col: string): string {
  return col
    .replaceAll("_", " ")
    .replaceAll(/\b\w/g, (l) => l.toUpperCase());
}

// Number formatters for international format
const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Column patterns for different formatting
const CURRENCY_PATTERNS = [
  "amount", 
  "principal", 
  "balance", 
  "fee", 
  "charge", 
  "disbursed", 
  "repaid", 
  "outstanding",
  "total",
  "payment",
  "arrears",
  "due",
  "paid",
  "penalty",
  "waived",
  "written_off",
  "overdue",
];
const PERCENTAGE_PATTERNS = ["interest_rate", "rate_", "_rate", "percent", "%"];
const SKIP_NUMBER_FORMAT_PATTERNS = ["id", "account", "phone", "mobile"];
const PHONE_PATTERNS = ["phone", "mobile", "cell", "tel"];

function isCurrencyColumn(colLower: string): boolean {
  // If it has "amount" anywhere, it's currency (even interest_amount)
  if (colLower.includes("amount")) return true;
  // Check for currency patterns but exclude percentage columns
  if (isPercentageColumn(colLower)) return false;
  return CURRENCY_PATTERNS.some(pattern => colLower.includes(pattern));
}

function isPercentageColumn(colLower: string): boolean {
  // If it has "amount", it's not a percentage
  if (colLower.includes("amount")) return false;
  return PERCENTAGE_PATTERNS.some(pattern => colLower.includes(pattern));
}

function shouldSkipNumberFormat(colLower: string): boolean {
  return SKIP_NUMBER_FORMAT_PATTERNS.some(pattern => colLower.includes(pattern));
}

function isPhoneColumn(colLower: string): boolean {
  return PHONE_PATTERNS.some(pattern => colLower.includes(pattern));
}

function formatPhoneNumber(value: any, countryCode?: string, defaultCountryCode?: string): string {
  if (!value) return "-";

  const code = countryCode || defaultCountryCode || "+260";
  const codeDigits = code.replace("+", "");
  let phone = String(value).replaceAll(/\D/g, "");

  // Strip country code prefix if already present in the number
  if (phone.startsWith(codeDigits)) {
    phone = phone.slice(codeDigits.length);
  }

  // Strip leading 0
  if (phone.startsWith("0") && phone.length > 1) {
    phone = phone.slice(1);
  }

  if (phone.length >= 7) {
    return `${code} ${phone.slice(0, 2)} ${phone.slice(2)}`;
  }

  return `${code} ${phone}`;
}

function formatDate(value: any): React.ReactNode | null {
  // Handle Fineract date arrays [year, month, day]
  if (Array.isArray(value) && value.length === 3) {
    const [year, month, day] = value;
    return <span className="text-muted-foreground">{format(new Date(year, month - 1, day), "MMM d, yyyy")}</span>;
  }
  // Handle ISO date strings
  if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return <span className="text-muted-foreground">{format(new Date(value), "MMM d, yyyy")}</span>;
  }
  return null;
}

// Helper to get badge color based on status/stage value
function getBadgeColor(value: string): string {
  // Approved/Success states - Green
  if (value.includes("approved") || value.includes("success") || value.includes("complete") || 
      value.includes("active") || value.includes("disbursed") || value.includes("paid")) {
    return "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
  }
  
  // Pending/Warning states - Yellow/Amber
  if (value.includes("pending") || value.includes("waiting") || value.includes("review") ||
      value.includes("submitted") || value.includes("processing")) {
    return "border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
  }
  
  // Rejected/Error states - Red
  if (value.includes("rejected") || value.includes("failed") || value.includes("cancelled") ||
      value.includes("declined") || value.includes("overdue") || value.includes("written")) {
    return "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
  }
  
  // Draft/New states - Gray
  if (value.includes("draft") || value.includes("new") || value.includes("created")) {
    return "border-gray-500 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
  
  // In Progress states - Blue
  if (value.includes("progress") || value.includes("ongoing") || value.includes("started") ||
      value.includes("verification") || value.includes("kyc")) {
    return "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
  }
  
  // Default - neutral
  return "border-border";
}

// Helper to strip formatting from number strings (commas, spaces)
function cleanNumberString(value: string): string {
  return value.trim().replaceAll(",", "").replaceAll(" ", "");
}

// Helper to check if value is numeric
function isNumericValue(value: any): boolean {
  if (typeof value === "number") return true;
  if (typeof value === "string") {
    const cleaned = cleanNumberString(value);
    return cleaned !== "" && !Number.isNaN(Number(cleaned));
  }
  return false;
}

// Helper to parse numeric value (handles comma-formatted strings)
function parseNumericValue(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    return Number(cleanNumberString(value));
  }
  return Number.NaN;
}

// Format numeric value based on column type
function formatNumericValue(value: any, colLower: string, currencyCode?: string): React.ReactNode | null {
  if (!isNumericValue(value)) return null;
  
  const num = parseNumericValue(value);
  if (Number.isNaN(num)) return null;
  
  // Currency columns
  if (isCurrencyColumn(colLower)) {
    return <span className="font-medium tabular-nums">{formatCurrency(num, currencyCode)}</span>;
  }
  
  // Percentage columns
  if (isPercentageColumn(colLower)) {
    return <span className="tabular-nums">{currencyFormatter.format(num)}%</span>;
  }
  
  // Skip IDs, accounts, phones
  if (shouldSkipNumberFormat(colLower)) return null;
  
  // Decimals
  if (num % 1 !== 0) {
    return <span className="tabular-nums">{currencyFormatter.format(num)}</span>;
  }
  
  // Large integers
  if (Math.abs(num) >= 1000) {
    return <span className="tabular-nums">{integerFormatter.format(num)}</span>;
  }
  
  return null;
}

// Helper to format cell values
function formatCellValue(column: string, value: any, currencyCode?: string, rowData?: any, defaultCountryCode?: string): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  const colLower = column.toLowerCase();

  // Phone numbers
  if (isPhoneColumn(colLower)) {
    const code = rowData?.countryCode || rowData?.country_code;
    return <span className="tabular-nums">{formatPhoneNumber(value, code, defaultCountryCode)}</span>;
  }

  // Dates (check before numbers as dates can look numeric)
  if (colLower.includes("date")) {
    const formatted = formatDate(value);
    if (formatted) return formatted;
  }

  // Numeric values (currency, percentage, general numbers)
  const numericFormatted = formatNumericValue(value, colLower, currencyCode);
  if (numericFormatted) return numericFormatted;

  // Status and pipeline stage badges with colors
  if (colLower.includes("status") || colLower.includes("stage") || colLower.includes("pipeline")) {
    const badgeColor = getBadgeColor(String(value).toLowerCase());
    return <Badge variant="outline" className={cn("text-xs", badgeColor)}>{value}</Badge>;
  }

  // Bold for names
  if (colLower.includes("name") || colLower.includes("client")) {
    return <span className="font-medium">{String(value)}</span>;
  }

  return String(value);
}
