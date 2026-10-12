import type { Metadata } from "next";
import { Phone } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canAccessUssdDetailsServer } from "@/lib/ussd-client-details-access";
import { UssdDetailsClient } from "./components/ussd-details-client";

export const metadata: Metadata = {
  title: "USSD Details | KENAC Loan Matrix",
  description: "Review and update USSD client information",
};

export default async function UssdDetailsPage() {
  const hasAccess = await canAccessUssdDetailsServer();

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            You do not have permission to update USSD client details.
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
            <Phone className="h-6 w-6 text-blue-500" />
            USSD Details
          </h2>
          <p className="text-muted-foreground">
            Review USSD information updates and keep client phone numbers in sync.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <UssdDetailsClient />
        </CardContent>
      </Card>
    </div>
  );
}
