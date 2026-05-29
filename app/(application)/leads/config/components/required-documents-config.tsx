"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GripVertical,
  Clock,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RequiredDoc {
  id?: string;
  name: string;
  description: string;
  category: string;
  expiryMonths: number | null;
  isRequired: boolean;
  isActive: boolean;
  order: number;
}

const CATEGORIES = [
  { value: "kyc", label: "KYC" },
  { value: "identity", label: "Identity" },
  { value: "proof_of_income", label: "Proof of Income" },
  { value: "proof_of_residence", label: "Proof of Residence" },
  { value: "collateral", label: "Collateral" },
  { value: "employment", label: "Employment" },
  { value: "financial", label: "Financial" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
];

const emptyDoc: RequiredDoc = {
  name: "",
  description: "",
  category: "kyc",
  expiryMonths: null,
  isRequired: true,
  isActive: true,
  order: 0,
};

export function RequiredDocumentsConfig() {
  const [documents, setDocuments] = useState<RequiredDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<RequiredDoc | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/required-documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(
          data.map((d: any) => ({
            id: d.id,
            name: d.name,
            description: d.description || "",
            category: d.category,
            expiryMonths: d.expiryMonths,
            isRequired: d.isRequired,
            isActive: d.isActive,
            order: d.order,
          }))
        );
      }
    } catch (e) {
      console.error("Error fetching required documents:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const openCreateModal = () => {
    setEditingDoc({ ...emptyDoc, order: documents.length });
    setEditingIndex(null);
    setModalOpen(true);
  };

  const openEditModal = (doc: RequiredDoc, index: number) => {
    setEditingDoc({ ...doc });
    setEditingIndex(index);
    setModalOpen(true);
  };

  const handleSaveDoc = async () => {
    if (!editingDoc || !editingDoc.name.trim() || !editingDoc.category) return;

    setSaving(true);
    try {
      let updatedDocs: RequiredDoc[];
      if (editingIndex !== null) {
        updatedDocs = [...documents];
        updatedDocs[editingIndex] = editingDoc;
      } else {
        updatedDocs = [...documents, editingDoc];
      }

      const res = await fetch("/api/pipeline/required-documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: updatedDocs }),
      });

      if (res.ok) {
        toast({
          title: editingIndex !== null ? "Document Updated" : "Document Added",
          description: `"${editingDoc.name}" has been saved.`,
        });
        await fetchDocuments();
        setModalOpen(false);
      } else {
        const err = await res.json();
        toast({
          title: "Error",
          description: err.error || "Failed to save",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to save document configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc: RequiredDoc, index: number) => {
    if (!doc.id) {
      setDocuments((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    try {
      const res = await fetch(
        `/api/pipeline/required-documents?id=${doc.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast({ title: "Deleted", description: `"${doc.name}" removed.` });
        await fetchDocuments();
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to delete",
        variant: "destructive",
      });
    }
  };

  const getCategoryLabel = (value: string) =>
    CATEGORIES.find((c) => c.value === value)?.label || value;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading document requirements...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Required Documents
              </CardTitle>
              <CardDescription>
                Configure which documents must be uploaded for each lead. Set
                expiry periods so documents are flagged when they expire.
              </CardDescription>
            </div>
            <Button onClick={openCreateModal} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Document
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No required documents configured yet.</p>
              <p className="text-sm mt-1">
                Add documents that must be uploaded for each lead.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    doc.isActive
                      ? "bg-background"
                      : "bg-muted/40 opacity-60"
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{doc.name}</span>
                      <Badge
                        variant="outline"
                        className="text-xs"
                      >
                        {getCategoryLabel(doc.category)}
                      </Badge>
                      {doc.isRequired ? (
                        <Badge className="text-xs bg-red-100 text-red-700 border-red-200">
                          <ShieldAlert className="h-3 w-3 mr-0.5" />
                          Required
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          Optional
                        </Badge>
                      )}
                      {doc.expiryMonths && (
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-300 text-amber-700 bg-amber-50"
                        >
                          <Clock className="h-3 w-3 mr-0.5" />
                          Expires in {doc.expiryMonths}mo
                        </Badge>
                      )}
                      {!doc.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {doc.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditModal(doc, idx)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(doc, idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null
                ? "Edit Required Document"
                : "Add Required Document"}
            </DialogTitle>
            <DialogDescription>
              Configure a document type that leads must upload.
            </DialogDescription>
          </DialogHeader>

          {editingDoc && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Document Name *</Label>
                <Input
                  placeholder="e.g. National ID, Payslip, Utility Bill"
                  value={editingDoc.name}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={editingDoc.category}
                  onValueChange={(v) =>
                    setEditingDoc({ ...editingDoc, category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of what this document is..."
                  value={editingDoc.description}
                  onChange={(e) =>
                    setEditingDoc({
                      ...editingDoc,
                      description: e.target.value,
                    })
                  }
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Expiry Period (months)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Leave empty for no expiry"
                  value={editingDoc.expiryMonths ?? ""}
                  onChange={(e) =>
                    setEditingDoc({
                      ...editingDoc,
                      expiryMonths: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Documents will be flagged as expired after this period from
                  upload date.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="font-medium">Required</Label>
                  <p className="text-xs text-muted-foreground">
                    Lead cannot progress without this document
                  </p>
                </div>
                <Switch
                  checked={editingDoc.isRequired}
                  onCheckedChange={(checked) =>
                    setEditingDoc({ ...editingDoc, isRequired: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="font-medium">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive documents are not shown to users
                  </p>
                </div>
                <Switch
                  checked={editingDoc.isActive}
                  onCheckedChange={(checked) =>
                    setEditingDoc({ ...editingDoc, isActive: checked })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveDoc}
              disabled={saving || !editingDoc?.name.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {editingIndex !== null ? "Update" : "Add"} Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
