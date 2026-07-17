import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canResetUssdPinServer } from "@/lib/ussd-pin-reset-access";
import { UssdPinResetClient } from "./components/ussd-pin-reset-client";

export const metadata: Metadata = {
  title: "USSD PIN Reset | KENAC Loan Matrix",
  description: "Reset Goodfellow USSD client PINs",
};

export default async function UssdPinResetPage() {
  const hasAccess = await canResetUssdPinServer();

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            You do not have permission to reset USSD PINs.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="h-6 w-6 text-blue-500" />
            USSD PIN Reset
          </h2>
          <p className="text-muted-foreground">
            Search a USSD client and request a staff-initiated PIN reset.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <UssdPinResetClient />
        </CardContent>
      </Card>
    </div>
  );
}
