"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  Upload,
  FileText,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ArrowUpCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContractData } from "./contract-types";
import { getMySignature } from "@/app/actions/user-signature-actions";
import type { FacilityIntent } from "@/components/credit-facility/facility-toggle";
import {
  createCreditFacilityForLead,
  linkLoanToExistingFacility,
} from "@/app/actions/credit-facility-actions";

function parseFineractErrorResponse(responseText: string): string {
  try {
    const parsed = JSON.parse(responseText);
    const errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
    const message =
      errors.find((error: any) => typeof error?.defaultUserMessage === "string")
        ?.defaultUserMessage ||
      parsed?.defaultUserMessage ||
      parsed?.message ||
      parsed?.error;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch {
    // Fall through to the raw response text.
  }

  return responseText || "Fineract request failed";
}

const successfulLeadLoanOutcomes = new Set([
  "created",
  "created_and_linked",
  "created_linked",
  "loan_created",
  "loan_created_and_linked",
  "already_linked",
  "linked",
  "loan_linked",
  "reconciled",
  "reconcile_succeeded",
  "success",
  "succeeded",
]);

function isSuccessfulLeadLoanOutcome(outcome: unknown): boolean {
  if (typeof outcome !== "string") return false;

  const normalizedOutcome = outcome
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return successfulLeadLoanOutcomes.has(normalizedOutcome);
}

function getLeadLoanCommandError(
  payload: { message?: unknown; error?: unknown } | null | undefined,
  fallback: string,
): string {
  const message = payload?.message || payload?.error;
  return typeof message === "string" && message.trim()
    ? message.trim()
    : fallback;
}

function normalizeCreatedLoanId(value: unknown): number | null {
  const loanId = Number(value);
  return Number.isInteger(loanId) && loanId > 0 ? loanId : null;
}

function normalizeDatatableColumnName(name: string | undefined | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[_\s-]+/g, "")
    .replace(/cd.*$/i, "");
}

function cleanDatatableLookupValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const duplicateMatch = trimmed.match(/^(.+?)\s+cd[\s-]+\1$/i);
  if (duplicateMatch?.[1]) {
    return duplicateMatch[1].trim();
  }

  const cdMatch = trimmed.match(/^(.+?)\s+cd_[a-z_]+\s+/i);
  if (cdMatch?.[1]) {
    return cdMatch[1].trim();
  }

  const prefixMatch = trimmed.match(/^cd_[a-z_]+\s+(.+)$/i);
  if (prefixMatch?.[1]) {
    return prefixMatch[1].trim();
  }

  return trimmed;
}

function isBankNameColumn(normalizedColumnName: string): boolean {
  return normalizedColumnName === "bank" || normalizedColumnName === "bankname";
}

function isBankBranchCodeColumn(normalizedColumnName: string): boolean {
  return (
    normalizedColumnName === "bankbranchcode" ||
    normalizedColumnName.includes("bankbranchcode")
  );
}

function isBranchCodeOnlyColumn(normalizedColumnName: string): boolean {
  return (
    (normalizedColumnName === "branchcode" ||
      normalizedColumnName.includes("branchcode")) &&
    !normalizedColumnName.includes("bankbranchcode")
  );
}

function isBranchNameColumn(normalizedColumnName: string): boolean {
  return (
    normalizedColumnName === "branchname" ||
    normalizedColumnName === "bankbranchname" ||
    normalizedColumnName.includes("branchname")
  );
}

function isAccountNumberColumn(normalizedColumnName: string): boolean {
  return (
    normalizedColumnName === "accountnumber" ||
    normalizedColumnName === "bankaccountnumber" ||
    normalizedColumnName.includes("accountnumber") ||
    normalizedColumnName.includes("accountno")
  );
}

function resolveDatatableCellValue(header: any, rawValue: unknown): string {
  if (rawValue == null) return "";

  if (
    header?.columnDisplayType === "CODELOOKUP" &&
    Array.isArray(header?.columnValues)
  ) {
    const match = header.columnValues.find(
      (columnValue: any) =>
        columnValue.id === rawValue || columnValue.id === Number(rawValue),
    );

    if (match) {
      return cleanDatatableLookupValue(
        String(match.name || match.value || rawValue),
      );
    }
  }

  return cleanDatatableLookupValue(String(rawValue));
}

function extractClientBankDetailsFromRow(
  headers: any[],
  row: any[],
  tableName: string,
): {
  bankName?: string;
  branchName?: string;
  sortCode?: string;
  accountNumber?: string;
} | null {
  const bankNameIndex = headers.findIndex((header: any) =>
    isBankNameColumn(normalizeDatatableColumnName(header?.columnName)),
  );
  const bankBranchCodeIndex = headers.findIndex((header: any) =>
    isBankBranchCodeColumn(normalizeDatatableColumnName(header?.columnName)),
  );
  const branchCodeIndex = headers.findIndex((header: any) =>
    isBranchCodeOnlyColumn(normalizeDatatableColumnName(header?.columnName)),
  );
  const branchNameIndex = headers.findIndex((header: any) =>
    isBranchNameColumn(normalizeDatatableColumnName(header?.columnName)),
  );
  const accountNumberIndex = headers.findIndex((header: any) =>
    isAccountNumberColumn(normalizeDatatableColumnName(header?.columnName)),
  );

  const resolvedBranchCodeIndex =
    bankBranchCodeIndex >= 0 ? bankBranchCodeIndex : branchCodeIndex;
  const hasBankShape =
    bankNameIndex >= 0 ||
    branchNameIndex >= 0 ||
    resolvedBranchCodeIndex >= 0 ||
    (accountNumberIndex >= 0 && tableName.includes("bank"));

  if (!hasBankShape) {
    return null;
  }

  const getValue = (index: number): string | undefined => {
    if (index < 0) return undefined;
    const value = resolveDatatableCellValue(headers[index], row[index]);
    return value || undefined;
  };

  return {
    bankName: getValue(bankNameIndex),
    branchName: getValue(branchNameIndex),
    sortCode: getValue(resolvedBranchCodeIndex),
    accountNumber: getValue(accountNumberIndex),
  };
}

function isOverdueChargeLike(charge?: any): boolean {
  const timeType = charge?.originalCharge?.chargeTimeType || charge?.chargeTimeType;
  const code = String(timeType?.code || "").toLowerCase();
  const value = String(timeType?.value || "").toLowerCase();

  if (
    code === "chargetimetype.overdueinstallment" ||
    code === "overdueinstallment" ||
    code.endsWith(".overdueinstallment") ||
    value.includes("overdue")
  ) {
    return true;
  }

  return !timeType && Boolean(charge?.originalCharge?.penalty ?? charge?.penalty);
}

async function fineractFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(parseFineractErrorResponse(responseText));
  }

  return response;
}

interface LoanContractsProps {
  leadId?: string;
  clientId?: number;
  repaymentSchedule?: any;
  loanDetails?: any;
  loanTerms?: any;
  loanTemplate?: any;
  contractData?: ContractData;
  facilityIntent?: FacilityIntent;
  onComplete?: () => void;
  onBack?: () => void;
}

function resolveLoanScheduleTypeCode(
  loanScheduleType: string | undefined,
  options:
    | Array<{ id?: number; code?: string; value?: string }>
    | undefined
) {
  if (!loanScheduleType) return undefined;

  const exactCodeMatch = options?.find((option) => option.code === loanScheduleType);
  if (exactCodeMatch?.code) return exactCodeMatch.code;

  const valueMatch = options?.find((option) => option.value === loanScheduleType);
  if (valueMatch?.code) return valueMatch.code;

  return loanScheduleType;
}

type PreviewDoc = "contract" | "mandate" | "kfs";

const PREVIEW_DOCUMENT_TYPES: Record<PreviewDoc, "CONTRACT" | "MANDATE" | "KFS"> = {
  contract: "CONTRACT",
  mandate: "MANDATE",
  kfs: "KFS",
};

const PREVIEW_PLACEHOLDER = "<p>Loading preview…</p>";

/**
 * srcDoc iframes have origin about:srcdoc — inject <base> so relative URLs
 * (e.g. /gfl-logo.png, /api/documents/…) resolve against the app origin.
 */
function withBaseTag(html: string): string {
  if (typeof window === "undefined") return html;
  const baseTag = `<base href="${window.location.origin}/">`;
  if (html.includes("<head>")) return html.replace("<head>", `<head>${baseTag}`);
  if (/<head\s[^>]*>/.test(html)) return html.replace(/<head\s[^>]*>/, (m) => `${m}${baseTag}`);
  return baseTag + html;
}

