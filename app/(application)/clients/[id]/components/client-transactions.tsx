"use client";

import useSWR from 'swr';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  DollarSign,
  Download,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RepaymentSchedulePeriod {
  period: number;
  fromDate: string | number[];
  dueDate: string | number[];
  obligationsMetOnDate?: string | number[];
  completed: boolean;
  daysInPeriod: number;
  principal?: number;
  principalLoanBalanceOutstanding?: number;
  interest?: number;
  feeCharges?: number;
  penaltyCharges?: number;
  totalDueForPeriod?: number;
  totalPaidForPeriod?: number;
  totalInAdvanceForPeriod?: number;
  totalOverdue?: number;
  outstanding?: number;
  totalWaivedForPeriod?: number;
  totalOutstandingForPeriod?: number;
  // Additional fields that might be present
  principalDue?: number;
  interestOriginalDue?: number;
  feeChargesDue?: number;
  penaltyChargesDue?: number;
  totalPaidLateForPeriod?: number;
}

interface RepaymentSchedule {
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    inMultiplesOf: number;
    displaySymbol: string;
    nameCode: string;
    displayLabel: string;
  };
  totalPrincipalDisbursed?: number;
  totalPrincipalExpected?: number;
  totalPrincipalPaid?: number;
  totalInterestCharged?: number;
  totalInterestPaid?: number;
  totalFeeChargesCharged?: number;
  totalPenaltyChargesCharged?: number;
  totalWaived?: number;
  totalWrittenOff?: number;
  totalRepaymentExpected?: number;
  totalRepayment?: number;
  totalOutstanding?: number;
  totalPaidInAdvance?: number;
  totalPaidLate?: number;
  period?: number;
  loanTermInDays?: number;
  totalFeeChargesAtDisbursement?: number;
  fixedEmiAmount?: number;
  maxOutstandingLoanBalance?: number;
  disbursedAmount?: number;
  disbursedAmountPercentage?: number;
  feeChargesAtDisbursementCharged?: number;
  scheduleRegenerated?: boolean;
  futureSchedule?: any[];
  periods: RepaymentSchedulePeriod[];
}

