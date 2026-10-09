"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LockOpen,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  holidayCreateInputSchema,
  holidayUpdateInputSchema,
} from "@/lib/organization-form-schemas";

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;

type FineractDate = string | number[] | null | undefined;

type Office = { id: number; name: string };

type Holiday = {
  id: number;
  name: string;
  description?: string | null;
  fromDate?: FineractDate;
  toDate?: FineractDate;
  repaymentsRescheduledTo?: FineractDate;
  reschedulingType?: number | null;
  status?: { value?: string | null; code?: string | null } | string | null;
};

type ReschedulingType = { id: number; value: string };

type HolidayFormState = {
  name: string;
  description: string;
  fromDate: string;
  toDate: string;
  reschedulingType: string;
  repaymentsRescheduledTo: string;
  officeIds: number[];
};

type FieldErrors = Partial<Record<keyof HolidayFormState, string>>;

const emptyHolidayForm: HolidayFormState = {
  name: "",
  description: "",
  fromDate: "",
  toDate: "",
  reschedulingType: "",
  repaymentsRescheduledTo: "",
  officeIds: [],
};

function getIsoDate(value: FineractDate) {
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  if (typeof value !== "string" || !value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : format(parsed, "yyyy-MM-dd");
}

function displayDate(value: FineractDate) {
  const isoDate = getIsoDate(value);
  if (!isoDate) return "—";
  const parsed = parseISO(isoDate);
  return isValid(parsed) ? format(parsed, "dd MMM yyyy") : "—";
}

function statusLabel(status: Holiday["status"]) {
  if (typeof status === "string") return status;
  return status?.value || status?.code || "Unknown";
}

function isActiveHoliday(holiday: Holiday | null) {
  return statusLabel(holiday?.status).toLowerCase().includes("active");
}

function toHolidayForm(holiday: Holiday | null): HolidayFormState {
  if (!holiday) return emptyHolidayForm;

  return {
    name: holiday.name || "",
    description: holiday.description || "",
    fromDate: getIsoDate(holiday.fromDate),
    toDate: getIsoDate(holiday.toDate),
    reschedulingType: holiday.reschedulingType ? String(holiday.reschedulingType) : "",
    repaymentsRescheduledTo: getIsoDate(holiday.repaymentsRescheduledTo),
    officeIds: [],
  };
}

function getFieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>): FieldErrors {
  return issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && field in emptyHolidayForm && !errors[field as keyof HolidayFormState]) {
      errors[field as keyof HolidayFormState] = issue.message;
    }
    return errors;
  }, {});
}

