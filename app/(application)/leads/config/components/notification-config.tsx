"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Edit,
  Save,
  AlertCircle,
  Mail,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Sample pipeline stages (would be fetched from API in real app)
const pipelineStages = [
  { id: "qualification", name: "Lead Qualification", color: "#3b82f6" },
  { id: "documents", name: "Document Collection", color: "#8b5cf6" },
  { id: "assessment", name: "Credit Assessment", color: "#eab308" },
  { id: "approval", name: "Approval", color: "#22c55e" },
  { id: "disbursement", name: "Disbursement", color: "#14b8a6" },
];

// Sample initial notification templates
const initialTemplates = [
  {
    id: "stage-change",
    name: "Stage Change Notification",
    type: "email",
    subject: "Lead Status Update: [Lead ID] moved to [Stage Name]",
    body: "Dear [Recipient Name],\n\nThe lead [Lead ID] for [Client Name] has been moved to the [Stage Name] stage.\n\nCurrent Status: [Stage Name]\nAssigned To: [Assignee Name]\n\nPlease review and take appropriate action if needed.\n\nRegards,\nKENAC Loan Matrix",
    triggers: ["stage-change"],
    recipients: ["team-lead", "team-members"],
    isActive: true,
  },
  {
    id: "sla-warning",
    name: "SLA Warning Notification",
    type: "email",
    subject: "SLA Warning: [Lead ID] approaching deadline",
    body: "Dear [Recipient Name],\n\nThe lead [Lead ID] for [Client Name] is approaching its SLA deadline in the [Stage Name] stage.\n\nCurrent Status: [Stage Name]\nTime in Stage: [Time in Stage]\nSLA Deadline: [SLA Deadline]\nAssigned To: [Assignee Name]\n\nPlease take immediate action to ensure timely processing.\n\nRegards,\nKENAC Loan Matrix",
    triggers: ["sla-warning"],
    recipients: ["team-lead", "team-members"],
    isActive: true,
  },
  {
    id: "sla-breach",
    name: "SLA Breach Notification",
    type: "email",
    subject: "URGENT: SLA Breach for [Lead ID]",
    body: "Dear [Recipient Name],\n\nThe lead [Lead ID] for [Client Name] has exceeded its SLA deadline in the [Stage Name] stage.\n\nCurrent Status: [Stage Name]\nTime in Stage: [Time in Stage]\nSLA Deadline: [SLA Deadline]\nAssigned To: [Assignee Name]\n\nPlease take immediate action to resolve this issue.\n\nRegards,\nKENAC Loan Matrix",
    triggers: ["sla-breach"],
    recipients: ["team-lead", "team-members", "manager"],
    isActive: true,
  },
  {
    id: "assignment",
    name: "Lead Assignment Notification",
    type: "email",
    subject: "New Lead Assignment: [Lead ID]",
    body: "Dear [Recipient Name],\n\nYou have been assigned to lead [Lead ID] for [Client Name] in the [Stage Name] stage.\n\nLead Details:\nClient: [Client Name]\nLoan Amount: [Loan Amount]\nLoan Type: [Loan Type]\nStage: [Stage Name]\n\nPlease review and take appropriate action.\n\nRegards,\nKENAC Loan Matrix",
    triggers: ["assignment"],
    recipients: ["assignee"],
    isActive: true,
  },
  {
    id: "client-update",
    name: "Client Update Notification",
    type: "sms",
    subject: "",
    body: "KENAC Loan Matrix: Your loan application [Lead ID] has been updated to status: [Stage Name]. Log in to your portal for details or contact your loan officer.",
    triggers: ["stage-change"],
    recipients: ["client"],
    isActive: true,
  },
];

