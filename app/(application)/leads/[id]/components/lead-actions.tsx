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
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeadActionsProps {
  leadId: string;
}

export function LeadActions({ leadId }: LeadActionsProps) {
  const [moveStageOpen, setMoveStageOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [assignTeamOpen, setAssignTeamOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState("");
  const [showValidationWarning, setShowValidationWarning] = useState(false);

  // This would normally be fetched from an API
  const hasFailedValidations = true;

  const handleMoveStage = () => {
    if (hasFailedValidations) {
      setShowValidationWarning(true);
    } else {
      // Proceed with stage change
      setMoveStageOpen(false);
      // API call would happen here
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
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
            onClick={() => setMoveStageOpen(true)}
            className="cursor-pointer"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <span>Move to Next Stage</span>
          </DropdownMenuItem>
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
          <DropdownMenuSeparator className="bg-[#1a2035]" />
          <DropdownMenuItem className="text-red-400 cursor-pointer">
            <X className="mr-2 h-4 w-4" />
            <span>Reject Application</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Move Stage Dialog */}
      <Dialog open={moveStageOpen} onOpenChange={setMoveStageOpen}>
        <DialogContent className="border-[#1a2035] bg-[#0d121f] text-white">
          <DialogHeader>
            <DialogTitle>Move to Next Stage</DialogTitle>
            <DialogDescription className="text-gray-400">
              Move this lead to the next stage in the pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Current Stage: Credit Assessment
              </p>
              <p className="text-sm text-gray-400">
                Select the next stage for this lead:
              </p>
            </div>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger className="border-[#1a2035] bg-[#0a0e17]">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent className="border-[#1a2035] bg-[#0d121f] text-white">
                <SelectItem value="approval">Approval</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <p className="text-sm font-medium">Add a comment (optional):</p>
              <Textarea
                placeholder="Enter any relevant notes about this stage change..."
                className="border-[#1a2035] bg-[#0a0e17] min-h-[100px]"
              />
            </div>

            {/* Validation Status Summary */}
            <div className="rounded-md border border-[#1a2035] bg-[#0a0e17] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  <h4 className="text-sm font-medium">Validation Status</h4>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-[#1a2035]"
                  asChild
                >
                  <a href={`/leads/${leadId}?tab=validations`}>View All</a>
                </Button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Required Fields</span>
                  <Badge className="bg-green-500 text-white">Passed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Document Verification</span>
                  <Badge className="bg-red-500 text-white">Failed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Budget Information</span>
                  <Badge className="bg-yellow-500 text-white">Warning</Badge>
                </div>
              </div>
              {hasFailedValidations && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>
                    There are failed validations that may prevent stage
                    progression
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveStageOpen(false)}
              className="border-[#1a2035] hover:bg-[#1a2035]"
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-500 hover:bg-blue-600"
              onClick={handleMoveStage}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Move to Next Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Warning Dialog */}
      <Dialog
        open={showValidationWarning}
        onOpenChange={setShowValidationWarning}
      >
        <DialogContent className="border-[#1a2035] bg-[#0d121f] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              Validation Warnings
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              There are failed validations that may prevent moving to the next
              stage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
              <h4 className="text-sm font-medium mb-2">Failed Validations:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Document Verification</p>
                    <p className="text-gray-400">
                      Missing required documents: Business Registration,
                      Financial Statements
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 border-[#2a304d] text-blue-400 hover:bg-[#1a2035] hover:text-blue-300"
                      asChild
                    >
                      <a href={`/leads/${leadId}/documents`}>
                        Upload Missing Documents
                      </a>
                    </Button>
                  </div>
                </li>
              </ul>
            </div>
            <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3">
              <h4 className="text-sm font-medium mb-2">Warnings:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Budget Information</p>
                    <p className="text-gray-400">
                      Budget information is missing. Consider collecting this
                      before proceeding.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Credit Score Validation</p>
                    <p className="text-gray-400">
                      Credit score is below recommended threshold but above
                      minimum requirement.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowValidationWarning(false)}
              className="border-[#1a2035] hover:bg-[#1a2035]"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
              asChild
            >
              <a href={`/leads/${leadId}?tab=validations`}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Review All Validations
              </a>
            </Button>
            <Button className="bg-red-500 hover:bg-red-600">
              <X className="mr-2 h-4 w-4" />
              Override and Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
