"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Edit2, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

type SLALevel = {
  id: string;
  name: string;
  timeframe: number;
  timeUnit: "minutes" | "hours" | "days";
  escalation: boolean;
  notifyTeam: boolean;
  notifyManager: boolean;
  color: string;
};

type StageSLA = {
  id: string;
  stageName: string;
  description: string;
  slaLevels: SLALevel[];
};

export function SLAConfig() {
  const [stageSLAs, setStageSLAs] = useState<StageSLA[]>([
    {
      id: "1",
      stageName: "New Lead",
      description: "Initial contact with potential client",
      slaLevels: [
        {
          id: "1",
          name: "First Response",
          timeframe: 4,
          timeUnit: "hours",
          escalation: true,
          notifyTeam: true,
          notifyManager: false,
          color: "#3b82f6",
        },
        {
          id: "2",
          name: "Qualification",
          timeframe: 1,
          timeUnit: "days",
          escalation: true,
          notifyTeam: true,
          notifyManager: true,
          color: "#f59e0b",
        },
      ],
    },
    {
      id: "2",
      stageName: "Qualification",
      description: "Assessing lead requirements and fit",
      slaLevels: [
        {
          id: "3",
          name: "Requirements Gathering",
          timeframe: 2,
          timeUnit: "days",
          escalation: true,
          notifyTeam: true,
          notifyManager: false,
          color: "#3b82f6",
        },
      ],
    },
    {
      id: "3",
      stageName: "Proposal",
      description: "Preparing and sending proposal",
      slaLevels: [
        {
          id: "4",
          name: "Proposal Submission",
          timeframe: 3,
          timeUnit: "days",
          escalation: true,
          notifyTeam: true,
          notifyManager: false,
          color: "#3b82f6",
        },
      ],
    },
  ]);

  const [editingSLA, setEditingSLA] = useState<StageSLA | null>(null);
  const [editingSLALevel, setEditingSLALevel] = useState<SLALevel | null>(null);
  const [newSLALevel, setNewSLALevel] = useState<Partial<SLALevel>>({
    name: "",
    timeframe: 4,
    timeUnit: "hours",
    escalation: true,
    notifyTeam: true,
    notifyManager: false,
    color: "#3b82f6",
  });

  const pipelineStages = [
    "New Lead",
    "Qualification",
    "Proposal",
    "Negotiation",
    "Closed Won",
    "Closed Lost",
  ];

  const handleEditSLA = (sla: StageSLA) => {
    setEditingSLA(sla);
  };

  const handleEditSLALevel = (level: SLALevel) => {
    setEditingSLALevel(level);
  };

  const handleAddSLALevel = () => {
    if (!editingSLA || !newSLALevel.name) return;

    const slaLevel: SLALevel = {
      id: Date.now().toString(),
      name: newSLALevel.name,
      timeframe: newSLALevel.timeframe || 4,
      timeUnit: newSLALevel.timeUnit || "hours",
      escalation: newSLALevel.escalation || false,
      notifyTeam: newSLALevel.notifyTeam || false,
      notifyManager: newSLALevel.notifyManager || false,
      color: newSLALevel.color || "#3b82f6",
    };

    setEditingSLA({
      ...editingSLA,
      slaLevels: [...editingSLA.slaLevels, slaLevel],
    });

    setNewSLALevel({
      name: "",
      timeframe: 4,
      timeUnit: "hours",
      escalation: true,
      notifyTeam: true,
      notifyManager: false,
      color: "#3b82f6",
    });
  };

  const handleUpdateSLALevel = () => {
    if (!editingSLA || !editingSLALevel) return;

    setEditingSLA({
      ...editingSLA,
      slaLevels: editingSLA.slaLevels.map((level) =>
        level.id === editingSLALevel.id ? editingSLALevel : level
      ),
    });

    setEditingSLALevel(null);
  };

  const handleDeleteSLALevel = (levelId: string) => {
    if (!editingSLA) return;

    setEditingSLA({
      ...editingSLA,
      slaLevels: editingSLA.slaLevels.filter((level) => level.id !== levelId),
    });
  };

  const handleUpdateSLA = () => {
    if (!editingSLA) return;

    setStageSLAs(
      stageSLAs.map((sla) => (sla.id === editingSLA.id ? editingSLA : sla))
    );

    setEditingSLA(null);
  };

  const handleAddStageSLA = () => {
    // Find a stage that doesn't have an SLA yet
    const stagesWithSLA = stageSLAs.map((sla) => sla.stageName);
    const availableStages = pipelineStages.filter(
      (stage) => !stagesWithSLA.includes(stage)
    );

    if (availableStages.length === 0) return;

    const newStageSLA: StageSLA = {
      id: Date.now().toString(),
      stageName: availableStages[0],
      description: `SLA for ${availableStages[0]} stage`,
      slaLevels: [],
    };

    setStageSLAs([...stageSLAs, newStageSLA]);
    setEditingSLA(newStageSLA);
  };

  const handleDeleteStageSLA = (slaId: string) => {
    setStageSLAs(stageSLAs.filter((sla) => sla.id !== slaId));
  };

  const getTimeUnitLabel = (unit: string, value: number) => {
    if (unit === "minutes") return value === 1 ? "minute" : "minutes";
    if (unit === "hours") return value === 1 ? "hour" : "hours";
    if (unit === "days") return value === 1 ? "day" : "days";
    return unit;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">SLA Configuration</h3>
        <p className="text-sm text-gray-400">
          Configure Service Level Agreements for each stage in your pipeline
        </p>
      </div>

      <div className="grid gap-4">
        {stageSLAs.map((sla) => (
          <Card key={sla.id} className="bg-[#0d121f] border-[#1a2035]">
            <div className="bg-[#1a2035] p-4 flex justify-between items-start">
              <div>
                <h4 className="font-medium flex items-center text-white">
                  <Clock className="h-4 w-4 mr-2 text-blue-400" />
                  {sla.stageName}
                </h4>
                <p className="text-sm text-gray-400 mt-1">{sla.description}</p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditSLA(sla)}
                  className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteStageSLA(sla.id)}
                  className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4 bg-[#0d121f]">
              <div className="space-y-4">
                <h5 className="text-sm font-medium text-gray-300">
                  SLA Levels:
                </h5>
                {sla.slaLevels.length > 0 ? (
                  <div className="space-y-2">
                    {sla.slaLevels.map((level) => (
                      <div
                        key={level.id}
                        className="flex items-center justify-between bg-[#1a2035] p-3 rounded-md"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: level.color }}
                          />
                          <div>
                            <div className="font-medium text-sm text-white">
                              {level.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {level.timeframe}{" "}
                              {getTimeUnitLabel(
                                level.timeUnit,
                                level.timeframe
                              )}
                              {level.escalation && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-xs border-[#2a304d] text-gray-300"
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                                  Escalation
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No SLA levels configured for this stage
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleAddStageSLA}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Add Stage SLA
          <Plus className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {editingSLA && (
        <Card className="bg-[#0d121f] border-[#1a2035]">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">
                Edit SLA for {editingSLA.stageName}
              </h3>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="stage-description" className="text-gray-300">
                    Stage Description
                  </Label>
                  <Input
                    id="stage-description"
                    value={editingSLA.description}
                    onChange={(e) =>
                      setEditingSLA({
                        ...editingSLA,
                        description: e.target.value,
                      })
                    }
                    placeholder="Enter stage description"
                    className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="border-t border-[#2a304d] pt-4">
                  <h4 className="text-sm font-medium mb-4 text-white">
                    SLA Levels
                  </h4>

                  {editingSLA.slaLevels.map((level) => (
                    <div
                      key={level.id}
                      className="mb-4 p-4 border border-[#2a304d] rounded-md bg-[#1a2035]"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h5 className="font-medium text-white">{level.name}</h5>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditSLALevel(level)}
                            className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSLALevel(level.id)}
                            className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">
                            Timeframe:
                          </span>
                          <span className="font-medium text-white">
                            {level.timeframe}{" "}
                            {getTimeUnitLabel(level.timeUnit, level.timeframe)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">
                            Escalation:
                          </span>
                          <Badge
                            variant={level.escalation ? "default" : "outline"}
                            className={
                              level.escalation
                                ? "bg-blue-600 text-white"
                                : "border-[#2a304d] text-gray-300"
                            }
                          >
                            {level.escalation ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">
                            Notify Team:
                          </span>
                          <Badge
                            variant={level.notifyTeam ? "default" : "outline"}
                            className={
                              level.notifyTeam
                                ? "bg-blue-600 text-white"
                                : "border-[#2a304d] text-gray-300"
                            }
                          >
                            {level.notifyTeam ? "Yes" : "No"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">
                            Notify Manager:
                          </span>
                          <Badge
                            variant={
                              level.notifyManager ? "default" : "outline"
                            }
                            className={
                              level.notifyManager
                                ? "bg-blue-600 text-white"
                                : "border-[#2a304d] text-gray-300"
                            }
                          >
                            {level.notifyManager ? "Yes" : "No"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}

                  {editingSLALevel ? (
                    <div className="border border-[#2a304d] p-4 rounded-md mt-4 bg-[#1a2035]">
                      <h5 className="font-medium mb-4 text-white">
                        Edit SLA Level
                      </h5>
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label htmlFor="level-name" className="text-gray-300">
                            Level Name
                          </Label>
                          <Input
                            id="level-name"
                            value={editingSLALevel.name}
                            onChange={(e) =>
                              setEditingSLALevel({
                                ...editingSLALevel,
                                name: e.target.value,
                              })
                            }
                            placeholder="Enter level name"
                            className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-gray-300">Timeframe</Label>
                          <div className="flex items-center space-x-4">
                            <div className="flex-1">
                              <Slider
                                value={[editingSLALevel.timeframe]}
                                min={1}
                                max={
                                  editingSLALevel.timeUnit === "minutes"
                                    ? 60
                                    : editingSLALevel.timeUnit === "hours"
                                    ? 24
                                    : 30
                                }
                                step={1}
                                onValueChange={(value) =>
                                  setEditingSLALevel({
                                    ...editingSLALevel,
                                    timeframe: value[0],
                                  })
                                }
                                className="[&>span]:bg-blue-500"
                              />
                            </div>
                            <div className="w-16">
                              <Input
                                type="number"
                                value={editingSLALevel.timeframe}
                                onChange={(e) =>
                                  setEditingSLALevel({
                                    ...editingSLALevel,
                                    timeframe:
                                      Number.parseInt(e.target.value) || 1,
                                  })
                                }
                                min={1}
                                className="bg-[#1a2035] border-[#2a304d] text-white"
                              />
                            </div>
                            <Select
                              value={editingSLALevel.timeUnit}
                              onValueChange={(value) =>
                                setEditingSLALevel({
                                  ...editingSLALevel,
                                  timeUnit: value as
                                    | "minutes"
                                    | "hours"
                                    | "days",
                                })
                              }
                            >
                              <SelectTrigger className="w-24 bg-[#1a2035] border-[#2a304d] text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                                <SelectItem
                                  value="minutes"
                                  className="focus:bg-[#2a304d] focus:text-white"
                                >
                                  Minutes
                                </SelectItem>
                                <SelectItem
                                  value="hours"
                                  className="focus:bg-[#2a304d] focus:text-white"
                                >
                                  Hours
                                </SelectItem>
                                <SelectItem
                                  value="days"
                                  className="focus:bg-[#2a304d] focus:text-white"
                                >
                                  Days
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-4">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="escalation"
                              className="cursor-pointer text-gray-300"
                            >
                              Enable Escalation
                            </Label>
                            <Switch
                              id="escalation"
                              checked={editingSLALevel.escalation}
                              onCheckedChange={(checked) =>
                                setEditingSLALevel({
                                  ...editingSLALevel,
                                  escalation: checked,
                                })
                              }
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="notify-team"
                              className="cursor-pointer text-gray-300"
                            >
                              Notify Team
                            </Label>
                            <Switch
                              id="notify-team"
                              checked={editingSLALevel.notifyTeam}
                              onCheckedChange={(checked) =>
                                setEditingSLALevel({
                                  ...editingSLALevel,
                                  notifyTeam: checked,
                                })
                              }
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="notify-manager"
                              className="cursor-pointer text-gray-300"
                            >
                              Notify Manager
                            </Label>
                            <Switch
                              id="notify-manager"
                              checked={editingSLALevel.notifyManager}
                              onCheckedChange={(checked) =>
                                setEditingSLALevel({
                                  ...editingSLALevel,
                                  notifyManager: checked,
                                })
                              }
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Button
                            onClick={handleUpdateSLALevel}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Update SLA Level
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setEditingSLALevel(null)}
                            className="border-[#2a304d] text-gray-300 hover:bg-[#2a304d] hover:text-white"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-[#2a304d] p-4 rounded-md mt-4 bg-[#1a2035]">
                      <h5 className="font-medium mb-4 text-white">
                        Add New SLA Level
                      </h5>
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label
                            htmlFor="new-level-name"
                            className="text-gray-300"
                          >
                            Level Name
                          </Label>
                          <Input
                            id="new-level-name"
                            value={newSLALevel.name}
                            onChange={(e) =>
                              setNewSLALevel({
                                ...newSLALevel,
                                name: e.target.value,
                              })
                            }
                            placeholder="Enter level name"
                            className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-gray-300">Timeframe</Label>
                          <div className="flex items-center space-x-4">
                            <div className="flex-1">
                              <Slider
                                value={[newSLALevel.timeframe || 4]}
                                min={1}
                                max={
                                  newSLALevel.timeUnit === "minutes"
                                    ? 60
                                    : newSLALevel.timeUnit === "hours"
                                    ? 24
                                    : 30
                                }
                                step={1}
                                onValueChange={(value) =>
                                  setNewSLALevel({
                                    ...newSLALevel,
                                    timeframe: value[0],
                                  })
                                }
                                className="[&>span]:bg-blue-500"
                              />
                            </div>
                            <div className="w-16">
                              <Input
                                type="number"
                                value={newSLALevel.timeframe}
                                onChange={(e) =>
                                  setNewSLALevel({
                                    ...newSLALevel,
                                    timeframe:
                                      Number.parseInt(e.target.value) || 1,
                                  })
                                }
                                min={1}
                                className="bg-[#1a2035] border-[#2a304d] text-white"
                              />
                            </div>
                            <Select
                              value={newSLALevel.timeUnit || "hours"}
                              onValueChange={(value) =>
                                setNewSLALevel({
                                  ...newSLALevel,
                                  timeUnit: value as
                                    | "minutes"
                                    | "hours"
                                    | "days",
                                })
                              }
                            >
                              <SelectTrigger className="w-24 bg-[#1a2035] border-[#2a304d] text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                                <SelectItem
                                  value="minutes"
                                  className="focus:bg-[#2a304d] focus:text-white"
                                >
                                  Minutes
                                </SelectItem>
                                <SelectItem
                                  value="hours"
                                  className="focus:bg-[#2a304d] focus:text-white"
                                >
                                  Hours
                                </SelectItem>
                                <SelectItem
                                  value="days"
                                  className="focus:bg-[#2a304d] focus:text-white"
                                >
                                  Days
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-4">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="new-escalation"
                              className="cursor-pointer text-gray-300"
                            >
                              Enable Escalation
                            </Label>
                            <Switch
                              id="new-escalation"
                              checked={newSLALevel.escalation || false}
                              onCheckedChange={(checked) =>
                                setNewSLALevel({
                                  ...newSLALevel,
                                  escalation: checked,
                                })
                              }
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="new-notify-team"
                              className="cursor-pointer text-gray-300"
                            >
                              Notify Team
                            </Label>
                            <Switch
                              id="new-notify-team"
                              checked={newSLALevel.notifyTeam || false}
                              onCheckedChange={(checked) =>
                                setNewSLALevel({
                                  ...newSLALevel,
                                  notifyTeam: checked,
                                })
                              }
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="new-notify-manager"
                              className="cursor-pointer text-gray-300"
                            >
                              Notify Manager
                            </Label>
                            <Switch
                              id="new-notify-manager"
                              checked={newSLALevel.notifyManager || false}
                              onCheckedChange={(checked) =>
                                setNewSLALevel({
                                  ...newSLALevel,
                                  notifyManager: checked,
                                })
                              }
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                        </div>

                        <Button
                          onClick={handleAddSLALevel}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Add SLA Level
                          <Plus className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    onClick={handleUpdateSLA}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Update Stage SLA
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingSLA(null);
                      setEditingSLALevel(null);
                    }}
                    className="border-[#2a304d] text-gray-300 hover:bg-[#2a304d] hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
