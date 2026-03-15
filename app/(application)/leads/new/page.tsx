import type { Metadata } from "next";
import { NewLeadForm } from "./components/new-lead-form";

export const metadata: Metadata = {
  title: "New Lead | KENAC Loan Matrix",
  description: "Create a new lead",
};

export default function NewLeadPage() {
  return <NewLeadForm />;
}
