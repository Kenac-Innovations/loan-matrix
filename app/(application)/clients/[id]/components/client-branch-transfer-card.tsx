"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

interface FineractOffice {
  id: number;
  name: string;
  externalId?: string;
}

interface FineractClient {
  id: number;
  displayName: string;
  officeId?: number;
  officeName?: string;
}

interface ClientBranchTransferCardProps {
  clientId: number;
  client: FineractClient;
}

export function ClientBranchTransferCard({
  clientId,
  client,
}: ClientBranchTransferCardProps) {
  const router = useRouter();
  const [offices, setOffices] = useState<FineractOffice[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [isLoadingOffices, setIsLoadingOffices] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOffices() {
      setIsLoadingOffices(true);
      try {
        const response = await fetch(
          "/api/fineract/client-branch-transfer/offices",
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch branches");
        }

        const data = await response.json();
        const officeList = Array.isArray(data)
          ? data
          : Array.isArray(data?.offices)
            ? data.offices
            : Array.isArray(data?.pageItems)
              ? data.pageItems
              : [];

        if (isMounted) {
          setOffices(officeList);
        }
      } catch (error) {
        console.error("Error loading branches for client transfer:", error);
        toast({
          title: "Could not load branches",
          description: "Refresh the page and try again.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setIsLoadingOffices(false);
        }
      }
    }

    loadOffices();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedOffice = useMemo(
    () => offices.find((office) => String(office.id) === selectedOfficeId),
    [offices, selectedOfficeId]
  );

  const isCurrentBranch =
    selectedOfficeId.length > 0 && Number(selectedOfficeId) === client.officeId;

  async function handleMoveBranch() {
    if (!selectedOfficeId || isCurrentBranch) {
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
            destinationOfficeId: Number(selectedOfficeId),
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
          selectedOffice?.name || "the selected branch"
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
          This client is outside your assigned branch. Select the correct branch
          to transfer the client in Fineract.
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
          <Select
            value={selectedOfficeId}
            onValueChange={setSelectedOfficeId}
            disabled={isLoadingOffices || isSubmitting}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingOffices ? "Loading branches..." : "Select branch"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {offices.map((office) => (
                <SelectItem key={office.id} value={String(office.id)}>
                  {office.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isCurrentBranch && (
            <p className="text-xs text-muted-foreground">
              This client is already assigned to the selected branch.
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={handleMoveBranch}
          disabled={
            isLoadingOffices ||
            isSubmitting ||
            !selectedOfficeId ||
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
