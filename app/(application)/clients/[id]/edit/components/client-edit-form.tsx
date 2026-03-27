"use client";

import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FineractClient {
  id: number;
  accountNo: string;
  externalId?: string;
  displayName?: string;
  fullname?: string;
  firstname?: string;
  middlename?: string;
  lastname?: string;
  mobileNo?: string;
  emailAddress?: string;
  dateOfBirth?: string | number[];
  gender?: {
    id: number;
    name: string;
  };
  clientType?: {
    id: number;
    name: string;
  };
  clientClassification?: {
    id: number;
    name: string;
  };
  officeId: number;
  officeName: string;
  staffId?: number;
  staffName?: string;
  activationDate?: string | number[];
  submittedOnDate: string | number[];
  legalForm?: {
    id: number;
    code: string;
    value: string;
  };
  isStaff?: boolean;
  timeline?: {
    submittedOnDate: string | number[];
    submittedByUsername?: string;
    activatedOnDate?: string | number[];
    activatedByUsername?: string;
    activatedByFirstname?: string;
    activatedByLastname?: string;
  };
  clientNonPersonDetails?: {
    incorporationDate?: string | number[];
  };
}

interface Staff {
  id: number;
  displayName: string;
}

interface ClientEditFormProps {
  clientId: number;
}

