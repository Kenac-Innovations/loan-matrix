"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Plus,
  Trash2,
  Save,
  Upload,
  TrendingUp,
  AlertCircle,
  Calculator,
  Shield,
  Info,
} from "lucide-react";
import { ScoringFactor, defaultScoringFactors } from "@/types/credit-scoring";

export function CreditScoringConfig() {
  const [factors, setFactors] = useState<ScoringFactor[]>(defaultScoringFactors);
  const [newFactorName, setNewFactorName] = useState("");
  const [newFactorDescription, setNewFactorDescription] = useState("");

  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const isValidWeight = totalWeight === 100;

  const updateFactor = (id: string, updates: Partial<ScoringFactor>) => {
    setFactors(
      factors.map((factor) =>
        factor.id === id ? { ...factor, ...updates } : factor
      )
    );
  };

  const addFactor = () => {
    if (!newFactorName.trim()) return;

    const newFactor: ScoringFactor = {
      id: `factor-${Date.now()}`,
      name: newFactorName,
      weight: 0,
      minScore: 0,
      maxScore: 100,
      description: newFactorDescription,
    };

    setFactors([...factors, newFactor]);
    setNewFactorName("");
    setNewFactorDescription("");
  };

  const removeFactor = (id: string) => {
    setFactors(factors.filter((factor) => factor.id !== id));
  };

  const resetToDefault = () => {
    setFactors(defaultScoringFactors);
  };

  const saveConfiguration = () => {
    // TODO: Implement API call to save configuration
    console.log("Saving credit scoring configuration:", factors);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3 text-foreground">
            <Calculator className="w-8 h-8 text-primary" />
            Credit Scoring Configuration
          </h2>
          <p className="text-muted-foreground mt-2">
            Configure scoring factors and weights for credit assessment
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={resetToDefault}
                            className="border-2 border-border hover:bg-accent text-foreground"
          >
            <Upload className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
          <Button onClick={saveConfiguration} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Save className="w-4 h-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Weight Status Card */}
      <Card
        className={`border-2 ${
          isValidWeight
            ? "border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-700 dark:from-green-950/20 dark:to-emerald-950/20"
            : "border-red-300 bg-gradient-to-br from-red-50 to-rose-50 dark:border-red-700 dark:from-red-950/20 dark:to-rose-950/20"
        }`}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isValidWeight ? (
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <p className="font-bold text-lg text-foreground">
                  Weight Configuration Status
                </p>
                <p className="text-muted-foreground dark:text-muted-foreground">
                  {isValidWeight
                    ? "All weights properly configured"
                    : "Total weights must equal 100%"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-3xl font-bold ${
                  isValidWeight ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {totalWeight}%
              </div>
              <Progress value={totalWeight} className="w-32 mt-2 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Factors Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-foreground">
            Scoring Factors Management
          </CardTitle>
          <p className="text-muted-foreground">
            Define and adjust the factors used in credit scoring calculations
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {factors.map((factor) => (
            <div
              key={factor.id}
              className="p-6 border-2 border-border rounded-xl bg-gradient-to-br from-background to-muted/50 dark:from-card dark:to-muted/20 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg text-foreground">
                      {factor.name}
                    </h3>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground dark:text-muted-foreground text-sm">
                    {factor.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFactor(factor.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">
                    Weight: {factor.weight}%
                  </Label>
                  <Slider
                    value={[factor.weight]}
                    onValueChange={([value]) =>
                      updateFactor(factor.id, { weight: value })
                    }
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground dark:text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">
                    Minimum Score
                  </Label>
                  <Input
                    type="number"
                    value={factor.minScore}
                    onChange={(e) =>
                      updateFactor(factor.id, {
                        minScore: Number(e.target.value),
                      })
                    }
                    className="h-9 text-center border-border bg-background"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">
                    Maximum Score
                  </Label>
                  <Input
                    type="number"
                    value={factor.maxScore}
                    onChange={(e) =>
                      updateFactor(factor.id, {
                        maxScore: Number(e.target.value),
                      })
                    }
                    className="h-9 text-center border-border bg-background"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add New Factor */}
          <Card className="border-dashed border-2 border-muted-foreground/30 dark:border-muted-foreground/20 bg-gradient-to-br from-muted/30 to-muted/50 dark:from-muted/20 dark:to-muted/30">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                  <Plus className="w-5 h-5 text-primary" />
                  Add New Scoring Factor
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                      Factor Name
                    </Label>
                    <Input
                      placeholder="e.g., Credit Utilization Ratio"
                      value={newFactorName}
                      onChange={(e) => setNewFactorName(e.target.value)}
                      className="h-9 border-border bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                      Description
                    </Label>
                    <Textarea
                      placeholder="Brief description of the scoring factor"
                      value={newFactorDescription}
                      onChange={(e) => setNewFactorDescription(e.target.value)}
                      className="h-9 resize-none border-border bg-background"
                    />
                  </div>
                </div>
                <Button
                  onClick={addFactor}
                  disabled={!newFactorName.trim()}
                  className="bg-primary hover:bg-primary/90 h-9 text-primary-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Scoring Factor
                </Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Scoring Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Scoring Thresholds
          </CardTitle>
          <p className="text-muted-foreground">
            Configure score ranges for risk levels and recommendations
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Low Risk Threshold</Label>
                              <Input
                  type="number"
                  defaultValue={700}
                  className="h-9 border-border bg-background"
                  placeholder="700"
                />
                                <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    Score ≥ this value = Low Risk
                  </p>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Medium Risk Threshold</Label>
                              <Input
                  type="number"
                  defaultValue={500}
                  className="h-9 border-border bg-background"
                  placeholder="500"
                />
                                <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    Score ≥ this value = Medium Risk
                  </p>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">High Risk Threshold</Label>
                              <Input
                  type="number"
                  defaultValue={0}
                  className="h-9 border-border bg-background"
                  placeholder="0"
                />
                                               <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    Score &lt; Medium threshold = High Risk
                  </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 