"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  GripVertical,
  Plus,
  Pencil,
  ArrowRight,
  Settings,
  Loader2,
  Save,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ColourPicker } from "./colour-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  defaultStages,
  type Stage,
} from "@/shared/defaults/pipeline-config";
import { toast } from "sonner";

export function PipelineConfig() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/pipeline/stages");
      if (response.ok) {
        const data = await response.json();
        if (data.stages && data.stages.length > 0) {
          setStages(
            data.stages.map((s: any) => ({
              id: s.id,
              name: s.name,
              description: s.description || "",
              color: s.color || "#3b82f6",
              isInitialState: s.isInitialState || false,
              isFinalState: s.isFinalState || false,
              allowedTransitions: s.allowedTransitions || [],
              fineractStatus: s.fineractStatus || null,
              fineractAction: s.fineractAction || null,
              requiredApprovals: s.requiredApprovals ?? 1,
              skipBelowAmount: s.skipBelowAmount ?? null,
              order: s.order,
            }))
          );
        } else {
          setStages(defaultStages);
        }
      } else {
        console.error("Failed to fetch stages");
        setStages(defaultStages);
      }
    } catch (error) {
      console.error("Error fetching stages:", error);
      setStages(defaultStages);
    } finally {
      setIsLoading(false);
    }
  };

  const saveStages = async (updatedStages?: Stage[]) => {
    const toSave = updatedStages || stages;
    try {
      setIsSaving(true);
      const response = await fetch("/api/pipeline/stages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: toSave }),
      });

      if (response.ok) {
        toast.success("Pipeline stages saved successfully");
        setHasChanges(false);
        await fetchStages();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save stages");
      }
    } catch (error) {
      console.error("Error saving stages:", error);
      toast.error("Error saving stages");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reorderedItems = items.map((item, index) => ({
      ...item,
      order: index + 1,
    }));

    setStages(reorderedItems);
    setHasChanges(true);
  };

  const openCreateModal = () => {
    setEditingStage({
      id: `new-${Date.now()}`,
      name: "",
      description: "",
      color: "#3b82f6",
      isInitialState: false,
      isFinalState: false,
      allowedTransitions: [],
      fineractStatus: null,
      fineractAction: null,
      requiredApprovals: 1,
      skipBelowAmount: null,
      order: stages.length + 1,
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEditModal = (stage: Stage) => {
    setEditingStage({ ...stage });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSaveStage = () => {
    if (!editingStage || !editingStage.name.trim()) return;

    let updated: Stage[];
    if (isEditing) {
      updated = stages.map((s) => (s.id === editingStage.id ? editingStage : s));
    } else {
      updated = [...stages, editingStage];
    }

    const reordered = updated.map((item, index) => ({ ...item, order: index + 1 }));
    setStages(reordered);
    setHasChanges(true);
    setModalOpen(false);
    toast.info(isEditing ? "Stage updated — click Save Changes to persist" : "Stage added — click Save Changes to persist");
  };

  const handleDeleteStage = (id: string) => {
    const updated = stages.filter((stage) => stage.id !== id);
    const reordered = updated.map((item, index) => ({ ...item, order: index + 1 }));
    setStages(reordered);
    setHasChanges(true);
  };

  const handleToggleTransition = (fromStageId: string, toStageId: string) => {
    setStages(
      stages.map((stage) => {
        if (stage.id === fromStageId) {
          const currentTransitions = stage.allowedTransitions || [];
          const hasTransition = currentTransitions.includes(toStageId);
          return {
            ...stage,
            allowedTransitions: hasTransition
              ? currentTransitions.filter((id) => id !== toStageId)
              : [...currentTransitions, toStageId],
          };
        }
        return stage;
      })
    );
    setHasChanges(true);
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
          <Button onClick={openCreateModal} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Stage
          </Button>
          {hasChanges && (
            <Button
              onClick={() => saveStages()}
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

        <Tabs defaultValue="stages" className="space-y-6">
          <TabsList>
            <TabsTrigger value="stages">
              <Settings className="mr-2 h-4 w-4" />
              Stages
            </TabsTrigger>
            <TabsTrigger value="transitions">
              <ArrowRight className="mr-2 h-4 w-4" />
              Transitions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stages" className="space-y-6">
            {stages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <p>No pipeline stages configured yet.</p>
                <p className="text-sm mt-1">Add stages to define your lead workflow.</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="stages">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {stages.map((stage, index) => (
                        <Draggable
                          key={stage.id}
                          draggableId={stage.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="flex items-center gap-3 bg-card rounded-lg border p-3 transition-colors hover:bg-muted/30"
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab"
                              >
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div
                                className="w-4 h-4 rounded-full shrink-0"
                                style={{ backgroundColor: stage.color }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{stage.name}</span>
                                  <Badge variant="secondary" className="text-xs font-mono">
                                    #{stage.order}
                                  </Badge>
                                  {stage.isInitialState && (
                                    <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                                      Initial
                                    </Badge>
                                  )}
                                  {stage.isFinalState && (
                                    <Badge className="text-xs bg-gray-100 text-gray-700 border-gray-200">
                                      Final
                                    </Badge>
                                  )}
                                  {stage.fineractAction && (
                                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                                      Fineract: {stage.fineractAction}
                                    </Badge>
                                  )}
                                  {(stage.requiredApprovals ?? 1) > 1 && (
                                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">
                                      {stage.requiredApprovals} approvals
                                    </Badge>
                                  )}
                                  {stage.skipBelowAmount && (
                                    <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 bg-purple-50">
                                      Skip &lt; K{stage.skipBelowAmount.toLocaleString()}
                                    </Badge>
                                  )}
                                </div>
                                {stage.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {stage.description}
                                  </p>
                                )}
                                {(stage.allowedTransitions?.length ?? 0) > 0 && (
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                    {stage.allowedTransitions?.map((tid) => {
                                      const target = stages.find((s) => s.id === tid);
                                      return target ? (
                                        <Badge key={tid} variant="outline" className="text-xs">
                                          <div
                                            className="w-2 h-2 rounded-full mr-1"
                                            style={{ backgroundColor: target.color }}
                                          />
                                          {target.name}
                                        </Badge>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditModal(stage)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700"
                                  onClick={() => handleDeleteStage(stage.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </TabsContent>

          <TabsContent value="transitions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>State Transitions</CardTitle>
                <CardDescription>
                  Configure which stages can transition to other stages. This
                  creates the state machine logic.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stages.map((fromStage) => (
                    <div key={fromStage.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: fromStage.color }}
                        />
                        <h4 className="font-medium">{fromStage.name}</h4>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          can transition to:
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {stages
                          .filter((stage) => stage.id !== fromStage.id)
                          .map((toStage) => (
                            <div
                              key={toStage.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`${fromStage.id}-${toStage.id}`}
                                checked={
                                  fromStage.allowedTransitions?.includes(
                                    toStage.id
                                  ) || false
                                }
                                onCheckedChange={() =>
                                  handleToggleTransition(fromStage.id, toStage.id)
                                }
                              />
                              <Label
                                htmlFor={`${fromStage.id}-${toStage.id}`}
                                className="text-sm flex items-center gap-2"
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: toStage.color }}
                                />
                                {toStage.name}
                              </Label>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add / Edit Stage Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Pipeline Stage" : "Add Pipeline Stage"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the stage properties and Fineract integration settings."
                : "Add a new stage to your pipeline workflow."}
            </DialogDescription>
          </DialogHeader>

          {editingStage && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Stage Name *</Label>
                <Input
                  placeholder="e.g. Appraisal, CEO Approval"
                  value={editingStage.name}
                  onChange={(e) =>
                    setEditingStage({ ...editingStage, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Brief description of this stage"
                  value={editingStage.description || ""}
                  onChange={(e) =>
                    setEditingStage({ ...editingStage, description: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Stage Color</Label>
                <ColourPicker
                  colour={editingStage.color || "#3b82f6"}
                  onChange={(color) =>
                    setEditingStage({ ...editingStage, color })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="font-medium text-sm">Initial State</Label>
                    <p className="text-xs text-muted-foreground">Leads start here</p>
                  </div>
                  <Checkbox
                    checked={editingStage.isInitialState || false}
                    onCheckedChange={(checked) =>
                      setEditingStage({
                        ...editingStage,
                        isInitialState: checked as boolean,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="font-medium text-sm">Final State</Label>
                    <p className="text-xs text-muted-foreground">Leads end here</p>
                  </div>
                  <Checkbox
                    checked={editingStage.isFinalState || false}
                    onCheckedChange={(checked) =>
                      setEditingStage({
                        ...editingStage,
                        isFinalState: checked as boolean,
                      })
                    }
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Fineract Integration
                </h4>
                <div className="space-y-2">
                  <Label className="text-sm">Action on Enter</Label>
                  <Select
                    value={editingStage.fineractAction || "none"}
                    onValueChange={(val) =>
                      setEditingStage({
                        ...editingStage,
                        fineractAction: val === "none" ? null : val,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No action</SelectItem>
                      <SelectItem value="approve">Approve Loan</SelectItem>
                      <SelectItem value="disburse">Disburse Loan</SelectItem>
                      <SelectItem value="reject">Reject Loan</SelectItem>
                      <SelectItem value="payout">Process Payout</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Fineract API call triggered when a lead enters this stage
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Expected Fineract Status</Label>
                  <Select
                    value={editingStage.fineractStatus || "none"}
                    onValueChange={(val) =>
                      setEditingStage({
                        ...editingStage,
                        fineractStatus: val === "none" ? null : val,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="submitted_pending_approval">
                        Submitted &amp; Pending Approval
                      </SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="disbursed">Disbursed / Active</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The Fineract loan status expected while a lead is in this stage
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Approval Settings
                </h4>
                <div className="space-y-2">
                  <Label className="text-sm">Required Approvals</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={editingStage.requiredApprovals ?? 1}
                    onChange={(e) =>
                      setEditingStage({
                        ...editingStage,
                        requiredApprovals: Math.max(1, Number.parseInt(e.target.value) || 1),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    How many unique team members must approve before a lead can move forward (1 = no multi-approval)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Auto-skip Below Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Leave empty to never skip"
                    value={editingStage.skipBelowAmount ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingStage({
                        ...editingStage,
                        skipBelowAmount: val === "" ? null : Number.parseFloat(val),
                      });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    If set, loans with a requested amount below this value will automatically skip this stage
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveStage}
              disabled={!editingStage?.name.trim()}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {isEditing ? "Update Stage" : "Add Stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