export function ClientEditForm({ clientId }: ClientEditFormProps) {
  const router = useRouter();
  const [client, setClient] = useState<FineractClient | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    legalForm: "1", // Default to Person
    accountNo: "",
    externalId: "",
    fullname: "",
    firstname: "",
    middlename: "",
    lastname: "",
    gender: "",
    dateOfBirth: "",
    isStaff: false,
    staffId: "",
    emailAddress: "",
    mobileNo: "",
    clientClassification: "1", // Default to REGULAR
    clientType: "1", // Default to INDIVIDUAL
    activationDate: "",
    submittedOnDate: "",
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch client details
        const clientResponse = await fetch(`/api/clients/${clientId}`);
        if (!clientResponse.ok) {
          throw new Error("Failed to fetch client details");
        }
        console.log("==========> clientDataResponse to edit ::", clientResponse);
        const clientData = await clientResponse.json();
        console.log("==========> clientData to edit ::", clientData);
        console.log("==========> activationDate ::", clientData.activationDate);
        console.log("==========> submittedOnDate ::", clientData.submittedOnDate);
        console.log("==========> timeline ::", clientData.timeline);
        setClient(clientData);

        // Helper function to convert date array to ISO string
        const convertDateArray = (dateArray: number[] | string | undefined): string => {
          if (!dateArray) return "";
          if (typeof dateArray === "string") {
            return new Date(dateArray).toISOString().split('T')[0];
          }
          if (Array.isArray(dateArray) && dateArray.length === 3) {
            const [year, month, day] = dateArray;
            // Note: month is 0-indexed in Date constructor, but Fineract uses 1-indexed
            return new Date(year, month - 1, day).toISOString().split('T')[0];
          }
          return "";
        };

        // Set form data from client
        const isEntityClient = clientData.legalForm?.id === 2;
        setFormData({
          legalForm: clientData.legalForm?.id?.toString() || "1",
          accountNo: clientData.accountNo || "",
          externalId: clientData.externalId || "",
          fullname: isEntityClient
            ? (clientData.fullname || clientData.displayName || "").trim()
            : "",
          firstname: isEntityClient ? "" : clientData.firstname || "",
          middlename: isEntityClient ? "" : clientData.middlename || "",
          lastname: isEntityClient ? "" : clientData.lastname || "",
          gender: isEntityClient ? "" : clientData.gender?.id?.toString() || "",
          dateOfBirth: convertDateArray(
            isEntityClient
              ? clientData.clientNonPersonDetails?.incorporationDate ??
                  clientData.dateOfBirth
              : clientData.dateOfBirth
          ),
          isStaff: clientData.isStaff || false,
          staffId: clientData.staffId?.toString() || "",
          emailAddress: clientData.emailAddress || "",
          mobileNo: clientData.mobileNo || "",
          clientClassification: clientData.clientClassification?.id?.toString() || "1",
          clientType: clientData.clientType?.id?.toString() || "1",
          activationDate: convertDateArray(clientData.activationDate || clientData.timeline?.activatedOnDate),
          submittedOnDate: convertDateArray(clientData.submittedOnDate || clientData.timeline?.submittedOnDate),
        });

        // Fetch staff
        const staffResponse = await fetch("/api/staff");
        if (staffResponse.ok) {
          const staffData = await staffResponse.json();
          setStaff(Array.isArray(staffData) ? staffData : []);
        } else {
          // Mock data for development
          setStaff([
            { id: 1, displayName: "Bazaya, Nashley" },
            { id: 2, displayName: "Smith, John" },
          ]);
        }

      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load client details");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clientId]);

  const isEntity = formData.legalForm === "2";

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEntity) {
      if (!formData.fullname.trim()) {
        setError("Entity name is required");
        return;
      }
    } else {
      if (!formData.firstname.trim() || !formData.lastname.trim()) {
        setError("First name and last name are required");
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Transform form data to match Fineract API format.
      // locale + dateFormat are required so Fineract can parse date fields.
      const updateData = {
        locale: "en",
        dateFormat: "yyyy-MM-dd",
        legalFormId: parseInt(formData.legalForm) || undefined,
        externalId: formData.externalId || undefined,
        isStaff: formData.isStaff,
        staffId: parseInt(formData.staffId) || undefined,
        emailAddress: formData.emailAddress || undefined,
        mobileNo: formData.mobileNo || undefined,
        // clientClassificationId: parseInt(formData.clientClassification) || undefined,
        clientTypeId: parseInt(formData.clientType) || undefined,
        activationDate: formData.activationDate ? new Date(formData.activationDate).toISOString().split('T')[0] : undefined,
        submittedOnDate: formData.submittedOnDate ? new Date(formData.submittedOnDate).toISOString().split('T')[0] : undefined,
        ...(isEntity
          ? { fullname: formData.fullname.trim() }
          : {
              firstname: formData.firstname,
              middlename: formData.middlename || undefined,
              lastname: formData.lastname,
              genderId: parseInt(formData.gender) || undefined,
              dateOfBirth: formData.dateOfBirth
                ? new Date(formData.dateOfBirth).toISOString().split("T")[0]
                : undefined,
            }),
      };

      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        let message = "Failed to update client";
        try {
          const errorData = await response.json();
          message =
            (typeof errorData.error === "string" && errorData.error) || message;
        } catch {
          message = `Update failed (${response.status})`;
        }
        throw new Error(message);
      }

      setSuccess("Client updated successfully");
      setTimeout(() => {
        router.push(`/clients/${clientId}`);
      }, 1500);
    } catch (err) {
      console.error("Error updating client:", err);
      setError(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setSaving(false);
    }
  };

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric", 
      year: "numeric"
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading client details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !client) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>
              Update client details and personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Row 1 */}
              <div className="space-y-2">
                <Label htmlFor="officeName">Office</Label>
                <Input
                  id="officeName"
                  value={client?.officeName ?? ""}
                  disabled
                  className="bg-muted/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="legalForm">Legal Form</Label>
                <Select value={formData.legalForm} disabled>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select legal form" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Person</SelectItem>
                    <SelectItem value="2">Entity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2 */}
              <div className="space-y-2">
                <Label htmlFor="accountNo">Account No.</Label>
                <Input
                  id="accountNo"
                  value={formData.accountNo}
                  disabled
                  className="bg-muted/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="externalId">External Id</Label>
                <Input
                  id="externalId"
                  value={formData.externalId}
                  onChange={(e) => handleInputChange("externalId", e.target.value)}
                />
              </div>

              {/* Name: person vs entity */}
              {isEntity ? (
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="fullname">Entity name *</Label>
                  <Input
                    id="fullname"
                    value={formData.fullname}
                    onChange={(e) => handleInputChange("fullname", e.target.value)}
                    required
                    autoComplete="organization"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="firstname">First Name *</Label>
                    <Input
                      id="firstname"
                      value={formData.firstname}
                      onChange={(e) => handleInputChange("firstname", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="middlename">Middle Name</Label>
                    <Input
                      id="middlename"
                      value={formData.middlename}
                      onChange={(e) => handleInputChange("middlename", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastname">Last Name *</Label>
                    <Input
                      id="lastname"
                      value={formData.lastname}
                      onChange={(e) => handleInputChange("lastname", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Male</SelectItem>
                        <SelectItem value="2">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Row 5 */}
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">
                  {isEntity ? "Date of incorporation" : "Date of Birth"}
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                  readOnly={isEntity}
                  className={isEntity ? "bg-muted/50" : undefined}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isStaff"
                    checked={formData.isStaff}
                    onCheckedChange={(checked) => handleInputChange("isStaff", checked as boolean)}
                  />
                  <Label htmlFor="isStaff">Is staff?</Label>
                </div>
              </div>

              {/* Row 6 */}
              <div className="space-y-2">
                <Label htmlFor="staffId">Staff</Label>
                <Select value={formData.staffId} onValueChange={(value) => handleInputChange("staffId", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((staffMember) => (
                      <SelectItem key={staffMember.id} value={staffMember.id.toString()}>
                        {staffMember.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailAddress">Email Address</Label>
                <Input
                  id="emailAddress"
                  type="email"
                  value={formData.emailAddress}
                  onChange={(e) => handleInputChange("emailAddress", e.target.value)}
                />
              </div>

              {/* Row 7 */}
              <div className="space-y-2">
                <Label htmlFor="mobileNo">Mobile No</Label>
                <Input
                  id="mobileNo"
                  value={formData.mobileNo}
                  onChange={(e) => handleInputChange("mobileNo", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientClassification">Client Classification</Label>
                <Select value={formData.clientClassification} onValueChange={(value) => handleInputChange("clientClassification", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">REGULAR</SelectItem>
                    <SelectItem value="2">VIP</SelectItem>
                    <SelectItem value="3">PREMIUM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 8 */}
              <div className="space-y-2">
                <Label htmlFor="clientType">Client Type</Label>
                <Select value={formData.clientType} onValueChange={(value) => handleInputChange("clientType", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select client type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">INDIVIDUAL</SelectItem>
                    <SelectItem value="2">GROUP</SelectItem>
                    <SelectItem value="3">CORPORATE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activationDate">Activated On</Label>
                <Input
                  id="activationDate"
                  type="date"
                  value={formData.activationDate}
                  onChange={(e) => handleInputChange("activationDate", e.target.value)}
                />
              </div>

              {/* Row 9 */}
              <div className="space-y-2">
                <Label htmlFor="submittedOnDate">Submitted On *</Label>
                <Input
                  id="submittedOnDate"
                  type="date"
                  value={formData.submittedOnDate}
                  onChange={(e) => handleInputChange("submittedOnDate", e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/clients/${clientId}`)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
} 