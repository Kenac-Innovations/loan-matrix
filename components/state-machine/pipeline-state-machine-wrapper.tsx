"use client";

import { PipelineStateMachine } from "./pipeline-state-machine";

interface Lead {
  id: string;
  firstname?: string;
  lastname?: string;
  emailAddress?: string;
  status: string;
  currentStageId?: string;
}

interface PipelineStage {
  id: string;
  name: string;
  description: string;
  order: number;
  color: string;
  isActive: boolean;
  isInitialState: boolean;
  isFinalState: boolean;
  allowedTransitions: string[];
}

interface PipelineStateMachineWrapperProps {
  lead: any;
  stages: any[];
}

export function PipelineStateMachineWrapper({
  lead,
  stages,
}: PipelineStateMachineWrapperProps) {
  const handleTransition = async (leadId: string, targetStageId: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/transitions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetStageId,
          triggeredBy: "current-user", // This should come from auth context
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to transition lead");
      }

      const result = await response.json();
      console.log("Transition successful:", result);

      // Refresh the page to show updated state
      window.location.reload();
    } catch (error) {
      console.error("Error transitioning lead:", error);
      alert("Failed to transition lead. Please try again.");
    }
  };

  return (
    <PipelineStateMachine
      lead={lead}
      stages={stages}
      onTransition={handleTransition}
    />
  );
}
