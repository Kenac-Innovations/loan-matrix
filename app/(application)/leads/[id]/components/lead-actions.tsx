"use client";

import { useState } from "react";
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
  CheckCircle2,
  X,
  MessageSquare,
  Send,
  UserPlus,
  Clock,
} from "lucide-react";
import StateTransitionManager from "./state-transition-manager";

interface LeadActionsProps {
  leadId: string;
  currentStage?: string;
  onRefresh?: () => void;
}

export function LeadActions({
  leadId,
  currentStage,
  onRefresh,
}: LeadActionsProps) {
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [assignTeamOpen, setAssignTeamOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <StateTransitionManager
        leadId={leadId}
        currentStage={currentStage || "Unknown"}
        onTransitionComplete={onRefresh}
      />

      <Button className="bg-blue-500 hover:bg-blue-600">
        <MessageSquare className="mr-2 h-4 w-4" />
        Contact Client
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="border-[#1a2035] dark:text-white hover:bg-[#1a2035]"
          >
            More Actions
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-[#1a2035] bg-[#0d121f] text-white">
          <DropdownMenuLabel>Lead Actions</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#1a2035]" />
          <DropdownMenuItem
            onClick={() => setAddNoteOpen(true)}
            className="cursor-pointer"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Add Note</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setAssignTeamOpen(true)}
            className="cursor-pointer"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            <span>Assign Team Member</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Note Dialog */}
      <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <DialogContent className="border-[#1a2035] bg-[#0d121f] text-white">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a note to this lead's timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Note Type:</p>
              <Select>
                <SelectTrigger className="border-[#1a2035] bg-[#0a0e17]">
                  <SelectValue placeholder="Select note type" />
                </SelectTrigger>
                <SelectContent className="border-[#1a2035] bg-[#0d121f] text-white">
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
                className="border-[#1a2035] bg-[#0a0e17] min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddNoteOpen(false)}
              className="border-[#1a2035] hover:bg-[#1a2035]"
            >
              Cancel
            </Button>
            <Button className="bg-blue-500 hover:bg-blue-600">
              <Send className="mr-2 h-4 w-4" />
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Team Member Dialog */}
      <Dialog open={assignTeamOpen} onOpenChange={setAssignTeamOpen}>
        <DialogContent className="border-[#1a2035] bg-[#0d121f] text-white">
          <DialogHeader>
            <DialogTitle>Assign Team Member</DialogTitle>
            <DialogDescription className="text-gray-400">
              Assign a team member to handle this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Current Stage: Credit Assessment
              </p>
              <p className="text-sm text-gray-400">
                Current Assignee: Robert Johnson (Credit Analyst)
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Select Team Member:</p>
              <Select>
                <SelectTrigger className="border-[#1a2035] bg-[#0a0e17]">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent className="border-[#1a2035] bg-[#0d121f] text-white">
                  <SelectItem value="rj">
                    Robert Johnson (Credit Analyst)
                  </SelectItem>
                  <SelectItem value="ms">
                    Maria Santos (Senior Credit Analyst)
                  </SelectItem>
                  <SelectItem value="ad">
                    Alex Donovan (Approval Officer)
                  </SelectItem>
                  <SelectItem value="jw">
                    James Wilson (Risk Manager)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Set SLA Deadline:</p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <Select>
                  <SelectTrigger className="border-[#1a2035] bg-[#0a0e17]">
                    <SelectValue placeholder="Select deadline" />
                  </SelectTrigger>
                  <SelectContent className="border-[#1a2035] bg-[#0d121f] text-white">
                    <SelectItem value="1d">1 day (Standard)</SelectItem>
                    <SelectItem value="2d">2 days</SelectItem>
                    <SelectItem value="3d">3 days (Default)</SelectItem>
                    <SelectItem value="urgent">Urgent (8 hours)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Assignment Note:</p>
              <Textarea
                placeholder="Enter any specific instructions..."
                className="border-[#1a2035] bg-[#0a0e17] min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignTeamOpen(false)}
              className="border-[#1a2035] hover:bg-[#1a2035]"
            >
              Cancel
            </Button>
            <Button className="bg-blue-500 hover:bg-blue-600">
              <UserPlus className="mr-2 h-4 w-4" />
              Assign Team Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
