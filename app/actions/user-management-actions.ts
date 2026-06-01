"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchFineractAPI } from "@/lib/api";
import { hasPermissionServer } from "@/lib/authorization";
import { SpecificPermission } from "@/shared/types/auth";
import type {
  OfficeOption,
  StaffOption,
  UserActionResult,
  UserDetail,
  UserFormInput,
  UserPasswordChangeInput,
  UserRoleOption,
  UserSummary,
  UsersTemplate,
} from "@/shared/types/user-management";

const namePattern = /^[A-Za-z].*/;
const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^\w\s]).+$/;
const minimumPasswordLength = 12;
const maximumPasswordLength = 50;
type LooseObject = Record<string, unknown>;

const createUserSchema = z
  .object({
    username: z.string().trim().min(1, "Username is required"),
    email: z.string().trim().optional().default(""),
    firstname: z
      .string()
      .trim()
      .min(1, "First name is required")
      .regex(
        namePattern,
        "First name cannot begin with a special character or number"
      ),
    lastname: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .regex(
        namePattern,
        "Last name cannot begin with a special character or number"
      ),
    sendPasswordToEmail: z.boolean().default(true),
    passwordNeverExpires: z.boolean().default(false),
    officeId: z.coerce.number().int().positive("Office is required"),
    staffId: z
      .union([z.coerce.number().int().positive(), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (typeof value === "number" ? value : undefined)),
    roles: z
      .array(z.coerce.number().int().positive())
      .min(1, "At least one role must be selected"),
    password: z.string().optional(),
    repeatPassword: z.string().optional(),
  })
  .superRefine((value, context) => {
    const email = value.email.trim();

    if (value.sendPasswordToEmail) {
      if (!email) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Email is required when sending password to email",
        });
      } else if (!z.string().email().safeParse(email).success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Enter a valid email address",
        });
      }
      return;
    }

    if (email && !z.string().email().safeParse(email).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Enter a valid email address",
      });
    }

    validatePasswordFields(
      {
        password: value.password,
        repeatPassword: value.repeatPassword,
      },
      context
    );
  });

const updateUserSchema = z.object({
  userId: z.coerce.number().int().positive("User id is required"),
  username: z.string().trim().min(1, "Username is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .refine((value) => z.string().email().safeParse(value).success, {
      message: "Enter a valid email address",
    }),
  firstname: z
    .string()
    .trim()
    .min(1, "First name is required")
    .regex(
      namePattern,
      "First name cannot begin with a special character or number"
    ),
  lastname: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .regex(
      namePattern,
      "Last name cannot begin with a special character or number"
    ),
  passwordNeverExpires: z.boolean().default(false),
  officeId: z.coerce.number().int().positive("Office is required"),
  staffId: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "number" ? value : null)),
  roles: z
    .array(z.coerce.number().int().positive())
    .min(1, "At least one role must be selected"),
});

const deleteUserSchema = z.object({
  userId: z.coerce.number().int().positive("User id is required"),
});

const changePasswordSchema = z
  .object({
    userId: z.coerce.number().int().positive("User id is required"),
    firstname: z.string().trim().optional(),
    password: z.string().optional(),
    repeatPassword: z.string().optional(),
  })
  .superRefine((value, context) => {
    validatePasswordFields(
      {
        password: value.password,
        repeatPassword: value.repeatPassword,
      },
      context
    );
  });

function validatePasswordFields(
  value: { password?: string; repeatPassword?: string },
  context: z.RefinementCtx
) {
  const password = value.password?.trim() ?? "";
  const repeatPassword = value.repeatPassword?.trim() ?? "";

  if (!password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: "Password is required",
    });
  }

  if (!repeatPassword) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["repeatPassword"],
      message: "Repeat password is required",
    });
  }

  if (password && password.length < minimumPasswordLength) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: `Password must be at least ${minimumPasswordLength} characters long`,
    });
  }

  if (password && password.length > maximumPasswordLength) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: `Password must not exceed ${maximumPasswordLength} characters`,
    });
  }

  if (password && !passwordPattern.test(password)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    });
  }

  if (password && repeatPassword && password !== repeatPassword) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["repeatPassword"],
      message: "Passwords do not match",
    });
  }
}

