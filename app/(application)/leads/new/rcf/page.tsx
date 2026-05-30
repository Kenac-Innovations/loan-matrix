import type { Metadata } from "next";
import { Suspense } from "react";
import { RcfLeadForm } from "./components/rcf-lead-form";

export const metadata: Metadata = {
  title: "New RCF | KENAC Loan Matrix",
  description: "Create a new revolving credit facility",
};

export default function NewRcfLeadPage() {
  return (
    <Suspense>
      <RcfLeadForm />
    </Suspense>
  );
}
