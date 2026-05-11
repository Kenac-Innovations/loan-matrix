"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EntityStructureEditor } from "@/components/entity-structure/entity-structure-editor";

type Option = {
  id: number;
  name?: string;
  value?: string;
  displayName?: string;
};

type ClientNonPersonDetails = {
  constitution?: Option;
  incorpValidityTillDate?: string | number[];
  incorpNumber?: string;
  incorporationDate?: string | number[];
  mainBusinessLine?: Option;
  remarks?: string;
};

type ClientTemplateData = {
  id: number;
  officeId: number;
  officeName?: string;
  officeOptions?: Option[];
  staffId?: number;
  staffName?: string;
  staffOptions?: Option[];
  legalForm?: {
    id: number;
    code?: string;
    value: string;
  };
  clientLegalFormOptions?: Option[];
  accountNo: string;
  externalId?: string;
  fullname?: string;
  firstname?: string;
  middlename?: string;
  lastname?: string;
  gender?: Option;
  genderOptions?: Option[];
  isStaff?: boolean;
  mobileNo?: string;
  emailAddress?: string;
  dateOfBirth?: string | number[];
  clientType?: Option;
  clientTypeOptions?: Option[];
  clientClassification?: Option;
  clientClassificationOptions?: Option[];
  timeline?: {
    submittedOnDate?: string | number[];
    activatedOnDate?: string | number[];
  };
  activationDate?: string | number[];
  submittedOnDate?: string | number[];
  clientNonPersonDetails?: ClientNonPersonDetails;
  clientNonPersonConstitutionOptions?: Option[];
  clientNonPersonMainBusinessLineOptions?: Option[];
};

type EntityFormData = {
  constitutionId: string;
  incorpValidityTillDate: string;
  incorpNumber: string;
  mainBusinessLineId: string;
  remarks: string;
};

type FormDataState = {
  officeId: string;
  staffId: string;
  legalFormId: string;
  accountNo: string;
  externalId: string;
  fullname: string;
  firstname: string;
  middlename: string;
  lastname: string;
  genderId: string;
  isStaff: boolean;
  mobileNo: string;
  emailAddress: string;
  dateOfBirth: string;
  clientTypeId: string;
  clientClassificationId: string;
  submittedOnDate: string;
  activationDate: string;
  clientNonPersonDetails: EntityFormData;
};

interface ClientEditFormProps {
  clientId: number;
}

function ClientEditFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 pt-6">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function toDateInputValue(value?: string | number[] | null): string {
  if (!value) return "";
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const directMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (directMatch) {
      return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
  }
  return "";
}

function buildInitialFormData(client: ClientTemplateData): FormDataState {
  const legalFormId = String(client.legalForm?.id ?? 1);
  const isEntity = legalFormId === "2";
  const nonPerson = client.clientNonPersonDetails;

  return {
    officeId: String(client.officeId ?? ""),
    staffId: client.staffId ? String(client.staffId) : "",
    legalFormId,
    accountNo: client.accountNo ?? "",
    externalId: client.externalId ?? "",
    fullname: isEntity ? (client.fullname ?? "").trim() : "",
    firstname: isEntity ? "" : client.firstname ?? "",
    middlename: isEntity ? "" : client.middlename ?? "",
    lastname: isEntity ? "" : client.lastname ?? "",
    genderId: isEntity ? "" : client.gender?.id ? String(client.gender.id) : "",
    isStaff: Boolean(client.isStaff),
    mobileNo: client.mobileNo ?? "",
    emailAddress: client.emailAddress ?? "",
    dateOfBirth: toDateInputValue(
      isEntity
        ? nonPerson?.incorporationDate ?? client.dateOfBirth
        : client.dateOfBirth
    ),
    clientTypeId: client.clientType?.id ? String(client.clientType.id) : "",
    clientClassificationId: client.clientClassification?.id
      ? String(client.clientClassification.id)
      : "",
    submittedOnDate: toDateInputValue(
      client.timeline?.submittedOnDate ?? client.submittedOnDate
    ),
    activationDate: toDateInputValue(
      client.timeline?.activatedOnDate ?? client.activationDate
    ),
    clientNonPersonDetails: {
      constitutionId: nonPerson?.constitution?.id
        ? String(nonPerson.constitution.id)
        : "",
      incorpValidityTillDate: toDateInputValue(nonPerson?.incorpValidityTillDate),
      incorpNumber: nonPerson?.incorpNumber ?? "",
      mainBusinessLineId: nonPerson?.mainBusinessLine?.id
        ? String(nonPerson.mainBusinessLine.id)
        : "",
      remarks: nonPerson?.remarks ?? "",
    },
  };
}

