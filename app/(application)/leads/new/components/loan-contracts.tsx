"use client";

import { useState, useEffect, useRef } from "react";
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
import { Upload, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { generateContractHTML } from "./contract-template";

interface ContractData {
  // Client Information
  clientName: string;
  nrc: string;
  dateOfBirth: string;
  gender: string;
  employeeNo?: string;
  employer?: string;
  gflNo?: string;
  loanId?: string;

  // Loan Information
  loanAmount: number;
  disbursedAmount: number;
  tenure: string;
  numberOfPayments: number;
  paymentFrequency: string;
  firstPaymentDate: string;

  // Financial Information
  interest: number;
  fees: number;
  totalCostOfCredit: number;
  totalRepayment: number;
  paymentPerPeriod: number;
  monthlyPercentageRate: number;

  // Schedule
  repaymentSchedule: Array<{
    paymentNumber: number;
    dueDate: string;
    paymentAmount: number;
    principal: number;
    interestAndFees: number;
    remainingBalance: number;
  }>;

  // Charges breakdown
  charges: Array<{
    name: string;
    amount: number;
  }>;

  // Other
  currency: string;
  branch: string;
  loanOfficer?: string;
  loanPurpose?: string;
}

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
  const [contractData, setContractData] = useState<ContractData | null>(
    initialContractData || null
  );
  const [isLoading, setIsLoading] = useState(!initialContractData);
  const [error, setError] = useState<string | null>(null);
  const [borrowerSignature, setBorrowerSignature] = useState<string | null>(
    null
  );
  const [guarantorSignature, setGuarantorSignature] = useState<string | null>(
    null
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
  const { toast } = useToast();
  const router = useRouter();

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
          `/api/fineract/clients/${clientId}/documents`
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
              doc.name.toLowerCase().includes("sig"))
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
          (doc: any) => doc.name === "borrowerSignature"
        );
        const guarantorSig = documents.find(
          (doc: any) => doc.name === "guarantorSignature"
        );
        const officerSig = documents.find(
          (doc: any) => doc.name === "loanOfficerSignature"
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

      console.log(
        "Building contract from schedule - fetching base client data"
      );

      // Fetch base contract data (has all client info)
      const response = await fetch(`/api/leads/${leadId}/contract-data`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch base contract data:", errorText);
        throw new Error("Failed to fetch client data");
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error("No client data available");
      }

      // Start with the base contract data from API (has all client info)
      const baseContractData = result.data;
      console.log(
        "Base contract data loaded, now overriding with provided schedule"
      );

      // Override the schedule-dependent fields with our already-calculated schedule

      const currency = repaymentSchedule.currency?.code || "ZMW";
      const principal = loanTerms?.principal || 0;
      const interest = repaymentSchedule?.totalInterestCharged || 0;
      const fees = repaymentSchedule?.totalFeeChargesCharged || 0;
      const totalRepayment =
        repaymentSchedule?.totalRepaymentExpected ||
        principal + interest + fees;

      // Get interest rate from loan product template (not calculated)
      const numberOfPayments = loanTerms?.numberOfRepayments || 1;
      const monthlyPercentageRate = loanTerms?.nominalInterestRate || 0;

      // Format repayment schedule
      const formattedSchedule =
        repaymentSchedule?.periods
          ?.filter(
            (period: any) =>
              period.period !== undefined && !period.downPaymentPeriod
          )
          .map((period: any) => ({
            paymentNumber: period.period,
            dueDate: Array.isArray(period.dueDate)
              ? format(
                  new Date(
                    period.dueDate[0],
                    period.dueDate[1] - 1,
                    period.dueDate[2]
                  ),
                  "dd/MM/yyyy"
                )
              : format(new Date(period.dueDate), "dd/MM/yyyy"),
            paymentAmount:
              period.totalDueForPeriod || period.totalOriginalDueForPeriod || 0,
            principal: period.principalDue || period.principalDisbursed || 0,
            interestAndFees:
              (period.interestDue || 0) + (period.feeChargesDue || 0),
            remainingBalance: period.principalLoanBalanceOutstanding || 0,
          })) || [];

      // Get first payment date
      const firstPaymentDate =
        formattedSchedule.length > 0
          ? formattedSchedule[0].dueDate
          : format(new Date(), "dd/MM/yyyy");

      // Format charges from loan terms
      const formattedCharges = (loanTerms.charges || []).map((charge: any) => ({
        name: charge.name,
        amount: charge.amount,
      }));

      // Net disbursed amount (principal - upfront fees)
      const upfrontFees = formattedCharges
        .filter(
          (c: any) =>
            !c.name.toLowerCase().includes("monthly") &&
            !c.name.toLowerCase().includes("recurring")
        )
        .reduce((sum: number, c: any) => sum + c.amount, 0);
      const disbursedAmount = principal - upfrontFees;

      // Use base contract data and override only schedule-dependent fields
      const contractData: ContractData = {
        ...baseContractData, // Start with all the base client data from API

        // Override with calculated schedule values
        loanAmount: principal,
        disbursedAmount: disbursedAmount,
        numberOfPayments: numberOfPayments,
        firstPaymentDate: firstPaymentDate,
        interest: interest,
        fees: fees,
        totalCostOfCredit: interest + fees,
        totalRepayment: totalRepayment,
        paymentPerPeriod:
          formattedSchedule.length > 0
            ? formattedSchedule.reduce(
                (sum: number, p: any) => sum + p.paymentAmount,
                0
              ) / formattedSchedule.length
            : totalRepayment / numberOfPayments,
        monthlyPercentageRate: monthlyPercentageRate,
        repaymentSchedule: formattedSchedule,
        charges: formattedCharges,
        currency: currency,
      };

      setContractData(contractData);
      console.log("Contract data built from schedule successfully");
    } catch (err) {
      console.error("Error building contract data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to build contract data"
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
          `Failed to load contract data: ${response.status} ${response.statusText}`
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
        err instanceof Error ? err.message : "Failed to load contract data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignatureUpload = async (
    file: File,
    signatureType: "borrower" | "guarantor" | "officer"
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
        }
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

  const handlePrint = () => {
    // Open a new window with the contract HTML template for printing
    const contractHTML = generateContractHTML(contractData, {
      borrower: borrowerSignature,
      guarantor: guarantorSignature,
      loanOfficer: loanOfficerSignature,
    });
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(contractHTML);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  // Generate Key Facts Statement PDF
  const generateKeyFactsPDF = async (): Promise<Blob> => {
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
      bold: boolean = false
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

    // ========== KEY FACTS STATEMENT ==========
    addText("GOODFELLOW FINANCE LIMITED (GFL)", 14, true);
    addText("KEY FACTS STATEMENT FOR CONSUMER CREDIT", 12, true);
    yPosition += 3;

    addSection("SECTION I: KEY TERMS");
    addText(
      `1. Amount of Loan: ${contractData.currency} ${formatCurrency(
        contractData.loanAmount
      )}`
    );
    addText(`2. Duration of Loan Agreement: ${contractData.tenure}`);
    addText(
      `3. Amount Received: ${contractData.currency} ${formatCurrency(
        contractData.disbursedAmount
      )}`
    );
    addText(
      `4. Interest: ${contractData.currency} ${formatCurrency(
        contractData.interest
      )}`
    );
    addText(
      `5. Other Fees and Charges: ${contractData.currency} ${formatCurrency(
        contractData.fees
      )}`
    );
    addText(`6. Percentage Rate: ${contractData.monthlyPercentageRate}%`);
    addText(`7. Date First Payment Due: ${contractData.firstPaymentDate}`);
    addText(`8. Number of Payments: ${contractData.numberOfPayments}`);
    addText(`9. Payment Frequency: ${contractData.paymentFrequency}`);
    addText(
      `10. Amount Per Payment: ${contractData.currency} ${formatCurrency(
        contractData.paymentPerPeriod
      )}`
    );
    addText(
      `11. Total Cost of Credit: ${contractData.currency} ${formatCurrency(
        contractData.totalCostOfCredit
      )}`
    );
    addText(
      `12. TOTAL AMOUNT YOU PAY: ${contractData.currency} ${formatCurrency(
        contractData.totalRepayment
      )}`
    );

    addSection("SECTION II: RISKS TO YOU");
    addText(
      "- Late or missing payments may be reported to a credit reference bureau"
    );
    addText("- Interest rates may change based on Bank of Zambia Policy Rate");

    addSection("SECTION III: YOUR RIGHTS AND OBLIGATIONS");
    addText("Contact: +260 211 238719 | info@goodfellow.co.zm");
    addText("You may pay off your loan early without penalties");

    addSection("SECTION IV: FEES AND CHARGES");
    contractData.charges.forEach((charge) => {
      addText(`${charge.name}: ${formatCurrency(charge.amount)}`);
    });
    addText(
      `Total Fees: ${contractData.currency} ${formatCurrency(
        contractData.fees
      )}`
    );

    addSection("SECTION VI: REPAYMENT SCHEDULE");
    contractData.repaymentSchedule.forEach((period) => {
      addText(
        `#${period.paymentNumber} | ${period.dueDate} | ${formatCurrency(
          period.paymentAmount
        )} | Principal: ${formatCurrency(
          period.principal
        )} | Int/Fees: ${formatCurrency(
          period.interestAndFees
        )} | Bal: ${formatCurrency(period.remainingBalance)}`
      );
    });

    addSection("BORROWER ACKNOWLEDGMENT");
    addText(`Name: ${contractData.clientName}`);
    addText(`NRC: ${contractData.nrc}`);
    addText(`Date: ${format(new Date(), "dd/MM/yyyy")}`);
    addText("Signature: [Signed electronically]");

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
      bold: boolean = false
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
      9
    );
    yPosition += 3;

    addSection("LOAN DETAILS");
    addText(`GFL No.: ${contractData.gflNo || "N/A"}`);
    addText(`NRC: ${contractData.nrc}`);
    addText(`Loan ID: ${contractData.loanId || "N/A"}`);
    addText(
      `Loan Amount: ${contractData.currency} ${formatCurrency(
        contractData.loanAmount
      )}`
    );
    addText(`Tenure: ${contractData.tenure}`);
    addText(`First Payment Due: ${contractData.firstPaymentDate}`);
    addText(
      `Interest: ${contractData.currency} ${formatCurrency(
        contractData.interest
      )}`
    );
    addText(
      `Service Fee: ${contractData.currency} ${formatCurrency(
        contractData.fees
      )}`
    );
    addText(
      `Total Cost of Borrowing: ${contractData.currency} ${formatCurrency(
        contractData.totalCostOfCredit
      )}`
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
      "1. Notify Lender immediately of changes to address, contact, bank details"
    );
    addText(
      "2. Borrower permits Lender to draw against any registered bank account"
    );
    addText(
      "3. Lender may obtain credit information from Credit Reference Bureaux"
    );
    addText(
      "4. Payroll deduction may be used if Direct Debit collection fails"
    );
    addText("5. Outstanding balance may be rescheduled with applicable fees");
    addText(
      "6. Lender may take legal action; borrower agrees to repay legal costs"
    );

    addSection("DECLARATION");
    addText(
      `I, ${contractData.clientName}, confirm that I have read and understood the terms of this contract.`
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
    if (!borrowerSignature) {
      toast({
        title: "Signature required",
        description: "Please upload the borrower's signature before completing",
        variant: "destructive",
      });
      return;
    }

    if (!loanOfficerSignature) {
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

      const keyFactsPDF = await generateKeyFactsPDF();
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
        loanIdToClose: "",
        isTopup: "",
        transactionProcessingStrategyCode:
          loanTerms.repaymentStrategy || "creocore-strategy",
        interestRateFrequencyType: loanTerms.interestRateFrequency
          ? parseInt(loanTerms.interestRateFrequency)
          : 2,
        interestRatePerPeriod: loanTerms.nominalInterestRate || 0,
        charges: (loanTerms.charges || []).map((charge: any) => ({
          chargeId: charge.chargeId,
          amount: charge.amount,
          dueDate: charge.dueDate,
        })),
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

      const loanResponse = await fetch("/api/fineract/loans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loanPayload),
      });

      if (!loanResponse.ok) {
        const errorData = await loanResponse.json();
        throw new Error(errorData.error || "Failed to create loan");
      }

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

        const uploadResponse = await fetch(
          `/api/fineract/loans/${createdLoanId}/documents`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${documentName}`);
        }

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

      // Clear local storage for this lead
      if (leadId) {
        localStorage.removeItem(`lead_${leadId}`);
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
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button
              onClick={() =>
                repaymentSchedule && loanDetails && loanTerms
                  ? buildContractDataFromSchedule()
                  : loadContractData()
              }
            >
              Retry
            </Button>
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
              <Label htmlFor="borrower-signature">Borrower Signature *</Label>
              {availableSignatures.length > 0 && !borrowerSignature && (
                <Select
                  onValueChange={(value) => {
                    const selected = availableSignatures.find(
                      (sig) => sig.id.toString() === value
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
                      (sig) => sig.id.toString() === value
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
                Loan Officer Signature *
              </Label>
              {availableSignatures.length > 0 && !loanOfficerSignature && (
                <Select
                  onValueChange={(value) => {
                    const selected = availableSignatures.find(
                      (sig) => sig.id.toString() === value
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
        <Card className="mb-6 bg-white text-black border-gray-200">
          <CardHeader>
            <CardTitle>Contract Preview</CardTitle>
            <CardDescription>
              Review the contract before printing or completing
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <iframe
              srcDoc={generateContractHTML(contractData, {
                borrower: borrowerSignature,
                guarantor: guarantorSignature,
                loanOfficer: loanOfficerSignature,
              })}
              className="w-full border rounded bg-white"
              style={{ height: "700px", minHeight: "500px" }}
              title="Loan Contract Preview"
            />
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
                              0
                            )
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
                            )
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
              <Button onClick={handlePrint} variant="outline" className="px-6">
                <FileText className="mr-2 h-4 w-4" />
                Print Contracts
              </Button>
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
