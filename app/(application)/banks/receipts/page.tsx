"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReceiptRangeConfig } from "@/app/(application)/leads/config/components/receipt-range-config";

export default function ReceiptsPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Receipt Ranges</h1>
        <p className="text-muted-foreground">
          Manage receipt number ranges for cash transactions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipt Number Ranges</CardTitle>
          <CardDescription>
            Define valid receipt number ranges. Cash transactions (repayments and
            disbursements) will require a receipt number within an active range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReceiptRangeConfig />
        </CardContent>
      </Card>
    </div>
  );
}