function asObject(value: unknown): LooseObject {
  return typeof value === "object" && value !== null
    ? (value as LooseObject)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapRoleOption(role: unknown): UserRoleOption {
  const roleRecord = asObject(role);
  const roleId = asNumber(roleRecord.id) ?? 0;

  return {
    id: roleId,
    name:
      asString(roleRecord.name) ||
      asString(roleRecord.displayName) ||
      `Role ${roleId}`,
    description: asString(roleRecord.description),
    disabled: Boolean(roleRecord.disabled),
  };
}

function mapOfficeOption(office: unknown): OfficeOption {
  const officeRecord = asObject(office);
  const officeId = asNumber(officeRecord.id) ?? 0;

  return {
    id: officeId,
    name: asString(officeRecord.name) || `Office ${officeId}`,
  };
}

function mapStaffOption(staff: unknown): StaffOption {
  const staffRecord = asObject(staff);
  const displayName =
    asString(staffRecord.displayName) ||
    [asString(staffRecord.firstname), asString(staffRecord.lastname)]
      .filter(Boolean)
      .join(" ")
      .trim();
  const staffId = asNumber(staffRecord.id) ?? 0;

  return {
    id: staffId,
    displayName: displayName || `Staff ${staffId}`,
  };
}

function mapUserSummary(user: unknown): UserSummary {
  const userRecord = asObject(user);
  const firstname = asString(userRecord.firstname);
  const lastname = asString(userRecord.lastname);
  const displayName =
    [firstname, lastname].filter(Boolean).join(" ").trim() ||
    asString(userRecord.username) ||
    `User ${asNumber(userRecord.id) ?? 0}`;
  const officeRecord = asObject(userRecord.office);
  const selectedRoles = Array.isArray(userRecord.selectedRoles)
    ? userRecord.selectedRoles
    : [];

  return {
    id: asNumber(userRecord.id) ?? 0,
    username: asString(userRecord.username),
    firstname,
    lastname,
    displayName,
    email: asString(userRecord.email),
    officeId: asNumber(userRecord.officeId),
    officeName: asString(userRecord.officeName) || asString(officeRecord.name),
    roles: selectedRoles
      .map((role) => asString(asObject(role).name))
      .filter(Boolean),
  };
}

function mapUserDetail(user: unknown): UserDetail {
  const userRecord = asObject(user);
  const summary = mapUserSummary(userRecord);
  const staffSource =
    userRecord.staff ??
    (userRecord.staffId
      ? {
          id: userRecord.staffId,
          displayName: userRecord.staffName,
        }
      : null);
  const selectedRoles = Array.isArray(userRecord.selectedRoles)
    ? userRecord.selectedRoles
    : [];

  return {
    ...summary,
    passwordNeverExpires: Boolean(userRecord.passwordNeverExpires),
    isSelfServiceUser: Boolean(userRecord.isSelfServiceUser),
    selectedRoles: selectedRoles.map(mapRoleOption),
    staff: staffSource ? mapStaffOption(staffSource) : null,
  };
}

function toFieldErrorResult(
  error: z.ZodError,
  message = "Please correct the highlighted fields and try again"
): UserActionResult {
  return {
    success: false,
    error: message,
    fieldErrors: error.flatten().fieldErrors,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const candidate = asObject(error);
  const errorData = asObject(candidate.errorData);

  if (
    typeof errorData.defaultUserMessage === "string" &&
    errorData.defaultUserMessage
  ) {
    return errorData.defaultUserMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function ensurePermission(
  permission: SpecificPermission,
  message = "You do not have permission to perform this action"
) {
  const hasPermission = await hasPermissionServer(permission);
  if (!hasPermission) {
    throw new Error(message);
  }
}

async function ensureAnyPermission(
  permissions: SpecificPermission[],
  message = "You do not have permission to perform this action"
) {
  for (const permission of permissions) {
    if (await hasPermissionServer(permission)) {
      return;
    }
  }

  throw new Error(message);
}

function revalidateUserPaths(userId?: number) {
  revalidatePath("/organization/users");
  revalidatePath("/organization/users/create");

  if (userId) {
    revalidatePath(`/organization/users/${userId}`);
    revalidatePath(`/organization/users/${userId}/edit`);
  }
}

export async function listUsersAction(): Promise<UserSummary[]> {
  await ensurePermission(
    SpecificPermission.READ_USER,
    "You do not have permission to view users"
  );

  const users = await fetchFineractAPI("/users");
  const mappedUsers = Array.isArray(users) ? users.map(mapUserSummary) : [];

  return mappedUsers.sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );
}

export async function getUserAction(userId: number): Promise<UserDetail> {
  await ensurePermission(
    SpecificPermission.READ_USER,
    "You do not have permission to view users"
  );

  const user = await fetchFineractAPI(`/users/${userId}`);
  return mapUserDetail(user);
}

export async function getUsersTemplateAction(): Promise<UsersTemplate> {
  await ensureAnyPermission(
    [SpecificPermission.CREATE_USER, SpecificPermission.UPDATE_USER],
    "You do not have permission to manage users"
  );

  const template = await fetchFineractAPI("/users/template");

  return {
    allowedOffices: Array.isArray(template?.allowedOffices)
      ? template.allowedOffices.map(mapOfficeOption)
      : [],
    availableRoles: Array.isArray(template?.availableRoles)
      ? template.availableRoles.map(mapRoleOption)
      : [],
  };
}

export async function getStaffOptionsAction(
  officeId: number | string
): Promise<UserActionResult<{ staff: StaffOption[] }>> {
  try {
    await ensureAnyPermission(
      [SpecificPermission.CREATE_USER, SpecificPermission.UPDATE_USER],
      "You do not have permission to manage users"
    );

    const parsedOfficeId = z.coerce
      .number()
      .int()
      .positive("Office is required")
      .parse(officeId);

    const staff = await fetchFineractAPI(
      `/staff?officeId=${parsedOfficeId}&status=all`
    );

    return {
      success: true,
      data: {
        staff: Array.isArray(staff) ? staff.map(mapStaffOption) : [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to load staff options"),
    };
  }
}

export async function createUserAction(
  input: UserFormInput
): Promise<UserActionResult<{ userId: number }>> {
  try {
    await ensurePermission(
      SpecificPermission.CREATE_USER,
      "You do not have permission to create users"
    );

    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return toFieldErrorResult(parsed.error);
    }

    const email = parsed.data.email.trim();
    const payload: Record<string, unknown> = {
      username: parsed.data.username,
      firstname: parsed.data.firstname,
      lastname: parsed.data.lastname,
      sendPasswordToEmail: parsed.data.sendPasswordToEmail,
      passwordNeverExpires: parsed.data.passwordNeverExpires,
      officeId: parsed.data.officeId,
      roles: parsed.data.roles,
    };

    if (email) {
      payload.email = email;
    }

    if (parsed.data.staffId) {
      payload.staffId = parsed.data.staffId;
    }

    if (!parsed.data.sendPasswordToEmail) {
      payload.password = parsed.data.password?.trim();
      payload.repeatPassword = parsed.data.repeatPassword?.trim();
    }

    const response = await fetchFineractAPI("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const userId = Number(
      response?.resourceId ?? response?.subResourceId ?? response?.id
    );

    revalidateUserPaths(Number.isFinite(userId) ? userId : undefined);

    return {
      success: true,
      message: "User created successfully",
      data: {
        userId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to create user"),
    };
  }
}

export async function updateUserAction(
  input: UserFormInput
): Promise<UserActionResult<{ userId: number }>> {
  try {
    await ensurePermission(
      SpecificPermission.UPDATE_USER,
      "You do not have permission to update users"
    );

    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      return toFieldErrorResult(parsed.error);
    }

    const payload = {
      username: parsed.data.username,
      email: parsed.data.email,
      firstname: parsed.data.firstname,
      lastname: parsed.data.lastname,
      passwordNeverExpires: parsed.data.passwordNeverExpires,
      officeId: parsed.data.officeId,
      staffId: parsed.data.staffId,
      roles: parsed.data.roles,
    };

    await fetchFineractAPI(`/users/${parsed.data.userId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    revalidateUserPaths(parsed.data.userId);

    return {
      success: true,
      message: "User updated successfully",
      data: {
        userId: parsed.data.userId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to update user"),
    };
  }
}

export async function deleteUserAction(input: {
  userId: number | string;
}): Promise<UserActionResult> {
  try {
    await ensurePermission(
      SpecificPermission.DELETE_USER,
      "You do not have permission to delete users"
    );

    const parsed = deleteUserSchema.safeParse(input);
    if (!parsed.success) {
      return toFieldErrorResult(parsed.error, "User id is required");
    }

    await fetchFineractAPI(`/users/${parsed.data.userId}`, {
      method: "DELETE",
    });

    revalidateUserPaths(parsed.data.userId);

    return {
      success: true,
      message: "User deleted successfully",
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to delete user"),
    };
  }
}

export async function changeUserPasswordAction(
  input: UserPasswordChangeInput
): Promise<UserActionResult> {
  try {
    await ensurePermission(
      SpecificPermission.UPDATE_USER,
      "You do not have permission to change user passwords"
    );

    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return toFieldErrorResult(parsed.error);
    }

    const payload: Record<string, unknown> = {
      password: parsed.data.password?.trim(),
      repeatPassword: parsed.data.repeatPassword?.trim(),
    };

    if (parsed.data.firstname) {
      payload.firstname = parsed.data.firstname;
    }

    await fetchFineractAPI(`/users/${parsed.data.userId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    revalidateUserPaths(parsed.data.userId);

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to change user password"),
    };
  }
}
