"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock3,
  Loader2,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import type {
  ClientServicingStatusDefinitionsResponse,
  ClientServicingStatusResponse,
} from "@/lib/fineract-api";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ClientServicingStatusCardProps = {
  clientId: number;
  canChangeStatus: boolean;
};

function responseMessage(response: Response, fallback: string): Promise<string> {
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
    "Unable to load servicing status definitions"
  );

const fetchClientServicingStatus = (url: string) =>
  fetchJson<ClientServicingStatusResponse>(
    url,
    "Unable to load client servicing status"
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

export function ClientServicingStatusCard({
  clientId,
  canChangeStatus,
}: ClientServicingStatusCardProps) {
  const router = useRouter();
  const {
    data: definitions,
    error: definitionsError,
    mutate: mutateDefinitions,
  } = useSWR<ClientServicingStatusDefinitionsResponse>(
    "/api/fineract/client-servicing-statuses",
    fetchServicingStatusDefinitions
  );
  const {
    data: servicingStatus,
    error: servicingStatusError,
    mutate: mutateServicingStatus,
  } = useSWR<ClientServicingStatusResponse>(
    `/api/fineract/clients/${clientId}/servicing-status`,
    fetchClientServicingStatus
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatusCode, setSelectedStatusCode] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const actions = useMemo(
    () =>
      new Map(
        (definitions?.actions ?? []).map((action) => [
          action.code,
          action.label,
        ])
      ),
    [definitions]
  );
  const editAllowed = servicingStatus?.policies.EDIT_CLIENT_DETAILS !== false;
  const lendingAllowed =
    servicingStatus?.policies.ORIGINATE_NEW_LOAN !== false;

  function openChangeDialog() {
    setSelectedStatusCode(servicingStatus?.status?.code ?? "");
    setReason("");
    setIsDialogOpen(true);
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
        }
      );

      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "Unable to change servicing status")
        );
      }

      const nextStatus = (await response.json()) as ClientServicingStatusResponse;
      await mutateServicingStatus(nextStatus, false);
      setIsDialogOpen(false);
      toast.success("Client servicing status changed");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to change servicing status"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!definitions || !servicingStatus) {
    const loadingError = definitionsError || servicingStatusError;
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
          {loadingError ? (
            <>
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span>
                {loadingError instanceof Error
                  ? loadingError.message
                  : "Unable to load client servicing status"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void mutateDefinitions();
                  void mutateServicingStatus();
                }}
              >
                Retry
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading servicing status…
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const currentStatusName = servicingStatus?.status?.name ?? "Not set";
  const currentStatusCode = servicingStatus?.status?.code;

  return (
    <>
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Client Servicing Status
            </CardTitle>
            <CardDescription className="mt-1">
              Operational restrictions are enforced by Fineract for this client.
            </CardDescription>
          </div>
          {canChangeStatus && (
            <Button size="sm" onClick={openChangeDialog}>
              <Pencil className="mr-2 h-4 w-4" />
              Change status
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current status</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                  {currentStatusName}
                </Badge>
                {currentStatusCode && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {currentStatusCode}
                  </span>
                )}
              </div>
            </div>
            {servicingStatus?.status && (
              <div className="text-sm text-muted-foreground sm:text-right">
                <p>Changed by {servicingStatus.status.changedBy}</p>
                <p>{formatDateTime(servicingStatus.status.changedOn)}</p>
              </div>
            )}
          </div>

          {!servicingStatus?.assigned && (
            <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
              No servicing status has been assigned. Existing client behaviour is
              retained until an authorised user assigns one.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div
              className={`rounded-md border p-3 text-sm ${
                editAllowed
                  ? "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20"
                  : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
              }`}
            >
              <p className="font-medium">
                {editAllowed ? "Client details may be edited" : "Client details are locked"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {actions.get("EDIT_CLIENT_DETAILS") ?? "Edit client details"}
              </p>
            </div>
            <div
              className={`rounded-md border p-3 text-sm ${
                lendingAllowed
                  ? "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20"
                  : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
              }`}
            >
              <p className="font-medium">
                {lendingAllowed ? "New lending is allowed" : "New lending is blocked"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {actions.get("ORIGINATE_NEW_LOAN") ?? "Obtain a new loan"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Status history</h3>
            </div>
            {(servicingStatus?.history ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
                No servicing status changes have been recorded.
              </p>
            ) : (
              <div className="space-y-3">
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
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change client servicing status</DialogTitle>
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
              <Label htmlFor="servicing-status-reason">
                Reason or comment
              </Label>
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
    </>
  );
}
