"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadDashboard } from "./upload-dashboard";
import { StagingTab } from "./staging-tab";
import { QueuedTab } from "./queued-tab";
import { SuccessfulTab } from "./successful-tab";
import { FailedTab } from "./failed-tab";

interface TabConfig {
  id: string;
  label: string;
  activeBg: string;
  inactiveText: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    id: "staging",
    label: "Staging",
    activeBg: "data-[state=active]:bg-amber-500 dark:data-[state=active]:bg-amber-600",
    inactiveText: "text-amber-700 dark:text-amber-400",
    icon: <FileSpreadsheet className="h-4 w-4" />,
  },
  {
    id: "queued",
    label: "Queued",
    activeBg: "data-[state=active]:bg-purple-500 dark:data-[state=active]:bg-purple-600",
    inactiveText: "text-purple-700 dark:text-purple-400",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: "successful",
    label: "Successful",
    activeBg: "data-[state=active]:bg-green-500 dark:data-[state=active]:bg-green-600",
    inactiveText: "text-green-700 dark:text-green-400",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    id: "failed",
    label: "Failed",
    activeBg: "data-[state=active]:bg-red-500 dark:data-[state=active]:bg-red-600",
    inactiveText: "text-red-700 dark:text-red-400",
    icon: <XCircle className="h-4 w-4" />,
  },
];

interface UploadDetailTabsProps {
  uploadId: string;
}

export function UploadDetailTabs({ uploadId }: UploadDetailTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("staging");
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({
    staging: 0,
    queued: 0,
    successful: 0,
    failed: 0,
  });

  const updateCount = useCallback((tabId: string, count: number) => {
    setTabCounts((prev) => {
      if (prev[tabId] === count) return prev;
      return { ...prev, [tabId]: count };
    });
  }, []);

  const onStagingCountChange = useCallback((count: number) => updateCount("staging", count), [updateCount]);
  const onQueuedCountChange = useCallback((count: number) => updateCount("queued", count), [updateCount]);
  const onSuccessCountChange = useCallback((count: number) => updateCount("successful", count), [updateCount]);
  const onFailedCountChange = useCallback((count: number) => updateCount("failed", count), [updateCount]);
  const onProcessed = useCallback(() => setActiveTab("queued"), []);

  return (
    <Card className="border dark:border-border">
      <CardHeader className="border-b dark:border-border">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/collections")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle>Upload Details</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <UploadDashboard uploadId={uploadId} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4 h-auto bg-muted/50 dark:bg-muted/30 p-1 rounded-lg">
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
                  <span className="font-medium hidden sm:inline">{tab.label}</span>
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

          <TabsContent value="staging" className="mt-0">
            <StagingTab
              selectedUploadId={uploadId}
              onCountChange={onStagingCountChange}
              onProcessed={onProcessed}
            />
          </TabsContent>

          <TabsContent value="queued" className="mt-0">
            <QueuedTab
              selectedUploadId={uploadId}
              onCountChange={onQueuedCountChange}
            />
          </TabsContent>

          <TabsContent value="successful" className="mt-0">
            <SuccessfulTab
              selectedUploadId={uploadId}
              onCountChange={onSuccessCountChange}
            />
          </TabsContent>

          <TabsContent value="failed" className="mt-0">
            <FailedTab
              selectedUploadId={uploadId}
              onCountChange={onFailedCountChange}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
