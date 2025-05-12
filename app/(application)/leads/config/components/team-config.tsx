"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Edit2, Users } from "lucide-react";
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
    setEditingTeam(team);
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

  const handleStageChange = (value: string) => {
    const stages = value.split(",").filter(Boolean);

    if (editingTeam) {
      setEditingTeam({
        ...editingTeam,
        pipelineStages: stages,
      });
    } else {
      setNewTeam({
        ...newTeam,
        pipelineStages: stages,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Teams Configuration</h3>
        <p className="text-sm text-gray-400">
          Configure teams and assign them to pipeline stages
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <Card
            key={team.id}
            className="overflow-hidden bg-[#0d121f] border-[#1a2035]"
          >
            <div className="bg-[#1a2035] p-4 flex justify-between items-start">
              <div>
                <h4 className="font-medium flex items-center text-white">
                  <Users className="h-4 w-4 mr-2 text-blue-400" />
                  {team.name}
                </h4>
                <p className="text-sm text-gray-400 mt-1">{team.description}</p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditTeam(team)}
                  className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteTeam(team.id)}
                  className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4 bg-[#0d121f]">
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium mb-2 text-gray-300">
                    Pipeline Stages:
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {team.pipelineStages.map((stage) => (
                      <Badge
                        key={stage}
                        variant="secondary"
                        className="bg-[#2a304d] text-gray-300 hover:bg-[#3a405d]"
                      >
                        {stage}
                      </Badge>
                    ))}
                    {team.pipelineStages.length === 0 && (
                      <span className="text-sm text-gray-500">
                        No stages assigned
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-medium mb-2 text-gray-300">
                    Team Members:
                  </h5>
                  <div className="space-y-2">
                    {team.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-[#1a2035] p-2 rounded-md"
                      >
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8 border border-[#2a304d]">
                            <AvatarImage
                              src={member.avatar || "/placeholder.svg"}
                            />
                            <AvatarFallback className="bg-[#2a304d] text-gray-300">
                              {member.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm text-white">
                              {member.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {member.role}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMember(team.id, member.id)}
                          className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {team.members.length === 0 && (
                      <span className="text-sm text-gray-500">
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

      <Card className="bg-[#0d121f] border-[#1a2035]">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">
              {editingTeam ? `Edit Team: ${editingTeam.name}` : "Add New Team"}
            </h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="team-name" className="text-gray-300">
                  Team Name
                </Label>
                <Input
                  id="team-name"
                  value={editingTeam ? editingTeam.name : newTeam.name}
                  onChange={(e) =>
                    editingTeam
                      ? setEditingTeam({ ...editingTeam, name: e.target.value })
                      : setNewTeam({ ...newTeam, name: e.target.value })
                  }
                  placeholder="Enter team name"
                  className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="team-description" className="text-gray-300">
                  Description
                </Label>
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
                  className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pipeline-stages" className="text-gray-300">
                  Pipeline Stages
                </Label>
                <Select
                  onValueChange={handleStageChange}
                  value={(editingTeam
                    ? editingTeam.pipelineStages
                    : newTeam.pipelineStages || []
                  ).join(",")}
                >
                  <SelectTrigger
                    id="pipeline-stages"
                    className="bg-[#1a2035] border-[#2a304d] text-white"
                  >
                    <SelectValue placeholder="Select stages" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2035] border-[#2a304d] text-white">
                    {pipelineStages.map((stage) => (
                      <SelectItem
                        key={stage}
                        value={stage}
                        className="focus:bg-[#2a304d] focus:text-white"
                      >
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(editingTeam
                    ? editingTeam.pipelineStages
                    : newTeam.pipelineStages || []
                  ).map((stage) => (
                    <Badge
                      key={stage}
                      variant="secondary"
                      className="bg-[#2a304d] text-gray-300 hover:bg-[#3a405d]"
                    >
                      {stage}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#2a304d] pt-4 mt-2">
                <h4 className="text-sm font-medium mb-4 text-white">
                  Team Members
                </h4>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label htmlFor="member-name" className="text-gray-300">
                        Name
                      </Label>
                      <Input
                        id="member-name"
                        value={newMember.name}
                        onChange={(e) =>
                          setNewMember({ ...newMember, name: e.target.value })
                        }
                        placeholder="Member name"
                        className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="member-email" className="text-gray-300">
                        Email
                      </Label>
                      <Input
                        id="member-email"
                        type="email"
                        value={newMember.email}
                        onChange={(e) =>
                          setNewMember({ ...newMember, email: e.target.value })
                        }
                        placeholder="Member email"
                        className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div>
                      <Label htmlFor="member-role" className="text-gray-300">
                        Role
                      </Label>
                      <Input
                        id="member-role"
                        value={newMember.role}
                        onChange={(e) =>
                          setNewMember({ ...newMember, role: e.target.value })
                        }
                        placeholder="Member role"
                        className="bg-[#1a2035] border-[#2a304d] text-white placeholder:text-gray-500"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddMember}
                    variant="outline"
                    className="w-full border-[#2a304d] text-gray-300 hover:bg-[#2a304d] hover:text-white"
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
                      className="flex items-center justify-between bg-[#1a2035] p-2 rounded-md"
                    >
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8 border border-[#2a304d]">
                          <AvatarFallback className="bg-[#2a304d] text-gray-300">
                            {member.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm text-white">
                            {member.name}
                          </div>
                          <div className="text-xs text-gray-400">
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
                        className="text-gray-400 hover:text-white hover:bg-[#2a304d]"
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
                <Button
                  variant="outline"
                  onClick={() => setEditingTeam(null)}
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
