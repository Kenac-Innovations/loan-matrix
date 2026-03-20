"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRightLeft,
  Loader2,
  CheckCircle,
  ArrowRight,
  Users,
  UserCircle,
  RotateCcw,
  BarChart3,
  Hand,
  UserCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface AvailableTransition {
  stageId: string;
  stageName: string;
  stageColor: string;
  stageDescription: string | null;
  isFinalState: boolean;
  receivingTeam: {
    id: string;
    name: string;
    assignmentStrategy: string;
    memberCount: number;
  } | null;
}

interface StateTransitionManagerProps {
  leadId: string;
  currentStage: string;
  currentStageColor?: string;
  onTransitionComplete?: () => void;
}

const strategyLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  round_robin: { label: "Round Robin", icon: <RotateCcw className="h-3 w-3" /> },
  least_loaded: { label: "Least Loaded", icon: <BarChart3 className="h-3 w-3" /> },
  manual: { label: "Manual Assignment", icon: <Hand className="h-3 w-3" /> },
  specific_member: { label: "Specific Member", icon: <UserCheck className="h-3 w-3" /> },
};

export default function StateTransitionManager({
  leadId,
  currentStage,
  currentStageColor,
  onTransitionComplete,
}: StateTransitionManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingTransitions, setFetchingTransitions] = useState(false);
  const [transitions, setTransitions] = useState<AvailableTransition[]>([]);
  const [selectedTransition, setSelectedTransition] = useState<AvailableTransition | null>(null);
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  const fetchAvailableTransitions = useCallback(async () => {
    setFetchingTransitions(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/transition`);
      if (response.ok) {
        const data = await response.json();
        setTransitions(data.transitions || []);
      }
    } catch (error) {
      console.error("Error fetching available transitions:", error);
    } finally {
      setFetchingTransitions(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (open) {
      fetchAvailableTransitions();
      setSelectedTransition(null);
      setReason("");
    }
  }, [open, fetchAvailableTransitions]);

  const handleTransition = async () => {
    if (!selectedTransition) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStageId: selectedTransition.stageId,
          reason: reason || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Stage Updated",
          description: result.message,
        });
        setOpen(false);
        router.refresh();
        onTransitionComplete?.();
      } else {
        toast({
          title: "Transition Failed",
          description: result.message || "Failed to move lead",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error transitioning lead:", error);
      toast({
        title: "Error",
        description: "Failed to move lead to next stage",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowRightLeft className="h-4 w-4 mr-2" />
          Move Stage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Move Lead to Next Stage</DialogTitle>
          <DialogDescription>
            Select a stage to move this lead to. The lead will be automatically assigned to the receiving team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Stage */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground shrink-0">From:</Label>
            <Badge
              variant="outline"
              className="font-medium"
              style={currentStageColor ? { borderColor: currentStageColor, color: currentStageColor } : undefined}
            >
              {currentStage}
            </Badge>
          </div>

          {/* Available Transitions */}
          {fetchingTransitions ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transitions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No transitions available from the current stage.
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm">Move to:</Label>
              <div className="grid gap-2">
                {transitions.map((t) => {
                  const isSelected = selectedTransition?.stageId === t.stageId;
                  const strategyInfo = t.receivingTeam
                    ? strategyLabels[t.receivingTeam.assignmentStrategy] || strategyLabels.round_robin
                    : null;

                  return (
                    <button
                      key={t.stageId}
                      type="button"
                      onClick={() => setSelectedTransition(t)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: t.stageColor }}
                            />
                            <span className="font-medium text-sm">{t.stageName}</span>
                            {t.isFinalState && (
                              <Badge variant="secondary" className="text-xs">
                                Final
                              </Badge>
                            )}
                          </div>
                          {t.stageDescription && (
                            <p className="text-xs text-muted-foreground mt-1 ml-5">
                              {t.stageDescription}
                            </p>
                          )}
                        </div>

                        {t.receivingTeam && (
                          <div className="shrink-0 text-right">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              <span>{t.receivingTeam.name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 justify-end">
                              {strategyInfo?.icon}
                              <span>{strategyInfo?.label}</span>
                              <span className="text-muted-foreground/60">
                                ({t.receivingTeam.memberCount})
                              </span>
                            </div>
                          </div>
                        )}

                        {!t.receivingTeam && (
                          <span className="text-xs text-muted-foreground/60 italic shrink-0">
                            No team assigned
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transition Preview */}
          {selectedTransition && (
            <div className="flex items-center gap-2 justify-center py-2 bg-muted/30 rounded-lg">
              <Badge variant="outline">{currentStage}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge
                variant="outline"
                style={{
                  borderColor: selectedTransition.stageColor,
                  color: selectedTransition.stageColor,
                }}
              >
                {selectedTransition.stageName}
              </Badge>
              {selectedTransition.receivingTeam && (
                <>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserCircle className="h-3 w-3" />
                    {selectedTransition.receivingTeam.name}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="transition-reason">
              Note <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="transition-reason"
              placeholder="Add a note about this transition..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleTransition}
            disabled={loading || !selectedTransition}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
