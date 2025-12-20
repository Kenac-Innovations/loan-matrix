"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, AlertCircle } from "lucide-react";
import { DatatableDisplay } from "./datatable-display";

interface LeadAdditionalInfoProps {
  leadId: string;
  clientId: number | null;
  datatables: any[];
  datatableData: Record<string, any>;
}

export function LeadAdditionalInfo({
  leadId,
  clientId,
  datatables,
  datatableData,
}: LeadAdditionalInfoProps) {
  // Format table name for display
  const formatTableName = (name: string) => {
    let formatted = name
      .replace(/^m_|^dt_|^cd_/i, "") // Remove common prefixes
      .replace(/_/g, " ") // Replace underscores with spaces
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    // Handle duplicated patterns like "bank branch code cd bank branch code"
    const duplicateMatch = formatted.match(/^(.+?)\s+cd[\s-]+\1$/i);
    if (duplicateMatch && duplicateMatch[1]) {
      return duplicateMatch[1].trim();
    }

    // Pattern: "Text cd text" -> extract first part
    const cdMatch = formatted.match(/^(.+?)\s+cd[\s-]+/i);
    if (cdMatch && cdMatch[1]) {
      return cdMatch[1].trim();
    }

    return formatted;
  };

  if (!clientId) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <p className="text-muted-foreground">No Fineract client linked to this lead</p>
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
                  <DatatableDisplay
                    datatableName={dt.registeredTableName}
                    clientId={clientId}
                    initialData={datatableData[dt.registeredTableName]}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
