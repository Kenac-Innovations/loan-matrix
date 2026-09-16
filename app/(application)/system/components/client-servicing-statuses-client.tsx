"use client";

import { useMemo, useState } from "react";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import type {
  ClientServicingPolicies,
  ClientServicingStatusDefinition,
  ClientServicingStatusDefinitionsResponse,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function policyKeys(status: ClientServicingStatusDefinition) {
  return Object.keys(status.policies).sort();
}

async function responseMessage(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body?.error || body?.defaultUserMessage || fallback;
  } catch {
    return fallback;
  }
}

async function fetchServicingStatusDefinitions(
  url: string
): Promise<ClientServicingStatusDefinitionsResponse> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      await responseMessage(
        response,
        "Unable to load client servicing status policies"
      )
    );
  }
  return response.json() as Promise<ClientServicingStatusDefinitionsResponse>;
}

export function ClientServicingStatusesClient() {
  const {
    data: definitions,
    error: definitionsError,
    mutate: mutateDefinitions,
  } = useSWR<ClientServicingStatusDefinitionsResponse>(
    "/api/fineract/client-servicing-statuses",
    fetchServicingStatusDefinitions
  );
  const [draftPolicies, setDraftPolicies] = useState<
    Record<string, ClientServicingPolicies>
  >({});
  const [pendingStatus, setPendingStatus] =
    useState<ClientServicingStatusDefinition | null>(null);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const actionLabels = useMemo(
    () =>
      new Map(
        (definitions?.actions ?? []).map((action) => [
          action.code,
          action.label,
        ])
      ),
    [definitions]
  );

  function updatePolicy(statusCode: string, actionCode: string, allowed: boolean) {
    setDraftPolicies((current) => ({
      ...current,
      [statusCode]: {
        ...current[statusCode],
        [actionCode]: allowed,
      },
    }));
  }

  function isDirty(status: ClientServicingStatusDefinition) {
    const current = {
      ...status.policies,
      ...draftPolicies[status.code],
    };
    return policyKeys(status).some(
      (actionCode) => current[actionCode] !== status.policies[actionCode]
    );
  }

  function openSaveDialog(status: ClientServicingStatusDefinition) {
    setPendingStatus(status);
    setReason("");
  }

  async function savePolicies() {
    if (!pendingStatus) return;
    if (!reason.trim()) {
      toast.error("A reason or comment is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/fineract/client-servicing-statuses/${encodeURIComponent(
          pendingStatus.code
        )}/policies`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            policies: {
              ...pendingStatus.policies,
              ...draftPolicies[pendingStatus.code],
            },
            reason,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(
          await responseMessage(
            response,
            "Unable to update client servicing status policy"
          )
        );
      }

      const nextDefinitions =
        (await response.json()) as ClientServicingStatusDefinitionsResponse;
      await mutateDefinitions(nextDefinitions, false);
      setDraftPolicies((current) => {
        const next = { ...current };
        delete next[pendingStatus.code];
        return next;
      });
      setPendingStatus(null);
      toast.success(`${pendingStatus.name} policy updated`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update client servicing status policy"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!definitions) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center gap-2 pt-6 text-sm text-muted-foreground">
          {definitionsError ? (
            <>
              <span>
                {definitionsError instanceof Error
                  ? definitionsError.message
                  : "Unable to load client servicing status policies"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void mutateDefinitions()}
              >
                Retry
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading client servicing status policies…
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const statuses = definitions.statuses;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Client Servicing Statuses
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Choose the client actions that each operational status allows.
            Fineract enforces these policies for every channel, including direct
            API calls.
          </p>
        </div>
        <Badge variant="secondary">{statuses.length} statuses</Badge>
      </div>

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex gap-3 pt-6 text-sm text-muted-foreground">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          <p>
            This configuration deliberately controls only client-detail editing
            and new-loan origination. Repayments, recoveries, reversals, and
            Fineract’s accrual processing remain governed by their existing
            permissions and accounting rules.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {statuses.map((status) => {
          const current = {
            ...status.policies,
            ...draftPolicies[status.code],
          };
          const dirty = isDirty(status);

          return (
            <Card key={status.code} className="rounded-lg">
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{status.name}</CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs">
                    {status.code}
                  </CardDescription>
                </div>
                {dirty && <Badge>Unsaved changes</Badge>}
              </CardHeader>
              <CardContent className="space-y-4">
                {policyKeys(status).map((actionCode) => (
                  <label
                    key={actionCode}
                    className="flex items-start gap-3 rounded-md border p-3 text-sm"
                  >
                    <Checkbox
                      checked={current[actionCode] === true}
                      onCheckedChange={(checked) =>
                        updatePolicy(status.code, actionCode, checked === true)
                      }
                    />
                    <span>
                      <span className="block font-medium">
                        {actionLabels.get(actionCode) ?? actionCode}
                      </span>
                      <span className="mt-1 block text-muted-foreground">
                        {current[actionCode] === true ? "Allowed" : "Blocked"}
                      </span>
                    </span>
                  </label>
                ))}
                <Button
                  className="w-full"
                  disabled={!dirty}
                  onClick={() => openSaveDialog(status)}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save {status.name} policy
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {statuses.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No client servicing statuses are available for this tenant.
          </CardContent>
        </Card>
      )}

      <Dialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save {pendingStatus?.name} policy</DialogTitle>
            <DialogDescription>
              Give a reason for this policy change. The change is applied
              immediately and recorded in Fineract.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="servicing-policy-reason">Reason or comment</Label>
            <Textarea
              id="servicing-policy-reason"
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why these actions are changing"
            />
          </div>
          <DialogFooter>
            <Button onClick={savePolicies} disabled={isSaving || !reason.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
