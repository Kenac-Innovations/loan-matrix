"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "@/components/ui/use-toast";
import {
  officeInputSchema,
  officeUpdateInputSchema,
} from "@/lib/organization-form-schemas";

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;

type FineractDate = string | number[] | null | undefined;

type Office = {
  id: number;
  name: string;
  externalId?: string | null;
  parentId?: number | null;
  parentName?: string | null;
  openingDate?: FineractDate;
  allowedParents?: Office[];
};

type OfficeFormState = {
  name: string;
  parentId: string;
  openingDate: string;
  externalId: string;
};

type FieldErrors = Partial<Record<keyof OfficeFormState, string>>;

const emptyOfficeForm: OfficeFormState = {
  name: "",
  parentId: "",
  openingDate: "",
  externalId: "",
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

function getFieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>): FieldErrors {
  return issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && field in emptyOfficeForm && !errors[field as keyof OfficeFormState]) {
      errors[field as keyof OfficeFormState] = issue.message;
    }
    return errors;
  }, {});
}

function toOfficeForm(office: Office | null): OfficeFormState {
  if (!office) return emptyOfficeForm;

  return {
    name: office.name || "",
    parentId: office.parentId ? String(office.parentId) : "",
    openingDate: getIsoDate(office.openingDate),
    externalId: office.externalId || "",
  };
}

