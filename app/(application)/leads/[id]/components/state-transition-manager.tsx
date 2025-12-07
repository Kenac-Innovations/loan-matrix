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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  GitBranch,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

interface AvailableStage {
  id: string;
  name: string;
  description?: string;
  color: string;
  requiresApproval: boolean;
}

interface StateTransitionManagerProps {
  leadId: string;
  currentStage: string;
  onTransitionComplete?: () => void;
}

export default function StateTransitionManager({
  leadId,
  currentStage,
  onTransitionComplete,
}: StateTransitionManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availableStages, setAvailableStages] = useState<AvailableStage[]>([]);
  const [selectedStage, setSelectedStage] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const fetchAvailableTransitions = useCallback(async () => {
    try {
      const response = await fetch(`/api/leads/${leadId}/transition`);
      if (response.ok) {
        const data = await response.json();
        setAvailableStages(data.stages || []);
      }
    } catch (error) {
      console.error("Error fetching available transitions:", error);
    }
  }, [leadId]);

  useEffect(() => {
    if (open) {
      fetchAvailableTransitions();
    }
  }, [open, fetchAvailableTransitions]);

  const handleTransition = async () => {
    if (!selectedStage) {
      toast({
        title: "Error",
        description: "Please select a target stage",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/leads/${leadId}/transition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetStageName: selectedStage,
          reason: reason || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        setOpen(false);
        setSelectedStage("");
        setReason("");
        if (onTransitionComplete) {
          onTransitionComplete();
        }
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to transition lead",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error transitioning lead:", error);
      toast({
        title: "Error",
        description: "Failed to transition lead",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedStageInfo = availableStages.find(
    (stage) => stage.name === selectedStage
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitBranch className="h-4 w-4 mr-2" />
          Change Stage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transition Lead Stage</DialogTitle>
          <DialogDescription>
            Move this lead to a different stage in the workflow
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Stage */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">
              Current Stage:
            </Label>
            <Badge variant="outline">{currentStage}</Badge>
          </div>

          {/* Target Stage Selection */}
          <div className="space-y-2">
            <Label htmlFor="targetStage">Target Stage</Label>
            {availableStages.length > 0 ? (
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger id="targetStage">
                  <SelectValue placeholder="Select target stage" />
                </SelectTrigger>
                <SelectContent>
                  {availableStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.name}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                        {stage.requiresApproval && (
                          <AlertCircle className="h-3 w-3 text-amber-500 ml-1" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No transitions available from current stage
              </p>
            )}

            {selectedStageInfo?.description && (
              <p className="text-xs text-muted-foreground">
                {selectedStageInfo.description}
              </p>
            )}

            {selectedStageInfo?.requiresApproval && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs">
                <AlertCircle className="h-3 w-3 text-amber-600" />
                <span className="text-amber-700 dark:text-amber-400">
                  This stage requires management approval
                </span>
              </div>
            )}
          </div>

          {/* Transition Arrow */}
          {selectedStage && (
            <div className="flex items-center gap-2 justify-center py-2">
              <Badge variant="outline">{currentStage}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge
                variant="outline"
                style={{
                  borderColor: selectedStageInfo?.color,
                  color: selectedStageInfo?.color,
                }}
              >
                {selectedStage}
              </Badge>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Provide a reason for this transition..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleTransition}
            disabled={loading || !selectedStage}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transitioning...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm Transition
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
