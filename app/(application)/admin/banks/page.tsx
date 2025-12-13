"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GitBranch,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BANK_CODE_NAME } from "@/lib/bank-branch-utils";
import Link from "next/link";

interface Bank {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

export default function BanksPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
  });

  // Fetch banks
  const fetchBanks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/fineract/codes/${BANK_CODE_NAME}/codevalues?includeInactive=true`
      );
      if (response.ok) {
        const data = await response.json();
        setBanks(
          data.map((cv: any) => ({
            id: cv.id,
            name: cv.name,
            description: cv.description,
            isActive: cv.isActive !== false,
          }))
        );
      } else {
        // Code might not exist yet
        setBanks([]);
      }
    } catch (error) {
      console.error("Error fetching banks:", error);
      toast({
        title: "Error",
        description: "Failed to fetch banks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  // Add bank
  const handleAddBank = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Bank name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/fineract/codes/${BANK_CODE_NAME}/codevalues`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || formData.name.trim(),
            isActive: formData.isActive,
            createCodeIfNotExists: true, // Create "Bank" code if it doesn't exist
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bank added successfully",
        });
        setShowAddDialog(false);
        setFormData({ name: "", description: "", isActive: true });
        fetchBanks();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to add bank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add bank",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit bank
  const handleEditBank = async () => {
    if (!selectedBank || !formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Bank name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/fineract/codes/${BANK_CODE_NAME}/codevalues/${selectedBank.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || formData.name.trim(),
            isActive: formData.isActive,
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bank updated successfully",
        });
        setShowEditDialog(false);
        setSelectedBank(null);
        setFormData({ name: "", description: "", isActive: true });
        fetchBanks();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to update bank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update bank",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete bank
  const handleDeleteBank = async () => {
    if (!selectedBank) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/fineract/codes/${BANK_CODE_NAME}/codevalues/${selectedBank.id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Bank deleted successfully",
        });
        setShowDeleteDialog(false);
        setSelectedBank(null);
        fetchBanks();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete bank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete bank",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (bank: Bank) => {
    setSelectedBank(bank);
    setFormData({
      name: bank.name,
      description: bank.description || "",
      isActive: bank.isActive,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (bank: Bank) => {
    setSelectedBank(bank);
    setShowDeleteDialog(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/leads/config">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Banks Management
          </h1>
          <p className="text-muted-foreground">
            Configure banks and their branch codes for client banking details
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Banks</CardTitle>
            <CardDescription>
              Manage the list of banks available for selection
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Bank
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : banks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No banks configured yet.</p>
              <p className="text-sm">Click "Add Bank" to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Branches</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => (
                  <TableRow key={bank.id}>
                    <TableCell className="font-medium">{bank.name}</TableCell>
                    <TableCell>{bank.description || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={bank.isActive ? "default" : "secondary"}>
                        {bank.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/banks/${bank.id}/branches`}>
                        <Button variant="ghost" size="sm">
                          <GitBranch className="h-4 w-4 mr-1" />
                          Manage Branches
                        </Button>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(bank)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(bank)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Bank Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bank</DialogTitle>
            <DialogDescription>
              Add a new bank to the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bank Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., CBZ Bank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddBank} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Bank Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bank</DialogTitle>
            <DialogDescription>
              Update bank details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Bank Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., CBZ Bank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
              <Label htmlFor="edit-isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleEditBank} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Bank Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bank</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedBank?.name}"? This will
              also affect all associated branch codes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBank}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

