"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  MessageSquare,
  Send,
  FileText,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { LoanActions } from "./loan-actions";

interface LeadActionsProps {
  leadId: string;
  currentStage?: string;
  loanStatus?: string | null;
  loanId?: number | null;
  assignedToUserId?: number | null;
  onRefresh?: () => void;
}

export function LeadActions({
  leadId,
  currentStage,
  loanStatus,
  loanId,
  assignedToUserId,
  onRefresh,
}: LeadActionsProps) {
  const { data: session } = useSession();
  const [addNoteOpen, setAddNoteOpen] = useState(false);

  // Get current user's Mifos ID - try userId first, then fall back to id
  const sessionUser = session?.user as any;
  const currentUserId = sessionUser?.userId ?? (sessionUser?.id ? parseInt(sessionUser.id) : undefined);
  const isAssignedToCurrentUser = !!(currentUserId && assignedToUserId && currentUserId === assignedToUserId);

  // Debug logging
  console.log("Assignment Check:", {
    currentUserId,
    assignedToUserId,
    isAssignedToCurrentUser,
    sessionUserId: sessionUser?.userId,
    sessionId: sessionUser?.id,
  });

  return (
    <div className="flex flex-wrap gap-2">
      {/* Loan Actions from Fineract - Only for submitted loans */}
      <LoanActions
        leadId={leadId}
        loanStatus={loanStatus}
        loanId={loanId}
        isAssignedToCurrentUser={!!isAssignedToCurrentUser}
        onActionComplete={onRefresh}
      />

      {/* More Actions Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            More Actions
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Lead Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setAddNoteOpen(true)}
            className="cursor-pointer"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Add Note</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <FileText className="mr-2 h-4 w-4" />
            <span>View Documents</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Note Dialog */}
      <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note to this lead's timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Note Type:</p>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select note type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client-communication">
                    Client Communication
                  </SelectItem>
                  <SelectItem value="internal-note">Internal Note</SelectItem>
                  <SelectItem value="follow-up">Follow-up Reminder</SelectItem>
                  <SelectItem value="risk-assessment">
                    Risk Assessment
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Note:</p>
              <Textarea
                placeholder="Enter your note here..."
                className="min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddNoteOpen(false)}
            >
              Cancel
            </Button>
            <Button>
              <Send className="mr-2 h-4 w-4" />
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
