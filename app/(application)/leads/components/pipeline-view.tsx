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

// Define the pipeline stages
const pipelineStages = [
  { id: "qualification", name: "Lead Qualification", color: "bg-blue-500" },
  { id: "documents", name: "Document Collection", color: "bg-purple-500" },
  { id: "assessment", name: "Credit Assessment", color: "bg-yellow-500" },
  { id: "approval", name: "Approval", color: "bg-green-500" },
  { id: "disbursement", name: "Disbursement", color: "bg-teal-500" },
];

// Sample lead data
const sampleLeads = [
  {
    id: "1001",
    client: "Robert Johnson",
    amount: "$125,000",
    type: "Business Loan",
    stage: "qualification",
    timeInStage: "1d 4h",
    sla: "2d",
    status: "normal", // normal, warning, overdue
    assignee: "JD",
    assigneeName: "John Doe",
    assigneeColor: "bg-blue-500",
  },
  {
    id: "1002",
    client: "Sarah Williams",
    amount: "$75,000",
    type: "Personal Loan",
    stage: "documents",
    timeInStage: "2d 6h",
    sla: "3d",
    status: "warning",
    assignee: "AS",
    assigneeName: "Alice Smith",
    assigneeColor: "bg-purple-500",
  },
  {
    id: "1003",
    client: "Michael Chen",
    amount: "$250,000",
    type: "Mortgage",
    stage: "assessment",
    timeInStage: "4d 2h",
    sla: "3d",
    status: "overdue",
    assignee: "RJ",
    assigneeName: "Robert Johnson",
    assigneeColor: "bg-yellow-500",
  },
  {
    id: "1004",
    client: "Emily Rodriguez",
    amount: "$180,000",
    type: "Business Loan",
    stage: "assessment",
    timeInStage: "1d 5h",
    sla: "3d",
    status: "normal",
    assignee: "RJ",
    assigneeName: "Robert Johnson",
    assigneeColor: "bg-yellow-500",
  },
  {
    id: "1005",
    client: "David Kim",
    amount: "$95,000",
    type: "Personal Loan",
    stage: "approval",
    timeInStage: "0d 8h",
    sla: "2d",
    status: "normal",
    assignee: "AD",
    assigneeName: "Alex Donovan",
    assigneeColor: "bg-green-500",
  },
  {
    id: "1006",
    client: "Jennifer Lee",
    amount: "$320,000",
    type: "Mortgage",
    stage: "disbursement",
    timeInStage: "0d 4h",
    sla: "1d",
    status: "normal",
    assignee: "MS",
    assigneeName: "Maria Santos",
    assigneeColor: "bg-teal-500",
  },
];

export function PipelineView() {
  const [filter, setFilter] = useState("all");

  // Get counts for each stage
  const stageCounts = pipelineStages.reduce((acc, stage) => {
    acc[stage.id] = sampleLeads.filter(
      (lead) => lead.stage === stage.id
    ).length;
    return acc;
  }, {} as Record<string, number>);

  // Get total count
  const totalLeads = sampleLeads.length;

  // Calculate percentages for the funnel visualization
  const stagePercentages = pipelineStages.map((stage) => {
    return {
      ...stage,
      count: stageCounts[stage.id],
      percentage: (stageCounts[stage.id] / totalLeads) * 100,
    };
  });

  // Filter leads based on selected filter
  const filteredLeads =
    filter === "all"
      ? sampleLeads
      : sampleLeads.filter((lead) => {
          if (filter === "overdue") return lead.status === "overdue";
          if (filter === "warning") return lead.status === "warning";
          return lead.stage === filter;
        });

  return (
    <div className="space-y-6">
      <Card className="border-[#1a2035] bg-[#0d121f] text-white">
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
          <CardDescription className="text-gray-400">
            Visualize your loan processing funnel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Funnel visualization */}
            <div className="space-y-3">
              {stagePercentages.map((stage, index) => (
                <div key={stage.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded-full ${stage.color}`}
                      ></div>
                      <span className="text-sm">{stage.name}</span>
                    </div>
                    <span className="text-sm">
                      {stage.count} leads ({Math.round(stage.percentage)}%)
                    </span>
                  </div>
                  <Progress
                    value={stage.percentage}
                    className="h-2 bg-[#1a2035]"
                    indicatorClassName={stage.color}
                  />
                </div>
              ))}
            </div>

            {/* Conversion metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#1a2035]">
              <div>
                <p className="text-xs text-gray-400">
                  Qualification → Documents
                </p>
                <p className="text-lg font-semibold text-white">85%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Documents → Assessment</p>
                <p className="text-lg font-semibold text-white">78%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Assessment → Approval</p>
                <p className="text-lg font-semibold text-white">65%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Approval → Disbursement</p>
                <p className="text-lg font-semibold text-white">95%</p>
              </div>
            </div>

            {/* Average TAT metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-[#1a2035]">
              {pipelineStages.map((stage) => (
                <div key={stage.id}>
                  <p className="text-xs text-gray-400">{stage.name} Avg. TAT</p>
                  <p className="text-lg font-semibold text-white">1.8d</p>
                  <p className="text-xs text-green-400">-0.2d vs SLA</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#1a2035] bg-[#0d121f] text-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pipeline Leads</CardTitle>
            <CardDescription className="text-gray-400">
              View and manage leads in your pipeline
            </CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] border-[#1a2035] bg-[#0a0e17]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <SelectValue placeholder="Filter leads" />
              </div>
            </SelectTrigger>
            <SelectContent className="border-[#1a2035] bg-[#0d121f] text-white">
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
                  className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border border-[#1a2035] bg-[#0a0e17] p-3 hover:bg-[#141b2d]"
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
                        <Badge
                          variant="outline"
                          className="border-[#1a2035] bg-[#1a2035] text-xs text-gray-300"
                        >
                          {lead.type}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {lead.amount}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-end">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span
                          className={`text-xs ${
                            lead.status === "overdue"
                              ? "text-red-400"
                              : lead.status === "warning"
                              ? "text-yellow-400"
                              : "text-gray-400"
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
                        className={`${
                          lead.stage === "qualification"
                            ? "bg-blue-500"
                            : lead.stage === "documents"
                            ? "bg-purple-500"
                            : lead.stage === "assessment"
                            ? "bg-yellow-500"
                            : lead.stage === "approval"
                            ? "bg-green-500"
                            : "bg-teal-500"
                        } text-white border-0 text-xs`}
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
                <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-gray-400">
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
