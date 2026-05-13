"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import type { PaymentType } from "@/shared/types/payment-type";
import PaymentTypeForm from "./components/payment-type-form";

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;

export default function PaymentTypesPage() {
  const router = useRouter();
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPaymentType, setEditingPaymentType] = useState<PaymentType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPaymentTypes = async () => {
    try {
      setLoadError(null);
      setIsLoading(true);
      const response = await fetch("/api/fineract/paymenttypes");
      const body = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(body?.error || "Failed to load payment types");
      }
      setPaymentTypes(Array.isArray(body) ? body : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load payment types";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentTypes();
  }, []);

  const filteredPaymentTypes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return paymentTypes
      .filter((paymentType) => {
        if (!normalizedSearch) return true;

        return [
          paymentType.name,
          paymentType.description,
          paymentType.codeName,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => left.position - right.position);
  }, [paymentTypes, search]);

  const pageCount = Math.max(1, Math.ceil(filteredPaymentTypes.length / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);

  const paginatedPaymentTypes = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredPaymentTypes.slice(start, start + pageSize);
  }, [currentPage, filteredPaymentTypes, pageSize]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, pageSize]);

  useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [pageCount, pageIndex]);

  const openCreateModal = () => {
    setFormMode("create");
    setEditingPaymentType(null);
    setIsFormOpen(true);
  };

  const openEditModal = (paymentType: PaymentType) => {
    setFormMode("edit");
    setEditingPaymentType(paymentType);
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setIsFormOpen(false);
    setEditingPaymentType(null);
  };

  const handleFormSuccess = async () => {
    closeFormModal();
    await loadPaymentTypes();
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/fineract/paymenttypes/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Failed to delete payment type");
      }

      setPaymentTypes((current) =>
        current.filter((item) => item.id !== deleteTarget.id)
      );
      toast({
        title: "Payment type deleted",
        description: deleteTarget.name,
        variant: "success",
      });
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      toast({
        title: "Unable to delete payment type",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payment Types</h1>
          <p className="mt-1 text-muted-foreground">
            Manage organization payment types from Fineract.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadPaymentTypes} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Create Payment Type
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
            <WalletCards className="h-5 w-5" />
            Payment Types
          </CardTitle>
          <CardDescription>
            {paymentTypes.length} payment type{paymentTypes.length === 1 ? "" : "s"} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
              <div className="h-64 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : paymentTypes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <WalletCards className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">No payment types found.</p>
              <Button size="sm" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first payment type
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-sm">
                  <Input
                    placeholder="Search payment types..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => setPageSize(Number(value))}
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

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>System Defined</TableHead>
                      <TableHead>Cash Payment</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead className="w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPaymentTypes.map((paymentType) => (
                      <TableRow key={paymentType.id}>
                        <TableCell className="font-medium">{paymentType.name}</TableCell>
                        <TableCell>{paymentType.description || "—"}</TableCell>
                        <TableCell>{paymentType.codeName || "—"}</TableCell>
                        <TableCell>
                          {paymentType.isSystemDefined ? (
                            <Badge variant="secondary">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {paymentType.isCashPayment ? (
                            <span className="inline-flex items-center gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                              <XCircle className="h-4 w-4" />
                              No
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{paymentType.position}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(paymentType)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            {!paymentType.isSystemDefined && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteTarget(paymentType)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {filteredPaymentTypes.length === 0 ? 0 : currentPage * pageSize + 1}
                  {" - "}
                  {Math.min(filteredPaymentTypes.length, (currentPage + 1) * pageSize)}
                  {" of "}
                  {filteredPaymentTypes.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
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
                    onClick={() =>
                      setPageIndex((current) => Math.min(pageCount - 1, current + 1))
                    }
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

      <Dialog
        open={isFormOpen}
        onOpenChange={(open: boolean) => {
          if (!open) {
            closeFormModal();
          } else {
            setIsFormOpen(true);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {formMode === "create" ? "Create Payment Type" : "Edit Payment Type"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Add a new payment type using the same fields available in Mifos UI."
                : "Update the selected payment type."}
            </DialogDescription>
          </DialogHeader>
          <PaymentTypeForm
            mode={formMode}
            initialData={editingPaymentType}
            onCancel={closeFormModal}
            onSuccess={handleFormSuccess}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Type</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Are you sure you want to delete payment type ${deleteTarget.name}?`
                : "Are you sure you want to delete this payment type?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
