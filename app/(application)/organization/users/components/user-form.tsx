"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, PenLine, Save, Trash2, Upload } from "lucide-react";
import {
  createUserAction,
  getStaffOptionsAction,
  updateUserAction,
} from "@/app/actions/user-management-actions";
import {
  deleteUserSignatureAction,
  getUserSignatureAction,
  saveUserSignatureAction,
} from "@/app/actions/user-signature-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  AFRICAN_COUNTRY_CODES,
  getAfricanCountryDialCodeOrDefault,
  getNumericPhoneValidationError,
  USER_LOGIN_PHONE_MAX_LENGTH,
} from "@/lib/phone-utils";
import type {
  StaffOption,
  UserDetail,
  UserFormInput,
  UsersTemplate,
} from "@/shared/types/user-management";

interface UserFormProps {
  mode: "create" | "edit";
  template: UsersTemplate;
  cancelHref: string;
  initialUser?: UserDetail;
  initialStaffOptions?: StaffOption[];
}

type FieldErrors = Partial<Record<string, string[]>>;

type FormState = {
  username: string;
  email: string;
  phone: string;
  countryCode: string;
  firstname: string;
  lastname: string;
  sendPasswordToEmail: boolean;
  passwordNeverExpires: boolean;
  officeId: string;
  staffId: string;
  roles: string[];
  password: string;
  repeatPassword: string;
};

const validSignatureTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
const maxSignatureFileSize = 2 * 1024 * 1024;

function buildInitialState(
  initialUser: UserDetail | undefined,
  defaultCountryCode: string
): FormState {
  return {
    username: initialUser?.username ?? "",
    email: initialUser?.email ?? "",
    phone: initialUser?.phone ?? "",
    countryCode: initialUser?.countryCode ?? defaultCountryCode,
    firstname: initialUser?.firstname ?? "",
    lastname: initialUser?.lastname ?? "",
    sendPasswordToEmail: true,
    passwordNeverExpires: initialUser?.passwordNeverExpires ?? false,
    officeId: initialUser?.officeId ? String(initialUser.officeId) : "",
    staffId: initialUser?.staff?.id ? String(initialUser.staff.id) : "",
    roles: initialUser?.selectedRoles.map((role) => String(role.id)) ?? [],
    password: "",
    repeatPassword: "",
  };
}

function firstError(errors: FieldErrors, field: string) {
  return errors[field]?.[0];
}

function readSignatureFile(file: File): Promise<string> {
  if (!validSignatureTypes.includes(file.type)) {
    return Promise.reject(new Error("Please upload a JPG, PNG, or GIF image"));
  }

  if (file.size > maxSignatureFileSize) {
    return Promise.reject(new Error("Please upload an image smaller than 2MB"));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read signature file"));
        return;
      }

      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error("Failed to read signature file"));
    };

    reader.readAsDataURL(file);
  });
}

