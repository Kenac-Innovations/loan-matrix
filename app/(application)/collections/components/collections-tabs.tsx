"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarCheck, FolderUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ExpectedPaymentsTab } from "./expected-payments-tab";
import { UploadsListTab } from "./uploads-list-tab";

interface TabConfig {
  id: string;
  label: string;
  activeBg: string;
  inactiveText: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    id: "expected",
    label: "Expected Payments",
    activeBg: "data-[state=active]:bg-blue-500 dark:data-[state=active]:bg-blue-600",
    inactiveText: "text-blue-700 dark:text-blue-400",
    icon: <CalendarCheck className="h-4 w-4" />,
  },
  {
    id: "uploads",
    label: "Bulk Repayment Uploads",
    activeBg: "data-[state=active]:bg-amber-500 dark:data-[state=active]:bg-amber-600",
    inactiveText: "text-amber-700 dark:text-amber-400",
    icon: <FolderUp className="h-4 w-4" />,
  },
];

export function CollectionsTabs() {
  const [activeTab, setActiveTab] = useState("expected");
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({
    expected: 0,
    uploads: 0,
  });

  const updateCount = useCallback((tabId: string, count: number) => {
    setTabCounts((prev) => {
      if (prev[tabId] === count) return prev;
      return { ...prev, [tabId]: count };
    });
  }, []);

  const onExpectedCountChange = useCallback((count: number) => updateCount("expected", count), [updateCount]);
  const onUploadsCountChange = useCallback((count: number) => updateCount("uploads", count), [updateCount]);

  return (
    <Card className="border dark:border-border">
      <CardHeader className="border-b dark:border-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Repayment Collections</CardTitle>
            <CardDescription>
              View expected payments and manage bulk repayment uploads
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4 h-auto bg-muted/50 dark:bg-muted/30 p-1 rounded-lg">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "py-3 px-4 rounded-md transition-all duration-200",
                  "data-[state=active]:text-white data-[state=active]:shadow-md",
                  "data-[state=inactive]:hover:bg-muted dark:data-[state=inactive]:hover:bg-muted/50",
                  tab.activeBg,
                  activeTab !== tab.id && tab.inactiveText
                )}
              >
                <div className="flex items-center gap-2">
                  {tab.icon}
                  <span className="font-medium">{tab.label}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-1 transition-colors min-w-[28px] justify-center",
                      activeTab === tab.id
                        ? "bg-white/25 text-white border-white/20"
                        : "bg-background dark:bg-background/50 text-foreground"
                    )}
                  >
                    {tabCounts[tab.id]}
                  </Badge>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="expected" className="mt-0">
            <ExpectedPaymentsTab onCountChange={onExpectedCountChange} />
          </TabsContent>

          <TabsContent value="uploads" className="mt-0">
            <UploadsListTab onCountChange={onUploadsCountChange} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
