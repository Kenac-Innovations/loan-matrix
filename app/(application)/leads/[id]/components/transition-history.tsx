"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  ArrowRight,
  RefreshCw,
  User,
  Clock,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface TransitionHistoryItem {
  id: string;
  fromStage: string | null;
  toStage: string;
  event: string;
  triggeredBy: string;
  triggeredAt: string;
  metadata?: any;
}

interface TransitionHistoryProps {
  leadId: string;
}

export default function TransitionHistory({ leadId }: TransitionHistoryProps) {
  const [history, setHistory] = useState<TransitionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        setError("Failed to load transition history");
      }
    } catch (err) {
      console.error("Error fetching transition history:", err);
      setError("Failed to load transition history");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getEventBadgeColor = (event: string) => {
    if (!event) return "bg-gray-500";
    if (event.includes("AUTO")) return "bg-blue-500";
    if (event.includes("MANUAL")) return "bg-purple-500";
    if (event.includes("CDE")) return "bg-green-500";
    return "bg-gray-500";
  };

  const getEventLabel = (event: string) => {
    if (!event) return "Unknown";
    if (event.includes("CDE_AUTO_TRANSITION_APPROVED")) return "Auto-Approved";
    if (event.includes("CDE_AUTO_TRANSITION_DECLINED")) return "Auto-Rejected";
    if (event.includes("CDE_AUTO_TRANSITION")) return "Auto-Transition";
    if (event.includes("MANUAL_TRANSITION")) return "Manual";
    return event;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transition History
            </CardTitle>
            <CardDescription>
              Track of all stage transitions for this lead
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No transition history yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {history.map((item, index) => (
                <div
                  key={item.id}
                  className="relative border-l-2 border-muted pl-6 pb-4 last:pb-0"
                >
                  {/* Timeline dot */}
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-background border-2 border-primary" />

                  {/* Transition details */}
                  <div className="space-y-2">
                    {/* From/To stages */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.fromStage ? (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {item.fromStage}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Initial
                        </Badge>
                      )}
                      <Badge
                        variant="default"
                        className="text-xs bg-primary text-primary-foreground"
                      >
                        {item.toStage}
                      </Badge>
                      <Badge
                        className={`${getEventBadgeColor(
                          item.event
                        )} text-white text-xs`}
                      >
                        {getEventLabel(item.event)}
                      </Badge>
                    </div>

                    {/* Metadata */}
                    {item.metadata && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        {item.metadata.cdeDecision && (
                          <div>
                            CDE Decision:{" "}
                            <span className="font-medium">
                              {item.metadata.cdeDecision}
                            </span>
                          </div>
                        )}
                        {item.metadata.creditScore && (
                          <div>
                            Credit Score:{" "}
                            <span className="font-medium">
                              {item.metadata.creditScore}
                            </span>
                          </div>
                        )}
                        {item.metadata.reason && (
                          <div>
                            Reason:{" "}
                            <span className="font-medium">
                              {item.metadata.reason}
                            </span>
                          </div>
                        )}
                        {item.metadata.recommendation && (
                          <div className="italic">
                            {item.metadata.recommendation}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timestamp and user */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(item.triggeredAt), "PPp")}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.triggeredBy === "system" ? (
                          <span className="italic">System</span>
                        ) : (
                          <span>{item.triggeredBy}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
