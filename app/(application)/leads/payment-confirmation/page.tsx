import { PaymentConfirmationClient } from "./components/payment-confirmation-client";

export default function PaymentConfirmationPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-normal">Payment Confirmation</h1>
      </div>
      <PaymentConfirmationClient />
    </div>
  );
}
