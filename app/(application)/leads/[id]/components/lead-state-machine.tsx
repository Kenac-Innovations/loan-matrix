"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PipelineStateMachineWrapper } from "@/components/state-machine/pipeline-state-machine-wrapper";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";

interface LeadStateMachineProps {
  leadId: string;
}

interface Stage {
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

interface Lead {
  id: string;
  firstname?: string;
  lastname?: string;
  status: string;
  currentStage?: {
    id: string;
    name: string;
    description?: string;
  };
}

interface StateMachineData {
  lead: Lead;
  stages: Stage[];
}

export function LeadStateMachine({ leadId }: LeadStateMachineProps) {
  const [data, setData] = useState<StateMachineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStateMachineData = async () => {
      try {
        setLoading(true);

        // Fetch lead data
        const leadResponse = await fetch(`/api/leads/${leadId}`);
        if (!leadResponse.ok) {
          throw new Error("Failed to fetch lead data");
        }
        const leadData = await leadResponse.json();

        // Fetch pipeline stages - we'll need to create this API endpoint
        const stagesResponse = await fetch(`/api/leads/${leadId}/stages`);
        let stages: Stage[] = [];

        if (stagesResponse.ok) {
          const stagesData = await stagesResponse.json();
          stages = stagesData.stages || [];
        }

        setData({
          lead: leadData,
          stages: stages,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchStateMachineData();
  }, [leadId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pipeline State Machine</CardTitle>
          <CardDescription>
            Interactive state machine showing lead progression through pipeline
            stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pipeline State Machine</CardTitle>
          <CardDescription>
            Interactive state machine showing lead progression through pipeline
            stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">
              {error || "Failed to load state machine data"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no stages are configured, show a message
  if (!data.stages || data.stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pipeline State Machine</CardTitle>
          <CardDescription>
            Interactive state machine showing lead progression through pipeline
            stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">
                No pipeline stages configured for this tenant.
              </p>
              <p className="text-sm text-muted-foreground">
                Please configure pipeline stages in the system settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline State Machine</CardTitle>
        <CardDescription>
          Interactive state machine showing lead progression through pipeline
          stages
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PipelineStateMachineWrapper
          lead={data.lead}
          stages={data.stages.map((stage) => ({
            ...stage,
            description: stage.description || "",
          }))}
        />
      </CardContent>
    </Card>
  );
}
