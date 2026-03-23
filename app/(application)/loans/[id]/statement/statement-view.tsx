"use client";

import { useEffect, useState } from "react";
import { usePDF } from "react-to-pdf";
import { Download, Printer, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface StatementViewProps {
  loanId: string;
}

export function StatementView({ loanId }: StatementViewProps) {
  const [data, setData] = useState<{
    container: string;
    styles: string;
    accountNumber: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { toPDF, targetRef } = usePDF({
    filename: data ? `loan-statement-${data.accountNumber}.pdf` : "loan-statement.pdf",
    options: {
      page: { margin: 10, format: "a4", orientation: "portrait" },
      overrides: {
        canvas: { useCORS: true, scale: 2 },
      },
    },
  });

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        const response = await fetch(
          `/api/fineract/loans/${loanId}/statement?format=html-embed`
        );
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to fetch statement");
        }
        const json = await response.json();
        setData({
          container: json.container,
          styles: json.styles,
          accountNumber: json.accountNumber || loanId,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load statement");
      }
    };
    fetchStatement();
  }, [loanId]);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      await toPDF();
    } finally {
      setIsGenerating(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h1 className="text-xl font-semibold text-destructive">Error Loading Statement</h1>
          <p className="text-muted-foreground">{error}</p>
          <Link
            href={`/loans`}
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Loans
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading statement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar - hidden when printing */}
      <div className="statement-toolbar sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-muted/80 border-b shadow-sm print:hidden">
        <Link
          href="/loans"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border bg-background hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download PDF
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border bg-background hover:bg-muted transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      {/* Statement content */}
      <div className="p-4 md:p-6">
        <style dangerouslySetInnerHTML={{ __html: data.styles }} />
        <div
          ref={targetRef}
          className="statement-page-body"
          dangerouslySetInnerHTML={{ __html: data.container }}
        />
      </div>
    </div>
  );
}
