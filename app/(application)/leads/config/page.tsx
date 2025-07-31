"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PipelineConfig } from "./components/piplene-config";
import { TeamConfig } from "./components/team-config";
import { SLAConfig } from "./components/sla-config";
import { FieldConfig } from "./components/field-config";
import { ValidationConfig } from "./components/validation-config";
import { AffordabilityConfig } from "./components/affordability-config";
import { NotificationConfig } from "./components/notification-config";
import { CreditScoringConfig } from "./components/credit-scoring-config";

export default function ConfigPage() {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    // In a real application, this would save to the backend
    try {
      // Simulate API call
      setTimeout(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }, 1000);
    } catch (err) {
      setError("Failed to save configuration. Please try again.");
      setTimeout(() => setError(null), 5000);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Lead Management Configuration
          </h1>
          <p className="text-muted-foreground">
            Configure your lead management process, teams, and notifications
          </p>
        </div>
        <Button
          onClick={handleSave}
          className="gap-2 bg-blue-500 hover:bg-blue-600"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved" : "Save Configuration"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert className="border-green-500 bg-green-500/10 text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Configuration saved successfully</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="grid grid-cols-8 w-full max-w-5xl">
          <TabsTrigger
            value="pipeline"
            className="data-[state=active]:bg-blue-500"
          >
            Pipeline Stages
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="data-[state=active]:bg-blue-500"
          >
            Teams
          </TabsTrigger>
          <TabsTrigger value="sla" className="data-[state=active]:bg-blue-500">
            SLA
          </TabsTrigger>
          <TabsTrigger
            value="fields"
            className="data-[state=active]:bg-blue-500"
          >
            Fields
          </TabsTrigger>
          <TabsTrigger
            value="validations"
            className="data-[state=active]:bg-blue-500"
          >
            Validations
          </TabsTrigger>
          <TabsTrigger
            value="affordability"
            className="data-[state=active]:bg-blue-500"
          >
            Affordability
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-blue-500"
          >
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="credit-scoring"
            className="data-[state=active]:bg-blue-500"
          >
            Credit Scoring
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Configuration</CardTitle>
              <CardDescription>
                Configure the stages in your lead management pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PipelineConfig />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <CardTitle>Team Configuration</CardTitle>
              <CardDescription>
                Configure the teams involved in your lead management process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TeamConfig />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="sla">
          <Card>
            <CardHeader>
              <CardTitle>SLA Configuration</CardTitle>
              <CardDescription>
                Configure Service Level Agreements for each stage in your
                pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SLAConfig />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>
                Configure custom fields for your lead management process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldConfig />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="validations">
          <Card>
            <CardHeader>
              <CardTitle>Validation Rules</CardTitle>
              <CardDescription>
                Configure automated validation rules for your pipeline stages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ValidationConfig />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="affordability">
          <Card>
            <CardHeader>
              <CardTitle>Affordability Models</CardTitle>
              <CardDescription>
                Configure affordability models for loan evaluation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AffordabilityConfig />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure notifications for your lead management process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationConfig />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="credit-scoring">
          <Card>
            <CardHeader>
              <CardTitle>Credit Scoring Configuration</CardTitle>
              <CardDescription>
                Configure scoring factors and weights for credit assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreditScoringConfig />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
