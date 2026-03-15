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
import {
  defaultPipelineStages,
  defaultNotificationTemplates,
  defaultNotificationTriggers,
  defaultNotificationRecipients,
  defaultNotificationTypes,
  type NotificationTemplate,
  type PipelineStage
} from "@/shared/defaults/notifications";

export function NotificationConfig() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>(defaultNotificationTemplates);
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
                    {defaultNotificationTriggers.map((trigger) => (
                      <div key={trigger} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`trigger-${trigger}`}
                          checked={editingTemplate?.triggers?.includes(trigger)}
                          onChange={() => handleTriggerChange(trigger)}
                          className="rounded border-border bg-background"
                        />
                        <Label htmlFor={`trigger-${trigger}`} className="text-sm">
                          {trigger === "stage-change"
                            ? "Stage Change"
                            : trigger === "sla-warning"
                            ? "SLA Warning"
                            : trigger === "sla-breach"
                            ? "SLA Breach"
                            : trigger === "assignment"
                            ? "Assignment"
                            : trigger === "document-upload"
                            ? "Document Upload"
                            : trigger === "approval"
                            ? "Approval"
                            : trigger === "rejection"
                            ? "Rejection"
                            : trigger === "disbursement"
                            ? "Disbursement"
                            : trigger}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="block mb-2">Recipients</Label>
                  <div className="space-y-2 border border-border rounded-md p-2 bg-muted">
                    {defaultNotificationRecipients.map((recipient) => (
                      <div key={recipient} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`recipient-${recipient}`}
                          checked={editingTemplate?.recipients?.includes(recipient)}
                          onChange={() => handleRecipientChange(recipient)}
                          className="rounded border-border bg-background"
                        />
                        <Label htmlFor={`recipient-${recipient}`} className="text-sm">
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
                            : recipient === "stakeholder"
                            ? "Stakeholder"
                            : recipient}
                        </Label>
                      </div>
                    ))}
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
