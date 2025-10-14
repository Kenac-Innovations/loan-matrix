import type { Metadata } from "next";
import { ClientRegistrationForm } from "../../leads/new/components/client-registration-form";

export const metadata: Metadata = {
  title: "New Client | KENAC Loan Matrix",
  description: "Create a new client",
};

export default function NewClientPage() {
  return <ClientRegistrationForm />;
}
