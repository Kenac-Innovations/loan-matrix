"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, FileText } from "lucide-react";
import type { UssdLoanApplication } from "@/shared/types/ussd";
import UssdLoanApplicationsTable from "@/components/tables/UssdLoanApplicationsTable";
import { UssdLinkedLeadsPanel } from "./ussd-linked-leads-panel";

interface UssdWorkspaceTabsProps {
  applications: UssdLoanApplication[];
  startDate?: string;
  endDate?: string;
}

export function UssdWorkspaceTabs({
  applications,
  startDate,
  endDate,
}: UssdWorkspaceTabsProps) {
  const [value, setValue] = useState("applications");

  return (
    <Tabs
      value={value}
      onValueChange={setValue}
      defaultValue="applications"
      className="mt-6"
    >
      <TabsList className="inline-flex max-w-full overflow-x-auto">
        <TabsTrigger
          value="applications"
          className="min-w-max data-[state=active]:bg-blue-500"
        >
          <Clock className="mr-2 h-4 w-4" />
          <span className="whitespace-nowrap">USSD Applications</span>
        </TabsTrigger>
        <TabsTrigger
          value="leads"
          className="min-w-max data-[state=active]:bg-blue-500"
        >
          <FileText className="mr-2 h-4 w-4" />
          <span className="whitespace-nowrap">USSD Leads</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="applications" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>USSD Applications</CardTitle>
            <CardDescription>
              Review incoming USSD applications before they are converted into leads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UssdLoanApplicationsTable
              ussdLoanApplications={applications}
              startDate={startDate}
              endDate={endDate}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="leads" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>USSD Leads</CardTitle>
            <CardDescription>
              Lead records created from USSD applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UssdLinkedLeadsPanel
              enabled={value === "leads"}
              startDate={startDate}
              endDate={endDate}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
