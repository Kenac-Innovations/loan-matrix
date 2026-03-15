"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface CreateGuarantorModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
  onSuccess: () => void;
}

interface GuarantorTemplate {
  guarantorType: {
    id: number;
    code: string;
    value: string;
  };
  status: boolean;
  guarantorTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  allowedClientRelationshipTypes: Array<{
    id: number;
    name: string;
    position: number;
    active: boolean;
    mandatory: boolean;
  }>;
}

interface CreateGuarantorForm {
  isExistingClient: boolean;
  guarantorTypeId: number;
  clientRelationshipTypeId: number;
  firstname: string;
  lastname: string;
  dob: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  zip: string;
  mobileNumber: string;
  housePhoneNumber: string;
  existingClientName: string;
}

export default function CreateGuarantorModal({ isOpen, onClose, loanId, onSuccess }: CreateGuarantorModalProps) {
  const [template, setTemplate] = useState<GuarantorTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [form, setForm] = useState<CreateGuarantorForm>({
    isExistingClient: false,
    guarantorTypeId: 1, // Default to CUSTOMER
    clientRelationshipTypeId: 0,
    firstname: "",
    lastname: "",
    dob: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    zip: "",
    mobileNumber: "",
    housePhoneNumber: "",
    existingClientName: "",
  });

  // Fetch template when modal opens
  useEffect(() => {
    if (isOpen && loanId) {
      fetchTemplate();
    }
  }, [isOpen, loanId]);

  const fetchTemplate = async () => {
    try {
      setTemplateLoading(true);
      const response = await fetch(`/api/fineract/loans/${loanId}/guarantors/template`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
      }

      const data: GuarantorTemplate = await response.json();
      setTemplate(data);
      
      // Set default guarantor type
      if (data.guarantorTypeOptions.length > 0) {
        setForm(prev => ({ ...prev, guarantorTypeId: data.guarantorTypeOptions[0].id }));
      }
    } catch (error) {
      console.error("Error fetching template:", error);
      toast({
        title: "Error",
        description: "Failed to fetch guarantor template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (form.isExistingClient && !form.existingClientName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter the existing client name.",
        variant: "destructive",
      });
      return;
    }

    if (!form.isExistingClient) {
      if (!form.firstname.trim() || !form.lastname.trim()) {
        toast({
          title: "Validation Error",
          description: "First name and last name are required.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!form.clientRelationshipTypeId) {
      toast({
        title: "Validation Error",
        description: "Please select a relationship type.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      let payload: any = {
        dateFormat: "dd MMMM yyyy",
        locale: "en",
        guarantorTypeId: form.guarantorTypeId,
        clientRelationshipTypeId: form.clientRelationshipTypeId,
      };

      if (form.isExistingClient) {
        // For existing client, we need to find the client ID by name
        // This would require additional API call to search for the client
        // For now, we'll show an error message
        toast({
          title: "Not Implemented",
          description: "Creating guarantor from existing client is not yet implemented.",
          variant: "destructive",
        });
        return;
      } else {
        // For new client
        payload = {
          ...payload,
          firstname: form.firstname,
          lastname: form.lastname,
          dob: form.dob ? format(new Date(form.dob), 'dd MMMM yyyy') : undefined,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2 || "N/A",
          city: form.city,
          zip: form.zip,
          mobileNumber: form.mobileNumber,
          housePhoneNumber: form.housePhoneNumber,
        };
      }

      const response = await fetch(`/api/fineract/loans/${loanId}/guarantors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create guarantor: ${response.statusText}`);
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Guarantor created successfully.",
      });

      onSuccess();
      onClose();
      
      // Reset form
      setForm({
        isExistingClient: false,
        guarantorTypeId: 1,
        clientRelationshipTypeId: 0,
        firstname: "",
        lastname: "",
        dob: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        zip: "",
        mobileNumber: "",
        housePhoneNumber: "",
        existingClientName: "",
      });
    } catch (error) {
      console.error("Error creating guarantor:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create guarantor. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setForm({
        isExistingClient: false,
        guarantorTypeId: 1,
        clientRelationshipTypeId: 0,
        firstname: "",
        lastname: "",
        dob: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        zip: "",
        mobileNumber: "",
        housePhoneNumber: "",
        existingClientName: "",
      });
      onClose();
    }
  };

  const handleExistingClientChange = (checked: boolean) => {
    setForm(prev => ({ ...prev, isExistingClient: checked }));
  };

  if (templateLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Guarantor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-64 w-full bg-gray-200 rounded animate-pulse"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Guarantor</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {template && (
            <>
              {/* Existing Client Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="existingClient"
                  checked={form.isExistingClient}
                  onCheckedChange={handleExistingClientChange}
                />
                <Label htmlFor="existingClient">Existing Client</Label>
              </div>

              {/* Form Fields */}
              {form.isExistingClient ? (
                // Existing Client Form
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="existingClientName">Name *</Label>
                    <Input
                      id="existingClientName"
                      value={form.existingClientName}
                      onChange={(e) => setForm(prev => ({ ...prev, existingClientName: e.target.value }))}
                      placeholder="Name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="relationship">Relationship *</Label>
                    <Select
                      value={form.clientRelationshipTypeId.toString()}
                      onValueChange={(value) => setForm(prev => ({ ...prev, clientRelationshipTypeId: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {template.allowedClientRelationshipTypes.map((relationship) => (
                          <SelectItem key={relationship.id} value={relationship.id.toString()}>
                            {relationship.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                // New Client Form
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstname">First Name *</Label>
                      <Input
                        id="firstname"
                        value={form.firstname}
                        onChange={(e) => setForm(prev => ({ ...prev, firstname: e.target.value }))}
                        placeholder="First Name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastname">Last Name *</Label>
                      <Input
                        id="lastname"
                        value={form.lastname}
                        onChange={(e) => setForm(prev => ({ ...prev, lastname: e.target.value }))}
                        placeholder="Last Name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dob">Date Of Birth</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !form.dob && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.dob ? format(new Date(form.dob), "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={form.dob ? new Date(form.dob) : undefined}
                          onSelect={(date) => setForm(prev => ({ ...prev, dob: date ? format(date, "yyyy-MM-dd") : "" }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine1">Address Line 1</Label>
                    <Input
                      id="addressLine1"
                      value={form.addressLine1}
                      onChange={(e) => setForm(prev => ({ ...prev, addressLine1: e.target.value }))}
                      placeholder="Address Line 1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">Address Line 2</Label>
                    <Input
                      id="addressLine2"
                      value={form.addressLine2}
                      onChange={(e) => setForm(prev => ({ ...prev, addressLine2: e.target.value }))}
                      placeholder="Address Line 2"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={form.city}
                        onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="City"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zip">Zip</Label>
                      <Input
                        id="zip"
                        value={form.zip}
                        onChange={(e) => setForm(prev => ({ ...prev, zip: e.target.value }))}
                        placeholder="Zip"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mobileNumber">Mobile</Label>
                      <Input
                        id="mobileNumber"
                        value={form.mobileNumber}
                        onChange={(e) => setForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                        placeholder="Mobile"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="housePhoneNumber">Residence Phone #</Label>
                      <Input
                        id="housePhoneNumber"
                        value={form.housePhoneNumber}
                        onChange={(e) => setForm(prev => ({ ...prev, housePhoneNumber: e.target.value }))}
                        placeholder="Residence Phone #"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="relationship">Relationship *</Label>
                    <Select
                      value={form.clientRelationshipTypeId.toString()}
                      onValueChange={(value) => setForm(prev => ({ ...prev, clientRelationshipTypeId: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {template.allowedClientRelationshipTypes.map((relationship) => (
                          <SelectItem key={relationship.id} value={relationship.id.toString()}>
                            {relationship.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !template}
          >
            {loading ? "Creating..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
