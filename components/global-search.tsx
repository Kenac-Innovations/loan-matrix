"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  PiggyBank,
  Search,
  User,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  type SearchResult,
  type SearchResultType,
  type SearchResponse,
  type SearchTypeFilter,
} from "@/lib/global-search";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const DIALOG_GROUP_LIMIT = 6;

export const SEARCH_TYPE_OPTIONS: { value: SearchTypeFilter; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: "clients", label: "Clients" },
    { value: "loans", label: "Loans" },
    { value: "savings", label: "Savings" },
  ];

export const SEARCH_RESULT_META: Record<
  SearchResultType,
  { heading: string; icon: LucideIcon }
> = {
  client: { heading: "Clients", icon: User },
  loan: { heading: "Loans", icon: FileText },
  savings: { heading: "Savings", icon: PiggyBank },
};

const RESULT_TYPE_ORDER: SearchResultType[] = ["client", "loan", "savings"];

export function getSearchResultSecondaryText(result: SearchResult): string | null {
  const parts =
    result.type === "client"
      ? [result.status]
      : [result.clientName, result.status];
  const text = parts.filter(Boolean).join(" · ");
  return text || null;
}

export function SearchResultIcon({ type }: { type: SearchResultType }) {
  const Icon = SEARCH_RESULT_META[type].icon;
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
      <Icon className="size-3.5 text-muted-foreground" />
    </span>
  );
}

export function SearchTypePills({
  value,
  onChange,
}: {
  value: SearchTypeFilter;
  onChange: (value: SearchTypeFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SEARCH_TYPE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              active
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export type SearchFetchStatus = "idle" | "loading" | "success" | "error";

interface FetchedSearch {
  key: string;
  status: "success" | "error";
  results: SearchResult[];
  truncated: boolean;
}

/**
 * Debounced, abortable fetch against /api/search. Only runs once the query has
 * at least MIN_QUERY_LENGTH characters and `enabled` is true.
 */
export function useSearchResults(
  query: string,
  type: SearchTypeFilter,
  enabled = true
): {
  status: SearchFetchStatus;
  results: SearchResult[];
  truncated: boolean;
  trimmed: string;
  retry: () => void;
} {
  const trimmed = query.trim();
  const active = enabled && trimmed.length >= MIN_QUERY_LENGTH;
  const [attempt, setAttempt] = React.useState(0);
  const key = `${type}|${trimmed}|${attempt}`;
  const [fetched, setFetched] = React.useState<FetchedSearch | null>(null);
  const retry = React.useCallback(() => setAttempt((value) => value + 1), []);

  React.useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, type });
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search failed: ${response.status}`);
        const data = (await response.json()) as SearchResponse;
        if (controller.signal.aborted) return;
        setFetched({
          key,
          status: "success",
          results: data.results ?? [],
          truncated: data.truncated === true,
        });
      } catch {
        if (controller.signal.aborted) return;
        setFetched({ key, status: "error", results: [], truncated: false });
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, key, trimmed, type]);

  if (!active) {
    return { status: "idle", results: [], truncated: false, trimmed, retry };
  }
  if (!fetched || fetched.key !== key) {
    return { status: "loading", results: [], truncated: false, trimmed, retry };
  }
  return {
    status: fetched.status,
    results: fetched.results,
    truncated: fetched.truncated,
    trimmed,
    retry,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<SearchTypeFilter>("all");

  const { status, results, trimmed, retry } = useSearchResults(query, type, open);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigate = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const seeAllResults = () => {
    setOpen(false);
    router.push(
      `/search?q=${encodeURIComponent(trimmed)}&type=${encodeURIComponent(type)}`
    );
  };

  const grouped = RESULT_TYPE_ORDER.map((resultType) => ({
    type: resultType,
    items: results
      .filter((result) => result.type === resultType)
      .slice(0, DIALOG_GROUP_LIMIT),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground shadow-xs transition-[color,box-shadow] hover:bg-muted/50 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className
        )}
      >
        <Search className="size-4 shrink-0 opacity-60" />
        <span className="flex-1 truncate text-left">
          Search clients, loans, accounts
        </span>
        <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Global search</DialogTitle>
            <DialogDescription>
              Search clients, loans and savings accounts.
            </DialogDescription>
          </DialogHeader>

          <Command
            shouldFilter={false}
            className="bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-item]]:py-2 **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-input]]:h-12"
          >
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search by name, account number or ID"
            />

            <div className="border-b border-border px-3 py-2">
              <SearchTypePills value={type} onChange={setType} />
            </div>

            <CommandList>
              {status === "idle" && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Type at least {MIN_QUERY_LENGTH} characters to search.
                </p>
              )}

              {status === "loading" && (
                <div className="flex items-center gap-2 px-3 py-8 justify-center text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching
                </div>
              )}

              {status === "error" && (
                <div className="flex flex-col items-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                  <p>Search isn&apos;t available right now.</p>
                  <Button variant="outline" size="sm" onClick={retry}>
                    Try again
                  </Button>
                </div>
              )}

              {status === "success" && grouped.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No matches for &quot;{trimmed}&quot;.
                </p>
              )}

              {status === "success" &&
                grouped.map((group) => (
                  <CommandGroup
                    key={group.type}
                    heading={SEARCH_RESULT_META[group.type].heading}
                  >
                    {group.items.map((result) => {
                      const secondary = getSearchResultSecondaryText(result);
                      return (
                        <CommandItem
                          key={`${result.type}-${result.id}`}
                          value={`${result.type}-${result.id}`}
                          onSelect={() => navigate(result.href)}
                          className="gap-3"
                        >
                          <SearchResultIcon type={result.type} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{result.name}</div>
                            {secondary && (
                              <div className="truncate text-xs text-muted-foreground">
                                {secondary}
                              </div>
                            )}
                          </div>
                          {result.accountNo && (
                            <span className="shrink-0 font-mono text-xs text-muted-foreground">
                              {result.accountNo}
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
            </CommandList>

            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>↑↓ to move · ↵ to open</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                disabled={trimmed.length < MIN_QUERY_LENGTH}
                onClick={seeAllResults}
              >
                See all results
              </Button>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GlobalSearch;
