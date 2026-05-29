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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const ASSIGNMENT_STRATEGIES: {
  value: AssignmentStrategy;
  label: string;
  description: string;
}[] = [
  {
    value: "round_robin",
    label: "Round Robin",
    description: "Rotate evenly through team members",
  },
  {
    value: "least_loaded",
    label: "Least Loaded",
    description: "Assign to member with fewest active leads",
  },
  {
    value: "manual",
    label: "Manual",
    description: "No auto-assignment; team lead picks up leads",
  },
  {
    value: "specific_member",
    label: "Specific Member",
    description: "Always assign to one person",
  },
];

interface FineractUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  displayName: string;
  email: string;
  officeId: number;
  officeName: string;
  roles: string[];
}

interface PipelineStage {
  id: string;
  name: string;
}

function TeamFormFields({
  team,
  onUpdate,
  pipelineStages,
  systemUsers,
  onAddMember,
  onRemoveMember,
}: {
  team: Team | Partial<Team>;
  onUpdate: (updates: Partial<Team>) => void;
  pipelineStages: string[];
  systemUsers: FineractUser[];
  onAddMember: (member: TeamMember) => void;
  onRemoveMember: (memberId: string) => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberRole, setMemberRole] = useState("Team Member");
  const [memberApprovalLimit, setMemberApprovalLimit] = useState<string>("");

  const members = team.members || [];
  const stages = team.pipelineStages || [];

  const handleAdd = () => {
    if (!selectedUserId) return;
    const user = systemUsers.find((u) => String(u.id) === selectedUserId);
    if (!user) return;

    if (members.some((m) => m.userId === selectedUserId)) {
      toast.error("User is already a member of this team");
      return;
    }

    onAddMember({
      id: `new-${Date.now()}`,
      userId: String(user.id),
      name: user.displayName,
      email: user.email || user.username,
      role: memberRole || "Team Member",
      approvalLimit: memberApprovalLimit ? Number.parseFloat(memberApprovalLimit) : null,
    });

    setSelectedUserId("");
    setMemberRole("Team Member");
    setMemberApprovalLimit("");
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Team Name</Label>
        <Input
          value={team.name || ""}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Enter team name"
        />
      </div>

      <div className="grid gap-2">
        <Label>Description</Label>
        <Textarea
          value={team.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Enter team description"
          rows={2}
        />
      </div>

      <div className="grid gap-2">
        <Label>Pipeline Stages</Label>
        <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
          {pipelineStages.map((stage) => (
            <div key={stage} className="flex items-center space-x-2">
              <Checkbox
                id={`stage-${team.id || "new"}-${stage}`}
                checked={stages.includes(stage)}
                onCheckedChange={(checked) => {
                  const updated = checked
                    ? [...stages, stage]
                    : stages.filter((s) => s !== stage);
                  onUpdate({ pipelineStages: updated });
                }}
              />
              <Label
                htmlFor={`stage-${team.id || "new"}-${stage}`}
                className="text-sm font-normal cursor-pointer"
              >
                {stage}
              </Label>
            </div>
          ))}
        </div>
        {stages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {stages.map((stage) => (
              <Badge
                key={stage}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {stage}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={() =>
                    onUpdate({
                      pipelineStages: stages.filter((s) => s !== stage),
                    })
                  }
                />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Assignment Strategy</Label>
        <Select
          value={team.assignmentStrategy || "round_robin"}
          onValueChange={(value: AssignmentStrategy) =>
            onUpdate({ assignmentStrategy: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select strategy" />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNMENT_STRATEGIES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  — {s.description}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-t pt-4 mt-1">
        <h4 className="text-sm font-medium mb-3">Team Members</h4>

        <div className="space-y-2 mb-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between bg-muted/50 p-2 rounded-md"
            >
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-sm">{member.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {member.email} &middot; {member.role}
                    {member.approvalLimit != null && (
                      <> &middot; Limit: K{member.approvalLimit.toLocaleString()}</>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveMember(member.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">No members added</p>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                {systemUsers.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.displayName} ({user.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Role in Team</Label>
            <Select value={memberRole} onValueChange={setMemberRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {defaultRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Approval Limit</Label>
            <Input
              type="number"
              min={0}
              placeholder="Unlimited"
              value={memberApprovalLimit}
              onChange={(e) => setMemberApprovalLimit(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={handleAdd}
          variant="outline"
          size="sm"
          className="w-full mt-2"
          disabled={!selectedUserId}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
      </div>
    </div>
  );
}

export function TeamConfig() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [systemUsers, setSystemUsers] = useState<FineractUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const emptyTeam: Partial<Team> = {
    name: "",
    description: "",
    members: [],
    pipelineStages: [],
    assignmentStrategy: "round_robin",
  };
  const [newTeam, setNewTeam] = useState<Partial<Team>>(emptyTeam);

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/pipeline/teams");
      if (response.ok) {
        const data = await response.json();
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

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/fineract/users");
      if (response.ok) {
        const data = await response.json();
        setSystemUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching system users:", error);
    }
  };

  const persistTeams = async (teamsToSave: Team[]) => {
    try {
      setIsSaving(true);
      const response = await fetch("/api/pipeline/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: teamsToSave }),
      });

      if (response.ok) {
        toast.success("Teams saved successfully");
        await fetchTeams();
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save teams");
        return false;
      }
    } catch (error) {
      console.error("Error saving teams:", error);
      toast.error("Error saving teams");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTeam = async () => {
    if (!newTeam.name) return;

    const team: Team = {
      id: `new-${Date.now()}`,
      name: newTeam.name,
      description: newTeam.description || "",
      members: newTeam.members || [],
      pipelineStages: newTeam.pipelineStages || [],
      assignmentStrategy: newTeam.assignmentStrategy || "round_robin",
    };

    const updated = [...teams, team];
    setTeams(updated);
    const ok = await persistTeams(updated);
    if (ok) {
      setNewTeam({ ...emptyTeam });
      setIsCreateModalOpen(false);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    const updated = teams.filter((team) => team.id !== id);
    setTeams(updated);
    await persistTeams(updated);
  };

  const openEditModal = (team: Team) => {
    setEditingTeam({ ...team, members: team.members.map((m) => ({ ...m })) });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTeam) return;
    const updated = teams.map((t) =>
      t.id === editingTeam.id ? editingTeam : t
    );
    setTeams(updated);
    const ok = await persistTeams(updated);
    if (ok) {
      setIsEditModalOpen(false);
      setEditingTeam(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingTeam(null);
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
        <div className="flex items-center gap-3">
          {isSaving && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </div>
          )}
          <Button
            onClick={() => {
              setNewTeam({ ...emptyTeam });
              setIsCreateModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </Button>
        </div>
      </div>

      {/* Team cards */}
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
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditModal(team)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteTeam(team.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium mb-2">Pipeline Stages</h5>
                  <div className="flex flex-wrap gap-1.5">
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
                  <h5 className="text-sm font-medium mb-1">
                    Assignment Strategy
                  </h5>
                  <Badge variant="outline" className="text-xs">
                    {ASSIGNMENT_STRATEGIES.find(
                      (s) => s.value === team.assignmentStrategy
                    )?.label || "Round Robin"}
                  </Badge>
                </div>
                <div>
                  <h5 className="text-sm font-medium mb-2">
                    Members ({team.members.length})
                  </h5>
                  <div className="space-y-2">
                    {team.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center space-x-2 bg-muted/50 p-2 rounded-md"
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarImage
                            src={member.avatar || "/placeholder.svg"}
                          />
                          <AvatarFallback className="text-xs">
                            {member.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {member.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.role}
                            {member.approvalLimit != null && (
                              <> &middot; Limit: K{member.approvalLimit.toLocaleString()}</>
                            )}
                          </div>
                        </div>
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

      {/* Create Team Modal */}
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={() => {
          setIsCreateModalOpen(false);
          setNewTeam({ ...emptyTeam });
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Team
            </DialogTitle>
            <DialogDescription>
              Set up a new team with members and pipeline stage assignments.
            </DialogDescription>
          </DialogHeader>

          <TeamFormFields
            team={newTeam}
            onUpdate={(updates) => setNewTeam({ ...newTeam, ...updates })}
            pipelineStages={pipelineStages}
            systemUsers={systemUsers}
            onAddMember={(member) =>
              setNewTeam({
                ...newTeam,
                members: [...(newTeam.members || []), member],
              })
            }
            onRemoveMember={(memberId) =>
              setNewTeam({
                ...newTeam,
                members: (newTeam.members || []).filter(
                  (m) => m.id !== memberId
                ),
              })
            }
          />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewTeam({ ...emptyTeam });
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTeam}
              disabled={isSaving || !newTeam.name}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {isSaving ? "Creating..." : "Create Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={handleCancelEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Team: {editingTeam?.name}
            </DialogTitle>
            <DialogDescription>
              Update team details, pipeline stages, and members.
            </DialogDescription>
          </DialogHeader>

          {editingTeam && (
            <TeamFormFields
              team={editingTeam}
              onUpdate={(updates) =>
                setEditingTeam({ ...editingTeam, ...updates })
              }
              pipelineStages={pipelineStages}
              systemUsers={systemUsers}
              onAddMember={(member) =>
                setEditingTeam({
                  ...editingTeam,
                  members: [...editingTeam.members, member],
                })
              }
              onRemoveMember={(memberId) =>
                setEditingTeam({
                  ...editingTeam,
                  members: editingTeam.members.filter(
                    (m) => m.id !== memberId
                  ),
                })
              }
            />
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving ? "Saving..." : "Save Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
