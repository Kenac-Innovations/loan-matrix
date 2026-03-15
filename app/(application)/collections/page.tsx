import type { Metadata } from "next";
import { CollectionsTabs } from "./components/collections-tabs";

export const metadata: Metadata = {
  title: "Collections | KENAC Loan Matrix",
  description: "Manage loan repayment collections and bulk receipting",
};

export default async function CollectionsPage() {
  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Collections</h2>
          <p className="text-muted-foreground">
            Track expected payments and process bulk repayments
          </p>
        </div>
      </div>

      <div className="mt-6">
        <CollectionsTabs />
      </div>
    </>
  );
}
