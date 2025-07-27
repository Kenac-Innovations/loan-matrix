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
} from "lucide-react";

interface LeadTimelineProps {
  leadId: string;
}

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  // This would normally be fetched from an API
  const timelineEvents = [
    {
      id: "1",
      type: "stage-change",
      title: "Lead Created",
      description: "Lead was created and assigned to John Doe",
      timestamp: "May 5, 2025 - 09:15 AM",
      user: "Alex Donovan",
      icon: <User className="h-4 w-4 text-white" />,
      iconBg: "bg-blue-500",
    },
    {
      id: "2",
      type: "note",
      title: "Initial Contact",
      description:
        "Called client to discuss loan requirements and explain the process",
      timestamp: "May 5, 2025 - 10:30 AM",
      user: "John Doe",
      icon: <MessageSquare className="h-4 w-4 text-white" />,
      iconBg: "bg-purple-500",
    },
    {
      id: "3",
      type: "stage-change",
      title: "Moved to Document Collection",
      description: "Lead qualified and moved to document collection stage",
      timestamp: "May 6, 2025 - 02:45 PM",
      user: "John Doe",
      icon: <CheckCircle2 className="h-4 w-4 text-white" />,
      iconBg: "bg-green-500",
    },
    {
      id: "4",
      type: "document",
      title: "Documents Requested",
      description: "Sent document checklist to client via email",
      timestamp: "May 6, 2025 - 03:15 PM",
      user: "Alice Smith",
      icon: <FileText className="h-4 w-4 text-white" />,
      iconBg: "bg-blue-500",
    },
    {
      id: "5",
      type: "document",
      title: "Documents Received",
      description: "Received ID proof, income statements, and bank statements",
      timestamp: "May 7, 2025 - 11:20 AM",
      user: "Alice Smith",
      icon: <FileText className="h-4 w-4 text-white" />,
      iconBg: "bg-blue-500",
    },
    {
      id: "6",
      type: "stage-change",
      title: "Moved to Credit Assessment",
      description: "All required documents received and verified",
      timestamp: "May 8, 2025 - 09:30 AM",
      user: "Alice Smith",
      icon: <CheckCircle2 className="h-4 w-4 text-white" />,
      iconBg: "bg-green-500",
    },
    {
      id: "7",
      type: "alert",
      title: "Credit Check Completed",
      description: "Credit score: 720 (Good). Debt-to-income ratio: 32%",
      timestamp: "May 9, 2025 - 02:10 PM",
      user: "Robert Johnson",
      icon: <CreditCard className="h-4 w-4 text-white" />,
      iconBg: "bg-yellow-500",
    },
    {
      id: "8",
      type: "note",
      title: "Risk Assessment Note",
      description:
        "Business has strong cash flow but limited operating history. Recommend additional collateral.",
      timestamp: "May 10, 2025 - 10:45 AM",
      user: "Robert Johnson",
      icon: <Shield className="h-4 w-4 text-white" />,
      iconBg: "bg-purple-500",
    },
    {
      id: "9",
      type: "current",
      title: "Awaiting Final Assessment",
      description:
        "Credit analyst performing final review before approval recommendation",
      timestamp: "Current Stage",
      user: "Robert Johnson",
      icon: <Clock className="h-4 w-4 text-white" />,
      iconBg: "bg-blue-500",
    },
  ];

  return (
    <div className="relative space-y-6 py-2">
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-px bg-border"></div>

      {/* Timeline events */}
      {timelineEvents.map((event, index) => (
        <div key={event.id} className="relative flex gap-4">
          <div
            className={`${event.iconBg} h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 z-10`}
          >
            {event.icon}
          </div>
          <div
            className={`flex-1 rounded-md border ${
              event.type === "current"
                ? "border-blue-500 bg-blue-500/10"
                : "border-border bg-card"
            } p-3`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-foreground">
                    {event.title}
                  </h4>
                  {event.type === "stage-change" && (
                    <Badge className="bg-green-500 text-white border-0 text-xs">
                      Stage Change
                    </Badge>
                  )}
                  {event.type === "alert" && (
                    <Badge className="bg-yellow-500 text-white border-0 text-xs">
                      Alert
                    </Badge>
                  )}
                  {event.type === "current" && (
                    <Badge className="bg-blue-500 text-white border-0 text-xs">
                      Current
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
