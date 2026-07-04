import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requirePaymentConfirmationPageAccess } from "@/lib/payment-confirmation-access";
import { PaymentConfirmationClient } from "./components/payment-confirmation-client";

export default async function PaymentConfirmationPage() {
  const access = await requirePaymentConfirmationPageAccess();

  if (!access.ok) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>{access.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-normal">Payment Confirmation</h1>
      </div>
      <PaymentConfirmationClient />
    </div>
  );
}
