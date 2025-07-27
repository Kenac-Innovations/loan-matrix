"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Edit2, Users, X } from "lucide-react";
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
import { TeamAwareStateMachineService } from "@/lib/team-state-machine-service";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
};

type Team = {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
  pipelineStages: string[];
};

export function TeamConfig() {
  const [teams, setTeams] = useState<Team[]>([
    {
      id: "1",
      name: "Sales Team",
      description:
        "Responsible for initial lead qualification and sales process",
      members: [
        {
          id: "1",
          name: "John Doe",
          email: "john@example.com",
          role: "Sales Manager",
          avatar: "/robert-johnson-avatar.png",
        },
        {
          id: "2",
          name: "Jane Smith",
          email: "jane@example.com",
          role: "Sales Representative",
        },
      ],
      pipelineStages: ["New Lead", "Qualification", "Proposal"],
    },
    {
      id: "2",
      name: "Finance Team",
      description: "Handles financial verification and approval",
      members: [
        {
          id: "3",
          name: "Robert Johnson",
          email: "robert@example.com",
          role: "Finance Manager",
        },
        {
          id: "4",
          name: "Sarah Williams",
          email: "sarah@example.com",
          role: "Financial Analyst",
        },
      ],
      pipelineStages: ["Negotiation"],
    },
    {
      id: "3",
      name: "Customer Success",
      description: "Manages onboarding and customer relationship",
      members: [
        {
          id: "5",
          name: "Michael Brown",
          email: "michael@example.com",
          role: "Customer Success Manager",
        },
      ],
      pipelineStages: ["Closed Won"],
    },
  ]);

  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newTeam, setNewTeam] = useState<Partial<Team>>({
    name: "",
    description: "",
    members: [],
    pipelineStages: [],
  });

  const [newMember, setNewMember] = useState<Partial<TeamMember>>({
    name: "",
    email: "",
    role: "",
  });

  const pipelineStages = [
    "New Lead",
    "Qualification",
    "Proposal",
    "Negotiation",
    "Closed Won",
    "Closed Lost",
  ];

  const handleAddTeam = () => {
    if (!newTeam.name) return;

    const team: Team = {
      id: Date.now().toString(),
      name: newTeam.name,
      description: newTeam.description || "",
      members: newTeam.members || [],
      pipelineStages: newTeam.pipelineStages || [],
    };

    setTeams([...teams, team]);
    setNewTeam({ name: "", description: "", members: [], pipelineStages: [] });
  };

  const handleDeleteTeam = (id: string) => {
    setTeams(teams.filter((team) => team.id !== id));
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
  };

  const handleAddMember = () => {
    if (!newMember.name || !newMember.email) return;

    const member: TeamMember = {
      id: Date.now().toString(),
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
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Teams Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure teams and assign them to pipeline stages
        </p>
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
