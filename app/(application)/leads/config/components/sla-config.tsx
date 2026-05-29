"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  Plus,
  Pencil,
  Clock,
  AlertTriangle,
  Loader2,
  Save,
} from "lucide-react";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  defaultTimeUnits,
  type SLALevel,
  type StageSLA,
} from "@/shared/defaults/sla-config";
import { toast } from "sonner";

interface PipelineStage {
  id: string;
  name: string;
}

export function SLAConfig() {
  const [stageSLAs, setStageSLAs] = useState<StageSLA[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSLA, setEditingSLA] = useState<StageSLA | null>(null);

  const [newLevelName, setNewLevelName] = useState("");
  const [newLevelTimeframe, setNewLevelTimeframe] = useState(4);
  const [newLevelTimeUnit, setNewLevelTimeUnit] = useState<"minutes" | "hours" | "days">("hours");
  const [newLevelEscalation, setNewLevelEscalation] = useState(true);
  const [newLevelNotifyTeam, setNewLevelNotifyTeam] = useState(true);
  const [newLevelNotifyManager, setNewLevelNotifyManager] = useState(false);

  useEffect(() => {
    fetchSLAConfigs();
  }, []);

  const fetchSLAConfigs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/pipeline/sla");
      if (response.ok) {
        const data = await response.json();
        setStageSLAs(data.stageSLAs || []);
        if (data.stages) setPipelineStages(data.stages);
      } else {
        setStageSLAs([]);
      }
    } catch (error) {
      console.error("Error fetching SLA configs:", error);
      setStageSLAs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSLAConfigs = async () => {
    try {
      setIsSaving(true);
      const response = await fetch("/api/pipeline/sla", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageSLAs }),
      });

      if (response.ok) {
        toast.success("SLA configurations saved successfully");
        setHasChanges(false);
        await fetchSLAConfigs();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save SLA configs");
      }
    } catch (error) {
      console.error("Error saving SLA configs:", error);
      toast.error("Error saving SLA configs");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (sla: StageSLA) => {
    setEditingSLA(structuredClone(sla));
    resetNewLevelForm();
    setModalOpen(true);
  };

  const resetNewLevelForm = () => {
    setNewLevelName("");
    setNewLevelTimeframe(4);
    setNewLevelTimeUnit("hours");
    setNewLevelEscalation(true);
    setNewLevelNotifyTeam(true);
    setNewLevelNotifyManager(false);
  };

  const handleAddStageSLA = () => {
    const stagesWithSLA = new Set(stageSLAs.map((sla) => sla.stageName));
    const availableStages = pipelineStages.filter(
      (stage) => !stagesWithSLA.has(stage.name)
    );
    if (availableStages.length === 0) {
      toast.info("All stages already have SLA configurations");
      return;
    }

    const newStageSLA: StageSLA = {
      id: `new-${Date.now()}`,
      stageName: availableStages[0].name,
      description: `SLA for ${availableStages[0].name} stage`,
      slaLevels: [],
    };

    setStageSLAs([...stageSLAs, newStageSLA]);
    setEditingSLA(newStageSLA);
    resetNewLevelForm();
    setModalOpen(true);
    setHasChanges(true);
  };

  const handleDeleteStageSLA = (slaId: string) => {
    setStageSLAs(stageSLAs.filter((sla) => sla.id !== slaId));
    setHasChanges(true);
  };

  const handleSaveModal = () => {
    if (!editingSLA) return;
    setStageSLAs(
      stageSLAs.map((sla) => (sla.id === editingSLA.id ? editingSLA : sla))
    );
    setHasChanges(true);
    setModalOpen(false);
    toast.info("SLA updated — click Save Changes to persist");
  };

  const handleAddLevel = () => {
    if (!editingSLA || !newLevelName.trim()) return;

    const level: SLALevel = {
      id: `new-${Date.now()}`,
      name: newLevelName,
      timeframe: newLevelTimeframe,
      timeUnit: newLevelTimeUnit,
      escalation: newLevelEscalation,
      notifyTeam: newLevelNotifyTeam,
      notifyManager: newLevelNotifyManager,
      color: "#3b82f6",
    };

    setEditingSLA({
      ...editingSLA,
      slaLevels: [...editingSLA.slaLevels, level],
    });
    resetNewLevelForm();
  };

  const handleDeleteLevel = (levelId: string) => {
    if (!editingSLA) return;
    setEditingSLA({
      ...editingSLA,
      slaLevels: editingSLA.slaLevels.filter((l) => l.id !== levelId),
    });
  };

  const handleUpdateLevelField = (levelId: string, field: string, value: any) => {
    if (!editingSLA) return;
    setEditingSLA({
      ...editingSLA,
      slaLevels: editingSLA.slaLevels.map((l) =>
        l.id === levelId ? { ...l, [field]: value } : l
      ),
    });
  };

  const getSliderMax = (unit: string) => {
    if (unit === "minutes") return 60;
    if (unit === "hours") return 72;
    return 30;
  };

  const getTimeUnitLabel = (unit: string, value: number) => {
    if (unit === "minutes") return value === 1 ? "minute" : "minutes";
    if (unit === "hours") return value === 1 ? "hour" : "hours";
    if (unit === "days") return value === 1 ? "day" : "days";
    return unit;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-end gap-2">
          <Button onClick={handleAddStageSLA} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Stage SLA
          </Button>
          {hasChanges && (
            <Button
              onClick={saveSLAConfigs}
              disabled={isSaving}
              className="bg-green-500 hover:bg-green-600"
              size="sm"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Changes
            </Button>
          )}
        </div>

        {stageSLAs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No SLA configurations yet.</p>
            <p className="text-sm mt-1">Add SLA rules for your pipeline stages.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stageSLAs.map((sla) => (
              <div
                key={sla.id}
                className="flex items-start gap-3 p-4 rounded-lg border bg-card transition-colors hover:bg-muted/30"
              >
                <Clock className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{sla.stageName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {sla.slaLevels.length} level{sla.slaLevels.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{sla.description}</p>

                  {sla.slaLevels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sla.slaLevels.map((level) => (
                        <Badge key={level.id} variant="outline" className="text-xs">
                          {level.name}: {level.timeframe} {getTimeUnitLabel(level.timeUnit, level.timeframe)}
                          {level.escalation && (
                            <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditModal(sla)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteStageSLA(sla.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit SLA Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit SLA — {editingSLA?.stageName}
            </DialogTitle>
            <DialogDescription>
              Configure SLA levels and escalation rules for this stage.
            </DialogDescription>
          </DialogHeader>

          {editingSLA && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingSLA.description}
                  onChange={(e) =>
                    setEditingSLA({ ...editingSLA, description: e.target.value })
                  }
                  placeholder="SLA description"
                />
              </div>

              {/* Existing SLA Levels */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">SLA Levels</h4>

                {editingSLA.slaLevels.length > 0 ? (
                  <div className="space-y-3">
                    {editingSLA.slaLevels.map((level) => (
                      <div key={level.id} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <Input
                            className="font-medium text-sm w-48"
                            value={level.name}
                            onChange={(e) =>
                              handleUpdateLevelField(level.id, "name", e.target.value)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteLevel(level.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Slider
                              value={[level.timeframe]}
                              min={1}
                              max={getSliderMax(level.timeUnit)}
                              step={1}
                              onValueChange={(v) =>
                                handleUpdateLevelField(level.id, "timeframe", v[0])
                              }
                            />
                          </div>
                          <Input
                            type="number"
                            className="w-16"
                            value={level.timeframe}
                            min={1}
                            onChange={(e) =>
                              handleUpdateLevelField(level.id, "timeframe", Number.parseInt(e.target.value) || 1)
                            }
                          />
                          <Select
                            value={level.timeUnit}
                            onValueChange={(v) =>
                              handleUpdateLevelField(level.id, "timeUnit", v)
                            }
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {defaultTimeUnits.map((u) => (
                                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={level.escalation}
                              onCheckedChange={(v) =>
                                handleUpdateLevelField(level.id, "escalation", v)
                              }
                            />
                            <Label className="text-xs">Escalate</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={level.notifyTeam}
                              onCheckedChange={(v) =>
                                handleUpdateLevelField(level.id, "notifyTeam", v)
                              }
                            />
                            <Label className="text-xs">Notify Team</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={level.notifyManager}
                              onCheckedChange={(v) =>
                                handleUpdateLevelField(level.id, "notifyManager", v)
                              }
                            />
                            <Label className="text-xs">Notify Manager</Label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-3">
                    No SLA levels configured for this stage.
                  </p>
                )}
              </div>

              {/* Add New Level */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Add New Level</h4>
                <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                  <Input
                    placeholder="Level name (e.g. First Response, Escalation)"
                    value={newLevelName}
                    onChange={(e) => setNewLevelName(e.target.value)}
                  />

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Slider
                        value={[newLevelTimeframe]}
                        min={1}
                        max={getSliderMax(newLevelTimeUnit)}
                        step={1}
                        onValueChange={(v) => setNewLevelTimeframe(v[0])}
                      />
                    </div>
                    <Input
                      type="number"
                      className="w-16"
                      value={newLevelTimeframe}
                      min={1}
                      onChange={(e) => setNewLevelTimeframe(Number.parseInt(e.target.value) || 1)}
                    />
                    <Select
                      value={newLevelTimeUnit}
                      onValueChange={(v) => setNewLevelTimeUnit(v as "minutes" | "hours" | "days")}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {defaultTimeUnits.map((u) => (
                          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch checked={newLevelEscalation} onCheckedChange={setNewLevelEscalation} />
                      <Label className="text-xs">Escalate</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={newLevelNotifyTeam} onCheckedChange={setNewLevelNotifyTeam} />
                      <Label className="text-xs">Notify Team</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={newLevelNotifyManager} onCheckedChange={setNewLevelNotifyManager} />
                      <Label className="text-xs">Notify Manager</Label>
                    </div>
                  </div>

                  <Button
                    onClick={handleAddLevel}
                    variant="outline"
                    size="sm"
                    disabled={!newLevelName.trim()}
                    className="w-full"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Level
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveModal} className="bg-blue-500 hover:bg-blue-600">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