interface ClientTransactionsProps {
  clientId: number;
  loanId?: number;
}

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ClientTransactions({ clientId, loanId }: ClientTransactionsProps) {
  // If loanId is provided, fetch repayment schedule, otherwise fetch transactions
  const endpoint = loanId
    ? `/api/fineract/loans/${loanId}?associations=all&exclude=guarantors,futureSchedule`
    : `/api/fineract/clients/${clientId}/transactions`;

  const { data, error, isLoading } = useSWR(endpoint, fetcher);

  const formatCurrency = (amount: number | undefined | null, currencyCode: string = "USD") => {
    // Return blank if amount is undefined, null, NaN, or 0
    if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
      return "";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string | number[] | undefined): string => {
    if (!date) return "";
    if (typeof date === "string") {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    if (Array.isArray(date) && date.length === 3) {
      const [year, month, day] = date;
      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return "";
  };

  const getInstallmentStyle = (period: RepaymentSchedulePeriod): string => {
    if (period.completed) {
      return "bg-green-50 dark:bg-green-950/20";
    }

    const dueDate = period.dueDate;
    if (!dueDate) return "";

    const dueDateObj = typeof dueDate === "string"
      ? new Date(dueDate)
      : new Date(dueDate[0], dueDate[1] - 1, dueDate[2]);

    const today = new Date();

    if (dueDateObj < today) {
      return "bg-red-50 dark:bg-red-950/20";
    }

    // Check if this is the current period
    const fromDateObj = typeof period.fromDate === "string"
      ? new Date(period.fromDate)
      : new Date(period.fromDate[0], period.fromDate[1] - 1, period.fromDate[2]);

    if (fromDateObj <= today && today < dueDateObj) {
      return "bg-blue-50 dark:bg-blue-950/20";
    }

    return "";
  };

  const exportToPDF = () => {
    // Get the repayment schedule from the current data
    if (!data || !loanId) {
      console.warn('No data or loanId available for PDF export');
      return;
    }

    const loan = data;
    const repaymentSchedule: RepaymentSchedule | undefined = loan.repaymentSchedule || loan.schedule;

    if (!repaymentSchedule || !repaymentSchedule.periods || repaymentSchedule.periods.length === 0) {
      console.warn('No repayment schedule data available for PDF export');
      return;
    }

    // Import jsPDF dynamically to avoid SSR issues
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then((autoTable) => {
        const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape orientation

        // Set modern fonts and colors
        pdf.setFont('helvetica');

        // Add modern header
        pdf.setFillColor(30, 64, 175); // Even darker blue background
        pdf.rect(0, 0, 297, 30, 'F');

        // Add title
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Loan Repayment Schedule', 148, 12, { align: 'center' });

        // Add client and loan information
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const clientName = loan.clientName || `Client #${clientId}`;
        const loanName = loan.accountNo || `Loan #${loanId}`;
        pdf.text(`Client: ${clientName} | Loan: ${loanName}`, 148, 20, { align: 'center' });

        // Add generation date
        pdf.text(`Generated on: ${new Date().toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric"
        })}`, 148, 26, { align: 'center' });

        // Reset text color for content
        pdf.setTextColor(0, 0, 0);

        // Simplified summary table
        const currencyCode = repaymentSchedule.currency?.code || 'USD';
        const summaryData = [
          ['Principal Amount', formatCurrency(repaymentSchedule.totalPrincipalExpected, currencyCode)],
          ['Total Interest', formatCurrency(repaymentSchedule.totalInterestCharged, currencyCode)],
          ['Total Fees & Penalties', formatCurrency((repaymentSchedule.totalFeeChargesCharged || 0) + (repaymentSchedule.totalPenaltyChargesCharged || 0), currencyCode)],
          ['Total Repayment', formatCurrency(repaymentSchedule.totalRepaymentExpected, currencyCode)],
          ['Currency', currencyCode]
        ];

        autoTable.default(pdf, {
          startY: 35,
          head: [['Category', 'Amount']],
          body: summaryData,
          theme: 'grid',
          headStyles: {
            fillColor: [30, 64, 175],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 9,
            cellPadding: 2
          },
          columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' }
          },
          margin: { left: 15, right: 15 }
        });

        // Prepare data for the main table
        const tableData = repaymentSchedule.periods.map((period) => {
          const row = [
            (period.period || '').toString(),
            (period.daysInPeriod || '').toString(),
            formatDate(period.dueDate),
            period.obligationsMetOnDate ? formatDate(period.obligationsMetOnDate) : '',
            formatCurrency(period.principalLoanBalanceOutstanding, currencyCode),
            formatCurrency(period.principalDue || period.principal, currencyCode),
            formatCurrency(period.interestOriginalDue || period.interest, currencyCode),
            formatCurrency(period.feeChargesDue || period.feeCharges, currencyCode),
            formatCurrency(period.penaltyChargesDue || period.penaltyCharges, currencyCode),
            formatCurrency(period.totalDueForPeriod, currencyCode),
            formatCurrency(period.totalPaidForPeriod, currencyCode),
            formatCurrency(period.totalInAdvanceForPeriod, currencyCode),
            formatCurrency(period.totalPaidLateForPeriod || period.totalOverdue, currencyCode)
          ];

          // Add waived column if there are waived amounts
          if ((repaymentSchedule.totalWaived || 0) > 0) {
            row.push(formatCurrency(period.totalWaivedForPeriod || 0, currencyCode));
          }

          row.push(formatCurrency(period.totalOutstandingForPeriod || period.outstanding, currencyCode));
          return row;
        });

        // Add totals row
        const totalsRow = [
          'Total',
          '',
          '',
          '',
          formatCurrency(repaymentSchedule.totalPrincipalExpected, currencyCode),
          formatCurrency(repaymentSchedule.totalPrincipalExpected, currencyCode),
          formatCurrency(repaymentSchedule.totalInterestCharged, currencyCode),
          formatCurrency(repaymentSchedule.totalFeeChargesCharged, currencyCode),
          formatCurrency(repaymentSchedule.totalPenaltyChargesCharged, currencyCode),
          formatCurrency(repaymentSchedule.totalRepaymentExpected, currencyCode),
          formatCurrency(repaymentSchedule.totalRepayment, currencyCode),
          formatCurrency(repaymentSchedule.totalPaidInAdvance, currencyCode),
          formatCurrency(repaymentSchedule.totalPaidLate, currencyCode)
        ];

        // Add waived total if there are waived amounts
        if ((repaymentSchedule.totalWaived || 0) > 0) {
          totalsRow.push(formatCurrency(repaymentSchedule.totalWaived, currencyCode));
        }

        totalsRow.push(formatCurrency(repaymentSchedule.totalOutstanding, currencyCode));

        tableData.push(totalsRow);

        // Prepare dynamic header
        const baseHeaders = [
          '#', 'Days', 'Date', 'Paid Date', 'Balance Of Loan',
          'Principal Due', 'Interest', 'Fees', 'Penalties', 'Due',
          'Paid', 'In advance', 'Late'
        ];

        if ((repaymentSchedule.totalWaived || 0) > 0) {
          baseHeaders.push('Waived');
        }

        baseHeaders.push('Outstanding');

        // Calculate column spans for header groups
        const hasWaived = (repaymentSchedule.totalWaived || 0) > 0;
        const loanBalanceCols = 2; // #, Days
        const totalCostCols = 3; // Date, Paid Date, Balance Of Loan
        const installmentCols = hasWaived ? 9 : 8; // Principal Due through Outstanding

        // Fix header alignment - based on the actual column structure
        let headerGroups = [
          { content: '', colSpan: 4 }, // #, Days, Date, Paid Date (no header)
          { content: 'Loan Amount and Balance', colSpan: 2 }, // Balance Of Loan, Principal Due
          { content: 'Total Cost of Loan', colSpan: 3 }, // Interest, Fees, Penalties
          { content: '', colSpan: 1 }, // Due (no header)
          { content: 'Installment Totals', colSpan: 3 } // Paid, In advance, Late
        ];

        // Add waived column if present
        if ((repaymentSchedule.totalWaived || 0) > 0) {
          headerGroups.push({ content: '', colSpan: 1 }); // Waived (no header)
        }

        // Add Outstanding column
        headerGroups.push({ content: '', colSpan: 1 }); // Outstanding (no header)

        // Main repayment schedule table
        autoTable.default(pdf, {
          startY: 80,
          head: [
            headerGroups,
            baseHeaders
          ],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [30, 64, 175],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 8
          },
          styles: {
            fontSize: 7,
            cellPadding: 2,
            overflow: 'linebreak'
          },
          columnStyles: {
            0: { halign: 'center', fontStyle: 'bold' }, // #
            1: { halign: 'center' }, // Days
            2: { halign: 'center' }, // Date
            3: { halign: 'center' }, // Paid Date
            4: { halign: 'right' }, // Balance
            5: { halign: 'right' }, // Principal
            6: { halign: 'right' }, // Interest
            7: { halign: 'right' }, // Fees
            8: { halign: 'right' }, // Penalties
            9: { halign: 'right' }, // Due
            10: { halign: 'right' }, // Paid
            11: { halign: 'right' }, // In advance
            12: { halign: 'right' }, // Late
            13: { halign: 'right' } // Outstanding
          },
          margin: { left: 15, right: 15 },
          didParseCell: function (data: any) {
            // Style the totals row
            if (data.row.index === tableData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [243, 244, 246]; // Light gray background
            }
          },
          didDrawPage: function (data: any) {
            // Add page number
            const pageCount = (pdf as any).getNumberOfPages();
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Page ${data.pageNumber} of ${pageCount}`, 148, 205, { align: 'center' });
          }
        });

        // Save the PDF
        const fileName = `repayment-schedule-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);
      });
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load data from Fineract</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If we have a loanId, show repayment schedule
  if (loanId && data) {
    const loan = data;
    const repaymentSchedule: RepaymentSchedule | undefined = loan.repaymentSchedule || loan.schedule;

    if (!repaymentSchedule || !repaymentSchedule.periods) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Repayment Schedule</CardTitle>
            <CardDescription>
              No repayment schedule available for this loan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Repayment schedule data is not available
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Repayment Schedule</CardTitle>
            <CardDescription>
              Detailed loan repayment schedule with payment tracking
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export to PDF
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Summary Section */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm text-muted-foreground">Loan Amount and Balance</h4>
                <p className="text-lg font-bold">
                  {formatCurrency(repaymentSchedule.totalPrincipalExpected, repaymentSchedule.currency.code)}
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm text-muted-foreground">Total Cost of Loan</h4>
                <p className="text-lg font-bold">
                  {formatCurrency(repaymentSchedule.totalRepaymentExpected, repaymentSchedule.currency.code)}
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm text-muted-foreground">Installment Totals</h4>
                <p className="text-lg font-bold">{repaymentSchedule.periods.length} installments</p>
              </div>
            </div>

            {/* Repayment Schedule Table */}
            <div className="rounded-lg border bg-muted/30 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b bg-muted/50">
                      <TableHead className="font-semibold text-center">#</TableHead>
                      <TableHead className="font-semibold text-center">Days</TableHead>
                      <TableHead className="font-semibold text-center">Date</TableHead>
                      <TableHead className="font-semibold text-center">Paid Date</TableHead>
                      <TableHead className="font-semibold text-center">✓</TableHead>
                      <TableHead className="font-semibold text-right">Balance Of Loan</TableHead>
                      <TableHead className="font-semibold text-right">Principal Due</TableHead>
                      <TableHead className="font-semibold text-right">Interest</TableHead>
                      <TableHead className="font-semibold text-right">Fees</TableHead>
                      <TableHead className="font-semibold text-right">Penalties</TableHead>
                      <TableHead className="font-semibold text-right">Due</TableHead>
                      <TableHead className="font-semibold text-right">Paid</TableHead>
                      <TableHead className="font-semibold text-right">In advance</TableHead>
                      <TableHead className="font-semibold text-right">Late</TableHead>
                      {(repaymentSchedule.totalWaived || 0) > 0 && (
                        <TableHead className="font-semibold text-right">Waived</TableHead>
                      )}
                      <TableHead className="font-semibold text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Installment rows */}
                    {repaymentSchedule.periods.map((period: RepaymentSchedulePeriod, index: number) => {
                      const style = getInstallmentStyle(period);
                      const isPaid = period.obligationsMetOnDate;

                      return (
                        <TableRow key={`period-${period.period}-${index}`} className={style}>
                          <TableCell className="font-medium text-center">{period.period}</TableCell>
                          <TableCell className="text-center">{period.daysInPeriod || 30}</TableCell>
                          <TableCell className="text-center">
                            {formatDate(period.dueDate)}
                          </TableCell>
                          <TableCell className="text-center">
                            {period.obligationsMetOnDate ? formatDate(period.obligationsMetOnDate) : ""}
                          </TableCell>
                          <TableCell className="text-center">
                            {isPaid && <Check className="h-4 w-4 text-green-600 mx-auto" />}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(period.principalLoanBalanceOutstanding, repaymentSchedule.currency.code)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(period.principalDue || period.principal, repaymentSchedule.currency.code)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(period.interestOriginalDue || period.interest, repaymentSchedule.currency.code)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(period.feeChargesDue || period.feeCharges, repaymentSchedule.currency.code)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(period.penaltyChargesDue || period.penaltyCharges, repaymentSchedule.currency.code)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(period.totalDueForPeriod, repaymentSchedule.currency.code)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(period.totalPaidForPeriod, repaymentSchedule.currency.code)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(period.totalInAdvanceForPeriod, repaymentSchedule.currency.code)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(period.totalPaidLateForPeriod || period.totalOverdue, repaymentSchedule.currency.code)}
                          </TableCell>
                          {(repaymentSchedule.totalWaived || 0) > 0 && (
                            <TableCell className="text-right">
                              {formatCurrency(period.totalWaivedForPeriod || 0, repaymentSchedule.currency.code)}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            {formatCurrency(period.totalOutstandingForPeriod || period.outstanding, repaymentSchedule.currency.code)}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Total row */}
                    <TableRow className="font-bold bg-muted/50 border-t-2">
                      <TableCell colSpan={5} className="text-center">Total</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalPrincipalExpected, repaymentSchedule.currency.code)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalPrincipalExpected, repaymentSchedule.currency.code)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalInterestCharged, repaymentSchedule.currency.code)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalFeeChargesCharged, repaymentSchedule.currency.code)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalPenaltyChargesCharged, repaymentSchedule.currency.code)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalRepaymentExpected, repaymentSchedule.currency.code)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalRepayment, repaymentSchedule.currency.code)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalPaidInAdvance, repaymentSchedule.currency.code)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalPaidLate, repaymentSchedule.currency.code)}
                      </TableCell>
                      {(repaymentSchedule.totalWaived || 0) > 0 && (
                        <TableCell className="text-right">
                          {formatCurrency(repaymentSchedule.totalWaived, repaymentSchedule.currency.code)}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        {formatCurrency(repaymentSchedule.totalOutstanding, repaymentSchedule.currency.code)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Original transaction history code for when no loanId is provided
  const transactions = (() => {
    if (!data) return [];

    if (Array.isArray(data)) {
      return data;
    }

    if (data.pageItems && Array.isArray(data.pageItems)) {
      return data.pageItems;
    }

    if (data.content && Array.isArray(data.content)) {
      return data.content;
    }

    if (data.transactions && Array.isArray(data.transactions)) {
      return data.transactions;
    }

    return [];
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>
          Complete transaction history for this client
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No transactions found for this client
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction: any, index: number) => (
                  <TableRow key={transaction.id || `transaction-${index}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {formatDate(transaction.date)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {transaction.type?.disbursement ? (
                          <ArrowDownLeft className="h-4 w-4 text-green-500" />
                        ) : transaction.type?.repayment ? (
                          <ArrowUpRight className="h-4 w-4 text-blue-500" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-gray-500" />
                        )}
                        <Badge variant="outline" className="text-sm">
                          {transaction.type?.value || "Unknown"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(transaction.amount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(transaction.principalPortion)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(transaction.interestPortion)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(transaction.outstandingLoanBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
