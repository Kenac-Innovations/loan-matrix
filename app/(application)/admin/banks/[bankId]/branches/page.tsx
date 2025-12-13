"use client";

import { useState, useEffect, use } from "react";
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
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowLeft,
  Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BANK_CODE_NAME,
  BRANCH_CODE_NAME,
  createBranchCodeValueName,
  parseBranchCodeValue,
  validateBranchCode,
} from "@/lib/bank-branch-utils";
import Link from "next/link";

interface Branch {
  id: number;
  code: string;
  name: string;
  rawName: string;
  isActive: boolean;
}

interface Bank {
  id: number;
  name: string;
}

export default function BranchesPage({
  params,
}: {
  params: Promise<{ bankId: string }>;
}) {
  const { bankId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [bank, setBank] = useState<Bank | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    isActive: true,
  });

  // Fetch bank details
  const fetchBank = async () => {
    try {
      const response = await fetch(
        `/api/fineract/codes/${BANK_CODE_NAME}/codevalues/${bankId}`
      );
      if (response.ok) {
        const data = await response.json();
        setBank({
          id: data.id,
          name: data.name,
        });
      } else {
        toast({
          title: "Error",
          description: "Bank not found",
          variant: "destructive",
        });
        router.push("/admin/banks");
      }
    } catch (error) {
      console.error("Error fetching bank:", error);
    }
  };

  // Fetch branches for this bank
  const fetchBranches = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/fineract/codes/${BRANCH_CODE_NAME}/codevalues?includeInactive=true`
      );

      if (response.ok) {
        const data = await response.json();
        // Filter branches for this bank
        const bankBranches = data
          .map((cv: any) => {
            const parsed = parseBranchCodeValue(cv.name);
            if (!parsed || parsed.bankId !== parseInt(bankId)) {
              return null;
            }
            return {
              id: cv.id,
              code: parsed.code,
              name: parsed.name,
              rawName: cv.name,
              isActive: cv.isActive !== false,
            };
          })
          .filter((b: Branch | null): b is Branch => b !== null);

        setBranches(bankBranches);
      } else {
        // Code might not exist yet
        setBranches([]);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast({
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBank();
    fetchBranches();
  }, [bankId]);

  // Add branch
  const handleAddBranch = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Branch code and name are required",
        variant: "destructive",
      });
      return;
    }

    if (!validateBranchCode(formData.code.trim())) {
      toast({
        title: "Validation Error",
        description: "Branch code must be alphanumeric (hyphens allowed)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create branch code value with format: {bankId}|{code}|{name}
      const codeValueName = createBranchCodeValueName(
        parseInt(bankId),
        formData.code.trim().toUpperCase(),
        formData.name.trim()
      );

      const response = await fetch(
        `/api/fineract/codes/${BRANCH_CODE_NAME}/codevalues`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: codeValueName,
            description: `${bank?.name} - ${formData.name.trim()}`,
            isActive: formData.isActive,
            createCodeIfNotExists: true,
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Branch added successfully",
        });
        setShowAddDialog(false);
        setFormData({ code: "", name: "", isActive: true });
        fetchBranches();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to add branch");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add branch",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit branch
  const handleEditBranch = async () => {
    if (!selectedBranch || !formData.code.trim() || !formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Branch code and name are required",
        variant: "destructive",
      });
      return;
    }

    if (!validateBranchCode(formData.code.trim())) {
      toast({
        title: "Validation Error",
        description: "Branch code must be alphanumeric (hyphens allowed)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const codeValueName = createBranchCodeValueName(
        parseInt(bankId),
        formData.code.trim().toUpperCase(),
        formData.name.trim()
      );

      const response = await fetch(
        `/api/fineract/codes/${BRANCH_CODE_NAME}/codevalues/${selectedBranch.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: codeValueName,
            description: `${bank?.name} - ${formData.name.trim()}`,
            isActive: formData.isActive,
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Branch updated successfully",
        });
        setShowEditDialog(false);
        setSelectedBranch(null);
        setFormData({ code: "", name: "", isActive: true });
        fetchBranches();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to update branch");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update branch",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete branch
  const handleDeleteBranch = async () => {
    if (!selectedBranch) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/fineract/codes/${BRANCH_CODE_NAME}/codevalues/${selectedBranch.id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Branch deleted successfully",
        });
        setShowDeleteDialog(false);
        setSelectedBranch(null);
        fetchBranches();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete branch");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete branch",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      code: branch.code,
      name: branch.name,
      isActive: branch.isActive,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setShowDeleteDialog(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/banks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            {bank?.name || "Loading..."} - Branches
          </h1>
          <p className="text-muted-foreground">
            Manage branch codes for this bank
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Branch Codes
            </CardTitle>
            <CardDescription>
              Configure the branch codes for {bank?.name}
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Branch
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No branches configured for this bank.</p>
              <p className="text-sm">Click "Add Branch" to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch Code</TableHead>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-mono font-medium">
                      {branch.code}
                    </TableCell>
                    <TableCell>{branch.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={branch.isActive ? "default" : "secondary"}
                      >
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(branch)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(branch)}
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

      {/* Add Branch Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Branch</DialogTitle>
            <DialogDescription>
              Add a new branch code for {bank?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Branch Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., CBZ001"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Alphanumeric characters and hyphens only
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Branch Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Harare Main Branch"
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
            <Button onClick={handleAddBranch} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Add Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>Update branch details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">Branch Code *</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., CBZ001"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Branch Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Harare Main Branch"
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
            <Button onClick={handleEditBranch} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete branch "{selectedBranch?.code} -{" "}
              {selectedBranch?.name}"?
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
              onClick={handleDeleteBranch}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

