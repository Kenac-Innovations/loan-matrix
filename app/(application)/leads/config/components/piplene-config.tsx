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
  Edit2,
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
  defaultStages,
  defaultStageColors,
  type Stage,
} from "@/shared/defaults/pipeline-config";
import { toast } from "sonner";

export function PipelineConfig() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch stages from database on mount
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
              order: s.order,
            }))
          );
        } else {
          // Use defaults if no stages in database
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

  const saveStages = async () => {
    try {
      setIsSaving(true);
      const response = await fetch("/api/pipeline/stages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages }),
      });

      if (response.ok) {
        toast.success("Pipeline stages saved successfully");
        setHasChanges(false);
        // Refresh to get updated IDs
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

  const markChanged = () => {
    setHasChanges(true);
  };

  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [newStage, setNewStage] = useState<Partial<Stage>>({
    name: "",
    description: "",
    color: "#3b82f6",
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order property
    const reorderedItems = items.map((item, index) => ({
      ...item,
      order: index + 1,
    }));

    setStages(reorderedItems);
    markChanged();
  };

  const handleAddStage = () => {
    if (!newStage.name) return;

    const stage: Stage = {
      id: `new-${Date.now()}`,
      name: newStage.name,
      description: newStage.description || "",
      color: newStage.color || "#3b82f6",
    };

    setStages([...stages, stage]);
    setNewStage({ name: "", description: "", color: "#3b82f6" });
    markChanged();
  };

  const handleDeleteStage = (id: string) => {
    setStages(stages.filter((stage) => stage.id !== id));
    markChanged();
  };

  const handleEditStage = (stage: Stage) => {
    setEditingStage(stage);
  };

  const handleUpdateStage = () => {
    if (!editingStage) return;

    setStages(
      stages.map((stage) =>
        stage.id === editingStage.id ? editingStage : stage
      )
    );

    setEditingStage(null);
    markChanged();
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
    markChanged();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">
            Pipeline State Machine Configuration
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure your pipeline stages and state transitions. This creates a
            state machine that controls how leads move through your pipeline.
          </p>
        </div>
        {hasChanges && (
          <Button
            onClick={saveStages}
            disabled={isSaving}
            className="bg-green-500 hover:bg-green-600"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
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
                          className="flex items-center space-x-2 bg-card rounded-md border p-3"
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab"
                          >
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{stage.name}</div>
                              {stage.isInitialState && (
                                <Badge variant="secondary" className="text-xs">
                                  Initial
                                </Badge>
                              )}
                              {stage.isFinalState && (
                                <Badge variant="secondary" className="text-xs">
                                  Final
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {stage.description}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditStage(stage)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteStage(stage.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  {editingStage ? "Edit Stage" : "Add New Stage"}
                </h3>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Stage Name</Label>
                    <Input
                      id="name"
                      value={editingStage ? editingStage.name : newStage.name}
                      onChange={(e) =>
                        editingStage
                          ? setEditingStage({
                              ...editingStage,
                              name: e.target.value,
                            })
                          : setNewStage({ ...newStage, name: e.target.value })
                      }
                      placeholder="Enter stage name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={
                        editingStage
                          ? editingStage.description
                          : newStage.description || ""
                      }
                      onChange={(e) =>
                        editingStage
                          ? setEditingStage({
                              ...editingStage,
                              description: e.target.value,
                            })
                          : setNewStage({
                              ...newStage,
                              description: e.target.value,
                            })
                      }
                      placeholder="Enter stage description"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Stage Color</Label>
                    <ColourPicker
                      colour={
                        editingStage
                          ? editingStage.color
                          : newStage.color || "#3b82f6"
                      }
                      onChange={(color) =>
                        editingStage
                          ? setEditingStage({ ...editingStage, color })
                          : setNewStage({ ...newStage, color })
                      }
                    />
                  </div>

                  {editingStage && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isInitialState"
                          checked={editingStage.isInitialState || false}
                          onCheckedChange={(checked) =>
                            setEditingStage({
                              ...editingStage,
                              isInitialState: checked as boolean,
                            })
                          }
                        />
                        <Label htmlFor="isInitialState" className="text-sm">
                          Initial State (leads start here)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isFinalState"
                          checked={editingStage.isFinalState || false}
                          onCheckedChange={(checked) =>
                            setEditingStage({
                              ...editingStage,
                              isFinalState: checked as boolean,
                            })
                          }
                        />
                        <Label htmlFor="isFinalState" className="text-sm">
                          Final State (leads end here)
                        </Label>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={editingStage ? handleUpdateStage : handleAddStage}
                    className="w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {editingStage ? "Update Stage" : "Add Stage"}
                    {!editingStage && <Plus className="ml-2 h-4 w-4" />}
                  </Button>
                  {editingStage && (
                    <Button
                      variant="outline"
                      onClick={() => setEditingStage(null)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
  );
}
