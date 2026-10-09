import { Suspense } from "react";
import { SearchResultsClient } from "./search-results-client";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Search</h1>
      <Suspense fallback={null}>
        <SearchResultsClient />
      </Suspense>
    </div>
  );
}
