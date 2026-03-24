"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  StickyNote,
  Plus,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mic,
  Trash2,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CONTACT_PERSON_OPTIONS = [
  { value: "BORROWER", label: "Borrower" },
  { value: "GUARANTOR", label: "Guarantor" },
  { value: "REFERENCE", label: "Reference" },
  { value: "EMPLOYER", label: "Employer" },
  { value: "OTHER", label: "Other" },
];

interface Communication {
  id: string;
  type: string;
  direction: string;
  subject?: string;
  content: string;
  status: string;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  fromEmail?: string;
  toEmail?: string;
  fromPhone?: string;
  toPhone?: string;
  provider?: string;
  createdBy: string;
  assignedTo?: string;
  metadata?: {
    contactPerson?: string;
    contactPersonName?: string;
  };
  attachments?: {
    voiceNote?: { name: string; data: string; mimeType: string };
  };
  createdAt: string;
  updatedAt: string;
}

interface CommunicationSummary {
  total: number;
  byType: {
    email: number;
    sms: number;
    call: number;
    meeting: number;
    note: number;
  };
  byDirection: {
    inbound: number;
    outbound: number;
  };
  lastCommunication?: string;
}

interface LeadInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface LeadCommunicationsProps {
  leadId: string;
  readOnly?: boolean;
}

