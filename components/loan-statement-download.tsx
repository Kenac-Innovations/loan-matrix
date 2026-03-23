"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Download, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LoanStatementDownloadProps {
  readonly loanId: string | number;
  readonly accountNo?: string;
  readonly variant?: "default" | "outline" | "ghost" | "secondary";
  readonly size?: "default" | "sm" | "lg" | "icon";
  readonly className?: string;
}

export function LoanStatementDownload({
  loanId,
  accountNo,
  variant = "outline",
  size = "default",
  className,
}: LoanStatementDownloadProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownloadPDF = async () => {
    setIsLoading(true);
    try {
      // Fetch HTML statement
      const response = await fetch(
        `/api/fineract/loans/${loanId}/statement?format=html`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch statement");
      }

      const html = await response.text();

      // Open in new window for printing
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        // Wait for content to load then trigger print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      } else {
        toast.error("Please allow pop-ups to download the statement");
      }
    } catch (error) {
      console.error("Error downloading statement:", error);
      toast.error("Failed to download statement");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewStatement = async () => {
    setIsLoading(true);
    try {
      // Open statement page in new tab (has react-to-pdf download button)
      window.open(`/loans/${loanId}/statement`, "_blank");
    } catch (error) {
      console.error("Error viewing statement:", error);
      toast.error("Failed to view statement");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadHTML = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/fineract/loans/${loanId}/statement?format=html`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch statement");
      }

      const html = await response.text();

      // Create download link
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `loan-statement-${accountNo || loanId}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success("Statement downloaded successfully");
    } catch (error) {
      console.error("Error downloading statement:", error);
      toast.error("Failed to download statement");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Statement
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleViewStatement}>
          <FileText className="h-4 w-4 mr-2" />
          View Statement
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadPDF}>
          <Printer className="h-4 w-4 mr-2" />
          Print / Save as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadHTML}>
          <Download className="h-4 w-4 mr-2" />
          Download HTML
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Simple button to view statement (no dropdown)
 */
export function ViewStatementButton({
  loanId,
  variant = "outline",
  size = "sm",
  className,
}: Readonly<Omit<LoanStatementDownloadProps, "accountNo">>) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsLoading(true);
    try {
      window.open(`/loans/${loanId}/statement`, "_blank");
    } catch (error) {
      console.error("Failed to open statement:", error);
      toast.error("Failed to open statement");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      <span className="ml-2">Statement</span>
    </Button>
  );
}