export function NotificationConfig() {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("email");

  const handleAddTemplate = () => {
    setEditingTemplate({
      id: "",
      name: "",
      type: activeTab,
      subject: activeTab === "email" ? "" : undefined,
      body: "",
      triggers: [],
      recipients: [],
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate({ ...template });
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate.name.trim() || !editingTemplate.body.trim()) {
      return; // Don't save if required fields are empty
    }

    // Generate ID from name if it's a new template
    if (!editingTemplate.id) {
      editingTemplate.id = editingTemplate.name
        .toLowerCase()
        .replace(/\s+/g, "-");
    }

    const updatedTemplates = editingTemplate.id
      ? templates.map((t) =>
          t.id === editingTemplate.id ? editingTemplate : t
        )
      : [...templates, editingTemplate];

    setTemplates(updatedTemplates);
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(templates.filter((t) => t.id !== templateId));
  };

  const handleTriggerChange = (trigger: string) => {
    const isSelected = editingTemplate.triggers.includes(trigger);

    if (isSelected) {
      setEditingTemplate({
        ...editingTemplate,
        triggers: editingTemplate.triggers.filter((t: string) => t !== trigger),
      });
    } else {
      setEditingTemplate({
        ...editingTemplate,
        triggers: [...editingTemplate.triggers, trigger],
      });
    }
  };

  const handleRecipientChange = (recipient: string) => {
    const isSelected = editingTemplate.recipients.includes(recipient);

    if (isSelected) {
      setEditingTemplate({
        ...editingTemplate,
        recipients: editingTemplate.recipients.filter(
          (r: string) => r !== recipient
        ),
      });
    } else {
      setEditingTemplate({
        ...editingTemplate,
        recipients: [...editingTemplate.recipients, recipient],
      });
    }
  };

  const filteredTemplates = templates.filter(
    (template) => template.type === activeTab
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Notification Templates</h3>
          <p className="text-sm text-muted-foreground">
            Configure notification templates for different events
          </p>
        </div>
        <Button
          onClick={handleAddTemplate}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Template
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-muted border border-border w-full sm:w-auto">
          <TabsTrigger
            value="email"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <Mail className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">Email Templates</span>
          </TabsTrigger>
          <TabsTrigger
            value="sms"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">SMS Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <div className="space-y-4">
            {filteredTemplates.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground border border-border rounded-md">
                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                <p>
                  No email templates configured. Click "Add Template" to create
                  your first template.
                </p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="border border-border rounded-md bg-card overflow-hidden"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-blue-500/20 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-md font-medium">{template.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Subject: {template.subject}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${
                          template.isActive
                            ? "border-green-500 bg-green-500/10 text-green-400"
                            : "border-gray-500 bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                        className="border-border hover:bg-muted"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="border-border hover:bg-muted text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-sm font-medium mb-2">Email Body</h5>
                      <div className="rounded-md border border-border bg-muted p-3 max-h-[200px] overflow-y-auto">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {template.body}
                        </pre>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h5 className="text-sm font-medium mb-2">Triggers</h5>
                        <div className="flex flex-wrap gap-2">
                          {template.triggers.map((trigger: string) => (
                            <Badge
                              key={trigger}
                              className="bg-muted hover:bg-muted text-foreground"
                            >
                              {trigger === "stage-change"
                                ? "Stage Change"
                                : trigger === "sla-warning"
                                ? "SLA Warning"
                                : trigger === "sla-breach"
                                ? "SLA Breach"
                                : trigger === "assignment"
                                ? "Assignment"
                                : trigger}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium mb-2">Recipients</h5>
                        <div className="flex flex-wrap gap-2">
                          {template.recipients.map((recipient: string) => (
                            <Badge
                              key={recipient}
                              className="bg-muted hover:bg-muted text-foreground"
                            >
                              {recipient === "team-lead"
                                ? "Team Lead"
                                : recipient === "team-members"
                                ? "Team Members"
                                : recipient === "manager"
                                ? "Manager"
                                : recipient === "assignee"
                                ? "Assignee"
                                : recipient === "client"
                                ? "Client"
                                : recipient}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="sms">
          <div className="space-y-4">
            {filteredTemplates.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground border border-border rounded-md">
                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                <p>
                  No SMS templates configured. Click "Add Template" to create
                  your first template.
                </p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="border border-border rounded-md bg-card overflow-hidden"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-purple-500/20 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="text-md font-medium">{template.name}</h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${
                          template.isActive
                            ? "border-green-500 bg-green-500/10 text-green-400"
                            : "border-gray-500 bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                        className="border-border hover:bg-muted"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="border-border hover:bg-muted text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-sm font-medium mb-2">SMS Message</h5>
                      <div className="rounded-md border border-border bg-muted p-3">
                        <p className="text-xs text-muted-foreground">
                          {template.body}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Character count: {template.body.length} / 160
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h5 className="text-sm font-medium mb-2">Triggers</h5>
                        <div className="flex flex-wrap gap-2">
                          {template.triggers.map((trigger: string) => (
                            <Badge
                              key={trigger}
                              className="bg-muted hover:bg-muted text-foreground"
                            >
                              {trigger === "stage-change"
                                ? "Stage Change"
                                : trigger === "sla-warning"
                                ? "SLA Warning"
                                : trigger === "sla-breach"
                                ? "SLA Breach"
                                : trigger === "assignment"
                                ? "Assignment"
                                : trigger}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium mb-2">Recipients</h5>
                        <div className="flex flex-wrap gap-2">
                          {template.recipients.map((recipient: string) => (
                            <Badge
                              key={recipient}
                              className="bg-muted hover:bg-muted text-foreground"
                            >
                              {recipient === "team-lead"
                                ? "Team Lead"
                                : recipient === "team-members"
                                ? "Team Members"
                                : recipient === "manager"
                                ? "Manager"
                                : recipient === "assignee"
                                ? "Assignee"
                                : recipient === "client"
                                ? "Client"
                                : recipient}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Save className="mr-2 h-4 w-4" />
          Save Configuration
        </Button>
      </div>

      {/* Edit/Add Template Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="border-border bg-card text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.id ? "Edit Template" : "Add New Template"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingTemplate?.id
                ? "Edit the details of this notification template"
                : "Configure a new notification template"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={editingTemplate?.name || ""}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        name: e.target.value,
                      })
                    }
                    className="border-border bg-background"
                  />
                </div>

                {editingTemplate?.type === "email" && (
                  <div className="grid gap-2">
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input
                      id="subject"
                      value={editingTemplate?.subject || ""}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          subject: e.target.value,
                        })
                      }
                      className="border-border bg-background"
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="body">
                    {editingTemplate?.type === "email"
                      ? "Email Body"
                      : "SMS Message"}
                  </Label>
                  <Textarea
                    id="body"
                    value={editingTemplate?.body || ""}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        body: e.target.value,
                      })
                    }
                    className="border-border bg-background min-h-[150px]"
                  />
                  {editingTemplate?.type === "sms" && (
                    <p className="text-xs text-muted-foreground">
                      Character count: {editingTemplate?.body?.length || 0} /
                      160
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={editingTemplate?.isActive}
                    onCheckedChange={(checked) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        isActive: checked,
                      })
                    }
                  />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="block mb-2">Triggers</Label>
                  <div className="space-y-2 border border-border rounded-md p-2 bg-muted">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="trigger-stage-change"
                        checked={editingTemplate?.triggers?.includes(
                          "stage-change"
                        )}
                        onChange={() => handleTriggerChange("stage-change")}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="trigger-stage-change" className="text-sm">
                        Stage Change
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="trigger-sla-warning"
                        checked={editingTemplate?.triggers?.includes(
                          "sla-warning"
                        )}
                        onChange={() => handleTriggerChange("sla-warning")}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="trigger-sla-warning" className="text-sm">
                        SLA Warning
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="trigger-sla-breach"
                        checked={editingTemplate?.triggers?.includes(
                          "sla-breach"
                        )}
                        onChange={() => handleTriggerChange("sla-breach")}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="trigger-sla-breach" className="text-sm">
                        SLA Breach
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="trigger-assignment"
                        checked={editingTemplate?.triggers?.includes(
                          "assignment"
                        )}
                        onChange={() => handleTriggerChange("assignment")}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="trigger-assignment" className="text-sm">
                        Assignment
                      </Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="block mb-2">Recipients</Label>
                  <div className="space-y-2 border border-border rounded-md p-2 bg-muted">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="recipient-team-lead"
                        checked={editingTemplate?.recipients?.includes(
                          "team-lead"
                        )}
                        onChange={() => handleRecipientChange("team-lead")}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="recipient-team-lead" className="text-sm">
                        Team Lead
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="recipient-team-members"
                        checked={editingTemplate?.recipients?.includes(
                          "team-members"
                        )}
                        onChange={() => handleRecipientChange("team-members")}
                        className="rounded border-border bg-background"
                      />
                      <Label
                        htmlFor="recipient-team-members"
                        className="text-sm"
                      >
                        Team Members
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="recipient-manager"
                        checked={editingTemplate?.recipients?.includes(
                          "manager"
                        )}
                        onChange={() => handleRecipientChange("manager")}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="recipient-manager" className="text-sm">
                        Manager
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="recipient-assignee"
                        checked={editingTemplate?.recipients?.includes(
                          "assignee"
                        )}
                        onChange={() => handleRecipientChange("assignee")}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="recipient-assignee" className="text-sm">
                        Assignee
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="recipient-client"
                        checked={editingTemplate?.recipients?.includes(
                          "client"
                        )}
                        onChange={() => handleRecipientChange("client")}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="recipient-client" className="text-sm">
                        Client
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-md p-3 bg-muted">
                  <h5 className="text-sm font-medium mb-2">
                    Available Variables
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    <Badge
                      variant="outline"
                      className="justify-start border-border text-xs"
                    >
                      [Lead ID]
                    </Badge>
                    <Badge
                      variant="outline"
                      className="justify-start border-border text-xs"
                    >
                      [Client Name]
                    </Badge>
                    <Badge
                      variant="outline"
                      className="justify-start border-border text-xs"
                    >
                      [Stage Name]
                    </Badge>
                    <Badge
                      variant="outline"
                      className="justify-start border-border text-xs"
                    >
                      [Assignee Name]
                    </Badge>
                    <Badge
                      variant="outline"
                      className="justify-start border-border text-xs"
                    >
                      [Time in Stage]
                    </Badge>
                    <Badge
                      variant="outline"
                      className="justify-start border-border text-xs"
                    >
                      [SLA Deadline]
                    </Badge>
                    <Badge
                      variant="outline"
                      className="justify-start border-border text-xs"
                    >
                      [Recipient Name]
                    </Badge>
                    <Badge
                      variant="outline"
                      className="justify-start border-border text-xs"
                    >
                      [Loan Amount]
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="border-border hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editingTemplate?.id ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