export function OfficesManager() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [parentOptions, setParentOptions] = useState<Office[]>([]);
  const [form, setForm] = useState<OfficeFormState>(emptyOfficeForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoadingOffice, setIsLoadingOffice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOffices = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/fineract/offices?orderBy=name");
      const body = await response.json().catch(() => []);
      if (!response.ok) throw new Error(body?.error || "Failed to load offices");
      setOffices(Array.isArray(body) ? body : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load offices");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOffices();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredOffices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return offices;

    return offices.filter((office) =>
      [office.name, office.externalId, office.parentName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [offices, search]);

  const pageCount = Math.max(1, Math.ceil(filteredOffices.length / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const paginatedOffices = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredOffices.slice(start, start + pageSize);
  }, [currentPage, filteredOffices, pageSize]);

  const closeForm = () => {
    if (isSubmitting) return;
    setIsFormOpen(false);
    setEditingOffice(null);
    setFieldErrors({});
    setFormError(null);
  };

  const openCreateModal = () => {
    setFormMode("create");
    setEditingOffice(null);
    setParentOptions(offices);
    setForm({ ...emptyOfficeForm, parentId: offices[0] ? String(offices[0].id) : "" });
    setFieldErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = async (office: Office) => {
    setFormMode("edit");
    setEditingOffice(office);
    setForm(toOfficeForm(office));
    setParentOptions(offices.filter((candidate) => candidate.id !== office.id));
    setFieldErrors({});
    setFormError(null);
    setIsFormOpen(true);
    setIsLoadingOffice(true);

    try {
      const response = await fetch(`/api/fineract/offices/${office.id}?template=true`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Failed to load office details");

      const loadedOffice = body as Office;
      setEditingOffice(loadedOffice);
      setForm(toOfficeForm(loadedOffice));
      setParentOptions(
        Array.isArray(loadedOffice.allowedParents)
          ? loadedOffice.allowedParents
          : offices.filter((candidate) => candidate.id !== office.id),
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to load office details");
    } finally {
      setIsLoadingOffice(false);
    }
  };

  const updateForm = <K extends keyof OfficeFormState>(key: K, value: OfficeFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate = {
      ...form,
      parentId: form.parentId ? Number(form.parentId) : undefined,
    };
    const parsed =
      formMode === "create"
        ? officeInputSchema.safeParse(candidate)
        : officeUpdateInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error.issues));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const endpoint =
        formMode === "create"
          ? "/api/fineract/offices"
          : `/api/fineract/offices/${editingOffice?.id}`;
      const response = await fetch(endpoint, {
        method: formMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `Failed to ${formMode} office`);

      toast({
        title: formMode === "create" ? "Office created" : "Office updated",
        description: parsed.data.name,
        variant: "success",
      });
      setIsFormOpen(false);
      setEditingOffice(null);
      await loadOffices();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : `Failed to ${formMode} office`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formTitle = formMode === "create" ? "Create Office" : "Edit Office";
  const canChooseParent = formMode === "create" || parentOptions.length > 0;
  const firstVisible = filteredOffices.length === 0 ? 0 : currentPage * pageSize + 1;
  const lastVisible = Math.min(filteredOffices.length, (currentPage + 1) * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Offices</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your Fineract office hierarchy and branch details.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadOffices()} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={openCreateModal} disabled={offices.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Create Office
          </Button>
        </div>
      </div>

      {offices.length === 0 && !isLoading && !loadError && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
          An existing head office is required before a child office can be created.
        </div>
      )}

      {loadError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Offices</CardTitle>
          <CardDescription>{offices.length} office{offices.length === 1 ? "" : "s"} configured</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4"><div className="h-9 w-64 animate-pulse rounded-md bg-muted" /><div className="h-64 animate-pulse rounded-lg bg-muted" /></div>
          ) : offices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center"><Building2 className="h-12 w-12 text-muted-foreground/40" /><p className="text-muted-foreground">No offices found.</p></div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input className="max-w-sm" placeholder="Search offices..." value={search} onChange={(event) => { setSearch(event.target.value); setPageIndex(0); }} />
                <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Rows per page</span><Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPageIndex(0); }}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{PAGE_SIZE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Office</TableHead><TableHead>External ID</TableHead><TableHead>Parent Office</TableHead><TableHead>Opened On</TableHead><TableHead className="w-[100px]">Actions</TableHead></TableRow></TableHeader><TableBody>{paginatedOffices.map((office) => <TableRow key={office.id}><TableCell className="font-medium">{office.name}</TableCell><TableCell>{office.externalId || "—"}</TableCell><TableCell>{office.parentName || "—"}</TableCell><TableCell>{displayDate(office.openingDate)}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => void openEditModal(office)}><Pencil className="mr-2 h-4 w-4" />Edit</Button></TableCell></TableRow>)}</TableBody></Table></div>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing {firstVisible} - {lastVisible} of {filteredOffices.length}</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPageIndex(Math.max(0, currentPage - 1))} disabled={currentPage === 0}><ChevronLeft className="h-4 w-4" /></Button><span>Page {currentPage + 1} of {pageCount}</span><Button variant="outline" size="sm" onClick={() => setPageIndex(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1}><ChevronRight className="h-4 w-4" /></Button></div></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => (open ? setIsFormOpen(true) : closeForm())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{formTitle}</DialogTitle><DialogDescription>{formMode === "create" ? "Add an office to the Fineract hierarchy." : "Update the selected office."}</DialogDescription></DialogHeader>
          {isLoadingOffice ? <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : <form className="space-y-5" onSubmit={submitForm} noValidate>
            {formError && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>}
            <div className="space-y-2"><Label htmlFor="office-name">Office name <span className="text-destructive">*</span></Label><Input id="office-name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} aria-invalid={Boolean(fieldErrors.name)} required />{fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}</div>
            {canChooseParent ? <div className="space-y-2"><Label htmlFor="office-parent">Parent office {formMode === "create" && <span className="text-destructive">*</span>}</Label><Select value={form.parentId} onValueChange={(value) => updateForm("parentId", value)}><SelectTrigger id="office-parent" aria-invalid={Boolean(fieldErrors.parentId)}><SelectValue placeholder="Select a parent office" /></SelectTrigger><SelectContent>{parentOptions.map((office) => <SelectItem key={office.id} value={String(office.id)}>{office.name}</SelectItem>)}</SelectContent></Select>{fieldErrors.parentId && <p className="text-sm text-destructive">{fieldErrors.parentId}</p>}</div> : <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">This is the head office, so Fineract does not allow a parent office to be changed.</p>}
            <div className="space-y-2"><Label htmlFor="office-opening-date">Opened on <span className="text-destructive">*</span></Label><Input id="office-opening-date" type="date" min="2000-01-01" max={format(new Date(), "yyyy-MM-dd")} value={form.openingDate} onChange={(event) => updateForm("openingDate", event.target.value)} aria-invalid={Boolean(fieldErrors.openingDate)} required />{fieldErrors.openingDate && <p className="text-sm text-destructive">{fieldErrors.openingDate}</p>}</div>
            <div className="space-y-2"><Label htmlFor="office-external-id">External ID</Label><Input id="office-external-id" value={form.externalId} onChange={(event) => updateForm("externalId", event.target.value)} aria-invalid={Boolean(fieldErrors.externalId)} />{fieldErrors.externalId && <p className="text-sm text-destructive">{fieldErrors.externalId}</p>}</div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{formMode === "create" ? "Create Office" : "Save Changes"}</Button></div>
          </form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
