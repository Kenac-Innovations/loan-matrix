"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Edit2, Users, X, Loader2, Save, Search } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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

const TEAM_MODAL_CLASSNAME =
  "max-h-[94vh] sm:max-w-[72rem] xl:max-w-[84rem] 2xl:max-w-[90rem] flex flex-col overflow-hidden p-0";

const MEMBER_PICKER_MODAL_CLASSNAME =
  "h-[min(92vh,54rem)] sm:max-w-5xl xl:max-w-6xl flex flex-col overflow-hidden p-0";

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

interface MemberDraft {
  role: string;
  approvalLimit: string;
}

const DEFAULT_MEMBER_DRAFT: MemberDraft = {
  role: "Team Member",
  approvalLimit: "",
};

function TeamMemberPickerDialog({
  open,
  onOpenChange,
  systemUsers,
  existingMembers,
  onAddMember,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemUsers: FineractUser[];
  existingMembers: TeamMember[];
  onAddMember: (member: TeamMember) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberDraft>>({});

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setMemberDrafts({});
    }
  }, [open]);

  const existingMemberIds = useMemo(
    () => new Set(existingMembers.map((member) => member.userId)),
    [existingMembers]
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const sortedUsers = [...systemUsers].sort((left, right) => {
      const leftAdded = existingMemberIds.has(String(left.id)) ? 1 : 0;
      const rightAdded = existingMemberIds.has(String(right.id)) ? 1 : 0;

      if (leftAdded !== rightAdded) {
        return leftAdded - rightAdded;
      }

      return left.displayName.localeCompare(right.displayName);
    });

    if (!normalizedSearch) {
      return sortedUsers;
    }

    return sortedUsers.filter((user) =>
      [
        user.displayName,
        user.username,
        user.email,
        user.officeName,
        user.firstname,
        user.lastname,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [existingMemberIds, searchQuery, systemUsers]);

  const availableUsersCount = systemUsers.filter(
    (user) => !existingMemberIds.has(String(user.id))
  ).length;

  const getDraft = (userId: string): MemberDraft =>
    memberDrafts[userId] || DEFAULT_MEMBER_DRAFT;

  const updateDraft = (userId: string, updates: Partial<MemberDraft>) => {
    setMemberDrafts((currentDrafts) => ({
      ...currentDrafts,
      [userId]: {
        ...DEFAULT_MEMBER_DRAFT,
        ...currentDrafts[userId],
        ...updates,
      },
    }));
  };

  const handleAddMember = (user: FineractUser) => {
    const userId = String(user.id);

    if (existingMemberIds.has(userId)) {
      toast.error("User is already a member of this team");
      return;
    }

    const draft = getDraft(userId);

    onAddMember({
      id: `new-${Date.now()}-${userId}`,
      userId,
      name: user.displayName,
      email: user.email || user.username,
      role: draft.role || DEFAULT_MEMBER_DRAFT.role,
      approvalLimit: draft.approvalLimit
        ? Number.parseFloat(draft.approvalLimit)
        : null,
    });

    setMemberDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[userId];
      return nextDrafts;
    });

    toast.success(`${user.displayName} added to team`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={MEMBER_PICKER_MODAL_CLASSNAME}>
        <DialogHeader className="shrink-0 gap-3 border-b px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Team Members
              </DialogTitle>
              <DialogDescription className="max-w-3xl">
                Search users, review branch details, and add each person with their
                team role and optional approval limit.
              </DialogDescription>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Badge variant="secondary" className="px-2.5 py-1">
                {availableUsersCount} available
              </Badge>
              <Badge variant="outline" className="px-2.5 py-1">
                {existingMembers.length} in team
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="shrink-0 border-b px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, username, email, or branch"
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium">No users match that search.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different name, username, email, or branch.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredUsers.map((user) => {
                const userId = String(user.id);
                const draft = getDraft(userId);
                const isExistingMember = existingMemberIds.has(userId);

                return (
                  <div
                    key={user.id}
                    className="grid gap-4 px-6 py-4 lg:grid-cols-[minmax(0,1.2fr)_220px_180px_112px] lg:items-center"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar className="mt-0.5 h-10 w-10">
                        <AvatarFallback>
                          {(user.displayName || user.username)
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{user.displayName}</p>
                          {isExistingMember && (
                            <Badge variant="secondary" className="px-2 py-0.5">
                              Added
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.username}
                          {user.email ? ` • ${user.email}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.officeName || "No branch assigned"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Role in Team</Label>
                      <Select
                        value={draft.role}
                        onValueChange={(value) => updateDraft(userId, { role: value })}
                        disabled={isExistingMember}
                      >
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

                    <div className="space-y-2">
                      <Label className="text-xs">Approval Limit</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Unlimited"
                        value={draft.approvalLimit}
                        disabled={isExistingMember}
                        onChange={(event) =>
                          updateDraft(userId, {
                            approvalLimit: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-end lg:justify-end">
                      <Button
                        variant={isExistingMember ? "secondary" : "outline"}
                        disabled={isExistingMember}
                        onClick={() => handleAddMember(user)}
                        className="w-full lg:w-auto"
                      >
                        {isExistingMember ? "Added" : "Add"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  const members = team.members || [];
  const stages = team.pipelineStages || [];

  return (
    <>
      <TeamMemberPickerDialog
        open={isAddMemberModalOpen}
        onOpenChange={setIsAddMemberModalOpen}
        systemUsers={systemUsers}
        existingMembers={members}
        onAddMember={onAddMember}
      />

      <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="grid gap-2">
          <Label>Team Name</Label>
          <Input
            value={team.name || ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Enter team name"
          />
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
      </div>

      <div className="grid gap-2">
        <Label>Description</Label>
        <Textarea
          value={team.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Enter team description"
          rows={3}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
        <section className="space-y-4 rounded-lg border p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Pipeline Stages</h4>
            <p className="text-sm text-muted-foreground">
              Choose the workflow stages this team is responsible for.
            </p>
          </div>

          <ScrollArea className="h-64 rounded-md border">
            <div className="space-y-2 p-3">
              {pipelineStages.map((stage) => (
                <div key={stage} className="flex items-center space-x-2 rounded-md px-1 py-1">
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
                    className="cursor-pointer text-sm font-normal"
                  >
                    {stage}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>

          {stages.length > 0 ? (
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
          ) : (
            <p className="text-sm text-muted-foreground">
              No pipeline stages selected yet.
            </p>
          )}
        </section>

        <section className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Team Members</h4>
              <p className="text-sm text-muted-foreground">
                Add the people who can work leads in this team.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge variant="outline">
                {members.length} member{members.length === 1 ? "" : "s"}
              </Badge>
              <Button
                onClick={() => setIsAddMemberModalOpen(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Team Member
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <ScrollArea className="h-64 rounded-md border">
              <div className="space-y-2 p-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-md border bg-muted/30 p-3"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{member.name}</div>
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
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {members.length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No members added yet. Use <span className="font-medium">Add Team Member</span> to start building this team.
                  </div>
                )}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              Team members listed here can work leads in the selected stages.
            </p>
          </div>
        </section>
      </div>
      </div>
    </>
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
        <DialogContent className={TEAM_MODAL_CLASSNAME}>
          <DialogHeader className="shrink-0 border-b px-6 py-5">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Team
            </DialogTitle>
            <DialogDescription>
              Set up a new team with members and pipeline stage assignments.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-6 py-5">
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
            </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:gap-0">
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
        <DialogContent className={TEAM_MODAL_CLASSNAME}>
          <DialogHeader className="shrink-0 gap-4 border-b px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2">
                  <Edit2 className="h-5 w-5" />
                  Edit Team: {editingTeam?.name}
                </DialogTitle>
                <DialogDescription className="max-w-3xl">
                  Update team details, stage coverage, and membership without leaving
                  this screen.
                </DialogDescription>
              </div>

              {editingTeam && (
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Badge variant="secondary" className="px-2.5 py-1">
                    {editingTeam.pipelineStages.length} stage
                    {editingTeam.pipelineStages.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="secondary" className="px-2.5 py-1">
                    {editingTeam.members.length} member
                    {editingTeam.members.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline" className="px-2.5 py-1">
                    {ASSIGNMENT_STRATEGIES.find(
                      (strategy) => strategy.value === editingTeam.assignmentStrategy
                    )?.label || "Round Robin"}
                  </Badge>
                </div>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-6 py-5">
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
            </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:gap-0">
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
