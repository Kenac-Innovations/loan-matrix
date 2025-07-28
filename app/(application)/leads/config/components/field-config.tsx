"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Edit2, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

type FieldOption = {
  id: string;
  label: string;
  value: string;
};

type CustomField = {
  id: string;
  name: string;
  label: string;
  type:
    | "text"
    | "number"
    | "email"
    | "phone"
    | "date"
    | "select"
    | "multiselect"
    | "checkbox"
    | "textarea";
  placeholder?: string;
  required: boolean;
  defaultValue?: string;
  options?: FieldOption[];
  description?: string;
  visibleTo: string[];
};

export function FieldConfig() {
  const [fields, setFields] = useState<CustomField[]>([
    {
      id: "1",
      name: "company_name",
      label: "Company Name",
      type: "text",
      placeholder: "Enter company name",
      required: true,
      description: "Legal name of the company",
      visibleTo: ["Sales Team", "Finance Team", "Customer Success"],
    },
    {
      id: "2",
      name: "industry",
      label: "Industry",
      type: "select",
      required: true,
      options: [
        { id: "1", label: "Technology", value: "technology" },
        { id: "2", label: "Healthcare", value: "healthcare" },
        { id: "3", label: "Finance", value: "finance" },
        { id: "4", label: "Education", value: "education" },
        { id: "5", label: "Other", value: "other" },
      ],
      visibleTo: ["Sales Team"],
    },
    {
      id: "3",
      name: "annual_revenue",
      label: "Annual Revenue",
      type: "number",
      placeholder: "Enter annual revenue",
      required: false,
      visibleTo: ["Finance Team"],
    },
    {
      id: "4",
      name: "notes",
      label: "Additional Notes",
      type: "textarea",
      placeholder: "Enter any additional information",
      required: false,
      visibleTo: ["Sales Team", "Customer Success"],
    },
  ]);

  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [newField, setNewField] = useState<Partial<CustomField>>({
    name: "",
    label: "",
    type: "text",
    required: false,
    visibleTo: [],
  });

  const [newOption, setNewOption] = useState<Partial<FieldOption>>({
    label: "",
    value: "",
  });

  const teams = ["Sales Team", "Finance Team", "Customer Success"];

  const fieldTypes = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "date", label: "Date" },
    { value: "select", label: "Dropdown" },
    { value: "multiselect", label: "Multi-select" },
    { value: "checkbox", label: "Checkbox" },
    { value: "textarea", label: "Text Area" },
  ];

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setFields(items);
  };

  const handleAddField = () => {
    if (!newField.name || !newField.label || !newField.type) return;

    // Convert field name to snake_case
    const fieldName = newField.name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    const field: CustomField = {
      id: Date.now().toString(),
      name: fieldName,
      label: newField.label,
      type: newField.type as any,
      placeholder: newField.placeholder,
      required: newField.required || false,
      defaultValue: newField.defaultValue,
      options:
        newField.type === "select" || newField.type === "multiselect"
          ? newField.options || []
          : undefined,
      description: newField.description,
      visibleTo: newField.visibleTo || [],
    };

    setFields([...fields, field]);
    setNewField({
      name: "",
      label: "",
      type: "text",
      required: false,
      visibleTo: [],
    });
  };

  const handleDeleteField = (id: string) => {
    setFields(fields.filter((field) => field.id !== id));
  };

  const handleEditField = (field: CustomField) => {
    setEditingField(field);
  };

  const handleUpdateField = () => {
    if (!editingField) return;

    setFields(
      fields.map((field) =>
        field.id === editingField.id ? editingField : field
      )
    );

    setEditingField(null);
  };

  const handleAddOption = () => {
    if (!newOption.label) return;

    const option: FieldOption = {
      id: Date.now().toString(),
      label: newOption.label,
      value:
        newOption.value || newOption.label.toLowerCase().replace(/\s+/g, "_"),
    };

    if (editingField) {
      setEditingField({
        ...editingField,
        options: [...(editingField.options || []), option],
      });
    } else {
      setNewField({
        ...newField,
        options: [...(newField.options || []), option],
      });
    }

    setNewOption({ label: "", value: "" });
  };

  const handleDeleteOption = (optionId: string) => {
    if (editingField) {
      setEditingField({
        ...editingField,
        options: editingField.options?.filter((opt) => opt.id !== optionId),
      });
    } else {
      setNewField({
        ...newField,
        options: newField.options?.filter((opt) => opt.id !== optionId),
      });
    }
  };

  const handleTeamVisibilityChange = (team: string) => {
    if (editingField) {
      const visibleTo = editingField.visibleTo.includes(team)
        ? editingField.visibleTo.filter((t) => t !== team)
        : [...editingField.visibleTo, team];

      setEditingField({
        ...editingField,
        visibleTo,
      });
    } else {
      const visibleTo = newField.visibleTo?.includes(team)
        ? newField.visibleTo.filter((t) => t !== team)
        : [...(newField.visibleTo || []), team];

      setNewField({
        ...newField,
        visibleTo,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Custom Fields</h3>
        <p className="text-sm text-muted-foreground">
          Configure custom fields for your lead management process
        </p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="fields">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {fields.map((field, index) => (
                <Draggable key={field.id} draggableId={field.id} index={index}>
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
                      <div className="flex-1">
                        <div className="flex items-center">
                          <div className="font-medium">{field.label}</div>
                          {field.required && (
                            <Badge className="ml-2 bg-red-500 text-white">
                              Required
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Badge variant="outline">{field.type}</Badge>
                          <span>Field name: {field.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditField(field)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteField(field.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">
              {editingField ? "Edit Field" : "Add New Field"}
            </h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="label">Field Label</Label>
                  <Input
                    id="label"
                    value={editingField ? editingField.label : newField.label}
                    onChange={(e) =>
                      editingField
                        ? setEditingField({
                            ...editingField,
                            label: e.target.value,
                          })
                        : setNewField({ ...newField, label: e.target.value })
                    }
                    placeholder="Enter field label"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Field Name (API)</Label>
                  <Input
                    id="name"
                    value={editingField ? editingField.name : newField.name}
                    onChange={(e) =>
                      editingField
                        ? setEditingField({
                            ...editingField,
                            name: e.target.value,
                          })
                        : setNewField({ ...newField, name: e.target.value })
                    }
                    placeholder="Enter field name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used in API calls and database. Use snake_case.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Field Type</Label>
                  <Select
                    value={editingField ? editingField.type : newField.type}
                    onValueChange={(value) =>
                      editingField
                        ? setEditingField({
                            ...editingField,
                            type: value as any,
                          })
                        : setNewField({ ...newField, type: value as any })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select field type" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="placeholder">Placeholder</Label>
                  <Input
                    id="placeholder"
                    value={
                      editingField
                        ? editingField.placeholder || ""
                        : newField.placeholder || ""
                    }
                    onChange={(e) =>
                      editingField
                        ? setEditingField({
                            ...editingField,
                            placeholder: e.target.value,
                          })
                        : setNewField({
                            ...newField,
                            placeholder: e.target.value,
                          })
                    }
                    placeholder="Enter placeholder text"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={
                    editingField
                      ? editingField.description || ""
                      : newField.description || ""
                  }
                  onChange={(e) =>
                    editingField
                      ? setEditingField({
                          ...editingField,
                          description: e.target.value,
                        })
                      : setNewField({
                          ...newField,
                          description: e.target.value,
                        })
                  }
                  placeholder="Enter field description"
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="required"
                  checked={
                    editingField
                      ? editingField.required
                      : newField.required || false
                  }
                  onCheckedChange={(checked) =>
                    editingField
                      ? setEditingField({ ...editingField, required: checked })
                      : setNewField({ ...newField, required: checked })
                  }
                />
                <Label htmlFor="required">Required Field</Label>
              </div>

              {/* Options for select/multiselect fields */}
              {((editingField &&
                (editingField.type === "select" ||
                  editingField.type === "multiselect")) ||
                (!editingField &&
                  (newField.type === "select" ||
                    newField.type === "multiselect"))) && (
                <div className="border-t pt-4 mt-2">
                  <h4 className="text-sm font-medium mb-4">Field Options</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="option-label">Option Label</Label>
                        <Input
                          id="option-label"
                          value={newOption.label}
                          onChange={(e) =>
                            setNewOption({
                              ...newOption,
                              label: e.target.value,
                            })
                          }
                          placeholder="Display text"
                        />
                      </div>
                      <div>
                        <Label htmlFor="option-value">Option Value</Label>
                        <Input
                          id="option-value"
                          value={newOption.value}
                          onChange={(e) =>
                            setNewOption({
                              ...newOption,
                              value: e.target.value,
                            })
                          }
                          placeholder="Stored value (optional)"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleAddOption}
                      variant="outline"
                      className="w-full"
                    >
                      Add Option
                      <Plus className="ml-2 h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {(editingField
                      ? editingField.options ?? []
                      : newField.options ?? []
                    ).map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center justify-between bg-muted/50 p-2 rounded-md"
                      >
                        <div>
                          <div className="font-medium text-sm">
                            {option.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Value: {option.value}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteOption(option.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team visibility */}
              <div className="border-t pt-4 mt-2">
                <h4 className="text-sm font-medium mb-4">Field Visibility</h4>
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div key={team} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`team-${team}`}
                        checked={
                          editingField
                            ? editingField.visibleTo.includes(team)
                            : newField.visibleTo?.includes(team) || false
                        }
                        onChange={() => handleTeamVisibilityChange(team)}
                        className="rounded border text-blue-600"
                      />
                      <Label htmlFor={`team-${team}`} className="text-sm">
                        {team}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={editingField ? handleUpdateField : handleAddField}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingField ? "Update Field" : "Add Field"}
                {!editingField && <Plus className="ml-2 h-4 w-4" />}
              </Button>
              {editingField && (
                <Button variant="outline" onClick={() => setEditingField(null)}>
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
