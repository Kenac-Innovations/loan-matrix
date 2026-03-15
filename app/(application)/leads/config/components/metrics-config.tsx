"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";

interface MetricSettings {
  monthlyTarget: number;
  conversionTarget: number;
  processingTimeTarget: number;
}

export function MetricsConfig() {
  const [settings, setSettings] = useState<MetricSettings>({
    monthlyTarget: 50,
    conversionTarget: 75,
    processingTimeTarget: 10,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/tenants/settings");
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast.error("Failed to load metric settings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/tenants/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success("Metric targets saved successfully");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save metric settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Monthly Lead Target */}
        <div className="space-y-2">
          <Label htmlFor="monthlyTarget">Monthly Lead Target</Label>
          <Input
            id="monthlyTarget"
            type="number"
            min="0"
            value={settings.monthlyTarget}
            onChange={(e) =>
              setSettings({
                ...settings,
                monthlyTarget: parseInt(e.target.value) || 0,
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Target number of active leads per month
          </p>
        </div>

        {/* Conversion Target */}
        <div className="space-y-2">
          <Label htmlFor="conversionTarget">Conversion Target (%)</Label>
          <Input
            id="conversionTarget"
            type="number"
            min="0"
            max="100"
            value={settings.conversionTarget}
            onChange={(e) =>
              setSettings({
                ...settings,
                conversionTarget: parseInt(e.target.value) || 0,
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Target conversion rate percentage
          </p>
        </div>

        {/* Processing Time Target */}
        <div className="space-y-2">
          <Label htmlFor="processingTimeTarget">
            Processing Time Target (days)
          </Label>
          <Input
            id="processingTimeTarget"
            type="number"
            min="0"
            value={settings.processingTimeTarget}
            onChange={(e) =>
              setSettings({
                ...settings,
                processingTimeTarget: parseInt(e.target.value) || 0,
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Target average processing time in days
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-500 hover:bg-blue-600"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Metric Targets
        </Button>
      </div>
    </div>
  );
}
