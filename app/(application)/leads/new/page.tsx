import type { Metadata } from "next";
import { NewLeadForm } from "./components/new-lead-form";
import { getClientTemplateData } from "@/app/actions/client-actions";

export const metadata: Metadata = {
  title: "New Lead | KENAC Loan Matrix",
  description: "Create a new lead",
};

export default async function NewLeadPage() {
  // Fetch all client template data in a single API call
  const result = await getClientTemplateData();

  // Use the data directly from the result
  const formData = result.data;

  return <NewLeadForm clientFormData={formData} />;
}
