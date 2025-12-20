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

        // Fetch datatables for clients (m_client app table)
        const datatableRes = await fetch(
          `/api/fineract/datatables?apptable=m_client`
        );
        if (datatableRes.ok) {
          const datatableData = await datatableRes.json();
          setDatatables(datatableData || []);
        } else {
          console.error("Failed to fetch datatables:", datatableRes.status);
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
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Vertical Tabs on the Left */}
      <Tabs
        defaultValue={datatables[0]?.registeredTableName}
        orientation="vertical"
        className="flex flex-col lg:flex-row w-full gap-4"
      >
        <TabsList className="flex lg:flex-col h-auto lg:w-56 shrink-0 bg-muted/50 p-1 gap-1 overflow-x-auto lg:overflow-x-visible">
          {datatables.map((dt) => (
            <TabsTrigger
              key={dt.registeredTableName}
              value={dt.registeredTableName}
              className="text-xs px-3 py-2 justify-start text-left data-[state=active]:bg-background whitespace-nowrap lg:whitespace-normal w-full"
              title={formatTableName(dt.registeredTableName)}
            >
              <Database className="h-3.5 w-3.5 mr-2 shrink-0" />
              <span className="truncate">{formatTableName(dt.registeredTableName)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content Card on the Right */}
        <div className="flex-1 min-w-0">
          {datatables.map((dt) => (
            <TabsContent
              key={dt.registeredTableName}
              value={dt.registeredTableName}
              className="mt-0"
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {formatTableName(dt.registeredTableName)}
                  </CardTitle>
                  <CardDescription>
                    Client data from Fineract system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {clientId && (
                    <DynamicDatatableContent
                      datatableName={dt.registeredTableName}
                      clientId={clientId}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
