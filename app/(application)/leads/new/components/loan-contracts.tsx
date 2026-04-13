"use client";

import { useCurrency } from "@/contexts/currency-context";
import { fineractFetch } from "@/lib/fineract-fetch";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import jsPDF from "jspdf";
import { generateContractHTML } from "./contract-template";
import { ContractData } from "./contract-types";
import { fillOmamaContractTemplate } from "./omama-contract-template";
import {
  generateKeyFactsStatementHTML,
  KeyFactsData,
} from "./key-facts-statement-template";

interface LoanContractsProps {
  leadId?: string;
  clientId?: number;
  repaymentSchedule?: any;
  loanDetails?: any;
  loanTerms?: any;
  loanTemplate?: any;
  contractData?: ContractData;
  onComplete?: () => void;
  onBack?: () => void;
}

export function LoanContracts({
  leadId,
  clientId,
  repaymentSchedule,
  loanDetails,
  loanTerms,
  loanTemplate,
  contractData: initialContractData,
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
  const [uploadingOfficer, setUploadingOfficer] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [availableSignatures, setAvailableSignatures] = useState<
    Array<{ id: number; name: string; url: string }>
  >([]);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [showKeyFacts, setShowKeyFacts] = useState(false);
  const [tenantContractHtml, setTenantContractHtml] = useState<string | null>(null);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [printPermissions, setPrintPermissions] = useState({
    canPrintContracts: false,
    approvalStatus: null as string | null,
    printBlockReason: "Printing is available after Final Approval.",
  });
  const { toast } = useToast();
  const router = useRouter();

  const filledTenantContractHtml = useMemo(() => {
    if (!tenantContractHtml) return null;
    let html: string;
    if (!contractData) {
      html = tenantContractHtml.replace(
        /\{\{\s*[A-Z_0-9]+\s*\}\}/g,
        " ____________________ "
      );
    } else {
      html = fillOmamaContractTemplate(tenantContractHtml, contractData, tenantLogoUrl, {
        borrower: borrowerSignature,
        guarantor: guarantorSignature,
        loanOfficer: loanOfficerSignature,
      });
    }
    // srcDoc iframes have origin about:srcdoc — inject <base> so relative
    // URLs (e.g. /api/documents/…) resolve against the real app origin.
    if (typeof window !== "undefined") {
      const baseTag = `<base href="${window.location.origin}/">`;
      if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>${baseTag}`);
      } else if (html.includes("<head ")) {
        html = html.replace(/<head\s[^>]*>/, (m) => `${m}${baseTag}`);
      } else {
        html = baseTag + html;
      }
    }
    return html;
  }, [tenantContractHtml, contractData, tenantLogoUrl, borrowerSignature, guarantorSignature, loanOfficerSignature]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tenant/contract-template?slug=full-loan")
      .then((res) => res.json())
      .then((data: { html?: string | null; logoUrl?: string | null }) => {
        if (!cancelled) {
          if (data.html) setTenantContractHtml(data.html);
          if (data.logoUrl) setTenantLogoUrl(data.logoUrl);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!leadId) {
      return;
    }

    fetch(`/api/leads/${leadId}/contract-data`)
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (cancelled || !result?.permissions) {
          return;
        }

        setPrintPermissions({
          canPrintContracts: !!result.permissions.canPrintContracts,
          approvalStatus: result.permissions.approvalStatus || null,
          printBlockReason:
            result.permissions.printBlockReason ||
            "Printing is available after Final Approval.",
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // Transform contract data to Key Facts Statement format
  const getKeyFactsData = (): KeyFactsData | null => {
    if (!contractData) return null;

    return {
      clientName: contractData.clientName,
      clientId: contractData.gflNo,
      nrc: contractData.nrc,
      applicationNo: contractData.loanId || leadId,
      loanId: contractData.loanId,
      loanAmount: contractData.loanAmount,
      disbursedAmount: contractData.disbursedAmount,
      interest: contractData.interest,
      fees: contractData.fees,
      totalCostOfCredit: contractData.totalCostOfCredit,
      totalRepayment: contractData.totalRepayment,
      paymentPerPeriod: contractData.paymentPerPeriod,
      tenure: contractData.tenure,
      numberOfPayments: contractData.numberOfPayments,
      paymentFrequency: contractData.paymentFrequency,
      firstPaymentDate: contractData.firstPaymentDate,
      monthlyPercentageRate: contractData.monthlyPercentageRate,
      charges: contractData.charges.map((charge) => ({
        name: charge.name,
        amount: charge.amount,
        isRecurring:
          charge.name.toLowerCase().includes("monthly") ||
          charge.name.toLowerCase().includes("recurring"),
        frequency: charge.name.toLowerCase().includes("monthly")
          ? "month"
          : undefined,
      })),
      lateFeeAmount: undefined, // TODO: Get from loan product template
      lateFeeDays: 10, // Default
      defaultInterestRate: 25, // Default
      defaultInterestDays: 10, // Default
      collateral: undefined, // TODO: Get from loan terms
      mandatorySavings: undefined,
      variableInterestApplies: false,
      repaymentSchedule: contractData.repaymentSchedule,
      currency: contractData.currency,
      preparedDate: format(new Date(), "EEEE, dd MMMM yyyy"),
      validFor: "30 days",
    };
  };

  // Refs for contract sections (for PDF generation)
  const keyFactsRef = useRef<HTMLDivElement>(null);
  const salaryAdvanceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If we have the repayment schedule and other required data, build contract data locally
    if (
      !initialContractData &&
      repaymentSchedule &&
      loanDetails &&
      loanTerms &&
      leadId
    ) {
      console.log("Building contract data from provided schedule");
      buildContractDataFromSchedule();
    } else if (!initialContractData && leadId && !repaymentSchedule) {
      // Fallback to API call if no schedule is provided
      console.log("No schedule provided, loading from API");
      loadContractData();
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
        const officerSig = documents.find(
          (doc: any) => doc.name === "loanOfficerSignature",
        );

        if (borrowerSig) {
          const imgUrl = `/api/fineract/clients/${clientId}/documents/${borrowerSig.id}/attachment`;
          setBorrowerSignature(imgUrl);
        }
        if (guarantorSig) {
          const imgUrl = `/api/fineract/clients/${clientId}/documents/${guarantorSig.id}/attachment`;
          setGuarantorSignature(imgUrl);
        }
        if (officerSig) {
          const imgUrl = `/api/fineract/clients/${clientId}/documents/${officerSig.id}/attachment`;
          setLoanOfficerSignature(imgUrl);
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
        lead.fineractAccountNo || lead.accountNumber || undefined;

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
        bankName: lead.bankName || undefined,
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
        const errorText = await response.text();
        console.error("Contract data API error:", errorText);
        throw new Error(
          `Failed to load contract data: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log("Contract data result:", result);

      if (result.success && result.data) {
        setContractData(result.data);
        if (result.permissions) {
          setPrintPermissions({
            canPrintContracts: !!result.permissions.canPrintContracts,
            approvalStatus: result.permissions.approvalStatus || null,
            printBlockReason:
              result.permissions.printBlockReason ||
              "Printing is available after Final Approval.",
          });
        }
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
      const templateData = await templateRes.json();
      if (templateData.html) setTenantContractHtml(templateData.html);
      if (templateData.logoUrl) setTenantLogoUrl(templateData.logoUrl);

      let dataRefreshed = false;
      if (leadId) {
        const dataRes = await fetch(`/api/leads/${leadId}/contract-data`);
        if (dataRes.ok) {
          const result = await dataRes.json();
          if (result.success && result.data) {
            setContractData(result.data);
            if (result.permissions) {
              setPrintPermissions({
                canPrintContracts: !!result.permissions.canPrintContracts,
                approvalStatus: result.permissions.approvalStatus || null,
                printBlockReason:
                  result.permissions.printBlockReason ||
                  "Printing is available after Final Approval.",
              });
            }
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
    signatureType: "borrower" | "guarantor" | "officer",
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
        : signatureType === "guarantor"
          ? setUploadingGuarantor
          : setUploadingOfficer;

    const setSignature =
      signatureType === "borrower"
        ? setBorrowerSignature
        : signatureType === "guarantor"
          ? setGuarantorSignature
          : setLoanOfficerSignature;

    try {
      setUploading(true);

      // Document names for different signature types
      const documentNames: {
        [key: string]: { name: string; description: string };
      } = {
        borrower: {
          name: "borrowerSignature",
          description: "Borrower signature for loan contract",
        },
        guarantor: {
          name: "guarantorSignature",
          description: "Guarantor signature for loan contract",
        },
        officer: {
          name: "loanOfficerSignature",
          description: "Loan officer signature for loan contract",
        },
      };

      // Upload to Fineract
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", documentNames[signatureType].name);
      formData.append("description", documentNames[signatureType].description);

      const response = await fetch(
        `/api/fineract/clients/${clientId}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload signature");
      }

      const result = await response.json();
      console.log("Signature uploaded to Fineract:", result);

      // Convert file to base64 for local preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignature(reader.result as string);
      };
      reader.readAsDataURL(file);

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

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handlePrint = (printType: "kfs" | "contract" | "both" = "both") => {
    if (!printPermissions.canPrintContracts) {
      toast({
        title: "Printing locked",
        description:
          printPermissions.printBlockReason ||
          "Printing is available after Final Approval.",
        variant: "destructive",
      });
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    if (printType === "kfs") {
      // Print only the Key Facts Statement
      const keyFactsData = getKeyFactsData();
      if (!keyFactsData) return;
      const kfsHTML = generateKeyFactsStatementHTML(keyFactsData, {
        borrower: borrowerSignature,
        guarantor: guarantorSignature,
        creditProvider: loanOfficerSignature,
      });
      printWindow.document.write(kfsHTML);
    } else if (printType === "contract") {
      // Print only the Salary Advance Contract
      const contractHTML =
        filledTenantContractHtml ||
        generateContractHTML(contractData, {
          borrower: borrowerSignature,
          guarantor: guarantorSignature,
          loanOfficer: loanOfficerSignature,
        });
      printWindow.document.write(contractHTML);
    } else {
      // Print both - Key Facts Statement AND Salary Advance Contract
      const keyFactsData = getKeyFactsData();
      if (!keyFactsData) return;

      const kfsHTML = generateKeyFactsStatementHTML(keyFactsData, {
        borrower: borrowerSignature,
        guarantor: guarantorSignature,
        creditProvider: loanOfficerSignature,
      });

      const contractHTML =
        filledTenantContractHtml ||
        generateContractHTML(contractData, {
          borrower: borrowerSignature,
          guarantor: guarantorSignature,
          loanOfficer: loanOfficerSignature,
        });

      // Extract body content from both HTML documents and combine them
      const kfsBodyMatch = kfsHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const contractBodyMatch = contractHTML.match(
        /<body[^>]*>([\s\S]*)<\/body>/i,
      );

      const kfsBody = kfsBodyMatch ? kfsBodyMatch[1] : "";
      const contractBody = contractBodyMatch ? contractBodyMatch[1] : "";

      // Extract styles from both documents
      const kfsStyleMatch = kfsHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      const contractStyleMatch = contractHTML.match(
        /<style[^>]*>([\s\S]*?)<\/style>/gi,
      );

      const combinedStyles = [
        ...(kfsStyleMatch || []),
        ...(contractStyleMatch || []),
      ].join("\n");

      // Create combined HTML with page break between documents
      const combinedHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>GFL - Key Facts Statement & Salary Advance Contract</title>
          ${combinedStyles}
          <style>
            .page-break {
              page-break-after: always;
              break-after: page;
            }
            @media print {
              .page-break {
                page-break-after: always;
                break-after: page;
              }
            }
          </style>
        </head>
        <body>
          <!-- Key Facts Statement -->
          <div class="page-break">
            ${kfsBody}
          </div>
          <!-- Salary Advance Contract -->
          <div>
            ${contractBody}
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(combinedHTML);
    }

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintKeyFacts = () => handlePrint("kfs");
  const handlePrintContract = () => handlePrint("contract");
  const handlePrintBoth = () => handlePrint("both");

  // Generate Key Facts Statement PDF (BOZ Format)
  const generateKeyFactsPDF = async (): Promise<Blob> => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const margin = 12;
    let yPosition = 15;
    const lineHeight = 4.5;
    const pageHeight = 280;
    const pageWidth = 210 - 2 * margin;
    const colWidth = pageWidth / 3 - 2;

    const addText = (
      text: string,
      fontSize: number = 9,
      bold: boolean = false,
      x: number = margin,
    ) => {
      if (yPosition > pageHeight - 15) {
        pdf.addPage();
        yPosition = 15;
      }
      pdf.setFontSize(fontSize);
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      const splitLines = pdf.splitTextToSize(text, pageWidth);
      splitLines.forEach((line: string) => {
        pdf.text(line, x, yPosition);
        yPosition += lineHeight;
      });
    };

    const addSection = (title: string) => {
      yPosition += 4;
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 3, pageWidth, 6, "F");
      addText(title, 10, true);
      yPosition += 2;
    };

    const addTableRow = (cols: string[], widths: number[], header = false) => {
      if (yPosition > pageHeight - 15) {
        pdf.addPage();
        yPosition = 15;
      }

      if (header) {
        pdf.setFillColor(51, 51, 51);
        pdf.setTextColor(255, 255, 255);
        pdf.rect(margin, yPosition - 3, pageWidth, 5, "F");
      } else {
        pdf.setTextColor(0, 0, 0);
      }

      pdf.setFontSize(7);
      pdf.setFont("helvetica", header ? "bold" : "normal");

      let x = margin;
      cols.forEach((col, i) => {
        const text = pdf.splitTextToSize(col, widths[i] - 2);
        pdf.text(text[0] || "", x + 1, yPosition);
        x += widths[i];
      });

      pdf.setTextColor(0, 0, 0);
      yPosition += lineHeight;
    };

    // ========== HEADER ==========
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text(
      "KEY FACTS STATEMENT FOR CONSUMER CREDIT",
      pageWidth / 2 + margin,
      yPosition,
      { align: "center" },
    );
    yPosition += 5;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.text(
      "*Review carefully before agreeing to a loan.*",
      pageWidth / 2 + margin,
      yPosition,
      { align: "center" },
    );
    yPosition += 3;
    pdf.text(
      "*You have the right to get a copy of the full loan agreement.*",
      pageWidth / 2 + margin,
      yPosition,
      { align: "center" },
    );
    yPosition += 4;
    pdf.setDrawColor(0, 0, 0);
    pdf.line(margin, yPosition, margin + pageWidth, yPosition);
    yPosition += 5;

    // ========== SECTION I: KEY TERMS ==========
    addSection("SECTION I: KEY TERMS");
    yPosition += 2;

    // Three column layout for key terms
    const startY = yPosition;

    // Column 1: LOAN SUMMARY
    let col1Y = startY;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("LOAN SUMMARY", margin, col1Y);
    col1Y += 4;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("1. Amount of Loan:", margin, col1Y);
    col1Y += 3;
    pdf.text(
      `${contractData.currency} ${formatCurrency(contractData.loanAmount)}`,
      margin,
      col1Y,
    );
    col1Y += 4;
    pdf.text("2. Duration of Loan Agreement:", margin, col1Y);
    col1Y += 3;
    pdf.text(contractData.tenure, margin, col1Y);
    col1Y += 4;
    pdf.text("3. Amount Received:", margin, col1Y);
    col1Y += 3;
    pdf.text(
      `${contractData.currency} ${formatCurrency(contractData.disbursedAmount)}`,
      margin,
      col1Y,
    );
    col1Y += 4;

    // Column 2: COST OF CREDIT
    let col2Y = startY;
    const col2X = margin + colWidth + 4;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("COST OF CREDIT", col2X, col2Y);
    col2Y += 4;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("4. Interest:", col2X, col2Y);
    col2Y += 3;
    pdf.text(
      `${contractData.currency} ${formatCurrency(contractData.interest)}`,
      col2X,
      col2Y,
    );
    col2Y += 4;
    pdf.text("5. Other Fees and Charges:", col2X, col2Y);
    col2Y += 3;
    pdf.text(
      `${contractData.currency} ${formatCurrency(contractData.fees)}`,
      col2X,
      col2Y,
    );
    col2Y += 4;
    pdf.text("6. Monthly Percentage Rate:", col2X, col2Y);
    col2Y += 3;
    pdf.text(`${contractData.monthlyPercentageRate.toFixed(0)}%`, col2X, col2Y);
    col2Y += 4;
    pdf.text("7. Total Cost of Credit:", col2X, col2Y);
    col2Y += 3;
    pdf.text(
      `${contractData.currency} ${formatCurrency(contractData.totalCostOfCredit)}`,
      col2X,
      col2Y,
    );
    col2Y += 4;

    // Column 3: REPAYMENT SCHEDULE
    let col3Y = startY;
    const col3X = margin + (colWidth + 4) * 2;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("REPAYMENT SCHEDULE", col3X, col3Y);
    col3Y += 4;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("7. Date First Payment Due:", col3X, col3Y);
    col3Y += 3;
    pdf.text(contractData.firstPaymentDate, col3X, col3Y);
    col3Y += 4;
    pdf.text("8. Number of Payments:", col3X, col3Y);
    col3Y += 3;
    pdf.text(String(contractData.numberOfPayments), col3X, col3Y);
    col3Y += 4;
    pdf.text("9. Payment Frequency:", col3X, col3Y);
    col3Y += 3;
    pdf.text(contractData.paymentFrequency, col3X, col3Y);
    col3Y += 4;
    pdf.text("10. Amount Per Payment:", col3X, col3Y);
    col3Y += 3;
    pdf.text(
      `${contractData.currency} ${formatCurrency(contractData.paymentPerPeriod)}`,
      col3X,
      col3Y,
    );
    col3Y += 4;

    yPosition = Math.max(col1Y, col2Y, col3Y) + 5;

    // Summary Box
    pdf.setDrawColor(51, 51, 51);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, yPosition, pageWidth, 15);

    const boxY = yPosition + 3;
    const boxColWidth = pageWidth / 5;

    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text("Amount of Loan", margin + 5, boxY);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `${contractData.currency} ${formatCurrency(contractData.loanAmount)}`,
      margin + 5,
      boxY + 5,
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("+", margin + boxColWidth + 5, boxY + 4);

    pdf.setFontSize(7);
    pdf.text("Total Cost of Credit", margin + boxColWidth + 15, boxY);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `${contractData.currency} ${formatCurrency(contractData.totalCostOfCredit)}`,
      margin + boxColWidth + 15,
      boxY + 5,
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("=", margin + boxColWidth * 2 + 20, boxY + 4);

    pdf.setFontSize(7);
    pdf.text("TOTAL AMOUNT YOU PAY", margin + boxColWidth * 2 + 30, boxY);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(
      `${contractData.currency} ${formatCurrency(contractData.totalRepayment)}`,
      margin + boxColWidth * 2 + 30,
      boxY + 6,
    );

    yPosition += 20;

    // ========== SECTION II: RISKS ==========
    addSection("SECTION II: RISKS TO YOU");
    addText(
      "* Late or missing payments may be reported to a credit reference bureau and may severely affect your financial situation, collateral, and ability to reborrow.",
    );
    addText(
      "* Your interest rate will change based on changes in the Bank of Zambia's Policy Rate. This change will affect the duration of your loan and your repayment amount.",
    );

    // ========== SECTION III: RIGHTS ==========
    addSection("SECTION III: YOUR RIGHTS AND OBLIGATIONS");
    addText(
      "Any questions or complaints? Call +260 211 238719, email info@goodfellow.co.zm or write to P.O. Box 50644 Lusaka.",
    );
    addText(
      "Unsatisfied with our response? Contact the Bank of Zambia at +260 211 399300 or info@boz.zm. Visit www.boz.zm.",
    );
    addText(
      "Want to pay off your loan early? You can do so without any penalties or fees.",
    );

    // ========== SECTION IV: FEES ==========
    addSection("SECTION IV: UPFRONT AND RECURRING FEES");

    const feeWidths = [pageWidth / 2, pageWidth / 4, pageWidth / 4];
    addTableRow(["Fee Description", "Amount", "Type"], feeWidths, true);

    contractData.charges.forEach((charge) => {
      const isRecurring =
        charge.name.toLowerCase().includes("monthly") ||
        charge.name.toLowerCase().includes("recurring");
      addTableRow(
        [
          charge.name,
          `${contractData.currency} ${formatCurrency(charge.amount)}`,
          isRecurring ? "Recurring" : "Upfront",
        ],
        feeWidths,
      );
    });

    addTableRow(
      [
        "TOTAL FEES (excluding interest)",
        `${contractData.currency} ${formatCurrency(contractData.fees)}`,
        "",
      ],
      feeWidths,
    );

    // ========== SECTION V: TERMS ==========
    addSection("SECTION V: IMPORTANT TERMS AND CONDITIONS");
    addText("Late fees: Applicable if payment is more than 30 days late");
    addText(
      "Default interest: 25% per month if payment is more than 10 days late",
    );

    // ========== SECTION VI: REPAYMENT SCHEDULE ==========
    // Check if we need a new page for the schedule
    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      yPosition = 15;
    }

    addSection("SECTION VI: REPAYMENT SCHEDULE");

    const scheduleWidths = [15, 25, 25, 25, 30, 30];
    addTableRow(
      ["#", "Due Date", "Payment", "Principal", "Interest/Fees", "Balance"],
      scheduleWidths,
      true,
    );

    // Show first 12 payments and summary if more
    const maxPayments = Math.min(contractData.repaymentSchedule.length, 12);
    for (let i = 0; i < maxPayments; i++) {
      const period = contractData.repaymentSchedule[i];
      addTableRow(
        [
          String(period.paymentNumber),
          period.dueDate,
          formatCurrency(period.paymentAmount),
          formatCurrency(period.principal),
          formatCurrency(period.interestAndFees),
          `${contractData.currency} ${formatCurrency(period.remainingBalance)}`,
        ],
        scheduleWidths,
      );
    }

    if (contractData.repaymentSchedule.length > 12) {
      addTableRow(["...", "...", "...", "...", "...", "..."], scheduleWidths);
    }

    // Totals row
    pdf.setFont("helvetica", "bold");
    addTableRow(
      [
        "TOTAL",
        "",
        formatCurrency(contractData.totalRepayment),
        formatCurrency(contractData.loanAmount),
        formatCurrency(contractData.totalCostOfCredit),
        "",
      ],
      scheduleWidths,
    );

    // ========== SIGNATURES ==========
    yPosition += 8;
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = 15;
    }

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.text(
      "* This information is not final until signed by all parties and does not replace the loan agreement. *",
      pageWidth / 2 + margin,
      yPosition,
      { align: "center" },
    );
    yPosition += 8;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("CERTIFIED CORRECT:", margin, yPosition);
    yPosition += 10;
    pdf.setDrawColor(0, 0, 0);
    pdf.line(margin, yPosition, margin + 60, yPosition);
    yPosition += 3;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("Credit provider representative", margin, yPosition);

    yPosition += 8;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(
      "I ACKNOWLEDGE RECEIPT OF THIS STATEMENT PRIOR TO SIGNING THE LOAN AGREEMENT:",
      margin,
      yPosition,
    );
    yPosition += 10;
    pdf.line(margin, yPosition, margin + 60, yPosition);
    pdf.line(margin + 90, yPosition, margin + 150, yPosition);
    yPosition += 3;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("Borrower", margin, yPosition);
    pdf.text("Guarantor (if applicable)", margin + 90, yPosition);

    yPosition += 8;
    pdf.setFontSize(7);
    pdf.text(
      `Name of Borrower: ${contractData.clientName}    NRC: ${contractData.nrc}    Date prepared: ${format(new Date(), "dd/MM/yyyy")}`,
      margin,
      yPosition,
    );

    return pdf.output("blob");
  };

  // Generate Salary Advance Contract PDF
  const generateSalaryAdvanceContractPDF = async (): Promise<Blob> => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const margin = 15;
    let yPosition = 20;
    const lineHeight = 5;
    const pageHeight = 280;

    const addText = (
      text: string,
      fontSize: number = 10,
      bold: boolean = false,
    ) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.setFontSize(fontSize);
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      const splitLines = pdf.splitTextToSize(text, 180);
      splitLines.forEach((line: string) => {
        pdf.text(line, margin, yPosition);
        yPosition += lineHeight;
      });
    };

    const addSection = (title: string) => {
      yPosition += 3;
      addText(title, 11, true);
      yPosition += 2;
    };

    // ========== SALARY ADVANCE CONTRACT ==========
    addText("GOODFELLOW FINANCE LIMITED (GFL)", 14, true);
    addText("SALARY ADVANCE CONTRACT", 12, true);
    addText(
      `GFL/LC/${format(new Date(), "yyyy")}/${contractData.gflNo || "N/A"}`,
      9,
    );
    yPosition += 3;

    addSection("LOAN DETAILS");
    addText(`GFL No.: ${contractData.gflNo || "N/A"}`);
    addText(`NRC: ${contractData.nrc}`);
    addText(`Loan ID: ${contractData.loanId || "N/A"}`);
    addText(
      `Loan Amount: ${contractData.currency} ${formatCurrency(
        contractData.loanAmount,
      )}`,
    );
    addText(`Tenure: ${contractData.tenure}`);
    addText(`First Payment Due: ${contractData.firstPaymentDate}`);
    addText(
      `Interest: ${contractData.currency} ${formatCurrency(
        contractData.interest,
      )}`,
    );
    addText(
      `Service Fee: ${contractData.currency} ${formatCurrency(
        contractData.fees,
      )}`,
    );
    addText(
      `Total Cost of Borrowing: ${contractData.currency} ${formatCurrency(
        contractData.totalCostOfCredit,
      )}`,
    );

    addSection("PARTIES");
    addText('Lender: Goodfellow Finance Limited ("Lender")');
    addText(`Borrower: ${contractData.clientName}`);
    addText(`NRC: ${contractData.nrc}`);
    addText(`Date of Birth: ${contractData.dateOfBirth}`);
    addText(`Employee No.: ${contractData.employeeNo || "N/A"}`);
    addText(`Employer: ${contractData.employer || "N/A"}`);

    addSection("OBLIGATIONS AND PERMISSIONS");
    addText(
      "1. Notify Lender immediately of changes to address, contact, bank details",
    );
    addText(
      "2. Borrower permits Lender to draw against any registered bank account",
    );
    addText(
      "3. Lender may obtain credit information from Credit Reference Bureaux",
    );
    addText(
      "4. Payroll deduction may be used if Direct Debit collection fails",
    );
    addText("5. Outstanding balance may be rescheduled with applicable fees");
    addText(
      "6. Lender may take legal action; borrower agrees to repay legal costs",
    );

    addSection("DECLARATION");
    addText(
      `I, ${contractData.clientName}, confirm that I have read and understood the terms of this contract.`,
    );
    yPosition += 3;
    addText(`Signed at: ${contractData.branch}`);
    addText(`Date: ${format(new Date(), "dd/MM/yyyy")}`);
    addText(`Loan Purpose: ${contractData.loanPurpose || "N/A"}`);
    yPosition += 5;
    addText(`Borrower Name: ${contractData.clientName}`);
    addText("Borrower Signature: [Signed electronically]");

    return pdf.output("blob");
  };

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
          "Please upload the loan officer's signature before completing",
        variant: "destructive",
      });
      return;
    }

    if (!clientId || !contractData || !loanDetails || !loanTerms) {
      toast({
        title: "Missing data",
        description:
          "Required loan data is missing. Please complete all previous steps.",
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

      // Step 2: Generate PDFs from contract data
      toast({
        title: "Generating contracts...",
        description: "Creating PDF documents",
      });

      const keyFactsPDF = tenantContractHtml ? null : await generateKeyFactsPDF();
      const salaryAdvancePDF = await generateSalaryAdvanceContractPDF();

      // Step 3: Create loan in Fineract
      toast({
        title: "Creating loan...",
        description: "Submitting loan application to Fineract",
      });

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
        charges: (loanTerms.charges || []).map((charge: any) => {
          const chargeData: any = {
            chargeId: charge.chargeId,
            amount: charge.amount,
          };
          // Include dueDate if present (required for "Specified Due Date" charges)
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
        allowPartialPeriodInterestCalcualtion: false,
      };

      console.log("Creating loan with payload:", loanPayload);
      console.log("Loan charges being sent:", loanPayload.charges);
      console.log("Raw loanTerms.charges:", loanTerms.charges);

      const loanResponse = await fineractFetch("/api/fineract/loans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loanPayload),
      });

      const loanResult = await loanResponse.json();
      const createdLoanId =
        loanResult.data.loanId || loanResult.data.resourceId;

      console.log("Loan created successfully:", createdLoanId);

      // Save the Fineract loan ID and submission status to the lead
      if (leadId && createdLoanId) {
        try {
          await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fineractLoanId: createdLoanId,
              loanSubmittedToFineract: true,
              loanSubmissionDate: new Date().toISOString(),
            }),
          });
          console.log("Loan ID and submission status saved to lead");
        } catch (err) {
          console.error("Error saving loan ID to lead:", err);
          // Don't block the flow
        }
      }

      // Step 4: Upload PDF contracts to the loan
      toast({
        title: "Uploading contracts...",
        description: "Attaching contract documents to loan",
      });

      const uploadDocument = async (pdf: Blob, documentName: string) => {
        const formData = new FormData();
        formData.append("file", pdf, `${documentName}.pdf`);
        formData.append("name", documentName);
        formData.append("description", `Loan contract: ${documentName}`);

        const uploadResponse = await fineractFetch(
          `/api/fineract/loans/${createdLoanId}/documents`,
          {
            method: "POST",
            body: formData,
          },
        );

        return uploadResponse.json();
      };

      // Upload both contract PDFs
      if (keyFactsPDF) {
        await uploadDocument(keyFactsPDF, "Key_Facts_Statement");
      }
      if (salaryAdvancePDF) {
        await uploadDocument(salaryAdvancePDF, "Salary_Advance_Contract");
      }

      // Call CDE to evaluate the loan application
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
          <CardTitle>Upload Signatures</CardTitle>
          <CardDescription>
            Upload signature images for the borrower, guarantor (if applicable),
            and loan officer
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
                <Label htmlFor="officer-signature">
                  Loan Officer Signature{!signaturesOptional ? " *" : ""}
                </Label>
              {availableSignatures.length > 0 && !loanOfficerSignature && (
                <Select
                  onValueChange={(value) => {
                    const selected = availableSignatures.find(
                      (sig) => sig.id.toString() === value,
                    );
                    if (selected) {
                      setLoanOfficerSignature(selected.url);
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
                {loanOfficerSignature ? (
                  <div className="space-y-2">
                    <img
                      src={loanOfficerSignature}
                      alt="Loan officer signature"
                      className="max-h-24 mx-auto"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLoanOfficerSignature(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <Label
                      htmlFor="officer-signature"
                      className="cursor-pointer text-sm text-blue-600 hover:underline"
                    >
                      {uploadingOfficer ? "Uploading..." : "Upload signature"}
                    </Label>
                    <Input
                      id="officer-signature"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingOfficer}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSignatureUpload(file, "officer");
                      }}
                    />
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
              {!tenantContractHtml && (
                <div className="flex gap-2">
                  <Button
                    variant={showKeyFacts ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowKeyFacts(true)}
                  >
                    Key Facts Statement
                  </Button>
                  <Button
                    variant={!showKeyFacts ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowKeyFacts(false)}
                  >
                    Loan Contract
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {showKeyFacts ? (
              <iframe
                srcDoc={
                  getKeyFactsData()
                    ? generateKeyFactsStatementHTML(getKeyFactsData()!, {
                        borrower: borrowerSignature,
                        guarantor: guarantorSignature,
                        creditProvider: loanOfficerSignature,
                      })
                    : "<p>Loading...</p>"
                }
                className="w-full border rounded bg-white"
                style={{ height: "700px", minHeight: "500px" }}
                title="Key Facts Statement Preview"
              />
            ) : (
              <iframe
                srcDoc={
                  filledTenantContractHtml ??
                  generateContractHTML(contractData, {
                    borrower: borrowerSignature,
                    guarantor: guarantorSignature,
                    loanOfficer: loanOfficerSignature,
                  })
                }
                className="w-full border rounded bg-white"
                style={{ height: "700px", minHeight: "500px" }}
                title="Loan Contract Preview"
              />
            )}
          </CardContent>
        </Card>

        {/* Hidden: Key Facts Statement (for PDF generation) */}
        <div className="hidden">
          <Card
            className="mb-6 break-after-page bg-white text-black border-gray-200 [&_*]:text-inherit"
            ref={keyFactsRef}
          >
            <CardContent className="p-8 bg-white text-black">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4 pb-4 border-b">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#004f73] to-[#00a5c4] flex items-center justify-center text-white font-bold text-xl">
                    GFL
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-[#004f73]">
                      GOODFELLOW FINANCE LIMITED (GFL)
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Key Facts Statement & Loan Contract
                    </p>
                  </div>
                </div>

                {/* ANNEX 1 - KEY FACTS STATEMENT */}
                <div>
                  <h2 className="text-lg font-bold text-[#004f73] mb-2">
                    ANNEX 1 — KEY FACTS STATEMENT FOR CONSUMER CREDIT
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Review carefully before agreeing to a loan. You have the
                    right to get a copy of the full loan agreement.
                  </p>

                  {/* Section I: Key Terms */}
                  <h3 className="text-sm font-semibold text-[#00a5c4] mb-3">
                    SECTION I: KEY TERMS
                  </h3>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label className="text-xs font-semibold">
                        1. Amount of Loan
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.currency}{" "}
                        {formatCurrency(contractData.loanAmount)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        2. Duration of Loan Agreement
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.tenure}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        3. Amount Received
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.currency}{" "}
                        {formatCurrency(contractData.disbursedAmount)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label className="text-xs font-semibold">
                        4. Interest
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.currency}{" "}
                        {formatCurrency(contractData.interest)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        5. Other Fees and Charges
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.currency}{" "}
                        {formatCurrency(contractData.fees)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        6. Monthly Percentage Rate
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.monthlyPercentageRate.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label className="text-xs font-semibold">
                        7. Date First Payment Due
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.firstPaymentDate}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        8. Number of Payments
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.numberOfPayments}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        9. Payment Frequency
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.paymentFrequency}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <Label className="text-xs font-semibold">
                      10. Amount Per Payment (Includes capital, interest,
                      recurring fees)
                    </Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.currency}{" "}
                      {formatCurrency(contractData.paymentPerPeriod)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-xs font-semibold">
                        11. Total Cost of Credit (interest + fees)
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                        {contractData.currency}{" "}
                        {formatCurrency(contractData.totalCostOfCredit)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">
                        12. TOTAL AMOUNT YOU PAY
                      </Label>
                      <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1 font-bold">
                        {contractData.currency}{" "}
                        {formatCurrency(contractData.totalRepayment)}
                      </div>
                    </div>
                  </div>

                  {/* Section II: Risks */}
                  <h3 className="text-sm font-semibold text-[#00a5c4] mb-2 mt-6">
                    SECTION II: RISKS TO YOU
                  </h3>
                  <ul className="list-disc list-inside text-sm space-y-1 text-gray-700 dark:text-gray-700 mb-4">
                    <li>
                      Late or missing payments may be reported to a credit
                      reference bureau and may severely affect your financial
                      situation, collateral, and ability to reborrow.
                    </li>
                    <li>
                      Your interest rate will change based on changes in the
                      Bank of Zambia's Policy Rate. This change will affect the
                      duration of your loan and your repayment amount.
                    </li>
                  </ul>

                  {/* Section III: Rights and Obligations */}
                  <h3 className="text-sm font-semibold text-[#00a5c4] mb-2">
                    SECTION III: YOUR RIGHTS AND OBLIGATIONS
                  </h3>
                  <div className="text-sm space-y-2 text-gray-700 dark:text-gray-700 mb-4">
                    <p>
                      Any questions or complaints? Call{" "}
                      <strong>+260 211 238719</strong>, email{" "}
                      <a
                        href="mailto:info@goodfellow.co.zm"
                        className="text-blue-600"
                      >
                        info@goodfellow.co.zm
                      </a>{" "}
                      or write to P.O. Box 50644 Lusaka.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Unsatisfied with our response? Contact the Bank of Zambia
                      at <strong>+260 211 399300</strong> or{" "}
                      <a href="mailto:info@boz.zm" className="text-blue-600">
                        info@boz.zm
                      </a>
                      . Visit{" "}
                      <a href="https://www.boz.zm" className="text-blue-600">
                        www.boz.zm
                      </a>
                      .
                    </p>
                    <p>
                      You may pay off your loan early without penalties. You are
                      required to make payments according to your loan agreement
                      and to notify us of important changes in your situation.
                    </p>
                  </div>

                  {/* Section IV: Fees */}
                  <h3 className="text-sm font-semibold text-[#00a5c4] mb-2">
                    SECTION IV: UPFRONT AND RECURRING FEES
                  </h3>
                  <div className="border rounded-lg overflow-hidden mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-[#004f73] to-[#00a5c4] text-white">
                        <tr>
                          <th className="p-2 text-left">Fee</th>
                          <th className="p-2 text-right">
                            Amount ({contractData.currency})
                          </th>
                          <th className="p-2 text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractData.charges.map((charge, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">{charge.name}</td>
                            <td className="p-2 text-right">
                              {formatCurrency(charge.amount)}
                            </td>
                            <td className="p-2">-</td>
                          </tr>
                        ))}
                        <tr className="border-t font-bold bg-gray-50 dark:bg-gray-50 dark:text-black">
                          <td className="p-2">Total (excluding interest)</td>
                          <td className="p-2 text-right">
                            {formatCurrency(
                              contractData.charges.reduce(
                                (sum, c) => sum + c.amount,
                                0,
                              ),
                            )}
                          </td>
                          <td className="p-2">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section VI: Repayment Schedule */}
                  <h3 className="text-sm font-semibold text-[#00a5c4] mb-2">
                    SECTION V: REPAYMENT SCHEDULE
                  </h3>
                  <div className="border rounded-lg overflow-hidden mb-4">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gradient-to-r from-[#004f73] to-[#00a5c4] text-white sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Payment #</th>
                            <th className="p-2 text-left">Due Date</th>
                            <th className="p-2 text-right">Payment Amount</th>
                            <th className="p-2 text-right">Principal</th>
                            <th className="p-2 text-right">Interest & Fees</th>
                            <th className="p-2 text-right">
                              Remaining Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {contractData.repaymentSchedule.map(
                            (period, index) => (
                              <tr key={index} className="border-t">
                                <td className="p-2">{period.paymentNumber}</td>
                                <td className="p-2">{period.dueDate}</td>
                                <td className="p-2 text-right">
                                  {formatCurrency(period.paymentAmount)}
                                </td>
                                <td className="p-2 text-right">
                                  {formatCurrency(period.principal)}
                                </td>
                                <td className="p-2 text-right">
                                  {formatCurrency(period.interestAndFees)}
                                </td>
                                <td className="p-2 text-right">
                                  {formatCurrency(period.remainingBalance)}
                                </td>
                              </tr>
                            ),
                          )}
                          <tr className="border-t font-bold bg-gray-50 dark:bg-gray-50 dark:text-black">
                            <td className="p-2" colSpan={2}>
                              TOTAL
                            </td>
                            <td className="p-2 text-right">
                              {formatCurrency(contractData.totalRepayment)}
                            </td>
                            <td className="p-2 text-right">
                              {formatCurrency(contractData.loanAmount)}
                            </td>
                            <td className="p-2 text-right">
                              {formatCurrency(contractData.totalCostOfCredit)}
                            </td>
                            <td className="p-2 text-right">-</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-4">
                    This information is not final until signed by all parties
                    and does not replace the loan agreement.
                  </p>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-6 mt-6">
                    <div>
                      <p className="text-sm mb-2">Certified correct:</p>
                      {loanOfficerSignature && (
                        <img
                          src={loanOfficerSignature}
                          alt="Officer signature"
                          className="max-h-16 mb-2"
                        />
                      )}
                      <div className="border-b-2 border-gray-300 mb-1"></div>
                      <p className="text-xs text-muted-foreground">
                        Credit provider representative
                      </p>
                      <p className="text-xs mt-2">
                        {contractData.loanOfficer || "___________"}
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        {borrowerSignature && (
                          <img
                            src={borrowerSignature}
                            alt="Borrower signature"
                            className="max-h-16 mb-2"
                          />
                        )}
                        <div className="border-b-2 border-gray-300 mb-1"></div>
                        <p className="text-xs text-muted-foreground">
                          Borrower (I acknowledge receipt prior to signing)
                        </p>
                        <p className="text-xs mt-1">
                          {contractData.clientName}
                        </p>
                      </div>
                      {guarantorSignature && (
                        <div>
                          <img
                            src={guarantorSignature}
                            alt="Guarantor signature"
                            className="max-h-16 mb-2"
                          />
                          <div className="border-b-2 border-gray-300 mb-1"></div>
                          <p className="text-xs text-muted-foreground">
                            Guarantor
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-4">
                    Name of Borrower: {contractData.clientName} &nbsp; NRC:{" "}
                    {contractData.nrc} &nbsp; Date prepared:{" "}
                    {format(new Date(), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Salary Advance Contract */}
          <Card
            className="bg-white text-black border-gray-200 [&_*]:text-inherit"
            ref={salaryAdvanceRef}
          >
            <CardContent className="p-8 bg-white text-black">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4 pb-4 border-b">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#004f73] to-[#00a5c4] flex items-center justify-center text-white font-bold text-xl">
                    GFL
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-[#004f73]">
                      SALARY ADVANCE CONTRACT
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      GFL/LC/2025/02
                    </p>
                  </div>
                </div>

                {/* Contract Details */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">GFL NO.</Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.gflNo || "N/A"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">NRC</Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.nrc}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">LOAN ID</Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.loanId || leadId || "N/A"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Loan Amount</Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.currency}{" "}
                      {formatCurrency(contractData.loanAmount)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Tenure</Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.tenure}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Payment Due</Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.firstPaymentDate}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Interest</Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.currency}{" "}
                      {formatCurrency(contractData.interest)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Service Fee</Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.currency}{" "}
                      {formatCurrency(contractData.fees)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">
                      Total Cost of Borrowing
                    </Label>
                    <div className="bg-[#f1fcff] border border-dashed rounded p-2 mt-1">
                      {contractData.currency}{" "}
                      {formatCurrency(contractData.totalRepayment)}
                    </div>
                  </div>
                </div>

                {/* Parties */}
                <div>
                  <h3 className="text-sm font-semibold text-[#00a5c4] mb-2">
                    Parties
                  </h3>
                  <p className="text-sm">
                    <strong>Lender:</strong> Goodfellow Finance Limited
                    ("Lender")
                  </p>
                  <p className="text-sm mt-2">
                    <strong>Borrower:</strong> {contractData.clientName} | NRC:{" "}
                    {contractData.nrc} | DOB: {contractData.dateOfBirth} |
                    Gender: {contractData.gender}
                  </p>
                  {contractData.employeeNo && contractData.employer && (
                    <p className="text-sm mt-1">
                      Employee No.: {contractData.employeeNo} | Employer:{" "}
                      {contractData.employer}
                    </p>
                  )}
                </div>

                {/* Obligations */}
                <div>
                  <h3 className="text-sm font-semibold text-[#00a5c4] mb-2">
                    Obligations & Permissions
                  </h3>
                  <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700 dark:text-gray-700">
                    <li>
                      Notify the Lender immediately of changes to address,
                      contact, bank details, employment or financial condition.
                    </li>
                    <li>
                      The Borrower permits the Lender to draw against any bank
                      account registered to the borrower (costs for bounced
                      direct debit apply).
                    </li>
                    <li>
                      The Lender may obtain and verify credit information from
                      licensed Credit Reference Bureaux.
                    </li>
                    <li>
                      In case of collection failure through Direct Debit,
                      payroll deduction may be used to recover the amount owed.
                    </li>
                    <li>
                      Reschedule outstanding balance if repayment is not
                      completed within the scheduled month; full monthly
                      interest and administrative fees may apply.
                    </li>
                    <li>
                      The Lender may take legal action in Zambia; borrower
                      agrees to repay expenses and legal costs incurred in
                      recovery.
                    </li>
                  </ol>
                </div>

                {/* Declaration */}
                <div>
                  <h3 className="text-sm font-semibold text-[#00a5c4] mb-2">
                    Declaration & Signatures
                  </h3>
                  <p className="text-sm mb-4">
                    I <strong>{contractData.clientName}</strong> confirm that I
                    have read and understood the terms of this salary advance
                    contract.
                  </p>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm">
                        Signed at:{" "}
                        <span className="bg-[#f1fcff] px-2">
                          {contractData.branch}
                        </span>
                      </p>
                      <p className="text-sm mt-2">
                        Date:{" "}
                        <span className="bg-[#f1fcff] px-2">
                          {format(new Date(), "dd/MM/yyyy")}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm">
                        Borrower's Name: {contractData.clientName}
                      </p>
                      <div className="mt-2">
                        {borrowerSignature && (
                          <img
                            src={borrowerSignature}
                            alt="Borrower signature"
                            className="max-h-16 mb-2"
                          />
                        )}
                        <div className="border-b-2 border-gray-300"></div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Borrower's Signature
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mt-6">
                    <div>
                      <p className="text-sm">
                        Loan Officer's Name:{" "}
                        {contractData.loanOfficer || "___________"}
                      </p>
                      <div className="mt-2">
                        {loanOfficerSignature && (
                          <img
                            src={loanOfficerSignature}
                            alt="Officer signature"
                            className="max-h-16 mb-2"
                          />
                        )}
                        <div className="border-b-2 border-gray-300"></div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Loan Officer's Signature
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm">
                        Loan Purpose:{" "}
                        {contractData.loanPurpose || "___________"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* End hidden section */}

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
              {!printPermissions.canPrintContracts && (
                <div className="max-w-xs self-center text-right text-xs text-amber-600 dark:text-amber-400">
                  {printPermissions.printBlockReason}
                  {printPermissions.approvalStatus
                    ? ` Current status: ${printPermissions.approvalStatus}.`
                    : ""}
                </div>
              )}
              {!tenantContractHtml && (
                <Button
                  onClick={handlePrintKeyFacts}
                  variant="outline"
                  size="sm"
                  disabled={!printPermissions.canPrintContracts}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Print Key Facts
                </Button>
              )}
              <Button
                onClick={handlePrintContract}
                variant="outline"
                size="sm"
                disabled={!printPermissions.canPrintContracts}
              >
                <FileText className="mr-2 h-4 w-4" />
                Print Contract
              </Button>
              {!tenantContractHtml && (
                <Button
                  onClick={handlePrintBoth}
                  variant="outline"
                  size="sm"
                  disabled={!printPermissions.canPrintContracts}
                >
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
