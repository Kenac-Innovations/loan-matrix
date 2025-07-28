"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ShieldCheck, ArrowRight, Users, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface LeadSidebarProps {
  leadId: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: "completed" | "in_progress" | "pending";
  initials: string;
  color: string;
}

interface ValidationResult {
  name: string;
  status: "passed" | "failed" | "warning";
}

interface StageTime {
  stageName: string;
  timeSpent: number; // in hours
  slaHours: number;
  status: "completed" | "in_progress" | "pending";
}

interface SidebarData {
  currentStage: string;
  timeInCurrentStage: number; // in hours
  totalTime: number; // in hours
  currentStageSLA: number; // in hours
  teamMembers: TeamMember[];
  validations: ValidationResult[];
  stageTimes: StageTime[];
}

export function LeadSidebar({ leadId }: LeadSidebarProps) {
  const [data, setData] = useState<SidebarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/leads/${leadId}/sidebar`);
        if (!response.ok) {
          throw new Error("Failed to fetch sidebar data");
        }
        const sidebarData = await response.json();
        setData(sidebarData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchSidebarData();
  }, [leadId]);

  const formatTime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${remainingHours}h`;
  };

  const getSLAStatus = (timeSpent: number, slaHours: number) => {
    const percentage = (timeSpent / slaHours) * 100;
    if (percentage <= 70) return "text-green-400";
    if (percentage <= 90) return "text-yellow-400";
    return "text-red-400";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground text-sm">
                {error || "Failed to load sidebar data"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Turn-Around Time Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Turn-Around Time
          </CardTitle>
          <Clock className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium">Current Stage</span>
                <span className="text-xs font-medium text-blue-400">
                  {data.currentStage}
                </span>
              </div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium">Time in Stage</span>
                <span
                  className={`text-xs font-medium ${getSLAStatus(
                    data.timeInCurrentStage,
                    data.currentStageSLA
                  )}`}
                >
                  {formatTime(data.timeInCurrentStage)} (SLA:{" "}
                  {formatTime(data.currentStageSLA)})
                </span>
              </div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium">Total Time</span>
                <span className="text-xs font-medium text-green-400">
                  {formatTime(data.totalTime)}
                </span>
              </div>
            </div>
            {data.stageTimes.length > 0 && (
              <div className="pt-2 border-t">
                <h4 className="text-xs font-semibold mb-2">
                  Stage TAT Performance
                </h4>
                <div className="space-y-3">
                  {data.stageTimes.map((stage, index) => (
                    <div key={index}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs">{stage.stageName}</span>
                        <span
                          className={`text-xs ${
                            stage.status === "completed"
                              ? getSLAStatus(stage.timeSpent, stage.slaHours)
                              : stage.status === "in_progress"
                              ? getSLAStatus(stage.timeSpent, stage.slaHours)
                              : "text-muted-foreground"
                          }`}
                        >
                          {stage.status === "pending"
                            ? "Pending"
                            : `${formatTime(
                                stage.timeSpent
                              )} (SLA: ${formatTime(stage.slaHours)})`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Validation Summary
          </CardTitle>
          <ShieldCheck className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.validations.length > 0 ? (
              <>
                {data.validations.map((validation, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs">{validation.name}</span>
                    <Badge
                      className={`${
                        validation.status === "passed"
                          ? "bg-green-500 text-white"
                          : validation.status === "failed"
                          ? "bg-red-500 text-white"
                          : "bg-yellow-500 text-white"
                      }`}
                    >
                      {validation.status === "passed"
                        ? "Passed"
                        : validation.status === "failed"
                        ? "Failed"
                        : "Warning"}
                    </Badge>
                  </div>
                ))}
                <div className="pt-3 mt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-blue-400"
                    asChild
                  >
                    <Link href={`/leads/${leadId}?tab=validations`}>
                      View All Validations
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  No validations configured
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assigned Team Members Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Assigned Team Members</CardTitle>
          <Users className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.teamMembers.length > 0 ? (
              data.teamMembers.map((member, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-full ${member.color} flex items-center justify-center`}
                    >
                      <span className="text-xs font-medium text-white">
                        {member.initials}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`${
                      member.status === "completed"
                        ? "border-green-500 bg-green-500/10 text-green-400"
                        : member.status === "in_progress"
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                        : "border-gray-500 bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {member.status === "completed"
                      ? "Completed"
                      : member.status === "in_progress"
                      ? "In Progress"
                      : "Pending"}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  No team members assigned
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