function isEmailInvalid(email: string) {
  if (!email) return false;
  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ClientEditForm({ clientId }: ClientEditFormProps) {
  const router = useRouter();
  const { success: showSuccessToast } = useToast();
  const [client, setClient] = useState<ClientTemplateData | null>(null);
  const [formData, setFormData] = useState<FormDataState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityLeadId, setEntityLeadId] = useState<string | null>(null);
  const [entityStakeholders, setEntityStakeholders] = useState<unknown[]>([]);
  const [entityBankAccounts, setEntityBankAccounts] = useState<unknown[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const clientResponse = await fetch(
          `/api/clients/${clientId}?template=true&staffInSelectedOfficeOnly=true`
        );
        if (!clientResponse.ok) {
          throw new Error("Failed to fetch client details");
        }

        const clientData = (await clientResponse.json()) as ClientTemplateData;
        setClient(clientData);
        setFormData(buildInitialFormData(clientData));

        if (clientData.legalForm?.id === 2) {
          try {
            const entityResponse = await fetch(
              `/api/clients/${clientId}/entity-structure`
            );
            if (entityResponse.ok) {
              const entityData = await entityResponse.json();
              setEntityLeadId(entityData.leadId ?? null);
              setEntityStakeholders(entityData.entityStakeholders || []);
              setEntityBankAccounts(entityData.entityBankAccounts || []);
            } else {
              setEntityLeadId(null);
              setEntityStakeholders([]);
              setEntityBankAccounts([]);
            }
          } catch {
            setEntityLeadId(null);
            setEntityStakeholders([]);
            setEntityBankAccounts([]);
          }
        } else {
          setEntityLeadId(null);
          setEntityStakeholders([]);
          setEntityBankAccounts([]);
        }
      } catch (err) {
        console.error("Error fetching client edit data:", err);
        setError("Failed to load client details");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clientId]);

  const isEntity = formData?.legalFormId === "2";
  const officeOptions = client?.officeOptions ?? [];
  const staffOptions = client?.staffOptions ?? [];
  const legalFormOptions = client?.clientLegalFormOptions ?? [];
  const genderOptions = client?.genderOptions ?? [];
  const clientTypeOptions = client?.clientTypeOptions ?? [];
  const clientClassificationOptions = client?.clientClassificationOptions ?? [];
  const constitutionOptions = client?.clientNonPersonConstitutionOptions ?? [];
  const businessLineOptions = client?.clientNonPersonMainBusinessLineOptions ?? [];

  const submittedDateMin = "2000-01-01";
  const maxDate = "2100-01-01";

  const canSubmit = useMemo(() => {
    if (!formData || saving) return false;
    if (!formData.submittedOnDate) return false;
    if (isEmailInvalid(formData.emailAddress)) return false;

    if (isEntity) {
      return Boolean(formData.fullname.trim());
    }

    return Boolean(formData.firstname.trim() && formData.lastname.trim());
  }, [formData, isEntity, saving]);

  const refreshEntityStructure = async () => {
    if (!isEntity) return;
    try {
      const response = await fetch(`/api/clients/${clientId}/entity-structure`);
      if (!response.ok) return;
      const entityData = await response.json();
      setEntityLeadId(entityData.leadId ?? null);
      setEntityStakeholders(entityData.entityStakeholders || []);
      setEntityBankAccounts(entityData.entityBankAccounts || []);
    } catch {
      /* ignore */
    }
  };

  const handleInputChange = (
    field: keyof FormDataState,
    value: string | boolean
  ) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleEntityFieldChange = (
    field: keyof EntityFormData,
    value: string
  ) => {
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            clientNonPersonDetails: {
              ...prev.clientNonPersonDetails,
              [field]: value,
            },
          }
        : prev
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData) return;

    if (isEntity && !formData.fullname.trim()) {
      setError("Entity name is required");
      return;
    }

    if (!isEntity && (!formData.firstname.trim() || !formData.lastname.trim())) {
      setError("First name and last name are required");
      return;
    }

    if (isEmailInvalid(formData.emailAddress)) {
      setError("Enter a valid email address");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const rawValue = structuredClone(formData);
      const locale = "en";
      const dateFormat = "yyyy-MM-dd";

      const updateData: Record<string, unknown> = {
        ...rawValue,
        dateOfBirth: rawValue.dateOfBirth || undefined,
        submittedOnDate: rawValue.submittedOnDate || undefined,
        activationDate: rawValue.activationDate || undefined,
        dateFormat,
        locale,
        genderId: rawValue.genderId ? Number(rawValue.genderId) : undefined,
        staffId: rawValue.staffId ? Number(rawValue.staffId) : undefined,
        clientTypeId: rawValue.clientTypeId
          ? Number(rawValue.clientTypeId)
          : undefined,
        clientClassificationId: rawValue.clientClassificationId
          ? Number(rawValue.clientClassificationId)
          : undefined,
        legalFormId: rawValue.legalFormId ? Number(rawValue.legalFormId) : undefined,
      };

      delete updateData.officeId;
      delete updateData.accountNo;

      updateData.clientNonPersonDetails = isEntity
        ? {
            constitutionId: rawValue.clientNonPersonDetails.constitutionId
              ? Number(rawValue.clientNonPersonDetails.constitutionId)
              : undefined,
            incorpValidityTillDate:
              rawValue.clientNonPersonDetails.incorpValidityTillDate || undefined,
            incorpNumber:
              rawValue.clientNonPersonDetails.incorpNumber || undefined,
            mainBusinessLineId: rawValue.clientNonPersonDetails.mainBusinessLineId
              ? Number(rawValue.clientNonPersonDetails.mainBusinessLineId)
              : undefined,
            remarks: rawValue.clientNonPersonDetails.remarks || undefined,
            dateFormat,
            locale,
          }
        : {};

      if (isEntity) {
        delete updateData.firstname;
        delete updateData.middlename;
        delete updateData.lastname;
      } else {
        delete updateData.fullname;
      }

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

      showSuccessToast({
        title: "Success",
        description: `Client updated successfully! Account: ${
          formData.accountNo || "N/A"
        }`,
      });
      router.push(`/clients/${clientId}`);
    } catch (err) {
      console.error("Error updating client:", err);
      setError(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ClientEditFormSkeleton />;
  }

  if (error && !client) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!client || !formData) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Client edit data is unavailable.</AlertDescription>
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

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>
              Update client details and personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="officeId">Office</Label>
                <Select value={formData.officeId} disabled>
                  <SelectTrigger id="officeId">
                    <SelectValue placeholder="Select office" />
                  </SelectTrigger>
                  <SelectContent>
                    {officeOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name ?? option.value ?? `Office ${option.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legalFormId">Legal Form</Label>
                <Select value={formData.legalFormId} disabled>
                  <SelectTrigger id="legalFormId">
                    <SelectValue placeholder="Select legal form" />
                  </SelectTrigger>
                  <SelectContent>
                    {legalFormOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.value ?? option.name ?? `Legal Form ${option.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  onChange={(e) =>
                    handleInputChange("externalId", e.target.value)
                  }
                />
              </div>

              {isEntity ? (
                <div className="space-y-2 lg:col-span-2 xl:col-span-2">
                  <Label htmlFor="fullname">Entity Name *</Label>
                  <Input
                    id="fullname"
                    value={formData.fullname}
                    onChange={(e) =>
                      handleInputChange("fullname", e.target.value)
                    }
                    required
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="firstname">First Name *</Label>
                    <Input
                      id="firstname"
                      value={formData.firstname}
                      onChange={(e) =>
                        handleInputChange("firstname", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="middlename">Middle Name</Label>
                    <Input
                      id="middlename"
                      value={formData.middlename}
                      onChange={(e) =>
                        handleInputChange("middlename", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastname">Last Name *</Label>
                    <Input
                      id="lastname"
                      value={formData.lastname}
                      onChange={(e) =>
                        handleInputChange("lastname", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="genderId">Gender</Label>
                    <Select
                      value={formData.genderId || "__none__"}
                      onValueChange={(value) =>
                        handleInputChange(
                          "genderId",
                          value === "__none__" ? "" : value
                        )
                      }
                    >
                      <SelectTrigger id="genderId">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {genderOptions.map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.name ?? option.value ?? `Gender ${option.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">
                  {isEntity ? "Date of Incorporation" : "Date of Birth"}
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) =>
                    handleInputChange("dateOfBirth", e.target.value)
                  }
                  max={maxDate}
                />
              </div>

              {!isEntity && (
                <div className="flex items-center gap-3 pt-8">
                  <Checkbox
                    id="isStaff"
                    checked={formData.isStaff}
                    onCheckedChange={(checked) =>
                      handleInputChange("isStaff", checked === true)
                    }
                  />
                  <Label htmlFor="isStaff">Is staff?</Label>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="staffId">Staff</Label>
                <Select
                  value={formData.staffId || "__none__"}
                  onValueChange={(value) =>
                    handleInputChange(
                      "staffId",
                      value === "__none__" ? "" : value
                    )
                  }
                >
                  <SelectTrigger id="staffId">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {staffOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.displayName ??
                          option.name ??
                          option.value ??
                          `Staff ${option.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobileNo">Mobile No</Label>
                <Input
                  id="mobileNo"
                  type="tel"
                  value={formData.mobileNo}
                  onChange={(e) =>
                    handleInputChange("mobileNo", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailAddress">Email Address</Label>
                <Input
                  id="emailAddress"
                  type="email"
                  value={formData.emailAddress}
                  onChange={(e) =>
                    handleInputChange("emailAddress", e.target.value)
                  }
                />
                {isEmailInvalid(formData.emailAddress) && (
                  <p className="text-sm text-destructive">
                    Enter a valid email address.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientTypeId">Client Type</Label>
                <Select
                  value={formData.clientTypeId || "__none__"}
                  onValueChange={(value) =>
                    handleInputChange(
                      "clientTypeId",
                      value === "__none__" ? "" : value
                    )
                  }
                >
                  <SelectTrigger id="clientTypeId">
                    <SelectValue placeholder="Select client type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {clientTypeOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name ?? option.value ?? `Type ${option.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientClassificationId">
                  Client Classification
                </Label>
                <Select
                  value={formData.clientClassificationId || "__none__"}
                  onValueChange={(value) =>
                    handleInputChange(
                      "clientClassificationId",
                      value === "__none__" ? "" : value
                    )
                  }
                >
                  <SelectTrigger id="clientClassificationId">
                    <SelectValue placeholder="Select client classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {clientClassificationOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name ??
                          option.value ??
                          `Classification ${option.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="submittedOnDate">Submitted On *</Label>
                <Input
                  id="submittedOnDate"
                  type="date"
                  value={formData.submittedOnDate}
                  onChange={(e) =>
                    handleInputChange("submittedOnDate", e.target.value)
                  }
                  min={submittedDateMin}
                  max={maxDate}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="activationDate">Activated On</Label>
                <Input
                  id="activationDate"
                  type="date"
                  value={formData.activationDate}
                  onChange={(e) =>
                    handleInputChange("activationDate", e.target.value)
                  }
                  min={formData.submittedOnDate || submittedDateMin}
                  max={maxDate}
                />
              </div>
            </div>

            {isEntity && (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="constitutionId">Constitution</Label>
                    <Select
                      value={
                        formData.clientNonPersonDetails.constitutionId || "__none__"
                      }
                      onValueChange={(value) =>
                        handleEntityFieldChange(
                          "constitutionId",
                          value === "__none__" ? "" : value
                        )
                      }
                    >
                      <SelectTrigger id="constitutionId">
                        <SelectValue placeholder="Select constitution" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {constitutionOptions.map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.name ??
                              option.value ??
                              `Constitution ${option.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mainBusinessLineId">Main Business Line</Label>
                    <Select
                      value={
                        formData.clientNonPersonDetails.mainBusinessLineId ||
                        "__none__"
                      }
                      onValueChange={(value) =>
                        handleEntityFieldChange(
                          "mainBusinessLineId",
                          value === "__none__" ? "" : value
                        )
                      }
                    >
                      <SelectTrigger id="mainBusinessLineId">
                        <SelectValue placeholder="Select business line" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {businessLineOptions.map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.name ??
                              option.value ??
                              `Business Line ${option.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incorpValidityTillDate">
                      Incorporation Valid Till
                    </Label>
                    <Input
                      id="incorpValidityTillDate"
                      type="date"
                      value={formData.clientNonPersonDetails.incorpValidityTillDate}
                      onChange={(e) =>
                        handleEntityFieldChange(
                          "incorpValidityTillDate",
                          e.target.value
                        )
                      }
                      min={submittedDateMin}
                      max={maxDate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incorpNumber">Incorporation Number</Label>
                    <Input
                      id="incorpNumber"
                      value={formData.clientNonPersonDetails.incorpNumber}
                      onChange={(e) =>
                        handleEntityFieldChange("incorpNumber", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={formData.clientNonPersonDetails.remarks}
                      onChange={(e) =>
                        handleEntityFieldChange("remarks", e.target.value)
                      }
                      rows={3}
                    />
                  </div>
                </div>

                <Card className="mt-2 border-muted">
                  <CardHeader>
                    <CardTitle>Directors, shareholders &amp; entity banking</CardTitle>
                    <CardDescription>
                      Data is stored in Loan Matrix. These records are managed
                      separately from the core Fineract client update payload.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EntityStructureEditor
                      leadId={entityLeadId}
                      fineractClientId={clientId}
                      initialStakeholders={entityStakeholders}
                      initialBankAccounts={entityBankAccounts}
                      onRefresh={refreshEntityStructure}
                    />
                  </CardContent>
                </Card>
              </>
            )}

            <div className="flex justify-center gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/clients/${clientId}`)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
