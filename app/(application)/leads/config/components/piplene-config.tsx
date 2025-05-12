"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, GripVertical, Plus, Edit2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ColourPicker } from "./colour-picker";

type Stage = {
  id: string;
  name: string;
  description: string;
  color: string;
};

export function PipelineConfig() {
  const [stages, setStages] = useState<Stage[]>([
    {
      id: "1",
      name: "New Lead",
      description: "Initial contact with potential client",
      color: "#3b82f6",
    },
    {
      id: "2",
      name: "Qualification",
      description: "Assessing lead requirements and fit",
      color: "#8b5cf6",
    },
    {
      id: "3",
      name: "Proposal",
      description: "Preparing and sending proposal",
      color: "#ec4899",
    },
    {
      id: "4",
      name: "Negotiation",
      description: "Discussing terms and conditions",
      color: "#f59e0b",
    },
    {
      id: "5",
      name: "Closed Won",
      description: "Successfully converted lead to customer",
      color: "#10b981",
    },
    {
      id: "6",
      name: "Closed Lost",
      description: "Lead did not convert to customer",
      color: "#ef4444",
    },
  ]);

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

    setStages(items);
  };

  const handleAddStage = () => {
    if (!newStage.name) return;

    const stage: Stage = {
      id: Date.now().toString(),
      name: newStage.name,
      description: newStage.description || "",
      color: newStage.color || "#3b82f6",
    };

    setStages([...stages, stage]);
    setNewStage({ name: "", description: "", color: "#3b82f6" });
  };

  const handleDeleteStage = (id: string) => {
    setStages(stages.filter((stage) => stage.id !== id));
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
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Pipeline Stages</h3>
        <p className="text-sm text-gray-400">
          Drag and drop to reorder stages. Click on a stage to edit its details.
        </p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="stages">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {stages.map((stage, index) => (
                <Draggable key={stage.id} draggableId={stage.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="flex items-center space-x-2 bg-[#1a2035] rounded-md border border-[#2a304d] p-3"
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="cursor-grab"
                      >
                        <GripVertical className="h-5 w-5 text-gray-400" />
                      </div>
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white">
                          {stage.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {stage.description}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditStage(stage)}
                        className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteStage(stage.id)}
                        className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
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

      <Card className="bg-[#1a2035] border-[#2a304d]">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">
              {editingStage ? "Edit Stage" : "Add New Stage"}
            </h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-gray-300">
                  Stage Name
                </Label>
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
                  className="bg-[#0d121f] border-[#2a304d] text-white"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description" className="text-gray-300">
                  Description
                </Label>
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
                  className="bg-[#0d121f] border-[#2a304d] text-white"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-gray-300">Stage Color</Label>
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
                  className="border-[#2a304d] text-gray-300 hover:bg-[#2a304d] hover:text-white"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
