"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play, Square } from "lucide-react";

interface PipelineStage {
  id: string;
  name: string;
  description?: string;
  order: number;
  color: string;
  isActive: boolean;
  isInitialState: boolean;
  isFinalState: boolean;
  allowedTransitions: string[];
}

interface Lead {
  id: string;
  currentStageId?: string;
  firstname?: string;
  lastname?: string;
  status: string;
}

interface PipelineStateMachineProps {
  lead: Lead;
  stages: PipelineStage[];
  onTransition?: (leadId: string, targetStageId: string) => Promise<void>;
  readonly?: boolean;
}

export function PipelineStateMachine({
  lead,
  stages,
  onTransition,
  readonly = false,
}: PipelineStateMachineProps) {
  const [availableTransitions, setAvailableTransitions] = useState<string[]>(
    []
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentStage = stages.find((stage) => stage.id === lead.currentStageId);
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (currentStage) {
      setAvailableTransitions(currentStage.allowedTransitions);
    }
  }, [currentStage]);

  const handleTransition = async (targetStageId: string) => {
    if (!onTransition || readonly) return;

    setIsTransitioning(true);
    try {
      await onTransition(lead.id, targetStageId);
    } catch (error) {
      console.error("Transition failed:", error);
    } finally {
      setIsTransitioning(false);
    }
  };

  const getStageStatus = (stage: PipelineStage) => {
    if (stage.id === lead.currentStageId) {
      return "current";
    }
    if (stage.order < (currentStage?.order || 0)) {
      return "completed";
    }
    return "pending";
  };

  const canTransitionTo = (stageId: string) => {
    return availableTransitions.includes(stageId);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Pipeline State Machine
          {lead.firstname && lead.lastname && (
            <span className="text-sm font-normal text-muted-foreground">
              - {lead.firstname} {lead.lastname}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Current State Display */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Current State:</span>
            {currentStage ? (
              <Badge
                style={{ backgroundColor: currentStage.color }}
                className="text-white"
              >
                {currentStage.name}
              </Badge>
            ) : (
              <Badge variant="secondary">No Stage</Badge>
            )}
          </div>

          {/* Pipeline Visualization */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Pipeline Flow</h4>
            <div className="flex flex-wrap gap-2 items-center">
              {sortedStages.map((stage, index) => {
                const status = getStageStatus(stage);
                const isTransitionTarget = canTransitionTo(stage.id);

                return (
                  <React.Fragment key={stage.id}>
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={`
                          relative px-3 py-2 rounded-lg border-2 transition-all
                          ${
                            status === "current"
                              ? "border-blue-500 bg-blue-50"
                              : status === "completed"
                              ? "border-green-500 bg-green-50"
                              : "border-gray-300 bg-gray-50"
                          }
                          ${
                            isTransitionTarget && !readonly
                              ? "ring-2 ring-orange-300 cursor-pointer hover:ring-orange-400"
                              : ""
                          }
                        `}
                        onClick={() =>
                          isTransitionTarget && !readonly
                            ? handleTransition(stage.id)
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="text-sm font-medium">
                            {stage.name}
                          </span>
                        </div>
                        {stage.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {stage.description}
                          </p>
                        )}
                        {status === "current" && (
                          <div className="absolute -top-1 -right-1">
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* Transition Button */}
                      {isTransitionTarget && !readonly && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTransition(stage.id)}
                          disabled={isTransitioning}
                          className="text-xs"
                        >
                          Move Here
                        </Button>
                      )}
                    </div>

                    {/* Arrow */}
                    {index < sortedStages.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Available Transitions */}
          {availableTransitions.length > 0 && !readonly && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Available Transitions</h4>
              <div className="flex flex-wrap gap-2">
                {availableTransitions.map((stageId) => {
                  const targetStage = stages.find((s) => s.id === stageId);
                  if (!targetStage) return null;

                  return (
                    <Button
                      key={stageId}
                      size="sm"
                      variant="outline"
                      onClick={() => handleTransition(stageId)}
                      disabled={isTransitioning}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: targetStage.color }}
                      />
                      {targetStage.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* State Machine Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Click on highlighted stages to transition</p>
            <p>• Transitions are governed by the configured state machine</p>
            <p>• Each transition is logged and auditable</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
