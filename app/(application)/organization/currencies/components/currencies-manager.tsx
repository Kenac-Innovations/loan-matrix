"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogHeading,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { useCurrency } from "@/contexts/currency-context";
import type { Currency } from "@/contexts/currency-context";

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;

interface CurrenciesResponse {
  selectedCurrencyOptions: Currency[];
  currencyOptions: Currency[];
}

type RemovalTarget = {
  currency: Currency;
} | null;

async function fetchCurrencies(): Promise<CurrenciesResponse> {
  const response = await fetch("/api/fineract/currencies", { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "Failed to load currencies");
  return {
    selectedCurrencyOptions: body?.selectedCurrencyOptions || [],
    currencyOptions: body?.currencyOptions || [],
  };
}

// Fineract returns enabled currencies ordered by name, and the app treats the
// first one as the organization's default currency.
function defaultCurrencyOf(currencies: Currency[]): Currency | undefined {
  return [...currencies].sort((a, b) => a.name.localeCompare(b.name))[0];
}

function DefaultCurrencyChangeWarning({
  next,
  acknowledged,
  onAcknowledgedChange,
}: {
  next: Currency;
  acknowledged: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
      <p>
        This will change the organization&apos;s default currency to {next.name} ({next.code}).
        Amounts across the application, including teller, cashier and repayment
        transactions, will use {next.code}.
      </p>
      <div className="flex items-center gap-2">
        <Checkbox
          id="default-currency-change"
          checked={acknowledged}
          onCheckedChange={(checked) => onAcknowledgedChange(checked === true)}
        />
        <Label htmlFor="default-currency-change">
          I understand the default currency will change
        </Label>
      </div>
    </div>
  );
}

export function CurrenciesManager() {
  const [selected, setSelected] = useState<Currency[]>([]);
  const [available, setAvailable] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [removalTarget, setRemovalTarget] = useState<RemovalTarget>(null);
  const [isSubmittingRemove, setIsSubmittingRemove] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [defaultChangeAcknowledged, setDefaultChangeAcknowledged] = useState(false);
  const { refetch } = useCurrency();

  const loadCurrencies = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchCurrencies();
      setSelected(data.selectedCurrencyOptions);
      setAvailable(data.currencyOptions);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load currencies");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCurrencies();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredCurrencies = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return selected;
    return selected.filter(
      (currency) =>
        currency.name.toLowerCase().includes(term) ||
        currency.code.toLowerCase().includes(term)
    );
  }, [selected, search]);

  const pageCount = Math.max(1, Math.ceil(filteredCurrencies.length / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const paginatedCurrencies = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredCurrencies.slice(start, start + pageSize);
  }, [currentPage, filteredCurrencies, pageSize]);

  const getAvailableCurrencies = () => {
    const selectedCodes = new Set(selected.map((c) => c.code));
    return available.filter((c) => !selectedCodes.has(c.code));
  };

  // Fineract replaces the whole enabled list, so apply the change to the latest
  // list rather than the one loaded when the page opened.
  const saveCurrencies = async (
    change: (codes: string[]) => string[],
    fallbackError: string
  ): Promise<{ pendingApproval: boolean }> => {
    const latest = await fetchCurrencies();
    const response = await fetch("/api/fineract/currencies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currencies: change(latest.selectedCurrencyOptions.map((c) => c.code)),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || fallbackError);
    return { pendingApproval: body?.pendingApproval === true };
  };

  const closeAddDialog = () => {
    if (isSubmittingAdd) return;
    setIsAddDialogOpen(false);
    setIsPopoverOpen(false);
    setSelectedCurrencyCode("");
    setAddError(null);
    setDefaultChangeAcknowledged(false);
  };

  const handleAddCurrency = async () => {
    if (!selectedCurrencyCode) {
      setAddError("Currency is required");
      return;
    }

    setIsSubmittingAdd(true);
    setAddError(null);

    try {
      const { pendingApproval } = await saveCurrencies(
        (codes) =>
          codes.includes(selectedCurrencyCode) ? codes : [...codes, selectedCurrencyCode],
        "Failed to add currency"
      );

      toast(
        pendingApproval
          ? {
              title: "Submitted for approval",
              description: `Enabling ${selectedCurrencyCode} is awaiting checker approval.`,
            }
          : {
              title: "Currency added",
              description: `${selectedCurrencyCode} has been enabled.`,
              variant: "success",
            }
      );

      setIsAddDialogOpen(false);
      setSelectedCurrencyCode("");
      setAddError(null);
      setDefaultChangeAcknowledged(false);
      await loadCurrencies();
      await refetch();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to add currency");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const closeRemoveDialog = () => {
    setRemovalTarget(null);
    setDefaultChangeAcknowledged(false);
  };

  const handleRemoveCurrency = async () => {
    if (!removalTarget) return;

    setIsSubmittingRemove(true);

    try {
      const removedCode = removalTarget.currency.code;
      const { pendingApproval } = await saveCurrencies(
        (codes) => codes.filter((code) => code !== removedCode),
        "Failed to remove currency"
      );

      toast(
        pendingApproval
          ? {
              title: "Submitted for approval",
              description: `Removing ${removedCode} is awaiting checker approval.`,
            }
          : {
              title: "Currency removed",
              description: `${removedCode} has been disabled.`,
              variant: "success",
            }
      );

      closeRemoveDialog();
      await loadCurrencies();
      await refetch();
    } catch (error) {
      toast({
        title: "Unable to remove currency",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingRemove(false);
    }
  };

  const firstVisible = filteredCurrencies.length === 0 ? 0 : currentPage * pageSize + 1;
  const lastVisible = Math.min(filteredCurrencies.length, (currentPage + 1) * pageSize);
  const availableCurrencies = getAvailableCurrencies();
  const currentDefault = defaultCurrencyOf(selected);
  const pickedCurrency = availableCurrencies.find((c) => c.code === selectedCurrencyCode);
  const defaultAfterAdd = pickedCurrency
    ? defaultCurrencyOf([...selected, pickedCurrency])
    : currentDefault;
  const defaultAfterRemove = removalTarget
    ? defaultCurrencyOf(selected.filter((c) => c.code !== removalTarget.currency.code))
    : currentDefault;
  const addChangesDefault =
    defaultAfterAdd != null && currentDefault != null && defaultAfterAdd.code !== currentDefault.code;
  const removeChangesDefault =
    defaultAfterRemove != null &&
    currentDefault != null &&
    defaultAfterRemove.code !== currentDefault.code;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Currencies</h1>
          <p className="mt-1 text-muted-foreground">
            Enable or disable currencies for your organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void loadCurrencies()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            disabled={isLoading || availableCurrencies.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Currency
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Enabled Currencies
          </CardTitle>
          <CardDescription>Currencies currently enabled for your organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
              <div className="h-64 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  className="max-w-sm"
                  placeholder="Search currencies..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPageIndex(0);
                  }}
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setPageIndex(0);
                    }}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Currency Name</TableHead>
                      <TableHead>Currency Code</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Decimal Places</TableHead>
                      <TableHead className="w-[190px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCurrencies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          {selected.length === 0
                            ? "No currencies enabled for your organization."
                            : "No currencies match your search."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedCurrencies.map((currency) => (
                        <TableRow key={currency.code}>
                          <TableCell>
                            <p className="font-medium">{currency.name}</p>
                          </TableCell>
                          <TableCell>{currency.code}</TableCell>
                          <TableCell>{currency.displaySymbol || "—"}</TableCell>
                          <TableCell>{currency.decimalPlaces}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemovalTarget({ currency })}
                                disabled={selected.length === 1}
                                title={
                                  selected.length === 1
                                    ? "At least one currency must remain enabled"
                                    : undefined
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {firstVisible} - {lastVisible} of {filteredCurrencies.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageIndex(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span>
                    Page {currentPage + 1} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageIndex(Math.min(pageCount - 1, currentPage + 1))}
                    disabled={currentPage >= pageCount - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => (open ? setIsAddDialogOpen(true) : closeAddDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Currency</DialogTitle>
            <DialogDescription>Select a currency to enable for your organization.</DialogDescription>
          </DialogHeader>
          {addError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {addError}
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency-picker">Currency <span className="text-destructive">*</span></Label>
              <Popover modal open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    id="currency-picker"
                    role="combobox"
                    aria-expanded={isPopoverOpen}
                    className="w-full justify-between"
                  >
                    {pickedCurrency
                      ? `(${pickedCurrency.code}) ${pickedCurrency.name}`
                      : "Select a currency..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search currencies..." />
                    <CommandList>
                      <CommandEmpty>No currencies found.</CommandEmpty>
                      <CommandGroup>
                        {availableCurrencies.map((currency) => (
                          <CommandItem
                            key={currency.code}
                            value={`${currency.code} ${currency.name}`}
                            onSelect={() => {
                              setSelectedCurrencyCode(currency.code);
                              setIsPopoverOpen(false);
                              setAddError(null);
                              setDefaultChangeAcknowledged(false);
                            }}
                          >
                            ({currency.code}) {currency.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {addChangesDefault && defaultAfterAdd && (
              <DefaultCurrencyChangeWarning
                next={defaultAfterAdd}
                acknowledged={defaultChangeAcknowledged}
                onAcknowledgedChange={setDefaultChangeAcknowledged}
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeAddDialog}
              disabled={isSubmittingAdd}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCurrency}
              disabled={isSubmittingAdd || (addChangesDefault && !defaultChangeAcknowledged)}
            >
              {isSubmittingAdd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Currency
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removalTarget != null} onOpenChange={(open) => !open && !isSubmittingRemove && closeRemoveDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogHeading>Remove currency</AlertDialogHeading>
            <AlertDialogBody>
              {removalTarget
                ? `Are you sure you want to remove currency: ${removalTarget.currency.code} (${removalTarget.currency.name})?`
                : "Remove this currency?"}
            </AlertDialogBody>
          </AlertDialogHeader>
          {removeChangesDefault && defaultAfterRemove && (
            <DefaultCurrencyChangeWarning
              next={defaultAfterRemove}
              acknowledged={defaultChangeAcknowledged}
              onAcknowledgedChange={setDefaultChangeAcknowledged}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingRemove}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleRemoveCurrency();
              }}
              disabled={isSubmittingRemove || (removeChangesDefault && !defaultChangeAcknowledged)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmittingRemove && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
