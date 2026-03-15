"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Edit,
  Trash2,
  BookOpen,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface PolicyDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  metadata?: any;
  embedding?: number[];
}

export default function PolicyDocumentsManager() {
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<PolicyDocument | null>(
    null
  );
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    metadata: "",
  });

  // Fetch policy documents
  const fetchDocuments = async () => {
    try {
      setError(null);
      const response = await fetch("/api/rag/policies");
      if (!response.ok) {
        throw new Error("Failed to fetch policy documents");
      }
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error("Error fetching documents:", error);
      setError("Failed to load policy documents");
    } finally {
      setIsLoading(false);
    }
  };

  // Save document (create or update)
  const saveDocument = async () => {
    try {
      setError(null);
      setSuccess(null);

      const payload = {
        title: formData.title,
        content: formData.content,
        metadata: formData.metadata ? JSON.parse(formData.metadata) : null,
      };

      const response = editingDocument
        ? await fetch(`/api/rag/policies/${editingDocument.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/rag/policies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        throw new Error("Failed to save document");
      }

      setSuccess(
        editingDocument
          ? "Document updated successfully"
          : "Document created successfully"
      );
      setIsDialogOpen(false);
      resetForm();
      await fetchDocuments();
    } catch (error) {
      console.error("Error saving document:", error);
      setError("Failed to save document");
    }
  };

  // Delete document
  const deleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/rag/policies/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      setSuccess("Document deleted successfully");
      await fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      setError("Failed to delete document");
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({ title: "", content: "", metadata: "" });
    setEditingDocument(null);
  };

  // Open edit dialog
  const openEditDialog = (document: PolicyDocument) => {
    setEditingDocument(document);
    setFormData({
      title: document.title,
      content: document.content,
      metadata: document.metadata
        ? JSON.stringify(document.metadata, null, 2)
        : "",
    });
    setIsDialogOpen(true);
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Policy Documents
            </CardTitle>
            <CardDescription>
              Manage policy documents for RAG responses
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center py-8">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No policy documents found. Add your first document to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{doc.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {doc.content.length > 100
                      ? `${doc.content.substring(0, 100)}...`
                      : doc.content}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">Policy</Badge>
                    {doc.embedding && (
                      <Badge variant="outline" className="text-green-600">
                        Indexed
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(doc)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteDocument(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingDocument ? "Edit Document" : "Add New Document"}
              </DialogTitle>
              <DialogDescription>
                {editingDocument
                  ? "Update the policy document details"
                  : "Create a new policy document for RAG responses"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter document title"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="Enter document content"
                  rows={8}
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Metadata (JSON, optional)
                </label>
                <Textarea
                  value={formData.metadata}
                  onChange={(e) =>
                    setFormData({ ...formData, metadata: e.target.value })
                  }
                  placeholder='{"category": "lending", "version": "1.0"}'
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={saveDocument}
                disabled={!formData.title || !formData.content}
              >
                {editingDocument ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
