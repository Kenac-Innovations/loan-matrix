"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, ChevronRight, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import {
  PipelineFunnelChart,
  ConversionMetricsChart,
} from "@/components/charts";
import { LeadsData } from "@/app/actions/leads-actions";

interface PipelineViewProps {
  initialData: LeadsData;
}

export function PipelineView({ initialData }: PipelineViewProps) {
  const [filter, setFilter] = useState("all");
  const { leads, pipelineStages } = initialData;

  // Get counts for each stage
  const stageCounts = pipelineStages.reduce((acc, stage) => {
    acc[stage.id] = leads.filter((lead) => lead.stage === stage.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Get total count
  const totalLeads = leads.length;

  // Calculate percentages for the funnel visualization
  const stagePercentages = pipelineStages.map((stage) => {
    return {
      ...stage,
      count: stageCounts[stage.id],
      percentage:
        totalLeads > 0 ? (stageCounts[stage.id] / totalLeads) * 100 : 0,
    };
  });

  // Filter leads based on selected filter
  const filteredLeads =
    filter === "all"
      ? leads
      : leads.filter((lead) => {
          if (filter === "overdue") return lead.status === "overdue";
          if (filter === "warning") return lead.status === "warning";
          return lead.stage === filter;
        });

  // Convert stage color hex to CSS class for compatibility
  const getStageColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      "#3b82f6": "bg-blue-500",
      "#8b5cf6": "bg-purple-500",
      "#f59e0b": "bg-yellow-500",
      "#10b981": "bg-green-500",
      "#14b8a6": "bg-teal-500",
    };
    return colorMap[color] || "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
          <CardDescription>
            Visualize your loan processing funnel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Funnel visualization */}
            <div className="h-[250px]">
              <PipelineFunnelChart
                stageData={stagePercentages.map((stage) => {
                  return {
                    name: stage.name,
                    count: stage.count,
                    color: stage.color, // Use the hex color directly from the database
                  };
                })}
                className="h-full"
              />
            </div>

            {/* Conversion metrics */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Conversion Rates</h4>
              <div className="h-[150px]">
                <ConversionMetricsChart
                  data={initialData.metrics.conversionMetrics}
                  className="h-full"
                />
              </div>
            </div>

            {/* Average TAT metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t">
              {initialData.metrics.stageTATMetrics.map((stageMetric) => (
                <div key={stageMetric.stageId}>
                  <p className="text-xs text-muted-foreground">
                    {stageMetric.stageName} Avg. TAT
                  </p>
                  <p className="text-lg font-semibold">{stageMetric.avgTAT}d</p>
                  <p
                    className={`text-xs ${
                      stageMetric.variance <= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {stageMetric.variance > 0 ? "+" : ""}
                    {stageMetric.variance}d vs SLA
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pipeline Leads</CardTitle>
            <CardDescription>
              View and manage leads in your pipeline
            </CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Filter leads" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leads</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="warning">At Risk</SelectItem>
              {pipelineStages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name} Stage
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border p-3 hover:bg-accent/50"
                >
                  <div className="flex items-start gap-3 mb-3 sm:mb-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={`/diverse-group-avatars.png?height=40&width=40&query=avatar ${lead.client}`}
                        alt={lead.client}
                      />
                      <AvatarFallback>
                        {lead.client
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{lead.client}</p>
                        {lead.status === "overdue" && (
                          <Badge
                            variant="outline"
                            className="border-red-500 bg-red-500/10 text-red-400 text-xs"
                          >
                            Overdue
                          </Badge>
                        )}
                        {lead.status === "warning" && (
                          <Badge
                            variant="outline"
                            className="border-yellow-500 bg-yellow-500/10 text-yellow-400 text-xs"
                          >
                            At Risk
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {lead.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {lead.amount}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-end">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span
                          className={`text-xs ${
                            lead.status === "overdue"
                              ? "text-red-400"
                              : lead.status === "warning"
                              ? "text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {lead.timeInStage} / {lead.sla}
                        </span>
                      </div>
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: lead.assigneeColor }}
                      >
                        <span className="text-xs font-medium text-white">
                          {lead.assignee}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className="text-white border-0 text-xs"
                        style={{
                          backgroundColor:
                            pipelineStages.find((s) => s.id === lead.stage)
                              ?.color || "#6B7280",
                        }}
                      >
                        {pipelineStages.find((s) => s.id === lead.stage)?.name}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <Link href={`/leads/${lead.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  No leads match your filter criteria
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
