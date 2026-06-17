"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

interface FineractClient {
  id: number;
  displayName: string;
  officeId?: number;
  officeName?: string;
}

interface UserOffice {
  id?: number | null;
  name?: string | null;
}

interface ClientBranchTransferCardProps {
  clientId: number;
  client: FineractClient;
  currentUserOffice: UserOffice;
}

export function ClientBranchTransferCard({
  clientId,
  client,
  currentUserOffice,
}: ClientBranchTransferCardProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCurrentBranch =
    currentUserOffice.id != null &&
    Number(currentUserOffice.id) === client.officeId;
  const hasDestinationBranch = currentUserOffice.id != null;

  async function handleMoveBranch() {
    if (!hasDestinationBranch || isCurrentBranch) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/fineract/clients/${clientId}/transfer-office`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientOfficeId: client.officeId,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.details?.defaultUserMessage ||
            data?.error ||
            "Failed to move client branch"
        );
      }

      toast({
        title: "Client branch moved",
        description: `${client.displayName} was moved to ${
          currentUserOffice.name || "your branch"
        }.`,
      });

      router.refresh();
    } catch (error) {
      console.error("Error moving client branch:", error);
      toast({
        title: "Failed to move branch",
        description:
          error instanceof Error
            ? error.message
            : "The client could not be moved to the selected branch.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-amber-500" />
          Move Branch
        </CardTitle>
        <CardDescription>
          This client is outside your assigned branch. Transfer the client to
          your branch in Fineract.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Current Branch
          </p>
          <p className="font-semibold">{client.officeName || "Unknown"}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">New Branch</p>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
            {currentUserOffice.name || "Your branch is not available"}
          </div>
          <p className="text-xs text-muted-foreground">
            This branch is locked to the logged-in user.
          </p>
          {isCurrentBranch && (
            <p className="text-xs text-muted-foreground">
              This client is already assigned to your branch.
            </p>
          )}
          {!hasDestinationBranch && (
            <p className="text-xs text-destructive">
              Your login session does not include a branch.
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={handleMoveBranch}
          disabled={
            isSubmitting ||
            !hasDestinationBranch ||
            isCurrentBranch
          }
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Move Branch
        </Button>
      </CardContent>
    </Card>
  );
}