export function HolidaysManager() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [reschedulingTypes, setReschedulingTypes] = useState<ReschedulingType[]>([]);
  const [isLoadingOffices, setIsLoadingOffices] = useState(true);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [form, setForm] = useState<HolidayFormState>(emptyHolidayForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoadingHoliday, setIsLoadingHoliday] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activationTarget, setActivationTarget] = useState<Holiday | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const holidayRequestId = useRef(0);

  const loadOffices = async () => {
    setIsLoadingOffices(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/fineract/offices?orderBy=name");
      const body = await response.json().catch(() => []);
      if (!response.ok) throw new Error(body?.error || "Failed to load offices");

      const nextOffices = Array.isArray(body) ? body : [];
      setOffices(nextOffices);
      setSelectedOfficeId((current) => current || (nextOffices[0] ? String(nextOffices[0].id) : ""));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load offices");
    } finally {
      setIsLoadingOffices(false);
    }
  };

  const loadReschedulingTypes = async () => {
    try {
      const response = await fetch("/api/fineract/holidays/template");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Failed to load holiday options");

      const values = Array.isArray(body)
        ? body
        : Array.isArray(body?.repaymentSchedulingTypes)
          ? body.repaymentSchedulingTypes
          : [];
      setReschedulingTypes(values);
      return values as ReschedulingType[];
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to load holiday options");
      return [] as ReschedulingType[];
    }
  };

  const loadHolidays = async (officeId: string) => {
    const requestId = ++holidayRequestId.current;
    if (!officeId) {
      setHolidays([]);
      setIsLoadingHolidays(false);
      return;
    }

    setIsLoadingHolidays(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/fineract/holidays?officeId=${encodeURIComponent(officeId)}`);
      const body = await response.json().catch(() => []);
      if (!response.ok) throw new Error(body?.error || "Failed to load holidays");

      if (requestId === holidayRequestId.current) {
        setHolidays(
          (Array.isArray(body) ? body : []).filter(
            (holiday: Holiday) => statusLabel(holiday.status).toLowerCase() !== "deleted",
          ),
        );
      }
    } catch (error) {
      if (requestId === holidayRequestId.current) {
        setLoadError(error instanceof Error ? error.message : "Failed to load holidays");
        setHolidays([]);
      }
    } finally {
      if (requestId === holidayRequestId.current) setIsLoadingHolidays(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadOffices(), loadReschedulingTypes()]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHolidays(selectedOfficeId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedOfficeId]);

  const filteredHolidays = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return holidays;
    return holidays.filter((holiday) =>
      [holiday.name, holiday.description, statusLabel(holiday.status)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [holidays, search]);

  const pageCount = Math.max(1, Math.ceil(filteredHolidays.length / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const paginatedHolidays = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredHolidays.slice(start, start + pageSize);
  }, [currentPage, filteredHolidays, pageSize]);

  const closeForm = () => {
    if (isSubmitting) return;
    setIsFormOpen(false);
    setEditingHoliday(null);
    setFieldErrors({});
    setFormError(null);
  };

  const openCreateModal = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setFormMode("create");
    setEditingHoliday(null);
    setForm({
      ...emptyHolidayForm,
      fromDate: today,
      toDate: today,
      reschedulingType: reschedulingTypes[0] ? String(reschedulingTypes[0].id) : "",
      officeIds: selectedOfficeId ? [Number(selectedOfficeId)] : [],
    });
    setFieldErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = async (holiday: Holiday) => {
    setFormMode("edit");
    setEditingHoliday(holiday);
    setForm(toHolidayForm(holiday));
    setFieldErrors({});
    setFormError(null);
    setIsFormOpen(true);
    setIsLoadingHoliday(true);

    try {
      const response = await fetch(`/api/fineract/holidays/${holiday.id}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Failed to load holiday details");
      setEditingHoliday(body as Holiday);
      setForm(toHolidayForm(body as Holiday));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to load holiday details");
    } finally {
      setIsLoadingHoliday(false);
    }
  };

  const updateForm = <K extends keyof HolidayFormState>(key: K, value: HolidayFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const toggleOffice = (officeId: number, checked: boolean) => {
    updateForm(
      "officeIds",
      checked
        ? [...new Set([...form.officeIds, officeId])]
        : form.officeIds.filter((id) => id !== officeId),
    );
  };

  const activeHoliday = isActiveHoliday(editingHoliday);
  const requiresRescheduledDate = Number(form.reschedulingType) === 2;

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const common = { name: form.name, description: form.description };
    const candidate =
      formMode === "create"
        ? {
            ...common,
            fromDate: form.fromDate,
            toDate: form.toDate,
            reschedulingType: Number(form.reschedulingType),
            repaymentsRescheduledTo: form.repaymentsRescheduledTo,
            officeIds: form.officeIds,
          }
        : activeHoliday
          ? common
          : {
              ...common,
              fromDate: form.fromDate,
              toDate: form.toDate,
              reschedulingType: Number(form.reschedulingType),
              repaymentsRescheduledTo: form.repaymentsRescheduledTo,
            };
    const parsed =
      formMode === "create"
        ? holidayCreateInputSchema.safeParse(candidate)
        : holidayUpdateInputSchema.safeParse(candidate);

    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error.issues));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const endpoint =
        formMode === "create"
          ? "/api/fineract/holidays"
          : `/api/fineract/holidays/${editingHoliday?.id}`;
      const response = await fetch(endpoint, {
        method: formMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `Failed to ${formMode} holiday`);

      toast({
        title: formMode === "create" ? "Holiday created" : "Holiday updated",
        description: parsed.data.name,
        variant: "success",
      });
      setIsFormOpen(false);
      setEditingHoliday(null);
      await loadHolidays(selectedOfficeId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : `Failed to ${formMode} holiday`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activateHoliday = async () => {
    if (!activationTarget) return;

    setIsActivating(true);
    try {
      const response = await fetch(
        `/api/fineract/holidays/${activationTarget.id}?command=activate`,
        { method: "POST" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Failed to activate holiday");

      toast({
        title: "Holiday activated",
        description: activationTarget.name,
        variant: "success",
      });
      setActivationTarget(null);
      await loadHolidays(selectedOfficeId);
    } catch (error) {
      toast({
        title: "Unable to activate holiday",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  const firstVisible = filteredHolidays.length === 0 ? 0 : currentPage * pageSize + 1;
  const lastVisible = Math.min(filteredHolidays.length, (currentPage + 1) * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Holidays</h1>
          <p className="mt-1 text-muted-foreground">Manage office holidays and repayment scheduling in Fineract.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadHolidays(selectedOfficeId)} disabled={!selectedOfficeId || isLoadingHolidays}>
            {isLoadingHolidays ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={openCreateModal} disabled={offices.length === 0 || isLoadingOffices}>
            <Plus className="mr-2 h-4 w-4" /> Create Holiday
          </Button>
        </div>
      </div>

      {loadError && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{loadError}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Holidays</CardTitle>
          <CardDescription>Choose an office to view its configured holidays.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-2"><Label htmlFor="holiday-office">Office</Label><Select value={selectedOfficeId} onValueChange={setSelectedOfficeId} disabled={isLoadingOffices || offices.length === 0}><SelectTrigger id="holiday-office"><SelectValue placeholder="Select an office" /></SelectTrigger><SelectContent>{offices.map((office) => <SelectItem key={office.id} value={String(office.id)}>{office.name}</SelectItem>)}</SelectContent></Select></div>
          {isLoadingOffices || isLoadingHolidays ? (
            <div className="space-y-4"><div className="h-9 w-64 animate-pulse rounded-md bg-muted" /><div className="h-64 animate-pulse rounded-lg bg-muted" /></div>
          ) : !selectedOfficeId ? (
            <div className="py-12 text-center text-muted-foreground">Create or select an office to manage holidays.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Input className="max-w-sm" placeholder="Search holidays..." value={search} onChange={(event) => { setSearch(event.target.value); setPageIndex(0); }} /><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Rows per page</span><Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPageIndex(0); }}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{PAGE_SIZE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holiday</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Repayments Rescheduled To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[190px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedHolidays.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          No holidays found for this office.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedHolidays.map((holiday) => (
                        <TableRow key={holiday.id}>
                          <TableCell>
                            <p className="font-medium">{holiday.name}</p>
                            {holiday.description && <p className="max-w-xs truncate text-sm text-muted-foreground">{holiday.description}</p>}
                          </TableCell>
                          <TableCell>{displayDate(holiday.fromDate)}</TableCell>
                          <TableCell>{displayDate(holiday.toDate)}</TableCell>
                          <TableCell>{displayDate(holiday.repaymentsRescheduledTo)}</TableCell>
                          <TableCell><Badge variant={isActiveHoliday(holiday) ? "default" : "secondary"}>{statusLabel(holiday.status)}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {!isActiveHoliday(holiday) && (
                                <Button size="sm" onClick={() => setActivationTarget(holiday)}>
                                  <LockOpen className="mr-2 h-4 w-4" /> Activate
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => void openEditModal(holiday)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing {firstVisible} - {lastVisible} of {filteredHolidays.length}</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPageIndex(Math.max(0, currentPage - 1))} disabled={currentPage === 0}><ChevronLeft className="h-4 w-4" /></Button><span>Page {currentPage + 1} of {pageCount}</span><Button variant="outline" size="sm" onClick={() => setPageIndex(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1}><ChevronRight className="h-4 w-4" /></Button></div></div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={activationTarget != null} onOpenChange={(open) => !open && setActivationTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogHeading>Activate Holiday</AlertDialogHeading>
            <AlertDialogBody>
              {activationTarget ? `Activate ${activationTarget.name}? This will make the holiday effective for its assigned offices.` : "Activate this holiday?"}
            </AlertDialogBody>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void activateHoliday()} disabled={isActivating}>
              {isActivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Activate Holiday
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isFormOpen} onOpenChange={(open) => (open ? setIsFormOpen(true) : closeForm())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{formMode === "create" ? "Create Holiday" : "Edit Holiday"}</DialogTitle><DialogDescription>{formMode === "create" ? "Apply a holiday to one or more offices." : activeHoliday ? "Active holiday dates are locked by Fineract; you can update its name and description." : "Update the selected holiday."}</DialogDescription></DialogHeader>
          {isLoadingHoliday ? <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : <form className="space-y-5" onSubmit={submitForm} noValidate>
            {formError && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>}
            <div className="space-y-2"><Label htmlFor="holiday-name">Holiday name <span className="text-destructive">*</span></Label><Input id="holiday-name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} aria-invalid={Boolean(fieldErrors.name)} required />{fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}</div>
            <div className="space-y-2"><Label htmlFor="holiday-description">Description</Label><Textarea id="holiday-description" value={form.description} onChange={(event) => updateForm("description", event.target.value)} aria-invalid={Boolean(fieldErrors.description)} rows={3} />{fieldErrors.description && <p className="text-sm text-destructive">{fieldErrors.description}</p>}</div>
            <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="holiday-from-date">From date <span className="text-destructive">*</span></Label><Input id="holiday-from-date" type="date" min="2000-01-01" max="2100-01-01" value={form.fromDate} onChange={(event) => updateForm("fromDate", event.target.value)} disabled={activeHoliday && formMode === "edit"} aria-invalid={Boolean(fieldErrors.fromDate)} required />{fieldErrors.fromDate && <p className="text-sm text-destructive">{fieldErrors.fromDate}</p>}</div><div className="space-y-2"><Label htmlFor="holiday-to-date">To date <span className="text-destructive">*</span></Label><Input id="holiday-to-date" type="date" min={form.fromDate || "2000-01-01"} max="2100-01-01" value={form.toDate} onChange={(event) => updateForm("toDate", event.target.value)} disabled={activeHoliday && formMode === "edit"} aria-invalid={Boolean(fieldErrors.toDate)} required />{fieldErrors.toDate && <p className="text-sm text-destructive">{fieldErrors.toDate}</p>}</div></div>
            <div className="space-y-2"><Label htmlFor="holiday-rescheduling-type">Repayment scheduling type <span className="text-destructive">*</span></Label><Select value={form.reschedulingType} onValueChange={(value) => updateForm("reschedulingType", value)} disabled={activeHoliday && formMode === "edit"}><SelectTrigger id="holiday-rescheduling-type" aria-invalid={Boolean(fieldErrors.reschedulingType)}><SelectValue placeholder="Select a scheduling type" /></SelectTrigger><SelectContent>{reschedulingTypes.map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.value}</SelectItem>)}</SelectContent></Select>{fieldErrors.reschedulingType && <p className="text-sm text-destructive">{fieldErrors.reschedulingType}</p>}</div>
            {requiresRescheduledDate && <div className="space-y-2"><Label htmlFor="holiday-rescheduled-date">Repayments rescheduled to <span className="text-destructive">*</span></Label><Input id="holiday-rescheduled-date" type="date" min={form.toDate || form.fromDate || "2000-01-01"} max="2100-01-01" value={form.repaymentsRescheduledTo} onChange={(event) => updateForm("repaymentsRescheduledTo", event.target.value)} disabled={activeHoliday && formMode === "edit"} aria-invalid={Boolean(fieldErrors.repaymentsRescheduledTo)} required />{fieldErrors.repaymentsRescheduledTo && <p className="text-sm text-destructive">{fieldErrors.repaymentsRescheduledTo}</p>}</div>}
            {formMode === "create" && <div className="space-y-3"><Label>Applicable offices <span className="text-destructive">*</span></Label><div className="max-h-52 space-y-3 overflow-y-auto rounded-md border p-3">{offices.map((office) => <div key={office.id} className="flex items-center gap-3"><Checkbox id={`holiday-office-${office.id}`} checked={form.officeIds.includes(office.id)} onCheckedChange={(checked) => toggleOffice(office.id, checked === true)} /><Label htmlFor={`holiday-office-${office.id}`} className="font-normal">{office.name}</Label></div>)}</div>{fieldErrors.officeIds && <p className="text-sm text-destructive">{fieldErrors.officeIds}</p>}</div>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting || (formMode === "create" && reschedulingTypes.length === 0)}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{formMode === "create" ? "Create Holiday" : "Save Changes"}</Button></div>
          </form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