export function UserForm({
  mode,
  template,
  cancelHref,
  initialUser,
  initialStaffOptions = [],
}: Readonly<UserFormProps>) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(
      initialUser,
      getAfricanCountryDialCodeOrDefault(template.defaultCountryCode)
    )
  );
  const [staffOptions, setStaffOptions] =
    useState<StaffOption[]>(initialStaffOptions);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phoneValidationError, setPhoneValidationError] = useState<string | null>(
    null
  );
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [hadExistingSignature, setHadExistingSignature] = useState(false);
  const [signatureMarkedForRemoval, setSignatureMarkedForRemoval] =
    useState(false);
  const [signatureLoading, setSignatureLoading] = useState(
    mode === "edit" && Boolean(initialUser?.id)
  );
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const countryCodeOptions = useMemo(
    () =>
      AFRICAN_COUNTRY_CODES.map((entry) => ({
        value: entry.code,
        label: entry.label,
      })),
    []
  );

  useEffect(() => {
    if (mode !== "edit" || !initialUser?.id) {
      setSignatureLoading(false);
      return;
    }

    let isCancelled = false;

    setSignatureLoading(true);
    setSignatureError(null);

    getUserSignatureAction(initialUser.id)
      .then((result) => {
        if (isCancelled) {
          return;
        }

        setSignatureData(result.signatureData);
        setHadExistingSignature(Boolean(result.signatureData));
        setSignatureMarkedForRemoval(false);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setSignatureError("Failed to load saved signature");
        setHadExistingSignature(false);
      })
      .finally(() => {
        if (!isCancelled) {
          setSignatureLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [initialUser?.id, mode]);

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
    setFormError(null);
  };

  const handlePhoneChange = (value: string) => {
    if (!value) {
      setPhoneValidationError(null);
      handleChange("phone", "");
      return;
    }

    if (!/^\d+$/.test(value)) {
      setPhoneValidationError("Phone number must contain only numbers");
      return;
    }

    if (value.length > USER_LOGIN_PHONE_MAX_LENGTH) {
      setPhoneValidationError(
        `Phone number must not exceed ${USER_LOGIN_PHONE_MAX_LENGTH} digits`
      );
      return;
    }

    const nextError = getNumericPhoneValidationError(value);
    setPhoneValidationError(nextError);
    handleChange("phone", value);
  };

  const phoneFieldError = phoneValidationError || firstError(fieldErrors, "phone");
  const countryCodeFieldError = firstError(fieldErrors, "countryCode");

  const handleOfficeChange = (value: string) => {
    const nextOfficeId = value === "__none__" ? "" : value;
    handleChange("officeId", nextOfficeId);
    handleChange("staffId", "");
    setStaffOptions([]);

    if (!nextOfficeId) {
      return;
    }

    setIsLoadingStaff(true);
    startTransition(async () => {
      const result = await getStaffOptionsAction(nextOfficeId);
      if (!result.success) {
        setFormError(result.error || "Failed to load staff");
        setIsLoadingStaff(false);
        return;
      }

      setStaffOptions(result.data?.staff ?? []);
      setIsLoadingStaff(false);
    });
  };

  const toggleRole = (roleId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      roles: checked
        ? [...current.roles, roleId]
        : current.roles.filter((value) => value !== roleId),
    }));
    setFieldErrors((current) => ({
      ...current,
      roles: undefined,
    }));
  };

  const handleSignatureSelect = async (file: File) => {
    try {
      setSignatureError(null);
      const nextSignatureData = await readSignatureFile(file);
      setSignatureData(nextSignatureData);
      setSignatureMarkedForRemoval(false);
    } catch (error) {
      setSignatureError(
        error instanceof Error ? error.message : "Failed to load signature file"
      );
    }
  };

  const handleSignatureClear = () => {
    setSignatureError(null);
    setSignatureData(null);
    setSignatureMarkedForRemoval(hadExistingSignature);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSignatureError(null);

    if (phoneValidationError) {
      setFormError("Please correct the phone number and try again.");
      return;
    }

    const payload: UserFormInput = {
      userId: initialUser?.id,
      username: form.username,
      email: form.email,
      phone: form.phone,
      countryCode: form.countryCode,
      firstname: form.firstname,
      lastname: form.lastname,
      sendPasswordToEmail: form.sendPasswordToEmail,
      passwordNeverExpires: form.passwordNeverExpires,
      officeId: form.officeId,
      staffId: form.staffId || null,
      roles: form.roles,
      password: form.password,
      repeatPassword: form.repeatPassword,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createUserAction(payload)
          : await updateUserAction(payload);

      if (!result.success) {
        setFormError(result.error || `Failed to ${mode} user`);
        setFieldErrors(result.fieldErrors || {});
        return;
      }

      const userId = result.data?.userId || initialUser?.id;
      const baseDescription =
        result.message ||
        (mode === "create"
          ? "The user has been created successfully."
          : "The user has been updated successfully.");
      let toastVariant: "success" | "warning" = "success";
      let toastDescription = baseDescription;

      if (userId && signatureData) {
        const signatureResult = await saveUserSignatureAction({
          userId,
          signatureData,
        });

        if (!signatureResult.success) {
          toastVariant = "warning";
          toastDescription = `${baseDescription} Signature could not be saved: ${
            signatureResult.error || "Unknown error"
          }`;
        } else {
          toastDescription =
            mode === "create"
              ? "The user and signature have been created successfully."
              : "The user details and signature have been saved successfully.";
        }
      } else if (userId && signatureMarkedForRemoval && hadExistingSignature) {
        const signatureResult = await deleteUserSignatureAction({ userId });

        if (!signatureResult.success) {
          toastVariant = "warning";
          toastDescription = `${baseDescription} Signature could not be removed: ${
            signatureResult.error || "Unknown error"
          }`;
        } else {
          toastDescription = "The user details and signature removal were saved.";
        }
      }

      toast({
        title: mode === "create" ? "User created" : "User updated",
        description: toastDescription,
        variant: toastVariant,
      });

      if (userId) {
        router.push(`/organization/users/${userId}`);
        router.refresh();
      } else {
        router.push("/organization/users");
        router.refresh();
      }
    });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to save user</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">
            Username <span className="text-destructive">*</span>
          </Label>
          <Input
            id="username"
            value={form.username}
            onChange={(event) => handleChange("username", event.target.value)}
            required
          />
          {firstError(fieldErrors, "username") && (
            <p className="text-sm text-destructive">
              {firstError(fieldErrors, "username")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email
            {mode === "edit" || form.sendPasswordToEmail ? (
              <span className="text-destructive"> *</span>
            ) : null}
          </Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => handleChange("email", event.target.value)}
            required={mode === "edit" || form.sendPasswordToEmail}
          />
          {firstError(fieldErrors, "email") && (
            <p className="text-sm text-destructive">
              {firstError(fieldErrors, "email")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchableSelect
              options={countryCodeOptions}
              value={form.countryCode}
              onValueChange={(value) =>
                handleChange("countryCode", getAfricanCountryDialCodeOrDefault(value))
              }
              placeholder="Country code"
              emptyMessage="No African country code found."
              className="w-full sm:w-[220px]"
            />
            <Input
              id="phone"
              type="text"
              inputMode="numeric"
              autoComplete="tel-national"
              pattern="[0-9]*"
              maxLength={USER_LOGIN_PHONE_MAX_LENGTH}
              value={form.phone}
              onChange={(event) => handlePhoneChange(event.target.value)}
              placeholder="Enter phone number for SMS MFA"
              className="flex-1"
            />
          </div>
          {countryCodeFieldError && (
            <p className="text-sm text-destructive">{countryCodeFieldError}</p>
          )}
          {phoneFieldError ? (
            <p className="text-sm text-destructive">{phoneFieldError}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Digits only, maximum {USER_LOGIN_PHONE_MAX_LENGTH} digits.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="firstname">
            First Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstname"
            value={form.firstname}
            onChange={(event) => handleChange("firstname", event.target.value)}
            required
          />
          {firstError(fieldErrors, "firstname") && (
            <p className="text-sm text-destructive">
              {firstError(fieldErrors, "firstname")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastname">
            Last Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastname"
            value={form.lastname}
            onChange={(event) => handleChange("lastname", event.target.value)}
            required
          />
          {firstError(fieldErrors, "lastname") && (
            <p className="text-sm text-destructive">
              {firstError(fieldErrors, "lastname")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="officeId">
            Office <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.officeId || "__none__"}
            onValueChange={handleOfficeChange}
          >
            <SelectTrigger id="officeId">
              <SelectValue placeholder="Select office" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select office</SelectItem>
              {template.allowedOffices.map((office) => (
                <SelectItem key={office.id} value={String(office.id)}>
                  {office.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {firstError(fieldErrors, "officeId") && (
            <p className="text-sm text-destructive">
              {firstError(fieldErrors, "officeId")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="staffId">Staff</Label>
          <Select
            value={form.staffId || "__none__"}
            onValueChange={(value) =>
              handleChange("staffId", value === "__none__" ? "" : value)
            }
            disabled={!form.officeId || isLoadingStaff}
          >
            <SelectTrigger id="staffId">
              <SelectValue
                placeholder={
                  isLoadingStaff ? "Loading staff..." : "Select staff"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {staffOptions.map((staff) => (
                <SelectItem key={staff.id} value={String(staff.id)}>
                  {staff.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoadingStaff && (
            <p className="text-sm text-muted-foreground">Loading staff list...</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border p-4">
          <Checkbox
            checked={form.passwordNeverExpires}
            onCheckedChange={(checked) =>
              handleChange("passwordNeverExpires", checked === true)
            }
          />
          <div className="space-y-1">
            <span className="font-medium">Password never expires</span>
            <p className="text-sm text-muted-foreground">
              Keep this user exempt from password expiry.
            </p>
          </div>
        </label>

        {mode === "create" && (
          <label className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              checked={form.sendPasswordToEmail}
              onCheckedChange={(checked) =>
                handleChange("sendPasswordToEmail", checked === true)
              }
            />
            <div className="space-y-1">
              <span className="font-medium">Send password to email address</span>
              <p className="text-sm text-muted-foreground">
                When turned off, you must set the user password manually.
              </p>
            </div>
          </label>
        )}
      </div>

      {mode === "create" && !form.sendPasswordToEmail && (
        <div className="grid grid-cols-1 gap-6 rounded-xl border p-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">
              Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(event) => handleChange("password", event.target.value)}
            />
            {firstError(fieldErrors, "password") && (
              <p className="text-sm text-destructive">
                {firstError(fieldErrors, "password")}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Use 12-50 characters with uppercase, lowercase, number, and special
              character.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repeatPassword">
              Repeat Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="repeatPassword"
              type="password"
              value={form.repeatPassword}
              onChange={(event) =>
                handleChange("repeatPassword", event.target.value)
              }
            />
            {firstError(fieldErrors, "repeatPassword") && (
              <p className="text-sm text-destructive">
                {firstError(fieldErrors, "repeatPassword")}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-xl border p-6">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 font-semibold">
            <PenLine className="h-4 w-4" />
            User Signature
          </h3>
          <p className="text-sm text-muted-foreground">
            Upload an optional signature for this user. It will appear in their
            profile and can be used for loan contract generation.
          </p>
        </div>

        {signatureLoading ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed p-6">
              {signatureData ? (
                <div className="space-y-4 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signatureData}
                    alt="User signature preview"
                    className="mx-auto max-h-32 rounded border bg-white p-2"
                  />
                  <div className="flex flex-col justify-center gap-3 sm:flex-row">
                    <Label
                      htmlFor="user-signature-upload"
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Upload className="h-4 w-4" />
                      Replace Signature
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSignatureClear}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      {hadExistingSignature
                        ? "Remove Signature"
                        : "Clear Selection"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <PenLine className="mx-auto h-10 w-10 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {signatureMarkedForRemoval && hadExistingSignature
                        ? "Signature will be removed"
                        : "No signature selected"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {signatureMarkedForRemoval && hadExistingSignature
                        ? "Save changes to remove the current signature, or upload a replacement now."
                        : mode === "edit"
                          ? "No signature has been saved for this user yet."
                          : "Add a signature now or leave this optional section empty."}
                    </p>
                  </div>
                  <Label
                    htmlFor="user-signature-upload"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Signature
                  </Label>
                </div>
              )}

              <Input
                id="user-signature-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif"
                className="hidden"
                disabled={isPending || signatureLoading}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    await handleSignatureSelect(file);
                  }
                  event.target.value = "";
                }}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Accepted formats: JPG, PNG, GIF. Maximum file size: 2MB.
            </p>

            {signatureError && (
              <p className="text-sm text-destructive">{signatureError}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border p-6">
        <div className="space-y-1">
          <h3 className="font-semibold">
            Roles <span className="text-destructive">*</span>
          </h3>
          <p className="text-sm text-muted-foreground">
            Assign one or more roles to control what the user can access.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {template.availableRoles.map((role) => {
            const checked = form.roles.includes(String(role.id));
            const disabled = Boolean(role.disabled);

            return (
              <label
                key={role.id}
                className={`flex items-start gap-3 rounded-lg border p-4 ${
                  disabled ? "opacity-60" : ""
                }`}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) =>
                    toggleRole(String(role.id), value === true)
                  }
                />
                <div className="space-y-1">
                  <span className="font-medium">{role.name}</span>
                  {role.description && (
                    <p className="text-sm text-muted-foreground">
                      {role.description}
                    </p>
                  )}
                  {disabled && (
                    <p className="text-xs text-muted-foreground">
                      This role is disabled in Fineract.
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {firstError(fieldErrors, "roles") && (
          <p className="text-sm text-destructive">
            {firstError(fieldErrors, "roles")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          disabled={isPending || signatureLoading || Boolean(phoneValidationError)}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {mode === "create" ? "Create User" : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(cancelHref)}
          disabled={isPending || signatureLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
