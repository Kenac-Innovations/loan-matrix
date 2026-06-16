"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

interface OfficeOption {
  id: number;
  name: string;
}

interface ClientBranchTransferCardProps {
  clientId: number;
  currentOfficeId?: number;
  currentOfficeName?: string;
}

export function ClientBranchTransferCard({
  clientId,
  currentOfficeId,
  currentOfficeName,
}: ClientBranchTransferCardProps) {
  const router = useRouter();
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [isLoadingOffices, setIsLoadingOffices] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchOffices() {
      try {
        setIsLoadingOffices(true);
        const response = await fetch("/api/fineract/client-branch-transfer/offices");

        if (!response.ok) {
          throw new Error("Failed to load branches");
        }

        const data = await response.json();
        if (!cancelled) {
          setOffices(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error loading branches:", error);
        toast({
          title: "Unable to load branches",
          description: "Refresh the page and try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) {
          setIsLoadingOffices(false);
        }
      }
    }

    fetchOffices();

    return () => {
      cancelled = true;
    };
  }, []);

  const destinationOffices = useMemo(
    () => offices.filter((office) => office.id !== currentOfficeId),
    [currentOfficeId, offices]
  );

  const selectedOffice = destinationOffices.find(
    (office) => office.id.toString() === selectedOfficeId
  );

  async function moveBranch() {
    if (!selectedOfficeId) {
      toast({
        title: "Select a branch",
        description: "Choose the branch this client should be moved to.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(
        `/api/fineract/clients/${clientId}/transfer-office`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinationOfficeId: Number(selectedOfficeId),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.defaultUserMessage ||
            data?.developerMessage ||
            data?.error ||
            "Failed to move client branch"
        );
      }

      toast({
        title: "Client moved",
        description: selectedOffice
          ? `Client moved to ${selectedOffice.name}.`
          : "Client branch was updated.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Move branch failed",
        description:
          error instanceof Error
            ? error.message
            : "The client branch could not be updated.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-amber-500" />
          Move Branch
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_280px_auto] md:items-end">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            This client is currently assigned to{" "}
            <span className="text-foreground">
              {currentOfficeName || "another branch"}
            </span>
            .
          </p>
          <p className="text-sm text-muted-foreground">
            Move the client to the correct branch before managing branch-scoped
            records.
          </p>
        </div>

        <Select
          value={selectedOfficeId}
          onValueChange={setSelectedOfficeId}
          disabled={isLoadingOffices || isSubmitting}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                isLoadingOffices ? "Loading branches..." : "Select branch"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {destinationOffices.map((office) => (
              <SelectItem key={office.id} value={office.id.toString()}>
                {office.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          onClick={moveBranch}
          disabled={!selectedOfficeId || isSubmitting || isLoadingOffices}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Move Branch
        </Button>
      </CardContent>
    </Card>
  );
}
