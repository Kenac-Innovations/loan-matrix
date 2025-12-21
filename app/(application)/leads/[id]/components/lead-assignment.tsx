"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  UserCheck,
  UserX,
  Users,
  Loader2,
  RefreshCw,
  CheckCircle,
  Banknote,
} from "lucide-react";

interface MifosUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  displayName: string;
  email?: string;
  officeId: number;
  officeName?: string;
  roles?: string[];
}

interface LoanActionInfo {
  approvedBy: string | null;
  approvedOnDate: string | null;
  disbursedBy: string | null;
  disbursedOnDate: string | null;
  loanStatus: string | null;
}

interface LeadAssignmentProps {
  leadId: string;
  isSubmitted: boolean;
  currentAssignment?: {
    userId: number | null;
    userName: string | null;
    assignedAt: string | null;
  };
  currentUserId?: number; // Current logged-in Mifos user ID
  onAssignmentChange?: () => void;
  loanActionInfo?: LoanActionInfo;
}

export function LeadAssignment({
  leadId,
  isSubmitted,
  currentAssignment,
  currentUserId,
  onAssignmentChange,
  loanActionInfo,
}: LeadAssignmentProps) {
  const [users, setUsers] = useState<MifosUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [isAssigned, setIsAssigned] = useState(!!currentAssignment?.userId);
  const [assignedUser, setAssignedUser] = useState<{
    userId: number | null;
    userName: string | null;
    assignedAt: string | null;
  } | null>(currentAssignment || null);

  // Check if current user is the assigned user
  const isCurrentUserAssigned =
    currentUserId && assignedUser?.userId === currentUserId;

  // Check if loan is disbursed (active status means disbursed)
  const isDisbursed =
    loanActionInfo?.loanStatus?.toLowerCase() === "active" ||
    loanActionInfo?.loanStatus?.toLowerCase().includes("disbursed");

  // Fetch Mifos users
  const fetchUsers = async () => {
    setIsFetchingUsers(true);
    try {
      const response = await fetch("/api/fineract/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        console.error("Failed to fetch users");
        toast.error("Failed to fetch users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error fetching users");
    } finally {
      setIsFetchingUsers(false);
    }
  };

  useEffect(() => {
    if (isSubmitted) {
      fetchUsers();
    }
  }, [isSubmitted]);

  // Update local state when currentAssignment changes
  useEffect(() => {
    setIsAssigned(!!currentAssignment?.userId);
    setAssignedUser(currentAssignment || null);
  }, [currentAssignment]);

  // Handle assigning a lead
  const handleAssign = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    setIsLoading(true);
    try {
      const selectedUser = users.find(
        (u) => u.id.toString() === selectedUserId
      );
      if (!selectedUser) {
        toast.error("Selected user not found");
        return;
      }

      const response = await fetch(`/api/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mifosUserId: selectedUser.id,
          mifosUserName: selectedUser.displayName,
          assignedByUserId: currentUserId?.toString() || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsAssigned(true);
        setAssignedUser({
          userId: data.lead.assignedToUserId,
          userName: data.lead.assignedToUserName,
          assignedAt: data.lead.assignedAt,
        });
        toast.success(`Lead assigned to ${selectedUser.displayName}`);
        onAssignmentChange?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to assign lead");
      }
    } catch (error) {
      console.error("Error assigning lead:", error);
      toast.error("Error assigning lead");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle assigning to self
  const handleAssignToSelf = async () => {
    if (!currentUserId) {
      toast.error("Current user ID not available");
      return;
    }

    const currentUser = users.find((u) => u.id === currentUserId);
    if (!currentUser) {
      toast.error("Current user not found in user list");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mifosUserId: currentUser.id,
          mifosUserName: currentUser.displayName,
          assignedByUserId: currentUserId.toString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsAssigned(true);
        setAssignedUser({
          userId: data.lead.assignedToUserId,
          userName: data.lead.assignedToUserName,
          assignedAt: data.lead.assignedAt,
        });
        toast.success("Lead assigned to you");
        onAssignmentChange?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to assign lead");
      }
    } catch (error) {
      console.error("Error assigning lead:", error);
      toast.error("Error assigning lead");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle unassigning a lead
  const handleUnassign = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/assign`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIsAssigned(false);
        setAssignedUser(null);
        setSelectedUserId("");
        toast.success("Lead unassigned");
        onAssignmentChange?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to unassign lead");
      }
    } catch (error) {
      console.error("Error unassigning lead:", error);
      toast.error("Error unassigning lead");
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show for non-submitted leads
  if (!isSubmitted) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Assignment</CardTitle>
          </div>
          {isDisbursed ? (
            <Badge className="bg-green-500 text-white">
              <Banknote className="h-3 w-3 mr-1" />
              Disbursed
            </Badge>
          ) : isAssigned && assignedUser?.userName ? (
            <Badge
              variant="outline"
              className="bg-green-50 text-green-700 border-green-200"
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Assigned
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          {isDisbursed
            ? "Loan has been disbursed - no further assignments allowed"
            : isAssigned
            ? "This lead is currently assigned for review"
            : "Assign this lead to a user for review and action"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Assignee */}
        {isAssigned && assignedUser?.userName && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(assignedUser.userName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Current Assignee
              </p>
              <p className="font-medium">{assignedUser.userName}</p>
              {assignedUser.assignedAt && (
                <p className="text-sm text-muted-foreground">
                  Assigned{" "}
                  {new Date(assignedUser.assignedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Approved By */}
        {loanActionInfo?.approvedBy && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Approved By
              </p>
              <p className="font-medium">{loanActionInfo.approvedBy}</p>
              {loanActionInfo.approvedOnDate && (
                <p className="text-sm text-muted-foreground">
                  {new Date(loanActionInfo.approvedOnDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Disbursed By */}
        {loanActionInfo?.disbursedBy && (
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Disbursed By
              </p>
              <p className="font-medium">{loanActionInfo.disbursedBy}</p>
              {loanActionInfo.disbursedOnDate && (
                <p className="text-sm text-muted-foreground">
                  {new Date(
                    loanActionInfo.disbursedOnDate
                  ).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Assignment Controls - Only show if not disbursed */}
        {!isDisbursed && (
          <>
            {isAssigned && assignedUser?.userName ? (
              <div className="pt-2 border-t">
                <div className="flex gap-2">
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    disabled={isFetchingUsers || isLoading}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Reassign to..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span>{user.displayName}</span>
                            {user.officeName && (
                              <span className="text-xs text-muted-foreground">
                                ({user.officeName})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={handleAssign}
                    disabled={!selectedUserId || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleUnassign}
                    disabled={isLoading}
                    title="Unassign"
                  >
                    <UserX className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    disabled={isFetchingUsers || isLoading}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue
                        placeholder={
                          isFetchingUsers
                            ? "Loading users..."
                            : "Select user..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span>{user.displayName}</span>
                            {user.officeName && (
                              <span className="text-xs text-muted-foreground">
                                ({user.officeName})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAssign}
                    disabled={!selectedUserId || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserCheck className="h-4 w-4 mr-2" />
                    )}
                    Assign
                  </Button>
                </div>

                {currentUserId && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleAssignToSelf}
                    disabled={isLoading}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Assign to Me
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
