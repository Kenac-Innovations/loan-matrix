"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Edit2, Users, X, Loader2, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  defaultRoles,
  type TeamMember,
  type Team,
  type AssignmentStrategy,
} from "@/shared/defaults/team-config";
import { toast } from "sonner";

const ASSIGNMENT_STRATEGIES: { value: AssignmentStrategy; label: string; description: string }[] = [
  { value: "round_robin", label: "Round Robin", description: "Rotate evenly through team members" },
  { value: "least_loaded", label: "Least Loaded", description: "Assign to member with fewest active leads" },
  { value: "manual", label: "Manual", description: "No auto-assignment; team lead picks up leads" },
  { value: "specific_member", label: "Specific Member", description: "Always assign to one person" },
];

interface PipelineStage {
  id: string;
  name: string;
}

export function TeamConfig() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newTeam, setNewTeam] = useState<Partial<Team>>({
    name: "",
    description: "",
    members: [],
    pipelineStages: [],
    assignmentStrategy: "round_robin",
  });

  const [newMember, setNewMember] = useState<Partial<TeamMember>>({
    name: "",
    email: "",
    role: "",
  });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/pipeline/teams");
      if (response.ok) {
        const data = await response.json();
        // Show whatever is in the database (even if empty)
        setTeams(data.teams || []);
        if (data.stages) {
          setPipelineStages(data.stages.map((s: PipelineStage) => s.name));
        }
      } else {
        console.error("Failed to fetch teams");
        setTeams([]);
      }
    } catch (error) {
      console.error("Error fetching teams:", error);
      setTeams([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTeams = async () => {
    try {
      setIsSaving(true);
      const response = await fetch("/api/pipeline/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams }),
      });

      if (response.ok) {
        toast.success("Teams saved successfully");
        setHasChanges(false);
        await fetchTeams();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save teams");
      }
    } catch (error) {
      console.error("Error saving teams:", error);
      toast.error("Error saving teams");
    } finally {
      setIsSaving(false);
    }
  };

  const markChanged = () => {
    setHasChanges(true);
  };

  const handleAddTeam = () => {
    if (!newTeam.name) return;

    const team: Team = {
      id: `new-${Date.now()}`,
      name: newTeam.name,
      description: newTeam.description || "",
      members: newTeam.members || [],
      pipelineStages: newTeam.pipelineStages || [],
      assignmentStrategy: newTeam.assignmentStrategy || "round_robin",
    };

    setTeams([...teams, team]);
    setNewTeam({ name: "", description: "", members: [], pipelineStages: [], assignmentStrategy: "round_robin" });
    markChanged();
  };

  const handleDeleteTeam = (id: string) => {
    setTeams(teams.filter((team) => team.id !== id));
    markChanged();
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam({ ...team }); // Create a copy to avoid direct mutation
  };

  const handleUpdateTeam = () => {
    if (!editingTeam) return;

    setTeams(
      teams.map((team) => (team.id === editingTeam.id ? editingTeam : team))
    );

    setEditingTeam(null);
    markChanged();
  };

  const handleAddMember = () => {
    if (!newMember.name || !newMember.email) return;

    const member: TeamMember = {
      id: `new-${Date.now()}`,
      name: newMember.name,
      email: newMember.email,
      role: newMember.role || "Team Member",
    };

    if (editingTeam) {
      setEditingTeam({
        ...editingTeam,
        members: [...editingTeam.members, member],
      });
    } else {
      setNewTeam({
        ...newTeam,
        members: [...(newTeam.members || []), member],
      });
    }

    setNewMember({ name: "", email: "", role: "" });
    markChanged();
  };

  const handleDeleteMember = (teamId: string, memberId: string) => {
    if (editingTeam && editingTeam.id === teamId) {
      setEditingTeam({
        ...editingTeam,
        members: editingTeam.members.filter((m) => m.id !== memberId),
      });
    } else {
      setTeams(
        teams.map((team) => {
          if (team.id === teamId) {
            return {
              ...team,
              members: team.members.filter((m) => m.id !== memberId),
            };
          }
          return team;
        })
      );
    }
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
        <h3 className="text-lg font-medium">Teams Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure teams and assign them to pipeline stages
        </p>
        </div>
        {hasChanges && (
          <Button
            onClick={saveTeams}
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

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.id} className="overflow-hidden">
            <div className="bg-muted/50 p-4 flex justify-between items-start">
              <div>
                <h4 className="font-medium flex items-center">
                  <Users className="h-4 w-4 mr-2 text-blue-400" />
                  {team.name}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {team.description}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditTeam(team)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteTeam(team.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium mb-2">Pipeline Stages:</h5>
                  <div className="flex flex-wrap gap-2">
                    {team.pipelineStages.map((stage) => (
                      <Badge key={stage} variant="secondary">
                        {stage}
                      </Badge>
                    ))}
                    {team.pipelineStages.length === 0 && (
                      <span className="text-sm text-muted-foreground">
                        No stages assigned
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-medium mb-1">Assignment Strategy:</h5>
                  <Badge variant="outline" className="text-xs">
                    {ASSIGNMENT_STRATEGIES.find((s) => s.value === team.assignmentStrategy)?.label || "Round Robin"}
                  </Badge>
                </div>
                <div>
                  <h5 className="text-sm font-medium mb-2">Team Members:</h5>
                  <div className="space-y-2">
                    {team.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-muted/50 p-2 rounded-md"
                      >
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={member.avatar || "/placeholder.svg"}
                            />
                            <AvatarFallback>
                              {member.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {member.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {member.role}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMember(team.id, member.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {team.members.length === 0 && (
                      <span className="text-sm text-muted-foreground">
                        No members added
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">
              {editingTeam ? `Edit Team: ${editingTeam.name}` : "Add New Team"}
            </h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  value={editingTeam ? editingTeam.name : newTeam.name}
                  onChange={(e) =>
                    editingTeam
                      ? setEditingTeam({ ...editingTeam, name: e.target.value })
                      : setNewTeam({ ...newTeam, name: e.target.value })
                  }
                  placeholder="Enter team name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="team-description">Description</Label>
                <Textarea
                  id="team-description"
                  value={
                    editingTeam
                      ? editingTeam.description
                      : newTeam.description || ""
                  }
                  onChange={(e) =>
                    editingTeam
                      ? setEditingTeam({
                          ...editingTeam,
                          description: e.target.value,
                        })
                      : setNewTeam({ ...newTeam, description: e.target.value })
                  }
                  placeholder="Enter team description"
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>Pipeline Stages</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                  {pipelineStages.map((stage) => {
                    const currentStages = editingTeam
                      ? editingTeam.pipelineStages
                      : newTeam.pipelineStages || [];
                    const isChecked = currentStages.includes(stage);

                    return (
                      <div key={stage} className="flex items-center space-x-2">
                        <Checkbox
                          id={`stage-${stage}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const updatedStages = checked
                              ? [...currentStages, stage]
                              : currentStages.filter((s) => s !== stage);

                            if (editingTeam) {
                              setEditingTeam({
                                ...editingTeam,
                                pipelineStages: updatedStages,
                              });
                            } else {
                              setNewTeam({
                                ...newTeam,
                                pipelineStages: updatedStages,
                              });
                            }
                          }}
                        />
                        <Label
                          htmlFor={`stage-${stage}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {stage}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(editingTeam
                    ? editingTeam.pipelineStages
                    : newTeam.pipelineStages || []
                  ).map((stage) => (
                    <Badge
                      key={stage}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {stage}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => {
                          const currentStages = editingTeam
                            ? editingTeam.pipelineStages
                            : newTeam.pipelineStages || [];
                          const updatedStages = currentStages.filter(
                            (s) => s !== stage
                          );

                          if (editingTeam) {
                            setEditingTeam({
                              ...editingTeam,
                              pipelineStages: updatedStages,
                            });
                          } else {
                            setNewTeam({
                              ...newTeam,
                              pipelineStages: updatedStages,
                            });
                          }
                        }}
                      />
                    </Badge>
                  ))}
                  {(editingTeam
                    ? editingTeam.pipelineStages
                    : newTeam.pipelineStages || []
                  ).length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      No stages selected
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Assignment Strategy</Label>
                <Select
                  value={editingTeam ? (editingTeam.assignmentStrategy || "round_robin") : (newTeam.assignmentStrategy || "round_robin")}
                  onValueChange={(value: AssignmentStrategy) => {
                    if (editingTeam) {
                      setEditingTeam({ ...editingTeam, assignmentStrategy: value });
                    } else {
                      setNewTeam({ ...newTeam, assignmentStrategy: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNMENT_STRATEGIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <div>
                          <span className="font-medium">{s.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {s.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4 mt-2">
                <h4 className="text-sm font-medium mb-4">Team Members</h4>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label htmlFor="member-name">Name</Label>
                      <Input
                        id="member-name"
                        value={newMember.name}
                        onChange={(e) =>
                          setNewMember({ ...newMember, name: e.target.value })
                        }
                        placeholder="Member name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="member-email">Email</Label>
                      <Input
                        id="member-email"
                        type="email"
                        value={newMember.email}
                        onChange={(e) =>
                          setNewMember({ ...newMember, email: e.target.value })
                        }
                        placeholder="Member email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="member-role">Role</Label>
                      <Input
                        id="member-role"
                        value={newMember.role}
                        onChange={(e) =>
                          setNewMember({ ...newMember, role: e.target.value })
                        }
                        placeholder="Member role"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddMember}
                    variant="outline"
                    className="w-full"
                  >
                    Add Team Member
                    <Plus className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {(editingTeam
                    ? editingTeam.members
                    : newTeam.members || []
                  ).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between bg-muted/50 p-2 rounded-md"
                    >
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {member.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.email} • {member.role}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleDeleteMember(
                            editingTeam ? editingTeam.id : "new",
                            member.id
                          )
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={editingTeam ? handleUpdateTeam : handleAddTeam}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingTeam ? "Update Team" : "Add Team"}
              </Button>
              {editingTeam && (
                <Button variant="outline" onClick={() => setEditingTeam(null)}>
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
