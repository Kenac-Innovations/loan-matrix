"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Database, AlertCircle } from "lucide-react";
import { DynamicDatatableContent } from "@/app/(application)/clients/[id]/components/DynamicDatatableContent";

interface LeadAdditionalInfoProps {
  leadId: string;
}

interface Datatable {
  registeredTableName: string;
  applicationTableName?: string;
  entitySubType?: string;
}

export function LeadAdditionalInfo({ leadId }: LeadAdditionalInfoProps) {
  const [datatables, setDatatables] = useState<Datatable[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // First fetch lead details to get fineractClientId
        const leadResponse = await fetch(`/api/leads/${leadId}/complete-details`);
        if (!leadResponse.ok) {
          throw new Error("Failed to fetch lead details");
        }
        const leadData = await leadResponse.json();
        const fineractClientId =
          leadData?.lead?.fineractClientId || leadData?.fineractClient?.id;

        if (!fineractClientId) {
          setError("No Fineract client linked to this lead");
          setLoading(false);
          return;
        }

        setClientId(fineractClientId);

        // Fetch datatables for the client
        const datatableRes = await fetch(
          `/api/fineract/clients/${fineractClientId}/datatables`
        );
        if (datatableRes.ok) {
          const datatableData = await datatableRes.json();
          setDatatables(datatableData || []);
        }
      } catch (err) {
        console.error("Error fetching additional info:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leadId]);

  // Format table name for display
  const formatTableName = (name: string) => {
    return name
      .replace(/^m_|^dt_|^cd_/i, "") // Remove common prefixes
      .replace(/_/g, " ") // Replace underscores with spaces
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Get a short label for the tab
  const getTabLabel = (name: string) => {
    const formatted = formatTableName(name);
    // If name is too long, truncate with ellipsis
    return formatted.length > 20 ? formatted.substring(0, 17) + "..." : formatted;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading additional information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (datatables.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No additional data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Additional Information
        </CardTitle>
        <CardDescription>
          Extended client data from Fineract system ({datatables.length} tables)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={datatables[0]?.registeredTableName} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {datatables.map((dt) => (
              <TabsTrigger
                key={dt.registeredTableName}
                value={dt.registeredTableName}
                className="text-xs px-3 py-1.5 data-[state=active]:bg-background"
                title={formatTableName(dt.registeredTableName)}
              >
                {getTabLabel(dt.registeredTableName)}
              </TabsTrigger>
            ))}
          </TabsList>

          {datatables.map((dt) => (
            <TabsContent
              key={dt.registeredTableName}
              value={dt.registeredTableName}
              className="mt-4"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {formatTableName(dt.registeredTableName)}
                  </h4>
                </div>
                {clientId && (
                  <DynamicDatatableContent
                    datatableName={dt.registeredTableName}
                    clientId={clientId}
                  />
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
