"use client";

import { Badge } from "@/components/ui/badge";
import {
  User,
  FileText,
  CheckCircle2,
  Clock,
  MessageSquare,
  CreditCard,
  Shield,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

interface LeadTimelineProps {
  leadId: string;
}

interface StateTransition {
  id: string;
  triggeredAt: string;
  fromStage?: {
    name: string;
    description?: string;
  };
  toStage: {
    name: string;
    description?: string;
  };
}

interface LeadData {
  id: string;
  firstname?: string;
  lastname?: string;
  createdAt: string;
  currentStage?: {
    name: string;
    description?: string;
  };
  stateTransitions: StateTransition[];
  computed: {
    fullName: string;
    timeInCurrentStage: number;
    totalTime: number;
  };
}

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const fetchLeadData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/leads/${leadId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch lead data");
        }
        const data = await response.json();
        setLeadData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchLeadData();
  }, [leadId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !leadData) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-muted-foreground">
          {error || "Failed to load timeline data"}
        </p>
      </div>
    );
  }

  // Create timeline events from real data only
  const timelineEvents = [];

  // Lead creation event (always present)
  timelineEvents.push({
    id: "lead-created",
    type: "stage-change",
    title: "Lead Created",
    description: `Lead was created for ${
      leadData.computed.fullName || "Unknown Lead"
    }`,
    timestamp: new Date(leadData.createdAt).toLocaleString(),
    user: "System",
    icon: <User className="h-4 w-4 text-white" />,
    iconBg: "bg-blue-500",
  });

  // Add state transitions if they exist
  if (leadData.stateTransitions && leadData.stateTransitions.length > 0) {
    const transitions = leadData.stateTransitions
      .slice()
      .reverse() // Show oldest first
      .map((transition) => ({
        id: transition.id,
        type: "stage-change",
        title: transition.fromStage
          ? `Moved to ${transition.toStage.name}`
          : `Initial Stage: ${transition.toStage.name}`,
        description: transition.fromStage
          ? `Transitioned from ${transition.fromStage.name} to ${transition.toStage.name}`
          : `Lead assigned to ${transition.toStage.name} stage`,
        timestamp: new Date(transition.triggeredAt).toLocaleString(),
        user: "System",
        icon: <ArrowRight className="h-4 w-4 text-white" />,
        iconBg: "bg-green-500",
      }));

    timelineEvents.push(...transitions);
  }

  // Current stage indicator (only if current stage exists)
  if (leadData.currentStage) {
    timelineEvents.push({
      id: "current-stage",
      type: "current",
      title: `Currently in ${leadData.currentStage.name}`,
      description: `Lead has been in this stage for ${leadData.computed.timeInCurrentStage} day(s). Total time in pipeline: ${leadData.computed.totalTime} day(s).`,
      timestamp: "Current Stage",
      user: "Active",
      icon: <Clock className="h-4 w-4 text-white" />,
      iconBg: "bg-blue-500",
    });
  }

  return (
    <div className="relative space-y-6 py-2">
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-border via-border to-transparent"></div>

      {/* Timeline events */}
      {timelineEvents.map((event, index) => (
        <div key={event.id} className="relative flex gap-4">
          <div
            className={`${event.iconBg} h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 shadow-lg ring-4 ring-background transition-transform hover:scale-105`}
          >
            {event.icon}
          </div>
          <div
            className={`flex-1 rounded-lg border transition-colors ${
              event.type === "current"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-sm"
                : "border-border bg-card hover:bg-accent/50 shadow-sm"
            } p-4`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-foreground">
                    {event.title}
                  </h4>
                  {event.type === "stage-change" && (
                    <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 text-xs shadow-sm">
                      Stage Change
                    </Badge>
                  )}
                  {event.type === "alert" && (
                    <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-0 text-xs shadow-sm">
                      Alert
                    </Badge>
                  )}
                  {event.type === "current" && (
                    <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 text-xs shadow-sm animate-pulse">
                      Current
                    </Badge>
                  )}
                  {event.type === "note" && (
                    <Badge className="bg-purple-500 hover:bg-purple-600 text-white border-0 text-xs shadow-sm">
                      Note
                    </Badge>
                  )}
                  {event.type === "document" && (
                    <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white border-0 text-xs shadow-sm">
                      Document
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {event.description}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-xs text-muted-foreground">
                  {event.timestamp}
                </span>
                <span className="text-xs text-muted-foreground">
                  {event.user}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
