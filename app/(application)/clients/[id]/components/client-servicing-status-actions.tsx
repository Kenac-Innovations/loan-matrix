"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock3,
  Edit,
  FileText,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import type {
  ClientServicingStatusDefinitionsResponse,
  ClientServicingStatusResponse,
} from "@/lib/fineract-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ClientServicingStatusActionsProps = {
  clientId: number;
  clientExternalId?: string;
  clientIsActive: boolean;
  canEditClient: boolean;
  canOriginateNewLoan: boolean;
  canChangeStatus: boolean;
};

function responseMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  return response
    .json()
    .then((body) => body?.error || body?.defaultUserMessage || fallback)
    .catch(() => fallback);
}

async function fetchJson<T>(url: string, fallback: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await responseMessage(response, fallback));
  }
  return response.json() as Promise<T>;
}

const fetchServicingStatusDefinitions = (url: string) =>
  fetchJson<ClientServicingStatusDefinitionsResponse>(
    url,
    "Unable to load servicing status definitions",
  );

const fetchClientServicingStatus = (url: string) =>
  fetchJson<ClientServicingStatusResponse>(
    url,
    "Unable to load client servicing status",
  );

function formatDateTime(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function ClientServicingStatusActions({
  clientId,
  clientExternalId,
  clientIsActive,
  canEditClient,
  canOriginateNewLoan,
  canChangeStatus,
}: ClientServicingStatusActionsProps) {
  const router = useRouter();
  const { data: definitions } =
    useSWR<ClientServicingStatusDefinitionsResponse>(
      "/api/fineract/client-servicing-statuses",
      fetchServicingStatusDefinitions,
    );
  const { data: servicingStatus, mutate: mutateServicingStatus } =
    useSWR<ClientServicingStatusResponse>(
      `/api/fineract/clients/${clientId}/servicing-status`,
      fetchClientServicingStatus,
    );
  const [isChangeDialogOpen, setIsChangeDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedStatusCode, setSelectedStatusCode] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const currentStatusCode = servicingStatus?.status?.code;
  const servicingStatusIsLoading = !servicingStatus;

  function openChangeDialog() {
    setSelectedStatusCode(currentStatusCode ?? "");
    setReason("");
    setIsChangeDialogOpen(true);
  }

  async function submitStatusChange() {
    if (!selectedStatusCode) {
      toast.error("Select a servicing status");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason or comment is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/fineract/clients/${clientId}/servicing-status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statusCode: selectedStatusCode, reason }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "Unable to change servicing status"),
        );
      }

      const nextStatus =
        (await response.json()) as ClientServicingStatusResponse;
      await mutateServicingStatus(nextStatus, false);
      setIsChangeDialogOpen(false);
      toast.success("Client servicing status changed");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to change servicing status",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Actions...
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem asChild>
            <Link
              href={`/api/fineract/clients/${clientId}/statement?format=html`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="h-4 w-4" />
              Consolidated statement
            </Link>
          </DropdownMenuItem>

          {clientIsActive && clientExternalId && canOriginateNewLoan && (
            <DropdownMenuItem asChild>
              <Link
                href={`/leads/new/loan?clientId=${clientId}&externalId=${encodeURIComponent(
                  clientExternalId,
                )}`}
              >
                <Plus className="h-4 w-4" />
                Apply for loan
              </Link>
            </DropdownMenuItem>
          )}

          {canEditClient && (
            <DropdownMenuItem asChild>
              <Link href={`/clients/${clientId}/edit`}>
                <Edit className="h-4 w-4" />
                Edit client
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {canChangeStatus && (
            <DropdownMenuItem
              disabled={!definitions || servicingStatusIsLoading}
              onSelect={openChangeDialog}
            >
              {definitions && !servicingStatusIsLoading ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Edit servicing status
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            disabled={servicingStatusIsLoading}
            onSelect={() => setIsHistoryDialogOpen(true)}
          >
            {servicingStatusIsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock3 className="h-4 w-4" />
            )}
            Status history
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isChangeDialogOpen} onOpenChange={setIsChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit client servicing status</DialogTitle>
            <DialogDescription>
              The policy takes effect immediately. A reason is required and is
              retained in the client audit history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="servicing-status">Status</Label>
              <Select
                value={selectedStatusCode}
                onValueChange={setSelectedStatusCode}
              >
                <SelectTrigger id="servicing-status">
                  <SelectValue placeholder="Select a servicing status" />
                </SelectTrigger>
                <SelectContent>
                  {(definitions?.statuses ?? [])
                    .filter((status) => status.active)
                    .map((status) => (
                      <SelectItem key={status.code} value={status.code}>
                        {status.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="servicing-status-reason">Reason or comment</Label>
              <Textarea
                id="servicing-status-reason"
                value={reason}
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this client’s servicing status is changing"
              />
            </div>

            {selectedStatusCode === currentStatusCode && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Select a different status to record a change.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={submitStatusChange}
              disabled={
                isSaving ||
                !selectedStatusCode ||
                selectedStatusCode === currentStatusCode ||
                !reason.trim()
              }
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Client servicing status history</DialogTitle>
            <DialogDescription>
              Every status change, including its reason and author, is retained
              in Fineract.
            </DialogDescription>
          </DialogHeader>

          {(servicingStatus?.history ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
              No servicing status changes have been recorded.
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {servicingStatus?.history.map((entry, index) => (
                <div
                  key={`${entry.changedOn}-${index}`}
                  className="rounded-md border p-3 text-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-medium">
                      {entry.previousStatus?.name ?? "Not set"} →{" "}
                      {entry.newStatus.name}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDateTime(entry.changedOn)} by {entry.changedBy}
                    </p>
                  </div>
                  <p className="mt-2 text-muted-foreground">{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
