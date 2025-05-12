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
import { Checkbox } from "@/components/ui/checkbox";

type ValidationCondition = {
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than"
    | "is_empty"
    | "is_not_empty"
    | "matches_regex";
  value?: string;
};

type ValidationAction = {
  type: "block_progression" | "notify" | "auto_assign" | "set_field_value";
  message?: string;
  assignTo?: string;
  field?: string;
  value?: string;
};

type ValidationRule = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  appliesTo: string[]; // Stage IDs
  conditions: ValidationCondition[];
  actions: ValidationAction[];
  severity: "info" | "warning" | "error";
};

export function ValidationConfig() {
  const [rules, setRules] = useState<ValidationRule[]>([
    {
      id: "1",
      name: "Required Company Information",
      description:
        "Ensures company information is complete before moving to Qualification",
      enabled: true,
      appliesTo: ["1"], // New Lead stage
      conditions: [
        { field: "company_name", operator: "is_empty" },
        { field: "industry", operator: "is_empty" },
      ],
      actions: [
        {
          type: "block_progression",
          message:
            "Company name and industry must be provided before moving to Qualification",
        },
      ],
      severity: "error",
    },
    {
      id: "2",
      name: "Budget Validation",
      description: "Checks if budget information is available before proposal",
      enabled: true,
      appliesTo: ["2"], // Qualification stage
      conditions: [{ field: "annual_revenue", operator: "is_empty" }],
      actions: [
        {
          type: "notify",
          message:
            "Budget information is missing. Consider collecting this before proceeding.",
        },
      ],
      severity: "warning",
    },
    {
      id: "3",
      name: "Auto-assign to Finance Team",
      description:
        "Automatically assigns leads with high revenue to Finance Team",
      enabled: true,
      appliesTo: ["2", "3"], // Qualification and Proposal stages
      conditions: [
        { field: "annual_revenue", operator: "greater_than", value: "1000000" },
      ],
      actions: [
        {
          type: "auto_assign",
          assignTo: "Finance Team",
        },
      ],
      severity: "info",
    },
  ]);

  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [newRule, setNewRule] = useState<Partial<ValidationRule>>({
    name: "",
    description: "",
    enabled: true,
    appliesTo: [],
    conditions: [],
    actions: [],
    severity: "warning",
  });

  const [newCondition, setNewCondition] = useState<
    Partial<ValidationCondition>
  >({
    field: "",
    operator: "equals",
    value: "",
  });

  const [newAction, setNewAction] = useState<Partial<ValidationAction>>({
    type: "block_progression",
    message: "",
  });

  // Sample pipeline stages (would be fetched from the pipeline config in a real app)
  const pipelineStages = [
    { id: "1", name: "New Lead" },
    { id: "2", name: "Qualification" },
    { id: "3", name: "Proposal" },
    { id: "4", name: "Negotiation" },
    { id: "5", name: "Closed Won" },
    { id: "6", name: "Closed Lost" },
  ];

  // Sample fields (would be fetched from the field config in a real app)
  const fields = [
    { id: "company_name", name: "Company Name" },
    { id: "industry", name: "Industry" },
    { id: "annual_revenue", name: "Annual Revenue" },
    { id: "notes", name: "Additional Notes" },
    { id: "contact_name", name: "Contact Name" },
    { id: "contact_email", name: "Contact Email" },
    { id: "contact_phone", name: "Contact Phone" },
  ];

  const operators = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Does not equal" },
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Does not contain" },
    { value: "greater_than", label: "Greater than" },
    { value: "less_than", label: "Less than" },
    { value: "is_empty", label: "Is empty" },
    { value: "is_not_empty", label: "Is not empty" },
    { value: "matches_regex", label: "Matches regex" },
  ];

  const actionTypes = [
    { value: "block_progression", label: "Block progression to next stage" },
    { value: "notify", label: "Show notification" },
    { value: "auto_assign", label: "Auto-assign to team" },
    { value: "set_field_value", label: "Set field value" },
  ];

  const teams = ["Sales Team", "Finance Team", "Customer Success"];

  const severityOptions = [
    { value: "info", label: "Info" },
    { value: "warning", label: "Warning" },
    { value: "error", label: "Error (Blocking)" },
  ];

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(rules);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setRules(items);
  };

  const handleAddRule = () => {
    if (!newRule.name) return;

    const rule: ValidationRule = {
      id: Date.now().toString(),
      name: newRule.name,
      description: newRule.description || "",
      enabled: newRule.enabled !== undefined ? newRule.enabled : true,
      appliesTo: newRule.appliesTo || [],
      conditions: newRule.conditions || [],
      actions: newRule.actions || [],
      severity: (newRule.severity as "info" | "warning" | "error") || "warning",
    };

    setRules([...rules, rule]);
    setNewRule({
      name: "",
      description: "",
      enabled: true,
      appliesTo: [],
      conditions: [],
      actions: [],
      severity: "warning",
    });
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const handleEditRule = (rule: ValidationRule) => {
    setEditingRule(rule);
  };

  const handleUpdateRule = () => {
    if (!editingRule) return;

    setRules(
      rules.map((rule) => (rule.id === editingRule.id ? editingRule : rule))
    );
    setEditingRule(null);
  };

  const handleAddCondition = () => {
    if (!newCondition.field || !newCondition.operator) return;

    const condition: ValidationCondition = {
      field: newCondition.field,
      operator: newCondition.operator as any,
      value: newCondition.value,
    };

    if (editingRule) {
      setEditingRule({
        ...editingRule,
        conditions: [...editingRule.conditions, condition],
      });
    } else {
      setNewRule({
        ...newRule,
        conditions: [...(newRule.conditions || []), condition],
      });
    }

    setNewCondition({
      field: "",
      operator: "equals",
      value: "",
    });
  };

  const handleDeleteCondition = (index: number) => {
    if (editingRule) {
      const updatedConditions = [...editingRule.conditions];
      updatedConditions.splice(index, 1);
      setEditingRule({
        ...editingRule,
        conditions: updatedConditions,
      });
    } else if (newRule.conditions) {
      const updatedConditions = [...newRule.conditions];
      updatedConditions.splice(index, 1);
      setNewRule({
        ...newRule,
        conditions: updatedConditions,
      });
    }
  };

  const handleAddAction = () => {
    if (!newAction.type) return;

    const action: ValidationAction = {
      type: newAction.type as any,
      message: newAction.message,
      assignTo: newAction.assignTo,
      field: newAction.field,
      value: newAction.value,
    };

    if (editingRule) {
      setEditingRule({
        ...editingRule,
        actions: [...editingRule.actions, action],
      });
    } else {
      setNewRule({
        ...newRule,
        actions: [...(newRule.actions || []), action],
      });
    }

    setNewAction({
      type: "block_progression",
      message: "",
    });
  };

  const handleDeleteAction = (index: number) => {
    if (editingRule) {
      const updatedActions = [...editingRule.actions];
      updatedActions.splice(index, 1);
      setEditingRule({
        ...editingRule,
        actions: updatedActions,
      });
    } else if (newRule.actions) {
      const updatedActions = [...newRule.actions];
      updatedActions.splice(index, 1);
      setNewRule({
        ...newRule,
        actions: updatedActions,
      });
    }
  };

  const handleStageToggle = (stageId: string) => {
    if (editingRule) {
      const appliesTo = editingRule.appliesTo.includes(stageId)
        ? editingRule.appliesTo.filter((id) => id !== stageId)
        : [...editingRule.appliesTo, stageId];

      setEditingRule({
        ...editingRule,
        appliesTo,
      });
    } else {
      const appliesTo = newRule.appliesTo?.includes(stageId)
        ? newRule.appliesTo.filter((id) => id !== stageId)
        : [...(newRule.appliesTo || []), stageId];

      setNewRule({
        ...newRule,
        appliesTo,
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "info":
        return "bg-blue-500";
      case "warning":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getActionLabel = (action: ValidationAction) => {
    switch (action.type) {
      case "block_progression":
        return "Block progression";
      case "notify":
        return "Show notification";
      case "auto_assign":
        return `Assign to ${action.assignTo}`;
      case "set_field_value":
        return `Set ${action.field} to ${action.value}`;
      default:
        return "Unknown action";
    }
  };

  const getConditionLabel = (condition: ValidationCondition) => {
    const fieldName =
      fields.find((f) => f.id === condition.field)?.name || condition.field;
    const operatorLabel =
      operators.find((o) => o.value === condition.operator)?.label ||
      condition.operator;

    if (
      condition.operator === "is_empty" ||
      condition.operator === "is_not_empty"
    ) {
      return `${fieldName} ${operatorLabel}`;
    }

    return `${fieldName} ${operatorLabel} ${condition.value}`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Validation Rules</h3>
        <p className="text-sm text-gray-400">
          Configure validation rules that automatically check conditions and
          perform actions at different pipeline stages
        </p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="rules">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {rules.map((rule, index) => (
                <Draggable key={rule.id} draggableId={rule.id} index={index}>
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
                        className={`w-2 h-full rounded-full ${getSeverityColor(
                          rule.severity
                        )}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center">
                          <div className="font-medium text-white">
                            {rule.name}
                          </div>
                          {!rule.enabled && (
                            <Badge className="ml-2 bg-gray-500 text-white">
                              Disabled
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          {rule.description}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rule.appliesTo.map((stageId) => {
                            const stage = pipelineStages.find(
                              (s) => s.id === stageId
                            );
                            return (
                              <Badge
                                key={stageId}
                                variant="outline"
                                className="border-[#2a304d] text-gray-300"
                              >
                                {stage?.name || stageId}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditRule(rule)}
                          className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
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

      <Card className="bg-[#0d121f] border-[#1a2035]">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">
              {editingRule ? "Edit Validation Rule" : "Add New Validation Rule"}
            </h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-gray-300">
                    Rule Name
                  </Label>
                  <Input
                    id="name"
                    value={editingRule ? editingRule.name : newRule.name}
                    onChange={(e) =>
                      editingRule
                        ? setEditingRule({
                            ...editingRule,
                            name: e.target.value,
                          })
                        : setNewRule({ ...newRule, name: e.target.value })
                    }
                    placeholder="Enter rule name"
                    className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="severity" className="text-gray-300">
                    Severity
                  </Label>
                  <Select
                    value={
                      editingRule ? editingRule.severity : newRule.severity
                    }
                    onValueChange={(value) =>
                      editingRule
                        ? setEditingRule({
                            ...editingRule,
                            severity: value as any,
                          })
                        : setNewRule({ ...newRule, severity: value as any })
                    }
                  >
                    <SelectTrigger
                      id="severity"
                      className="bg-[#1a2035] border-[#2a304d] text-white"
                    >
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                      {severityOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="focus:bg-[#2a304d] focus:text-white"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description" className="text-gray-300">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={
                    editingRule
                      ? editingRule.description
                      : newRule.description || ""
                  }
                  onChange={(e) =>
                    editingRule
                      ? setEditingRule({
                          ...editingRule,
                          description: e.target.value,
                        })
                      : setNewRule({ ...newRule, description: e.target.value })
                  }
                  placeholder="Enter rule description"
                  rows={2}
                  className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={
                    editingRule ? editingRule.enabled : newRule.enabled || false
                  }
                  onCheckedChange={(checked) =>
                    editingRule
                      ? setEditingRule({ ...editingRule, enabled: checked })
                      : setNewRule({ ...newRule, enabled: checked })
                  }
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="enabled" className="text-gray-300">
                  Rule Enabled
                </Label>
              </div>

              {/* Applies To (Stages) */}
              <div className="border-t border-[#2a304d] pt-4 mt-2">
                <h4 className="text-sm font-medium mb-4 text-white">
                  Applies To Stages
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {pipelineStages.map((stage) => (
                    <div key={stage.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`stage-${stage.id}`}
                        checked={
                          editingRule
                            ? editingRule.appliesTo.includes(stage.id)
                            : newRule.appliesTo?.includes(stage.id) || false
                        }
                        onCheckedChange={() => handleStageToggle(stage.id)}
                        className="border-[#2a304d] data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <Label
                        htmlFor={`stage-${stage.id}`}
                        className="text-sm text-gray-300"
                      >
                        {stage.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div className="border-t border-[#2a304d] pt-4 mt-2">
                <h4 className="text-sm font-medium mb-4 text-white">
                  Conditions
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label
                        htmlFor="condition-field"
                        className="text-gray-300"
                      >
                        Field
                      </Label>
                      <Select
                        value={newCondition.field}
                        onValueChange={(value) =>
                          setNewCondition({ ...newCondition, field: value })
                        }
                      >
                        <SelectTrigger
                          id="condition-field"
                          className="bg-[#1a2035] border-[#2a304d] text-white"
                        >
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                          {fields.map((field) => (
                            <SelectItem
                              key={field.id}
                              value={field.id}
                              className="focus:bg-[#2a304d] focus:text-white"
                            >
                              {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        htmlFor="condition-operator"
                        className="text-gray-300"
                      >
                        Operator
                      </Label>
                      <Select
                        value={newCondition.operator}
                        onValueChange={(value) =>
                          setNewCondition({
                            ...newCondition,
                            operator: value as any,
                          })
                        }
                      >
                        <SelectTrigger
                          id="condition-operator"
                          className="bg-[#1a2035] border-[#2a304d] text-white"
                        >
                          <SelectValue placeholder="Select operator" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                          {operators.map((operator) => (
                            <SelectItem
                              key={operator.value}
                              value={operator.value}
                              className="focus:bg-[#2a304d] focus:text-white"
                            >
                              {operator.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newCondition.operator !== "is_empty" &&
                      newCondition.operator !== "is_not_empty" && (
                        <div>
                          <Label
                            htmlFor="condition-value"
                            className="text-gray-300"
                          >
                            Value
                          </Label>
                          <Input
                            id="condition-value"
                            value={newCondition.value || ""}
                            onChange={(e) =>
                              setNewCondition({
                                ...newCondition,
                                value: e.target.value,
                              })
                            }
                            placeholder="Enter value"
                            className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                          />
                        </div>
                      )}
                  </div>
                  <Button
                    onClick={handleAddCondition}
                    variant="outline"
                    className="w-full border-[#2a304d] text-gray-300 hover:bg-[#2a304d] hover:text-white"
                  >
                    Add Condition
                    <Plus className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {(editingRule
                    ? editingRule.conditions
                    : newRule.conditions || []
                  ).map((condition, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-[#1a2035] p-2 rounded-md"
                    >
                      <div className="text-sm text-white">
                        {getConditionLabel(condition)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCondition(index)}
                        className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-[#2a304d] pt-4 mt-2">
                <h4 className="text-sm font-medium mb-4 text-white">Actions</h4>
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="action-type" className="text-gray-300">
                        Action Type
                      </Label>
                      <Select
                        value={newAction.type}
                        onValueChange={(value) =>
                          setNewAction({ ...newAction, type: value as any })
                        }
                      >
                        <SelectTrigger
                          id="action-type"
                          className="bg-[#1a2035] border-[#2a304d] text-white"
                        >
                          <SelectValue placeholder="Select action type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                          {actionTypes.map((actionType) => (
                            <SelectItem
                              key={actionType.value}
                              value={actionType.value}
                              className="focus:bg-[#2a304d] focus:text-white"
                            >
                              {actionType.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {(newAction.type === "block_progression" ||
                      newAction.type === "notify") && (
                      <div>
                        <Label
                          htmlFor="action-message"
                          className="text-gray-300"
                        >
                          Message
                        </Label>
                        <Textarea
                          id="action-message"
                          value={newAction.message || ""}
                          onChange={(e) =>
                            setNewAction({
                              ...newAction,
                              message: e.target.value,
                            })
                          }
                          placeholder="Enter message"
                          rows={2}
                          className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                        />
                      </div>
                    )}

                    {newAction.type === "auto_assign" && (
                      <div>
                        <Label
                          htmlFor="action-assign-to"
                          className="text-gray-300"
                        >
                          Assign To
                        </Label>
                        <Select
                          value={newAction.assignTo}
                          onValueChange={(value) =>
                            setNewAction({ ...newAction, assignTo: value })
                          }
                        >
                          <SelectTrigger
                            id="action-assign-to"
                            className="bg-[#1a2035] border-[#2a304d] text-white"
                          >
                            <SelectValue placeholder="Select team" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                            {teams.map((team) => (
                              <SelectItem
                                key={team}
                                value={team}
                                className="focus:bg-[#2a304d] focus:text-white"
                              >
                                {team}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {newAction.type === "set_field_value" && (
                      <>
                        <div>
                          <Label
                            htmlFor="action-field"
                            className="text-gray-300"
                          >
                            Field
                          </Label>
                          <Select
                            value={newAction.field}
                            onValueChange={(value) =>
                              setNewAction({ ...newAction, field: value })
                            }
                          >
                            <SelectTrigger
                              id="action-field"
                              className="bg-[#1a2035] border-[#2a304d] text-white"
                            >
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                              {fields.map((field) => (
                                <SelectItem
                                  key={field.id}
                                  value={field.id}
                                  className="focus:bg-[#2a304d] focus:text-white"
                                >
                                  {field.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label
                            htmlFor="action-value"
                            className="text-gray-300"
                          >
                            Value
                          </Label>
                          <Input
                            id="action-value"
                            value={newAction.value || ""}
                            onChange={(e) =>
                              setNewAction({
                                ...newAction,
                                value: e.target.value,
                              })
                            }
                            placeholder="Enter value"
                            className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    onClick={handleAddAction}
                    variant="outline"
                    className="w-full border-[#2a304d] text-gray-300 hover:bg-[#2a304d] hover:text-white"
                  >
                    Add Action
                    <Plus className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {(editingRule
                    ? editingRule.actions
                    : newRule.actions || []
                  ).map((action, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-[#1a2035] p-2 rounded-md"
                    >
                      <div className="text-sm text-white">
                        {getActionLabel(action)}
                        {action.message && (
                          <div className="text-xs text-gray-400 mt-1">
                            {action.message}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAction(index)}
                        className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={editingRule ? handleUpdateRule : handleAddRule}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingRule ? "Update Rule" : "Add Rule"}
                {!editingRule && <Plus className="ml-2 h-4 w-4" />}
              </Button>
              {editingRule && (
                <Button
                  variant="outline"
                  onClick={() => setEditingRule(null)}
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