export function LeadCommunications({ leadId, readOnly = false }: LeadCommunicationsProps) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [summary, setSummary] = useState<CommunicationSummary | null>(null);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // New communication form state
  const [newComm, setNewComm] = useState({
    type: "EMAIL",
    direction: "OUTBOUND",
    subject: "",
    content: "",
    toEmail: "",
    toPhone: "",
    contactPerson: "BORROWER",
    contactPersonName: "",
  });
  const [voiceNoteFile, setVoiceNoteFile] = useState<File | null>(null);
  const [voiceNotePreview, setVoiceNotePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCommunications();
  }, [leadId]);

  const fetchCommunications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/leads/${leadId}/communications`, {
        headers: {
          "x-tenant-slug": "default",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch communications");
      }

      const data = await response.json();
      setCommunications(data.communications || []);
      setSummary(data.summary);
      setLeadInfo(data.leadInfo);

      // Set default email/phone from lead info
      if (data.leadInfo) {
        setNewComm((prev) => ({
          ...prev,
          toEmail: data.leadInfo.email || "",
          toPhone: data.leadInfo.phone || "",
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCommunication = async () => {
    try {
      let voiceNoteData: { name: string; data: string; mimeType: string } | null = null;
      if (voiceNoteFile) {
        const base64 = await fileToBase64(voiceNoteFile);
        voiceNoteData = {
          name: voiceNoteFile.name,
          data: base64,
          mimeType: voiceNoteFile.type,
        };
      }

      const contactLabel = CONTACT_PERSON_OPTIONS.find((o) => o.value === newComm.contactPerson)?.label || newComm.contactPerson;

      const response = await fetch(`/api/leads/${leadId}/communications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "default",
        },
        body: JSON.stringify({
          type: newComm.type,
          direction: newComm.direction,
          subject: newComm.subject,
          content: newComm.content,
          toEmail: newComm.toEmail,
          toPhone: newComm.toPhone,
          metadata: {
            contactPerson: newComm.contactPerson,
            contactPersonName: newComm.contactPerson === "OTHER"
              ? newComm.contactPersonName
              : contactLabel,
          },
          attachments: voiceNoteData ? { voiceNote: voiceNoteData } : undefined,
          createdBy: "current-user",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create communication");
      }

      setNewComm({
        type: "EMAIL",
        direction: "OUTBOUND",
        subject: "",
        content: "",
        toEmail: leadInfo?.email || "",
        toPhone: leadInfo?.phone || "",
        contactPerson: "BORROWER",
        contactPersonName: "",
      });
      setVoiceNoteFile(null);
      setVoiceNotePreview(null);
      setIsDialogOpen(false);
      fetchCommunications();
      window.dispatchEvent(new Event("lead-data-changed"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create communication"
      );
    }
  };

  const handleVoiceNoteSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Voice note must be under 10MB");
      return;
    }
    setVoiceNoteFile(file);
    setVoiceNotePreview(URL.createObjectURL(file));
  };

  const clearVoiceNote = () => {
    setVoiceNoteFile(null);
    if (voiceNotePreview) URL.revokeObjectURL(voiceNotePreview);
    setVoiceNotePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "EMAIL":
        return <Mail className="h-4 w-4" />;
      case "SMS":
        return <MessageSquare className="h-4 w-4" />;
      case "CALL":
        return <Phone className="h-4 w-4" />;
      case "MEETING":
        return <Calendar className="h-4 w-4" />;
      case "NOTE":
        return <StickyNote className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "read":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "scheduled":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return "bg-green-500";
      case "read":
        return "bg-blue-500";
      case "failed":
        return "bg-red-500";
      case "scheduled":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const filteredCommunications = communications.filter((comm) => {
    if (activeTab === "all") return true;
    return comm.type.toLowerCase() === activeTab;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-muted-foreground">Loading communications...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <div className="text-center">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">{error}</p>
            <Button onClick={fetchCommunications} className="mt-2">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total
                  </p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Emails
                  </p>
                  <p className="text-2xl font-bold">{summary.byType.email}</p>
                </div>
                <Mail className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Calls
                  </p>
                  <p className="text-2xl font-bold">{summary.byType.call}</p>
                </div>
                <Phone className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Last Contact
                  </p>
                  <p className="text-sm font-medium">
                    {summary.lastCommunication
                      ? formatDistanceToNow(
                          new Date(summary.lastCommunication),
                          { addSuffix: true }
                        )
                      : "Never"}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Communications List */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle>Communication History</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {!readOnly && (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Communication
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New Communication</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={newComm.type}
                      onValueChange={(value) =>
                        setNewComm((prev) => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMAIL">Email</SelectItem>
                        <SelectItem value="SMS">SMS</SelectItem>
                        <SelectItem value="CALL">Call</SelectItem>
                        <SelectItem value="MEETING">Meeting</SelectItem>
                        <SelectItem value="NOTE">Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="direction">Direction</Label>
                    <Select
                      value={newComm.direction}
                      onValueChange={(value) =>
                        setNewComm((prev) => ({ ...prev, direction: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OUTBOUND">Outbound</SelectItem>
                        <SelectItem value="INBOUND">Inbound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactPerson">Communication With</Label>
                    <Select
                      value={newComm.contactPerson}
                      onValueChange={(value) =>
                        setNewComm((prev) => ({ ...prev, contactPerson: value, contactPersonName: "" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_PERSON_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newComm.contactPerson === "OTHER" && (
                    <div>
                      <Label htmlFor="contactPersonName">Name</Label>
                      <Input
                        id="contactPersonName"
                        value={newComm.contactPersonName}
                        onChange={(e) =>
                          setNewComm((prev) => ({ ...prev, contactPersonName: e.target.value }))
                        }
                        placeholder="Enter name"
                      />
                    </div>
                  )}
                </div>

                {(newComm.type === "EMAIL" || newComm.type === "MEETING") && (
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={newComm.subject}
                      onChange={(e) =>
                        setNewComm((prev) => ({
                          ...prev,
                          subject: e.target.value,
                        }))
                      }
                      placeholder="Enter subject"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={newComm.content}
                    onChange={(e) =>
                      setNewComm((prev) => ({
                        ...prev,
                        content: e.target.value,
                      }))
                    }
                    placeholder="Enter message content or notes"
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Voice Note (optional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleVoiceNoteSelect}
                    className="hidden"
                  />
                  {voiceNoteFile ? (
                    <div className="flex items-center gap-2 mt-1.5 p-2.5 bg-muted/50 rounded-lg border">
                      <Mic className="h-4 w-4 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{voiceNoteFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(voiceNoteFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      {voiceNotePreview && (
                        <audio controls src={voiceNotePreview} className="h-8 w-full max-w-[180px]" />
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={clearVoiceNote}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-1.5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Attach Voice Note
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateCommunication}
                    className="flex-1"
                    disabled={!newComm.content.trim()}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Create
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="sms">SMS</TabsTrigger>
              <TabsTrigger value="call">Call</TabsTrigger>
              <TabsTrigger value="meeting">Meeting</TabsTrigger>
              <TabsTrigger value="note">Note</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {filteredCommunications.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No {activeTab === "all" ? "" : activeTab} communications
                    found
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCommunications.map((comm) => (
                    <div
                      key={comm.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(comm.type)}
                            <span className="font-medium">{comm.type}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {comm.direction === "INBOUND" ? (
                              <ArrowDownLeft className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-blue-500" />
                            )}
                            <span className="text-sm text-muted-foreground">
                              {comm.direction}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(comm.status)}
                            <Badge
                              className={`${getStatusColor(
                                comm.status
                              )} text-white`}
                            >
                              {comm.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(comm.createdAt), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>

                      {comm.subject && (
                        <div>
                          <p className="font-medium">{comm.subject}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-sm">{comm.content}</p>
                      </div>

                      {comm.attachments?.voiceNote && (
                        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                          <Mic className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="text-xs text-muted-foreground shrink-0">{comm.attachments.voiceNote.name}</span>
                          <audio
                            controls
                            src={`data:${comm.attachments.voiceNote.mimeType};base64,${comm.attachments.voiceNote.data}`}
                            className="h-8 flex-1"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>By {comm.createdBy}</span>
                        </div>
                        {comm.metadata?.contactPerson && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                              {comm.metadata.contactPerson === "OTHER"
                                ? comm.metadata.contactPersonName || "Other"
                                : CONTACT_PERSON_OPTIONS.find((o) => o.value === comm.metadata?.contactPerson)?.label || comm.metadata.contactPerson}
                            </Badge>
                          </div>
                        )}
                        {comm.toEmail && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{comm.toEmail}</span>
                          </div>
                        )}
                        {comm.toPhone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{comm.toPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