export function LoanContracts({
  leadId,
  clientId,
  repaymentSchedule,
  loanDetails,
  loanTerms,
  loanTemplate,
  contractData: initialContractData,
  facilityIntent,
  onComplete,
  onBack,
}: LoanContractsProps) {
  const { currencyCode: orgCurrency, locale: tenantLocale } = useCurrency();
  const signaturesOptional =
    !!tenantLocale.createLeadSignaturesOnContractOptional;
  const [contractData, setContractData] = useState<ContractData | null>(
    initialContractData || null,
  );
  const [isLoading, setIsLoading] = useState(!initialContractData);
  const [error, setError] = useState<string | null>(null);
  const [borrowerSignature, setBorrowerSignature] = useState<string | null>(
    null,
  );
  const [guarantorSignature, setGuarantorSignature] = useState<string | null>(
    null,
  );
  const [loanOfficerSignature, setLoanOfficerSignature] = useState<
    string | null
  >(null);
  const [uploadingBorrower, setUploadingBorrower] = useState(false);
  const [uploadingGuarantor, setUploadingGuarantor] = useState(false);
  const [isLoadingOfficerSignature, setIsLoadingOfficerSignature] =
    useState(true);
  const [officerSignatureError, setOfficerSignatureError] = useState<
    string | null
  >(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [availableSignatures, setAvailableSignatures] = useState<
    Array<{ id: number; name: string; url: string }>
  >([]);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [activeDoc, setActiveDoc] = useState<"kfs" | "contract" | "mandate">("contract");
  const [hasTenantContractTemplate, setHasTenantContractTemplate] = useState(false);
  // Bumped to re-render previews when the tenant template may have changed.
  const [previewNonce, setPreviewNonce] = useState(0);
  const [renderedPreviews, setRenderedPreviews] = useState<
    Partial<Record<PreviewDoc, string | null>>
  >({});
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [renderPreviewError, setRenderPreviewError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const isInvoiceDiscountingLoan =
    loanDetails?.facilityType === "INVOICE_DISCOUNTING";

  const extractLoanChargeId = (payload: any): number | null => {
    const candidate =
      payload?.resourceId ?? payload?.entityId ?? payload?.id ?? null;
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  // The server selects this only for Omama ARDA stock loans. It avoids relying
  // on a separate client-side tenant lookup to choose the correct document.
  const isArdaStockLoanContract =
    contractData?.documentVariant === "ARDA_STOCK_INPUT";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tenant/contract-template?slug=full-loan")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((templateData) => {
        if (cancelled) return;
        setHasTenantContractTemplate(Boolean(templateData?.html));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-populate loan officer signature from user's saved profile signature
  useEffect(() => {
    let cancelled = false;
    setIsLoadingOfficerSignature(true);
    setOfficerSignatureError(null);
    getMySignature()
      .then(({ signatureData }) => {
        if (!cancelled) {
          setLoanOfficerSignature(signatureData ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoanOfficerSignature(null);
          setOfficerSignatureError("Failed to load your saved signature.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingOfficerSignature(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Convert signature value to backend format
  const toBackendSignature = (
    value: string | null
  ): { dataUrl?: string; fineractClientId?: number; documentId?: number } | null => {
    if (!value) return null;

    // data: URL format (local preview)
    if (value.startsWith("data:")) {
      return { dataUrl: value };
    }

    // Fineract document URL format: /api/fineract/clients/{clientId}/documents/{documentId}/attachment
    const fineractMatch = value.match(/\/api\/fineract\/clients\/(\d+)\/documents\/(\d+)\/attachment/);
    if (fineractMatch) {
      return {
        fineractClientId: parseInt(fineractMatch[1], 10),
        documentId: parseInt(fineractMatch[2], 10),
      };
    }

    return null;
  };

  // Sequence counter for preview rendering to avoid race conditions
  const previewSequenceRef = useRef<number>(0);

  useEffect(() => {
    // The server is the source of truth for tenant- and product-specific
    // document selection. Local schedule data is only a fallback for a lead
    // that has not been saved yet.
    if (leadId) {
      void loadContractData();
      return;
    }

    if (
      !initialContractData &&
      repaymentSchedule &&
      loanDetails &&
      loanTerms
    ) {
      console.log("Building contract data from provided schedule");
      void buildContractDataFromSchedule();
    }
  }, [leadId, initialContractData, repaymentSchedule, loanDetails, loanTerms]);

  // Load existing signatures from Fineract
  useEffect(() => {
    const loadSignatures = async () => {
      if (!clientId) return;

      setIsLoadingSignatures(true);
      try {
        const response = await fetch(
          `/api/fineract/clients/${clientId}/documents`,
        );
        if (!response.ok) {
          setIsLoadingSignatures(false);
          return;
        }

        const result = await response.json();
        let documents: any[] = [];

        // Handle different response formats
        if (result.success && result.data) {
          documents = result.data;
        } else if (Array.isArray(result)) {
          documents = result;
        } else if (result.pageItems && Array.isArray(result.pageItems)) {
          documents = result.pageItems;
        } else if (result.content && Array.isArray(result.content)) {
          documents = result.content;
        } else if (result.documents && Array.isArray(result.documents)) {
          documents = result.documents;
        }

        // Filter for signature documents (any document with "signature" in the name)
        const signatureDocs = documents.filter(
          (doc: any) =>
            doc.name &&
            (doc.name.toLowerCase().includes("signature") ||
              doc.name.toLowerCase().includes("sig")),
        );

        // Build available signatures list
        const signatures = signatureDocs.map((doc: any) => ({
          id: doc.id,
          name: doc.name || `Signature ${doc.id}`,
          url: `/api/fineract/clients/${clientId}/documents/${doc.id}/attachment`,
        }));

        setAvailableSignatures(signatures);

        // Auto-load specific signature types if found
        const borrowerSig = documents.find(
          (doc: any) => doc.name === "borrowerSignature",
        );
        const guarantorSig = documents.find(
          (doc: any) => doc.name === "guarantorSignature",
        );
        if (borrowerSig) {
          const imgUrl = `/api/fineract/clients/${clientId}/documents/${borrowerSig.id}/attachment`;
          setBorrowerSignature(imgUrl);
        }
        if (guarantorSig) {
          const imgUrl = `/api/fineract/clients/${clientId}/documents/${guarantorSig.id}/attachment`;
          setGuarantorSignature(imgUrl);
        }
      } catch (err) {
        console.error("Error loading signatures:", err);
        // Non-critical error, just log it
      } finally {
        setIsLoadingSignatures(false);
      }
    };

    loadSignatures();
  }, [clientId]);

  // Preview rendering: every document is rendered by loan-matrix-be.
  useEffect(() => {
    if (!leadId || !contractData) return;

    const currentSequence = ++previewSequenceRef.current;
    const abortController = new AbortController();
    const docs: PreviewDoc[] = hasTenantContractTemplate
      ? ["contract", "mandate"]
      : ["contract", "mandate", "kfs"];

    // Debounce so typing/uploading signatures doesn't fire a request per change.
    const renderTimeout = setTimeout(async () => {
      setIsRenderingPreview(true);
      setRenderPreviewError(null);
      const signatures = {
        borrower: toBackendSignature(borrowerSignature),
        guarantor: toBackendSignature(guarantorSignature),
        loanOfficer: toBackendSignature(loanOfficerSignature),
      };

      try {
        const results = await Promise.all(
          docs.map(async (doc) => {
            const res = await fetch(`/api/leads/${leadId}/contracts/render`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                documentType: PREVIEW_DOCUMENT_TYPES[doc],
                format: "HTML",
                contractData,
                signatures,
              }),
              signal: abortController.signal,
            });
            return [doc, res.ok ? withBaseTag(await res.text()) : null] as const;
          }),
        );

        if (currentSequence !== previewSequenceRef.current) return;
        setRenderedPreviews(Object.fromEntries(results));
        if (results.some(([, html]) => html === null)) {
          setRenderPreviewError("Failed to render one or more document previews");
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Error rendering preview:", err);
        if (currentSequence === previewSequenceRef.current) {
          setRenderPreviewError("Failed to render preview");
        }
      } finally {
        if (currentSequence === previewSequenceRef.current) {
          setIsRenderingPreview(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(renderTimeout);
      abortController.abort();
    };
    // toBackendSignature is a pure helper recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    leadId,
    contractData,
    hasTenantContractTemplate,
    previewNonce,
    borrowerSignature,
    guarantorSignature,
    loanOfficerSignature,
  ]);

  const buildContractDataFromSchedule = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("Building contract from schedule - fetching client data");

      // Fetch lead data directly (lightweight, no complex validations)
      const leadResponse = await fetch(`/api/leads/${leadId}`);
      if (!leadResponse.ok) {
        const errorText = await leadResponse.text();
        console.error("Failed to fetch lead data:", errorText);
        throw new Error("Failed to fetch client data");
      }

      const lead = await leadResponse.json();
      if (!lead || !lead.id) {
        throw new Error("Lead not found");
      }

      const clientName = [lead.firstname, lead.middlename, lead.lastname]
        .filter(Boolean)
        .join(" ");

      // Fetch Fineract client details for gender (best-effort)
      const FINERACT_GENDER_MAP: Record<number, string> = { 15: "Male", 16: "Female" };
      console.log("Gender debug:", { gender: lead.gender, genderId: lead.genderId, type: typeof lead.genderId, mapped: lead.genderId ? FINERACT_GENDER_MAP[lead.genderId] : "no id" });
      let genderName =
        (lead.genderId && FINERACT_GENDER_MAP[lead.genderId]) ||
        (lead.gender && lead.gender !== "null" && lead.gender !== "N/A" ? lead.gender : "") ||
        "";
      let employerName: string | undefined;
      let employeeNo: string | undefined;

      let residentialAddress: string | undefined;
      let workAddress: string | undefined;
      let dtMaritalStatus: string | undefined;
      let dtSpouseName: string | undefined;
      let dtSpousePhone: string | undefined;
      let dtClosestRelativeName: string | undefined;
      let dtClosestRelativePhone: string | undefined;
      let dtClosestRelativeRelationship: string | undefined;
      let dtBusinessSector: string | undefined;
      let dtBusinessAddress: string | undefined;
      let dtBankName: string | undefined;
      let dtBranchName: string | undefined;
      let dtSortCode: string | undefined;
      let dtAccountNumber: string | undefined;
      let dtCollaterals: Array<{ description?: string }> = [];
      let dtReferees: Array<{
        name?: string;
        occupation?: string;
        relation?: string;
        address?: string;
        phone?: string;
      }> = [];

      if (lead.fineractClientId) {
        try {
          const clientRes = await fetch(
            `/api/fineract/clients/${lead.fineractClientId}`,
          );
          if (clientRes.ok) {
            const fineractClient = await clientRes.json();
            if (fineractClient?.gender?.name) {
              genderName = fineractClient.gender.name;
            } else if (fineractClient?.gender?.id) {
              genderName = fineractClient.gender.id === 22 ? "Female" : "Male";
            }
          }
        } catch (err) {
          console.warn(
            "Non-critical: Could not fetch Fineract client details:",
            err,
          );
        }

        try {
          const addrRes = await fetch(
            `/api/fineract/clients/${lead.fineractClientId}/addresses`,
          );
          if (addrRes.ok) {
            const addresses = await addrRes.json();
            if (Array.isArray(addresses)) {
              const formatAddr = (addr: any): string => {
                return [
                  addr.addressLine1,
                  addr.addressLine2,
                  addr.addressLine3,
                  addr.city,
                  addr.stateProvinceName,
                  addr.postalCode,
                  addr.countryName,
                ]
                  .filter((p) => typeof p === "string" && p.trim())
                  .map((p: string) => p.trim())
                  .join(", ");
              };

              for (const addr of addresses) {
                const typeName = (addr.addressTypeName || addr.addressType || "").toLowerCase();
                const formatted = formatAddr(addr);
                if (!formatted) continue;

                if (!residentialAddress && (typeName.includes("residential") || typeName.includes("home") || typeName.includes("permanent"))) {
                  residentialAddress = formatted;
                } else if (!workAddress && (typeName.includes("work") || typeName.includes("office") || typeName.includes("business"))) {
                  workAddress = formatted;
                }
              }

              if (!residentialAddress && addresses.length > 0) {
                const formatted = formatAddr(addresses[0]);
                if (formatted) residentialAddress = formatted;
              }
            }
          }
        } catch (err) {
          console.warn("Non-critical: Could not fetch client addresses:", err);
        }

        // Fetch all Fineract client datatables for contract data (best-effort)
        try {
          const dtListRes = await fetch(
            `/api/fineract/datatables?apptable=m_client`,
          );
          if (dtListRes.ok) {
            const allDatatables = await dtListRes.json();

            const resolveCodeValue = (header: any, rawValue: any): string => {
              if (rawValue == null) return "";
              if (
                header.columnDisplayType === "CODELOOKUP" &&
                Array.isArray(header.columnValues)
              ) {
                const match = header.columnValues.find(
                  (cv: any) =>
                    cv.id === rawValue || cv.id === Number(rawValue),
                );
                return match?.value || match?.name || String(rawValue);
              }
              return String(rawValue);
            };

            for (const dt of allDatatables) {
              const tableName = dt.registeredTableName || "";
              const lowerName = tableName.toLowerCase();
              try {
                const dtRes = await fetch(
                  `/api/fineract/datatables/${encodeURIComponent(tableName)}/${lead.fineractClientId}?genericResultSet=true`,
                );
                if (!dtRes.ok) continue;
                const dtData = await dtRes.json();
                const headers = dtData?.columnHeaders || [];
                const rows = dtData?.data || [];
                if (rows.length === 0) continue;

                const getVal = (
                  row: any[],
                  colMatch: (name: string) => boolean,
                ) => {
                  const idx = headers.findIndex((h: any) =>
                    colMatch(
                      (h.columnName || "")
                        .toLowerCase()
                        .replace(/\s+/g, "_"),
                    ),
                  );
                  return idx >= 0 ? row[idx] : undefined;
                };

                const getResolvedVal = (
                  row: any[],
                  colMatch: (name: string) => boolean,
                ): string => {
                  const idx = headers.findIndex((h: any) =>
                    colMatch(
                      (h.columnName || "")
                        .toLowerCase()
                        .replace(/\s+/g, "_"),
                    ),
                  );
                  if (idx < 0) return "";
                  return resolveCodeValue(headers[idx], row[idx]);
                };

                for (const rowObj of rows) {
                  const bankDetails = extractClientBankDetailsFromRow(
                    headers,
                    rowObj?.row || [],
                    lowerName,
                  );

                  if (!bankDetails) continue;
                  if (!dtBankName && bankDetails.bankName) {
                    dtBankName = bankDetails.bankName;
                  }
                  if (!dtBranchName && bankDetails.branchName) {
                    dtBranchName = bankDetails.branchName;
                  }
                  if (!dtSortCode && bankDetails.sortCode) {
                    dtSortCode = bankDetails.sortCode;
                  }
                  if (!dtAccountNumber && bankDetails.accountNumber) {
                    dtAccountNumber = bankDetails.accountNumber;
                  }

                  if (dtBankName && dtBranchName && dtSortCode && dtAccountNumber) {
                    break;
                  }
                }

                if (
                  lowerName.includes("employment") ||
                  lowerName.includes("employer")
                ) {
                  const firstRow = rows[0]?.row || [];
                  if (!employerName) {
                    const idx = headers.findIndex((h: any) =>
                      (h.columnName || "")
                        .toLowerCase()
                        .replace(/\s+/g, "_")
                        .includes("employer"),
                    );
                    if (idx >= 0 && firstRow[idx]) {
                      employerName = resolveCodeValue(
                        headers[idx],
                        firstRow[idx],
                      );
                    }
                  }
                  if (!employeeNo) {
                    const val = getVal(
                      firstRow,
                      (n) =>
                        n.includes("employee") && n.includes("num"),
                    );
                    if (val) employeeNo = String(val);
                  }
                }

                if (lowerName.includes("business")) {
                  const firstRow = rows[0]?.row || [];
                  if (!dtBusinessSector) {
                    dtBusinessSector = getResolvedVal(
                      firstRow,
                      (n) =>
                        n.includes("business") &&
                        (n.includes("sector") || n.includes("type")),
                    );
                  }
                  if (!dtBusinessAddress) {
                    const val = getVal(
                      firstRow,
                      (n) => n === "address" || n.includes("address"),
                    );
                    if (val) dtBusinessAddress = String(val);
                  }
                }

                if (lowerName.includes("family")) {
                  const firstRow = rows[0]?.row || [];
                  if (!dtMaritalStatus) {
                    dtMaritalStatus = getResolvedVal(
                      firstRow,
                      (n) => n.includes("marital"),
                    );
                  }
                  if (!dtSpouseName) {
                    const val = getVal(
                      firstRow,
                      (n) => n.includes("spouse") && n.includes("name"),
                    );
                    if (val) dtSpouseName = String(val);
                  }
                  if (!dtSpousePhone) {
                    const val = getVal(
                      firstRow,
                      (n) =>
                        n.includes("spouse") &&
                        (n.includes("phone") || n.includes("tel")),
                    );
                    if (val) dtSpousePhone = String(val);
                  }
                  if (!dtClosestRelativeName) {
                    const val = getVal(
                      firstRow,
                      (n) =>
                        n.includes("closest") && n.includes("name"),
                    );
                    if (val) dtClosestRelativeName = String(val);
                  }
                  if (!dtClosestRelativePhone) {
                    const val = getVal(
                      firstRow,
                      (n) =>
                        n.includes("closest") &&
                        (n.includes("phone") || n.includes("tel")),
                    );
                    if (val) dtClosestRelativePhone = String(val);
                  }
                  if (!dtClosestRelativeRelationship) {
                    dtClosestRelativeRelationship = getResolvedVal(
                      firstRow,
                      (n) => n.includes("relation"),
                    );
                  }
                }

                if (
                  lowerName.includes("security") ||
                  lowerName.includes("collateral")
                ) {
                  for (const rowObj of rows) {
                    const row = rowObj?.row || [];
                    const desc = getVal(
                      row,
                      (n) => n.includes("description"),
                    );
                    if (desc)
                      dtCollaterals.push({ description: String(desc) });
                  }
                }

                if (lowerName.includes("referee")) {
                  for (const rowObj of rows) {
                    const row = rowObj?.row || [];
                    const name = getVal(row, (n) => n === "name");
                    const occupation = getVal(
                      row,
                      (n) => n === "occupation",
                    );
                    const relation = getResolvedVal(
                      row,
                      (n) => n.includes("relation"),
                    );
                    const address = getVal(row, (n) => n === "address");
                    const phone = getVal(
                      row,
                      (n) =>
                        n.includes("telephone") ||
                        n.includes("phone") ||
                        n.includes("tel"),
                    );
                    dtReferees.push({
                      name: name ? String(name) : undefined,
                      occupation: occupation
                        ? String(occupation)
                        : undefined,
                      relation: relation || undefined,
                      address: address ? String(address) : undefined,
                      phone: phone ? String(phone) : undefined,
                    });
                  }
                }
              } catch (err) {
                console.warn(
                  `Non-critical: Could not fetch datatable "${tableName}":`,
                  err,
                );
              }
            }
          }
        } catch (err) {
          console.warn(
            "Non-critical: Could not fetch client datatables:",
            err,
          );
        }
      }

      // Derive loan officer name from loan template if available
      let loanOfficerName = "N/A";
      if (loanTemplate?.loanOfficerOptions && loanDetails?.loanOfficer) {
        const officer = loanTemplate.loanOfficerOptions.find(
          (o: any) => o.id?.toString() === loanDetails.loanOfficer?.toString(),
        );
        loanOfficerName = officer?.displayName || "N/A";
      }

      // Derive loan purpose name from loan template if available
      let loanPurposeName = "N/A";
      if (loanTemplate?.loanPurposeOptions && loanDetails?.loanPurpose) {
        const purpose = loanTemplate.loanPurposeOptions.find(
          (p: any) => p.id?.toString() === loanDetails.loanPurpose?.toString(),
        );
        loanPurposeName = purpose?.name || "N/A";
      }

      // Normalize ZMK to ZMW (Fineract uses legacy ZMK code)
      const rawCurrency = repaymentSchedule.currency?.code || orgCurrency;
      const currency = rawCurrency === "ZMK" ? "ZMW" : rawCurrency;
      const principal = loanTerms?.principal || 0;
      const interest = repaymentSchedule?.totalInterestCharged || 0;
      const fees = repaymentSchedule?.totalFeeChargesCharged || 0;
      const totalRepayment =
        repaymentSchedule?.totalRepaymentExpected ||
        principal + interest + fees;

      const numberOfPayments = loanTerms?.numberOfRepayments || 1;

      // Convert to monthly rate if the interest rate is annual (frequency type 3 = Per Year)
      const interestRateFrequency = parseInt(
        loanTerms?.interestRateFrequency || "2",
      );
      const nominalRate = loanTerms?.nominalInterestRate || 0;
      const monthlyPercentageRate =
        interestRateFrequency === 3 ? nominalRate / 12 : nominalRate;

      // Format repayment schedule
      const formattedSchedule =
        repaymentSchedule?.periods
          ?.filter(
            (period: any) =>
              period.period !== undefined && !period.downPaymentPeriod,
          )
          .map((period: any) => ({
            paymentNumber: period.period,
            dueDate: Array.isArray(period.dueDate)
              ? format(
                  new Date(
                    period.dueDate[0],
                    period.dueDate[1] - 1,
                    period.dueDate[2],
                  ),
                  "dd/MM/yyyy",
                )
              : format(new Date(period.dueDate), "dd/MM/yyyy"),
            paymentAmount:
              period.totalDueForPeriod || period.totalOriginalDueForPeriod || 0,
            principal: period.principalDue || period.principalDisbursed || 0,
            interestAndFees:
              (period.interestDue || 0) + (period.feeChargesDue || 0),
            remainingBalance: period.principalLoanBalanceOutstanding || 0,
          })) || [];

      const firstPaymentDate =
        formattedSchedule.length > 0
          ? formattedSchedule[0].dueDate
          : format(new Date(), "dd/MM/yyyy");

      // Format charges from loan terms (include chargeTimeType for proper categorization)
      const formattedCharges = (loanTerms.charges || []).map((charge: any) => ({
        name: charge.name,
        amount: charge.amount,
        chargeTimeType: charge.originalCharge?.chargeTimeType || null,
      }));

      // Upfront fees: charges with chargeTimeType.id === 1 (Disbursement)
      const upfrontFees = formattedCharges
        .filter((c: any) => {
          if (c.chargeTimeType?.id) {
            return c.chargeTimeType.id === 1;
          }
          return (
            !c.name.toLowerCase().includes("monthly") &&
            !c.name.toLowerCase().includes("recurring") &&
            !c.name.toLowerCase().includes("installment") &&
            !c.name.toLowerCase().includes("overdue") &&
            !c.name.toLowerCase().includes("late")
          );
        })
        .reduce((sum: number, c: any) => sum + c.amount, 0);
      const disbursedAmount = principal - upfrontFees;

      // Get frequency labels
      const getFrequencyLabel = (typeId: number): string => {
        const types: { [key: number]: string } = {
          0: "Days",
          1: "Weeks",
          2: "Months",
          3: "Years",
        };
        return types[typeId] || "Months";
      };

      const repaymentFrequency = loanTerms?.repaymentFrequency
        ? getFrequencyLabel(parseInt(loanTerms.repaymentFrequency))
        : "Monthly";

      const tenure =
        loanTerms?.loanTerm && loanTerms?.termFrequency
          ? `${loanTerms.loanTerm} ${getFrequencyLabel(parseInt(loanTerms.termFrequency))}`
          : `${numberOfPayments} ${repaymentFrequency}`;

      const loanDateValue =
        lead.expectedDisbursementDate || lead.submittedOnDate || null;
      const loanDate = loanDateValue
        ? format(new Date(loanDateValue), "dd/MM/yyyy")
        : undefined;
      const accountNumber =
        dtAccountNumber ||
        lead.accountNumber ||
        lead.stateContext?.bankAccountNumber ||
        lead.stateContext?.accountNumber ||
        lead.stateMetadata?.bankAccountNumber ||
        lead.stateMetadata?.accountNumber ||
        lead.fineractAccountNo ||
        undefined;
      const branchName =
        dtBranchName ||
        lead.stateContext?.branchName ||
        lead.stateContext?.bankBranchName ||
        lead.stateMetadata?.branchName ||
        lead.stateMetadata?.bankBranchName ||
        undefined;
      const sortCode =
        dtSortCode ||
        lead.stateContext?.sortCode ||
        lead.stateContext?.bankBranchCode ||
        lead.stateMetadata?.sortCode ||
        lead.stateMetadata?.bankBranchCode ||
        undefined;
      const bankName =
        dtBankName ||
        lead.bankName ||
        lead.stateContext?.bankName ||
        lead.stateMetadata?.bankName ||
        undefined;

      const builtContractData: ContractData = {
        clientName,
        nrc: lead.externalId || "N/A",
        dateOfBirth: lead.dateOfBirth
          ? format(new Date(lead.dateOfBirth), "dd/MM/yyyy")
          : "N/A",
        gender: genderName,
        employeeNo,
        employer: employerName,
        gflNo: lead.fineractClientId?.toString() || undefined,
        loanId: leadId,
        loanAmount: principal,
        disbursedAmount,
        tenure,
        numberOfPayments,
        paymentFrequency: repaymentFrequency,
        firstPaymentDate,
        interest,
        fees,
        totalCostOfCredit: interest + fees,
        totalRepayment,
        paymentPerPeriod:
          formattedSchedule.length > 0
            ? formattedSchedule.reduce(
                (sum: number, p: any) => sum + p.paymentAmount,
                0,
              ) / formattedSchedule.length
            : totalRepayment / numberOfPayments,
        monthlyPercentageRate,
        repaymentSchedule: formattedSchedule,
        charges: formattedCharges,
        currency,
        branch: lead.officeName || "Head Office",
        loanOfficer: loanOfficerName,
        loanPurpose: loanPurposeName,
        firstname: lead.firstname || undefined,
        middlename: lead.middlename || undefined,
        lastname: lead.lastname || undefined,
        mobileNo: lead.mobileNo || undefined,
        countryCode: lead.countryCode || undefined,
        accountNumber,
        branchName,
        sortCode,
        loanDate,
        requestedAmount: lead.requestedAmount ?? undefined,
        annualIncome: lead.annualIncome ?? undefined,
        monthlyIncome: lead.monthlyIncome ?? undefined,
        grossMonthlyIncome: lead.grossMonthlyIncome ?? undefined,
        monthlyExpenses: lead.monthlyExpenses ?? undefined,
        employmentStatus: lead.employmentStatus || undefined,
        employerName: lead.employerName || employerName || undefined,
        yearsEmployed: lead.yearsEmployed ?? undefined,
        yearsAtCurrentJob: lead.yearsAtCurrentJob || undefined,
        businessType: lead.businessType || undefined,
        businessOwnership: lead.businessOwnership ?? undefined,
        collateralType: lead.collateralType || undefined,
        collateralValue: lead.collateralValue ?? undefined,
        bankName,
        existingLoans: lead.existingLoans ?? undefined,
        hasExistingLoans: lead.hasExistingLoans ?? undefined,
        nationality: lead.nationality || undefined,
        residentialAddress: residentialAddress || undefined,
        workAddress: workAddress || dtBusinessAddress || undefined,
        familyMembers: lead.familyMembers || undefined,
        stateContext: lead.stateContext || undefined,
        stateMetadata: lead.stateMetadata || undefined,
        maritalStatus: dtMaritalStatus || undefined,
        spouseName: dtSpouseName || undefined,
        spousePhone: dtSpousePhone || undefined,
        closestRelativeName: dtClosestRelativeName || undefined,
        closestRelativePhone: dtClosestRelativePhone || undefined,
        closestRelativeRelationship: dtClosestRelativeRelationship || undefined,
        businessSector: dtBusinessSector || undefined,
        businessAddress: dtBusinessAddress || undefined,
        collaterals: dtCollaterals.length > 0 ? dtCollaterals : undefined,
        referees: dtReferees.length > 0 ? dtReferees : undefined,
      };

      setContractData(builtContractData);
      console.log("Contract data built from schedule successfully");
    } catch (err) {
      console.error("Error building contract data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to build contract data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback: build contract data purely from props when API calls fail
  const buildContractDataFromAvailableProps = () => {
    if (!repaymentSchedule || !loanTerms) {
      setError(
        "Cannot build contract: missing repayment schedule or loan terms. Please go back and complete previous steps.",
      );
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("Building contract data from available props (fallback)");

      const rawCurrency = repaymentSchedule.currency?.code || orgCurrency;
      const currency = rawCurrency === "ZMK" ? "ZMW" : rawCurrency;
      const principal = loanTerms?.principal || 0;
      const interest = repaymentSchedule?.totalInterestCharged || 0;
      const fees = repaymentSchedule?.totalFeeChargesCharged || 0;
      const totalRepayment =
        repaymentSchedule?.totalRepaymentExpected ||
        principal + interest + fees;
      const numberOfPayments = loanTerms?.numberOfRepayments || 1;

      const interestRateFrequency = parseInt(
        loanTerms?.interestRateFrequency || "2",
      );
      const nominalRate = loanTerms?.nominalInterestRate || 0;
      const monthlyPercentageRate =
        interestRateFrequency === 3 ? nominalRate / 12 : nominalRate;

      const formattedSchedule =
        repaymentSchedule?.periods
          ?.filter(
            (period: any) =>
              period.period !== undefined && !period.downPaymentPeriod,
          )
          .map((period: any) => ({
            paymentNumber: period.period,
            dueDate: Array.isArray(period.dueDate)
              ? format(
                  new Date(
                    period.dueDate[0],
                    period.dueDate[1] - 1,
                    period.dueDate[2],
                  ),
                  "dd/MM/yyyy",
                )
              : format(new Date(period.dueDate), "dd/MM/yyyy"),
            paymentAmount:
              period.totalDueForPeriod || period.totalOriginalDueForPeriod || 0,
            principal: period.principalDue || period.principalDisbursed || 0,
            interestAndFees:
              (period.interestDue || 0) + (period.feeChargesDue || 0),
            remainingBalance: period.principalLoanBalanceOutstanding || 0,
          })) || [];

      const firstPaymentDate =
        formattedSchedule.length > 0
          ? formattedSchedule[0].dueDate
          : format(new Date(), "dd/MM/yyyy");

      const formattedCharges = (loanTerms.charges || []).map((charge: any) => ({
        name: charge.name,
        amount: charge.amount,
        chargeTimeType: charge.originalCharge?.chargeTimeType || null,
      }));

      const upfrontFees = formattedCharges
        .filter((c: any) => {
          if (c.chargeTimeType?.id) return c.chargeTimeType.id === 1;
          return (
            !c.name.toLowerCase().includes("monthly") &&
            !c.name.toLowerCase().includes("recurring") &&
            !c.name.toLowerCase().includes("installment") &&
            !c.name.toLowerCase().includes("overdue") &&
            !c.name.toLowerCase().includes("late")
          );
        })
        .reduce((sum: number, c: any) => sum + c.amount, 0);
      const disbursedAmount = principal - upfrontFees;

      const getFrequencyLabel = (typeId: number): string => {
        const types: { [key: number]: string } = {
          0: "Days",
          1: "Weeks",
          2: "Months",
          3: "Years",
        };
        return types[typeId] || "Months";
      };

      const repaymentFrequency = loanTerms?.repaymentFrequency
        ? getFrequencyLabel(parseInt(loanTerms.repaymentFrequency))
        : "Monthly";

      const tenure =
        loanTerms?.loanTerm && loanTerms?.termFrequency
          ? `${loanTerms.loanTerm} ${getFrequencyLabel(parseInt(loanTerms.termFrequency))}`
          : `${numberOfPayments} ${repaymentFrequency}`;

      const loanDateValue =
        loanDetails?.disbursementOn || loanDetails?.submittedOn || null;
      const loanDate = loanDateValue
        ? format(new Date(loanDateValue), "dd/MM/yyyy")
        : undefined;

      let loanOfficerName = "N/A";
      if (loanTemplate?.loanOfficerOptions && loanDetails?.loanOfficer) {
        const officer = loanTemplate.loanOfficerOptions.find(
          (o: any) => o.id?.toString() === loanDetails.loanOfficer?.toString(),
        );
        loanOfficerName = officer?.displayName || "N/A";
      }

      let loanPurposeName = "N/A";
      if (loanTemplate?.loanPurposeOptions && loanDetails?.loanPurpose) {
        const purpose = loanTemplate.loanPurposeOptions.find(
          (p: any) => p.id?.toString() === loanDetails.loanPurpose?.toString(),
        );
        loanPurposeName = purpose?.name || "N/A";
      }

      const fallbackData: ContractData = {
        clientName: clientId ? `Client #${clientId}` : "N/A",
        nrc: "N/A",
        dateOfBirth: "N/A",
        gender: "",
        gflNo: clientId?.toString() || undefined,
        loanId: leadId,
        loanAmount: principal,
        disbursedAmount,
        tenure,
        numberOfPayments,
        paymentFrequency: repaymentFrequency,
        firstPaymentDate,
        interest,
        fees,
        totalCostOfCredit: interest + fees,
        totalRepayment,
        paymentPerPeriod:
          formattedSchedule.length > 0
            ? formattedSchedule.reduce(
                (sum: number, p: any) => sum + p.paymentAmount,
                0,
              ) / formattedSchedule.length
            : totalRepayment / numberOfPayments,
        monthlyPercentageRate,
        repaymentSchedule: formattedSchedule,
        charges: formattedCharges,
        currency,
        branch: "Head Office",
        loanOfficer: loanOfficerName,
        loanPurpose: loanPurposeName,
        loanDate,
        requestedAmount: loanTerms?.principal ?? undefined,
      };

      setContractData(fallbackData);
      setError(null);
      console.log("Contract data built from props (fallback) successfully");

      toast({
        title: "Loaded with limited data",
        description:
          "Some client details (name, NRC, DOB) may be missing. You can still review the financial terms and schedule.",
      });
    } catch (err) {
      console.error("Error building fallback contract data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to build contract data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadContractData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("Loading contract data for leadId:", leadId);

      if (!leadId) {
        throw new Error("Lead ID is required to load contract data");
      }

      const response = await fetch(`/api/leads/${leadId}/contract-data`);
      console.log("Contract data response status:", response.status);

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        console.error("Contract data API error:", errorPayload);
        throw new Error(
          errorPayload?.error ||
            `Failed to load contract data: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log("Contract data result:", result);

      if (result.success && result.data) {
        setContractData(result.data);
        console.log("Contract data loaded successfully");
      } else {
        throw new Error(result.error || "No contract data available");
      }
    } catch (err) {
      console.error("Error loading contract data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load contract data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshContract = async () => {
    setIsRefreshing(true);
    try {
      const templateRes = await fetch("/api/tenant/contract-template?slug=full-loan");
      const templateData = templateRes.ok ? await templateRes.json() : null;
      setHasTenantContractTemplate(Boolean(templateData?.html));
      setPreviewNonce((n) => n + 1);

      let dataRefreshed = false;
      if (leadId) {
        const dataRes = await fetch(`/api/leads/${leadId}/contract-data`);
        if (dataRes.ok) {
          const result = await dataRes.json();
          if (result.success && result.data) {
            setContractData(result.data);
            dataRefreshed = true;
          }
        }
      }

      if (!dataRefreshed && repaymentSchedule && loanDetails && loanTerms) {
        await buildContractDataFromSchedule();
      }

      toast({ title: "Contract refreshed" });
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignatureUpload = async (
    file: File,
    signatureType: "borrower" | "guarantor",
  ) => {
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or GIF image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Client ID required",
        description: "Cannot upload signature without a valid client ID",
        variant: "destructive",
      });
      return;
    }

    const setUploading =
      signatureType === "borrower"
        ? setUploadingBorrower
        : setUploadingGuarantor;

    const setSignature =
      signatureType === "borrower"
        ? setBorrowerSignature
        : setGuarantorSignature;

    try {
      setUploading(true);

      // Convert file to base64 for local preview (works for both modes)
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to backend
      const formData = new FormData();
      formData.append("file", file);
      formData.append("role", signatureType);
      formData.append("clientId", String(clientId));

      const response = await fetch(`/api/leads/${leadId}/contracts/signatures`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload signature");
      }

      console.log("Signature uploaded:", response.status);

      // Update local preview with base64
      const dataUrl = await dataUrlPromise;
      setSignature(dataUrl);

      toast({
        title: "Signature uploaded",
        description: `${
          signatureType.charAt(0).toUpperCase() + signatureType.slice(1)
        } signature uploaded successfully`,
      });
    } catch (err) {
      console.error("Error uploading signature:", err);
      toast({
        title: "Upload failed",
        description:
          err instanceof Error
            ? err.message
            : "Failed to upload signature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };


  const handlePrint = async (
    printType: "kfs" | "contract" | "mandate" | "both" = "both"
  ) => {
    if (!leadId || !contractData) return;

    const docs: PreviewDoc[] =
      printType !== "both"
        ? [printType]
        : hasTenantContractTemplate
          ? ["contract", "mandate"]
          : ["kfs", "contract", "mandate"];

    // Open the windows synchronously, inside the click, so popup blockers allow them.
    const windows = docs.map(() => window.open("", "_blank"));
    const signatures = {
      borrower: toBackendSignature(borrowerSignature),
      guarantor: toBackendSignature(guarantorSignature),
      loanOfficer: toBackendSignature(loanOfficerSignature),
    };

    const results = await Promise.all(
      docs.map(async (doc, i) => {
        const w = windows[i];
        try {
          const res = await fetch(`/api/leads/${leadId}/contracts/render`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentType: PREVIEW_DOCUMENT_TYPES[doc],
              format: "PDF",
              contractData,
              signatures,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const url = URL.createObjectURL(await res.blob());
          if (w) w.location.href = url;
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          return true;
        } catch (err) {
          console.error(`Failed to generate ${doc} PDF:`, err);
          if (w && !w.closed) w.close();
          return false;
        }
      }),
    );

    if (results.includes(false)) {
      toast({
        title: "Error",
        description: "Failed to generate one or more PDFs",
        variant: "destructive",
      });
    }
  };

  const handlePrintKeyFacts = () => handlePrint("kfs");
  const handlePrintContract = () => handlePrint("contract");
  const handlePrintMandate = () => handlePrint("mandate");
  const handlePrintBoth = () => handlePrint("both");

  const handleComplete = async () => {
    if (!signaturesOptional && !borrowerSignature) {
      toast({
        title: "Signature required",
        description: "Please upload the borrower's signature before completing",
        variant: "destructive",
      });
      return;
    }

    if (!signaturesOptional && !loanOfficerSignature) {
      toast({
        title: "Signature required",
        description:
          "No saved loan officer signature was found for your account. Contact an administrator to add or correct it before completing.",
        variant: "destructive",
      });
      return;
    }

    if (!leadId || !clientId || !contractData || !loanDetails || !loanTerms) {
      toast({
        title: "Missing data",
        description:
          "Required lead or loan data is missing. Please complete all previous steps.",
        variant: "destructive",
      });
      return;
    }

    setIsCompleting(true);

    try {
      // Step 1: Save signature metadata to lead
      if (leadId) {
        try {
          const signatureMetadata = {
            borrowerSignature: !!borrowerSignature,
            guarantorSignature: !!guarantorSignature,
            loanOfficerSignature: !!loanOfficerSignature,
            completedAt: new Date().toISOString(),
            completedBy: "user",
          };

          await fetch(`/api/leads/${leadId}/signatures`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(signatureMetadata),
          });
        } catch (err) {
          console.error("Error saving signature metadata:", err);
        }
      }

      // Step 2: Create loan in Fineract
      toast({
        title: "Creating loan...",
        description: "Submitting loan application to Fineract",
      });

      const requestedCharges = Array.isArray(loanTerms.charges)
        ? loanTerms.charges.filter((charge: any) => !isOverdueChargeLike(charge))
        : [];
      const resolvedLoanScheduleType = resolveLoanScheduleTypeCode(
        loanTerms.loanScheduleType,
        loanTemplate?.loanScheduleTypeOptions,
      );

      const loanPayload = {
        productId: loanDetails.productId || loanDetails.product,
        loanOfficerId: loanDetails.loanOfficer || "",
        loanPurposeId: loanDetails.loanPurpose || "",
        fundId: loanDetails.fund || "",
        submittedOnDate: loanDetails.submittedOn
          ? format(new Date(loanDetails.submittedOn), "dd MMMM yyyy")
          : format(new Date(), "dd MMMM yyyy"),
        expectedDisbursementDate: loanDetails.disbursementOn
          ? format(new Date(loanDetails.disbursementOn), "dd MMMM yyyy")
          : format(new Date(), "dd MMMM yyyy"),
        externalId: leadId || loanDetails.externalId || "",
        linkAccountId: loanDetails.linkSavings || "",
        createStandingInstructionAtDisbursement:
          loanDetails.createStandingInstructions ? "true" : "",
        loanTermFrequency: loanTerms.loanTerm || 1,
        loanTermFrequencyType: loanTerms.termFrequency
          ? parseInt(loanTerms.termFrequency)
          : 2,
        numberOfRepayments: loanTerms.numberOfRepayments || 1,
        repaymentEvery: loanTerms.repaymentEvery || 1,
        repaymentFrequencyType: loanTerms.repaymentFrequency
          ? parseInt(loanTerms.repaymentFrequency)
          : 2,
        repaymentFrequencyNthDayType: loanTerms.repaymentFrequencyNthDay || "",
        repaymentFrequencyDayOfWeekType:
          loanTerms.repaymentFrequencyDayOfWeek || "",
        repaymentsStartingFromDate: loanTerms.firstRepaymentOn
          ? format(new Date(loanTerms.firstRepaymentOn), "dd MMMM yyyy")
          : null,
        interestChargedFromDate: loanTerms.interestChargedFrom
          ? format(new Date(loanTerms.interestChargedFrom), "dd MMMM yyyy")
          : null,
        interestType: loanTerms.interestMethod
          ? parseInt(loanTerms.interestMethod)
          : 1,
        isEqualAmortization: loanTerms.isEqualAmortization || false,
        amortizationType: loanTerms.amortization
          ? parseInt(loanTerms.amortization)
          : 1,
        interestCalculationPeriodType: loanTerms.interestCalculationPeriod
          ? parseInt(loanTerms.interestCalculationPeriod)
          : 1,
        ...(loanTerms.isTopup && loanTerms.loanIdToClose
          ? { isTopup: true, loanIdToClose: parseInt(loanTerms.loanIdToClose) }
          : {}),
        transactionProcessingStrategyCode:
          loanTerms.repaymentStrategy || "creocore-strategy",
        interestRateFrequencyType: loanTerms.interestRateFrequency
          ? parseInt(loanTerms.interestRateFrequency)
          : 2,
        interestRatePerPeriod: loanTerms.nominalInterestRate || 0,
        ...(resolvedLoanScheduleType
          ? { loanScheduleType: resolvedLoanScheduleType }
          : {}),
        balloonPaymentAmount: loanTerms.balloonRepaymentAmount ?? 0,
        allowPartialPeriodInterestCalculation:
          loanTerms.calculateInterestForExactDays ?? false,
        allowPartialPeriodInterestCalcualtion:
          loanTerms.calculateInterestForExactDays ?? false,
        inArrearsTolerance: loanTerms.arrearsTolerance ?? 0,
        graceOnInterestCharged: loanTerms.interestFreePeriod ?? 0,
        graceOnPrincipalPayment: loanTerms.graceOnPrincipalPayment ?? 0,
        graceOnInterestPayment: loanTerms.graceOnInterestPayment ?? 0,
        graceOnArrearsAgeing: loanTerms.onArrearsAgeing ?? 0,
        charges: isInvoiceDiscountingLoan
          ? []
          : requestedCharges.map((charge: any) => {
              const calcCode: string =
                charge.originalCharge?.chargeCalculationType?.code ?? "";
              const isPercentage =
                calcCode.toLowerCase().includes("percent") &&
                typeof charge.originalCharge?.percentage === "number" &&
                Number.isFinite(charge.originalCharge.percentage);

              const chargeData: any = { chargeId: charge.chargeId };

              if (isPercentage) {
                chargeData.amount = charge.originalCharge.percentage;
              } else {
                chargeData.amount = charge.amount;
              }

              if (charge.dueDate) {
                chargeData.dueDate = charge.dueDate;
              }
              return chargeData;
            }),
        collateral:
          loanTerms.collaterals?.map((coll: any) => ({
            collateralTypeId: coll.id || 0,
            quantity: coll.quantity || 0,
            totalValue: coll.totalValue || 0,
          })) || [],
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        clientId: clientId,
        loanType: "individual",
        principal: loanTerms.principal || 0,
      };

      console.log("Creating loan with payload:", loanPayload);
      console.log("Loan charges being sent:", loanPayload.charges);
      console.log("Raw loanTerms.charges:", loanTerms.charges);
      const loanResponse = await fetch(`/api/leads/${leadId}/create-loan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fineractPayload: loanPayload }),
      });

      const loanResponseText = await loanResponse.text();
      let loanResult: Record<string, unknown> = {};
      try {
        loanResult = loanResponseText ? JSON.parse(loanResponseText) : {};
      } catch {
        loanResult = { error: loanResponseText };
      }

      if (!loanResponse.ok) {
        throw new Error(
          getLeadLoanCommandError(
            loanResult,
            "The server could not create and link the loan to this lead. Please retry or contact support.",
          ),
        );
      }

      if (
        loanResult?.success !== true ||
        !isSuccessfulLeadLoanOutcome(loanResult?.outcome)
      ) {
        const outcome =
          typeof loanResult?.outcome === "string"
            ? ` (outcome: ${loanResult.outcome})`
            : "";
        throw new Error(
          getLeadLoanCommandError(
            loanResult,
            `The loan was not durably linked to this lead${outcome}. No contract documents were uploaded. Please retry or contact support.`,
          ),
        );
      }

      const createdLoanId = normalizeCreatedLoanId(loanResult?.loanId);
      if (!createdLoanId) {
        throw new Error(
          "The loan command completed without a linked Fineract loan ID. No contract documents were uploaded. Please retry or contact support.",
        );
      }

      console.log("Loan created successfully:", createdLoanId);

      if (isInvoiceDiscountingLoan && createdLoanId && requestedCharges.length > 0) {
        console.log("Applying invoice discounting charges via add-charge endpoint");

        for (const charge of requestedCharges) {
          const calcCode: string =
            charge.originalCharge?.chargeCalculationType?.code ?? "";
          const isPercentage =
            calcCode.toLowerCase().includes("percent") &&
            typeof charge.originalCharge?.percentage === "number" &&
            Number.isFinite(charge.originalCharge.percentage);

          const chargePayload: any = {
            chargeId: charge.chargeId,
            amount: isPercentage
              ? charge.originalCharge.percentage
              : charge.amount,
            locale: "en",
          };

          if (charge.dueDate) {
            chargePayload.dueDate = charge.dueDate;
            chargePayload.dateFormat = "dd MMMM yyyy";
          }

          const addChargeResponse = await fineractFetch(
            `/api/fineract/loans/${createdLoanId}/charges`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(chargePayload),
            },
          );

          const addChargeResult = await addChargeResponse
            .json()
            .catch(() => ({}));
          const createdLoanChargeId = extractLoanChargeId(addChargeResult);

          if (!createdLoanChargeId) {
            throw new Error(
              "Loan charge was created but no loan charge id was returned",
            );
          }
        }
      }

      // Attach credit facility only after the lead-scoped command confirms a
      // successful outcome and durable local loan link.
      if (facilityIntent) {
        try {
          if (facilityIntent.mode === "create") {
            const facilityResult = await createCreditFacilityForLead(
              leadId,
              facilityIntent.facility,
            );
            if (!facilityResult.success) {
              console.error("Credit facility creation failed:", facilityResult.error);
              toast({ title: "Warning", description: `Loan created, but facility setup failed: ${facilityResult.error}`, variant: "destructive" });
            }
          } else if (facilityIntent.mode === "link") {
            const linkResult = await linkLoanToExistingFacility(leadId, loanPayload.principal);
            if (!linkResult.success) {
              console.error("Facility link failed:", linkResult.error);
              toast({ title: "Warning", description: `Loan created, but facility link failed: ${linkResult.error}`, variant: "destructive" });
            }
          }
        } catch (facilityErr) {
          console.error("Facility operation error:", facilityErr);
        }
      }

      // Step 3: Upload contracts via backend
      toast({
        title: "Uploading contracts...",
        description: "Generating and attaching contract documents to loan",
      });

      const signatures = {
        borrower: toBackendSignature(borrowerSignature),
        guarantor: toBackendSignature(guarantorSignature),
        loanOfficer: toBackendSignature(loanOfficerSignature),
      };

      const uploadResponse = await fetch(`/api/leads/${leadId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: createdLoanId,
          contractData,
          signatures,
        }),
      });

      const uploadResult: {
        documents?: Array<{ name: string; status: string; error?: string }>;
        message?: string;
        error?: string;
      } = await uploadResponse.json().catch(() => ({}));

      // 200 = all uploaded/already present/skipped, 207 = some failed.
      const failedDocs = (uploadResult.documents ?? []).filter((d) => d.status === "FAILED");
      if (!uploadResponse.ok || failedDocs.length > 0) {
        const failedNames =
          failedDocs.map((d) => (d.error ? `${d.name}: ${d.error}` : d.name)).join(", ") ||
          uploadResult.message ||
          uploadResult.error ||
          "unknown error";
        // The loan exists; warn and carry on to CDE and the redirect.
        toast({
          title: "Warning",
          description: `Loan created, but contract documents were not uploaded: ${failedNames}.`,
          variant: "destructive",
        });
      }

      // Step 4: Call CDE to evaluate the loan application
      if (leadId) {
        try {
          toast({
            title: "Evaluating loan...",
            description: "Running Credit Decision Engine evaluation",
          });

          const cdeResponse = await fetch(`/api/leads/${leadId}/call-cde`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (cdeResponse.ok) {
            const cdeResult = await cdeResponse.json();
            console.log("CDE evaluation completed:", cdeResult.decision);
          } else {
            console.warn("CDE evaluation failed, but continuing...");
          }
        } catch (cdeError) {
          console.error("Error calling CDE:", cdeError);
          // Don't block the flow if CDE call fails
        }
      }

      toast({
        title: "Success!",
        description: `Loan created successfully (ID: ${createdLoanId}) with contract documents attached. Redirecting...`,
      });

      if (onComplete) {
        onComplete();
      }

      // Redirect to lead detail page after a short delay to show the success message
      setTimeout(() => {
        if (leadId) {
          router.push(`/leads/${leadId}`);
        } else {
          router.push("/leads");
        }
      }, 2000);
    } catch (error) {
      console.error("Error completing contracts:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to complete contracts and create loan",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-muted-foreground">Loading contract data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center max-w-md mx-auto">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="text-red-500 font-medium mb-2">{error}</p>
            <p className="text-sm text-muted-foreground mb-6">
              This may be caused by a network issue or the server being
              temporarily unavailable. Try again, or continue with the data
              already loaded.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => {
                  if (repaymentSchedule && loanDetails && loanTerms) {
                    buildContractDataFromSchedule();
                  } else {
                    loadContractData();
                  }
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {isLoading ? "Retrying..." : "Retry"}
              </Button>
              {repaymentSchedule && loanTerms && (
                <Button
                  variant="outline"
                  onClick={buildContractDataFromAvailableProps}
                  disabled={isLoading}
                >
                  Continue with available data
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!contractData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">
            No contract data available. Please complete the previous steps.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Signature Upload Section */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Signatures</CardTitle>
          <CardDescription>
            Upload borrower and guarantor signatures here. The loan officer
            signature is pulled automatically from your profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Borrower Signature */}
              <div className="space-y-2">
                <Label htmlFor="borrower-signature">
                  Borrower Signature{!signaturesOptional ? " *" : ""}
                </Label>
              {availableSignatures.length > 0 && !borrowerSignature && (
                <Select
                  onValueChange={(value) => {
                    const selected = availableSignatures.find(
                      (sig) => sig.id.toString() === value,
                    );
                    if (selected) {
                      setBorrowerSignature(selected.url);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select existing signature" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSignatures.map((sig) => (
                      <SelectItem key={sig.id} value={sig.id.toString()}>
                        {sig.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {borrowerSignature ? (
                  <div className="space-y-2">
                    <img
                      src={borrowerSignature}
                      alt="Borrower signature"
                      className="max-h-24 mx-auto"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBorrowerSignature(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <Label
                      htmlFor="borrower-signature"
                      className="cursor-pointer text-sm text-blue-600 hover:underline"
                    >
                      {uploadingBorrower ? "Uploading..." : "Upload signature"}
                    </Label>
                    <Input
                      id="borrower-signature"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingBorrower}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSignatureUpload(file, "borrower");
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Guarantor Signature */}
            <div className="space-y-2">
              <Label htmlFor="guarantor-signature">Guarantor Signature</Label>
              {availableSignatures.length > 0 && !guarantorSignature && (
                <Select
                  onValueChange={(value) => {
                    const selected = availableSignatures.find(
                      (sig) => sig.id.toString() === value,
                    );
                    if (selected) {
                      setGuarantorSignature(selected.url);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select existing signature" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSignatures.map((sig) => (
                      <SelectItem key={sig.id} value={sig.id.toString()}>
                        {sig.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {guarantorSignature ? (
                  <div className="space-y-2">
                    <img
                      src={guarantorSignature}
                      alt="Guarantor signature"
                      className="max-h-24 mx-auto"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setGuarantorSignature(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <Label
                      htmlFor="guarantor-signature"
                      className="cursor-pointer text-sm text-blue-600 hover:underline"
                    >
                      {uploadingGuarantor ? "Uploading..." : "Upload signature"}
                    </Label>
                    <Input
                      id="guarantor-signature"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingGuarantor}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSignatureUpload(file, "guarantor");
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Loan Officer Signature */}
            <div className="space-y-2">
              <Label>
                Loan Officer Signature{!signaturesOptional ? " *" : ""}
              </Label>
              <div className="border-2 border-dashed rounded-lg p-4">
                {isLoadingOfficerSignature ? (
                  <div className="py-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Loading your saved signature...
                    </p>
                  </div>
                ) : loanOfficerSignature ? (
                  <div className="space-y-4 text-center">
                    <img
                      src={loanOfficerSignature}
                      alt="Loan officer signature"
                      className="max-h-24 mx-auto"
                    />
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-amber-900 dark:text-amber-100">
                        This signature comes from your profile. If it is not
                        correct, contact your administrator to update it.
                      </AlertDescription>
                    </Alert>
                    {officerSignatureError && (
                      <p className="text-sm text-destructive">
                        {officerSignatureError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-amber-900 dark:text-amber-100">
                        No saved signature was found for your account. Contact
                        your administrator to add or correct it.
                      </AlertDescription>
                    </Alert>
                    {officerSignatureError && (
                      <p className="text-sm text-destructive text-center">
                        {officerSignatureError}
                      </p>
                    )}
                    <div className="text-center text-sm text-muted-foreground">
                      Loan contracts use only the signature saved on your
                      profile.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Documents */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .contract-section,
          .contract-section * {
            visibility: visible;
          }
          .contract-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>

      <div className="contract-section bg-white text-black dark:bg-white dark:text-black">
        {/* Contract Preview using HTML Template */}
        {loanTerms?.isTopup && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 px-4 py-3">
            <ArrowUpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Top-Up Loan</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This loan will close an existing loan (ID: {loanTerms.loanIdToClose}) and top up the balance.
              </p>
            </div>
          </div>
        )}

        <Card className="mb-6 bg-white text-black border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle>Document Preview</CardTitle>
                  <CardDescription>
                    Review the documents before printing or completing
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshContract}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
              <div className="flex gap-2">
                  {!hasTenantContractTemplate && (
                    <Button
                      variant={activeDoc === "kfs" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveDoc("kfs")}
                    >
                      Key Facts Statement
                    </Button>
                  )}
                  <Button
                    variant={activeDoc === "contract" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveDoc("contract")}
                  >
                    Loan Contract
                  </Button>
                  <Button
                    variant={activeDoc === "mandate" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveDoc("mandate")}
                  >
                    Mandate Form
                  </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {renderPreviewError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{renderPreviewError}</AlertDescription>
              </Alert>
            )}
            {isRenderingPreview && (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading preview…</p>
                </div>
              </div>
            )}
            {activeDoc === "kfs" ? (
              <iframe
                srcDoc={renderedPreviews.kfs ?? PREVIEW_PLACEHOLDER}
                className="w-full border rounded bg-white"
                style={{ height: "700px", minHeight: "500px" }}
                title="Key Facts Statement Preview"
              />
            ) : activeDoc === "mandate" ? (
              <iframe
                srcDoc={renderedPreviews.mandate ?? PREVIEW_PLACEHOLDER}
                className="w-full border rounded bg-white"
                style={{ height: "700px", minHeight: "500px" }}
                title={
                  isArdaStockLoanContract
                    ? "ARDA Repayment Mandate Preview"
                    : "Mandate Form Preview"
                }
              />
            ) : (
              <iframe
                srcDoc={renderedPreviews.contract ?? PREVIEW_PLACEHOLDER}
                className="w-full border rounded bg-white"
                style={{ height: "700px", minHeight: "500px" }}
                title="Loan Contract Preview"
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons at Bottom */}
        <Card className="print:hidden">
          <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
            {onBack && (
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="px-6"
              >
                Previous
              </Button>
            )}
            <div className="flex gap-4 ml-auto">
              {!hasTenantContractTemplate && (
                <Button onClick={handlePrintKeyFacts} variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Print Key Facts
                </Button>
              )}
              <Button onClick={handlePrintContract} variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Print Contract
              </Button>
              <Button onClick={handlePrintMandate} variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Print Mandate
              </Button>
              {(!hasTenantContractTemplate || isArdaStockLoanContract) && (
                <Button onClick={handlePrintBoth} variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Print All
                </Button>
              )}
              <Button
                onClick={handleComplete}
                className="px-6 transition-all duration-300"
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Complete Contracts & Create Loan"
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
