"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SearchResultIcon,
  SearchTypePills,
  useSearchResults,
} from "@/components/global-search";
import {
  SEARCH_TYPE_FILTERS,
  type SearchResultType,
  type SearchTypeFilter,
} from "@/lib/global-search";

const PAGE_SIZE = 25;
const URL_SYNC_DELAY_MS = 300;
const MIN_QUERY_LENGTH = 2;

const TYPE_LABELS: Record<SearchResultType, string> = {
  client: "Client",
  loan: "Loan",
  savings: "Savings",
};

function parseSearchType(raw: string | null): SearchTypeFilter {
  return (SEARCH_TYPE_FILTERS as readonly string[]).includes(raw ?? "")
    ? (raw as SearchTypeFilter)
    : "all";
}

export function SearchResultsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const urlType = parseSearchType(searchParams.get("type"));

  const [query, setQuery] = React.useState(urlQuery);
  const [type, setType] = React.useState<SearchTypeFilter>(urlType);
  const [page, setPage] = React.useState(1);

  // Last query/type pair known to match the URL. Used to avoid writing the URL
  // back on mount and to only adopt URL changes made from outside this page
  // (e.g. the global search "See all results" link).
  const syncedRef = React.useRef(`${urlQuery.trim()}|${urlType}`);

  React.useEffect(() => {
    const key = `${urlQuery.trim()}|${urlType}`;
    if (key === syncedRef.current) return;
    syncedRef.current = key;
    setQuery(urlQuery);
    setType(urlType);
    setPage(1);
  }, [urlQuery, urlType]);

  React.useEffect(() => {
    const trimmed = query.trim();
    const key = `${trimmed}|${type}`;
    if (key === syncedRef.current) return;

    const timer = window.setTimeout(() => {
      syncedRef.current = key;
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      if (type !== "all") params.set("type", type);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, URL_SYNC_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [query, type, pathname, router]);

  const { status, results, truncated, trimmed, retry } = useSearchResults(query, type);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = results.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const handleTypeChange = (value: SearchTypeFilter) => {
    setType(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground opacity-60" />
          <Input
            type="search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Search by name, account number or ID"
            className="pl-9"
            autoFocus
          />
        </div>
        <SearchTypePills value={type} onChange={handleTypeChange} />
      </div>

      {status === "idle" && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Type at least {MIN_QUERY_LENGTH} characters to search.
        </p>
      )}

      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Searching
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
          <p>Search isn&apos;t available right now.</p>
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {status === "success" && results.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No matches for &quot;{trimmed}&quot;.
        </p>
      )}

      {status === "success" && results.length > 0 && (
        <>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Account no</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((result) => (
                  <TableRow
                    key={`${result.type}-${result.id}`}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(result.href)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") router.push(result.href);
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <SearchResultIcon type={result.type} />
                        <span className="text-sm">
                          {TYPE_LABELS[result.type]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{result.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {result.accountNo ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {result.externalId ?? "—"}
                    </TableCell>
                    <TableCell>{result.clientName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {result.status ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {truncated && (
            <p className="text-xs text-muted-foreground">
              Showing first 200 results. Refine your search to see more.
            </p>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
