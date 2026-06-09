"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchFineractAPI } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { hasPermissionServer } from "@/lib/authorization";
import {
  DEFAULT_AFRICAN_COUNTRY_CODE,
  getAfricanCountryDialCodeOrDefault,
  getNumericPhoneValidationError,
  isAfricanCountryDialCode,
} from "@/lib/phone-utils";
import { prisma } from "@/lib/prisma";
import {
  blockUserLogin,
  deleteUserLogin,
  getUserLoginByFineractUserId,
  requireCurrentTenant,
  unblockUserLogin,
  upsertUserLogin,
} from "@/lib/user-login-service";
import {
  collapseVisibleLeadOfficeSelection,
  expandVisibleLeadOfficeSelection,
  isHeadOfficeOffice,
} from "@/shared/user-management/lead-branch-visibility";
import { SpecificPermission } from "@/shared/types/auth";
import type {
  UserBlockHistoryInput,
  UserBlockHistoryPage,
  OfficeOption,
  StaffOption,
  UserActionResult,
  UserBlockAccountInput,
  UserDetail,
  UserLoginBlockEvent,
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
    phone: z.string().trim().optional().default(""),
    countryCode: z.string().trim().optional().default(DEFAULT_AFRICAN_COUNTRY_CODE),
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
    canOverrideInitiatorDisbursement: z.boolean().default(false),
    officeId: z.coerce.number().int().positive("Office is required"),
    staffId: z
      .union([z.coerce.number().int().positive(), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (typeof value === "number" ? value : undefined)),
    visibleLeadOfficeIds: z
      .array(z.coerce.number().int().positive())
      .default([]),
    roles: z
      .array(z.coerce.number().int().positive())
      .min(1, "At least one role must be selected"),
    password: z.string().optional(),
    repeatPassword: z.string().optional(),
  })
  .superRefine((value, context) => {
    const email = value.email.trim();
    const phone = value.phone.trim();
    const countryCode = value.countryCode.trim();

    const phoneError = getNumericPhoneValidationError(phone);

    if (phoneError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: phoneError,
      });
    }

    if (phone && !isAfricanCountryDialCode(countryCode)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countryCode"],
        message: "Select a valid African country code",
      });
    }

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

const updateUserSchema = z
  .object({
    userId: z.coerce.number().int().positive("User id is required"),
    username: z.string().trim().min(1, "Username is required"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .refine((value) => z.string().email().safeParse(value).success, {
        message: "Enter a valid email address",
      }),
    phone: z.string().trim().optional().default(""),
    countryCode: z.string().trim().optional().default(DEFAULT_AFRICAN_COUNTRY_CODE),
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
    canOverrideInitiatorDisbursement: z.boolean().default(false),
    officeId: z.coerce.number().int().positive("Office is required"),
    staffId: z
      .union([z.coerce.number().int().positive(), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (typeof value === "number" ? value : null)),
    visibleLeadOfficeIds: z
      .array(z.coerce.number().int().positive())
      .default([]),
    roles: z
      .array(z.coerce.number().int().positive())
      .min(1, "At least one role must be selected"),
  })
  .superRefine((value, context) => {
    const phoneError = getNumericPhoneValidationError(value.phone);

    if (phoneError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: phoneError,
      });
    }

    if (value.phone && !isAfricanCountryDialCode(value.countryCode)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countryCode"],
        message: "Select a valid African country code",
      });
    }
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

const blockAccountSchema = z.object({
  userId: z.coerce.number().int().positive("User id is required"),
  note: z.string().trim().min(1, "Note is required"),
});

const blockHistorySchema = z.object({
  userId: z.coerce.number().int().positive("User id is required"),
  page: z.coerce.number().int().positive().default(1),
});

const userBlockHistoryPageSize = 5;

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

function getTenantDefaultCountryCode(settings: unknown) {
  const settingsRecord = asObject(settings);
  const locale = asObject(settingsRecord.locale);
  return getAfricanCountryDialCodeOrDefault(asString(locale.countryCode));
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

function mapVisibleLeadOffice(
  officeId: number,
  officeName: string | null | undefined,
  officesById: Map<number, OfficeOption>
): OfficeOption {
  const mappedOffice = officesById.get(officeId);

  return {
    id: officeId,
    name: officeName || mappedOffice?.name || `Office ${officeId}`,
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
    phone: undefined,
    countryCode: undefined,
    isBlocked: false,
    blockedAt: null,
    officeId: asNumber(userRecord.officeId),
    officeName: asString(userRecord.officeName) || asString(officeRecord.name),
    roles: selectedRoles
      .map((role) => asString(asObject(role).name))
      .filter(Boolean),
  };
}

function mapUserLoginBlockEvent(event: {
  id: string;
  action: string;
  source: string;
  note: string;
  actorUserId: number | null;
  actorName: string | null;
  createdAt: Date;
}): UserLoginBlockEvent {
  return {
    id: event.id,
    action: event.action === "UNBLOCK" ? "UNBLOCK" : "BLOCK",
    source:
      event.source === "SYSTEM_MFA_MAX_ATTEMPTS"
        ? "SYSTEM_MFA_MAX_ATTEMPTS"
        : "MANUAL",
    note: event.note,
    actorUserId: event.actorUserId,
    actorName: event.actorName,
    createdAt: event.createdAt.toISOString(),
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
    canOverrideInitiatorDisbursement: false,
    visibleLeadOffices: [],
    blockedSource: null,
    blockedNote: null,
    blockedByActorName: null,
    selectedRoles: selectedRoles.map(mapRoleOption),
    staff: staffSource ? mapStaffOption(staffSource) : null,
    blockHistory: [],
  };
}

async function syncUserLeadBranchAccess(input: {
  tenantId: string;
  userLoginId: string;
  fineractUserId: number;
  visibleLeadOfficeIds: number[];
  allowedOffices: OfficeOption[];
}) {
  const expandedOfficeIds = expandVisibleLeadOfficeSelection(
    input.visibleLeadOfficeIds,
    input.allowedOffices
  );
  const uniqueOfficeIds = [...new Set(expandedOfficeIds)];
  const officesById = new Map(
    input.allowedOffices.map((office) => [office.id, office])
  );

  await prisma.userLeadBranchAccess.deleteMany({
    where: {
      tenantId: input.tenantId,
      userLoginId: input.userLoginId,
    },
  });

  if (uniqueOfficeIds.length === 0) {
    return;
  }

  await prisma.userLeadBranchAccess.createMany({
    data: uniqueOfficeIds.map((officeId) => ({
      tenantId: input.tenantId,
      userLoginId: input.userLoginId,
      fineractUserId: input.fineractUserId,
      officeId,
      officeName: officesById.get(officeId)?.name ?? null,
    })),
    skipDuplicates: true,
  });
}

function mapAllowedUserOffices(template: unknown) {
  const templateRecord = asObject(template);
  const allowedOffices = Array.isArray(templateRecord.allowedOffices)
    ? templateRecord.allowedOffices
    : [];
  const mappedOffices = allowedOffices.map(mapOfficeOption);
  const headOffice = mappedOffices.find((office) => isHeadOfficeOffice(office));

  if (!headOffice) {
    return mappedOffices;
  }

  return [
    headOffice,
    ...mappedOffices.filter((office) => office.id !== headOffice.id),
  ];
}

async function getAllowedUserOffices() {
  const template = await fetchFineractAPI("/users/template");
  return mapAllowedUserOffices(template);
}

function toFieldErrorResult<T = undefined>(
  error: z.ZodError,
  message = "Please correct the highlighted fields and try again"
): UserActionResult<T> {
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

  const tenant = await requireCurrentTenant();
  const [users, localLogins] = await Promise.all([
    fetchFineractAPI("/users"),
    prisma.userLogin.findMany({
      where: {
        tenantId: tenant.id,
      },
      select: {
        fineractUserId: true,
        email: true,
        phone: true,
        countryCode: true,
        isBlocked: true,
        blockedAt: true,
      },
    }),
  ]);
  const localLoginsByUserId = new Map(
    localLogins.map((login) => [login.fineractUserId, login])
  );
  const mappedUsers = Array.isArray(users) ? users.map(mapUserSummary) : [];

  return mappedUsers
    .map((user) => {
      const localLogin = localLoginsByUserId.get(user.id);

      return {
        ...user,
        email: localLogin?.email || user.email,
        phone: localLogin?.phone || undefined,
        countryCode: localLogin?.countryCode || undefined,
        isBlocked: localLogin?.isBlocked ?? false,
        blockedAt: localLogin?.blockedAt?.toISOString() ?? null,
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function getUserAction(userId: number): Promise<UserDetail> {
  await ensurePermission(
    SpecificPermission.READ_USER,
    "You do not have permission to view users"
  );

  const tenant = await requireCurrentTenant();
  const user = await fetchFineractAPI(`/users/${userId}`);
  const localLogin = await prisma.userLogin.findUnique({
    where: {
      tenantId_fineractUserId: {
        tenantId: tenant.id,
        fineractUserId: userId,
      },
    },
    select: {
      email: true,
      phone: true,
      countryCode: true,
      isBlocked: true,
      blockedAt: true,
      blockedSource: true,
      blockedNote: true,
      blockedByActorName: true,
      canOverrideInitiatorDisbursement: true,
      leadBranchAccesses: {
        orderBy: {
          officeId: "asc",
        },
        select: {
          officeId: true,
          officeName: true,
        },
      },
    },
  });
  const mappedUser = mapUserDetail(user);
  const allowedOffices = await getAllowedUserOffices();
  const officesById = new Map(allowedOffices.map((office) => [office.id, office]));
  const storedVisibleLeadOffices = localLogin?.leadBranchAccesses ?? [];
  const visibleLeadOfficeNamesById = new Map(
    storedVisibleLeadOffices.map((branch) => [branch.officeId, branch.officeName])
  );
  const collapsedVisibleLeadOfficeIds = collapseVisibleLeadOfficeSelection(
    storedVisibleLeadOffices.map((branch) => branch.officeId),
    allowedOffices
  );

  return {
    ...mappedUser,
    email: localLogin?.email || mappedUser.email,
    phone: localLogin?.phone || undefined,
    countryCode: localLogin?.countryCode || undefined,
    canOverrideInitiatorDisbursement:
      localLogin?.canOverrideInitiatorDisbursement ?? false,
    visibleLeadOffices: collapsedVisibleLeadOfficeIds.map((officeId) =>
      mapVisibleLeadOffice(
        officeId,
        visibleLeadOfficeNamesById.get(officeId),
        officesById
      )
    ),
    isBlocked: localLogin?.isBlocked ?? false,
    blockedAt: localLogin?.blockedAt?.toISOString() ?? null,
    blockedSource:
      localLogin?.blockedSource === "SYSTEM_MFA_MAX_ATTEMPTS"
        ? "SYSTEM_MFA_MAX_ATTEMPTS"
        : localLogin?.blockedSource === "MANUAL"
          ? "MANUAL"
          : null,
    blockedNote: localLogin?.blockedNote ?? null,
    blockedByActorName: localLogin?.blockedByActorName ?? null,
    blockHistory: [],
  };
}

export async function getUserBlockHistoryAction(
  input: UserBlockHistoryInput
): Promise<UserBlockHistoryPage> {
  await ensurePermission(
    SpecificPermission.READ_USER,
    "You do not have permission to view users"
  );

  const parsed = blockHistorySchema.parse(input);
  const tenant = await requireCurrentTenant();
  const skip = (parsed.page - 1) * userBlockHistoryPageSize;
  const [items, total] = await prisma.$transaction([
    prisma.userLoginBlockEvent.findMany({
      where: {
        tenantId: tenant.id,
        fineractUserId: parsed.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: userBlockHistoryPageSize,
      select: {
        id: true,
        action: true,
        source: true,
        note: true,
        actorUserId: true,
        actorName: true,
        createdAt: true,
      },
    }),
    prisma.userLoginBlockEvent.count({
      where: {
        tenantId: tenant.id,
        fineractUserId: parsed.userId,
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / userBlockHistoryPageSize));

  return {
    items: items.map(mapUserLoginBlockEvent),
    page: Math.min(parsed.page, totalPages),
    pageSize: userBlockHistoryPageSize,
    total,
    totalPages,
  };
}

export async function getUsersTemplateAction(): Promise<UsersTemplate> {
  await ensureAnyPermission(
    [SpecificPermission.CREATE_USER, SpecificPermission.UPDATE_USER],
    "You do not have permission to manage users"
  );

  const [template, tenant] = await Promise.all([
    fetchFineractAPI("/users/template"),
    requireCurrentTenant(),
  ]);

  return {
    allowedOffices: mapAllowedUserOffices(template),
    availableRoles: Array.isArray(template?.availableRoles)
      ? template.availableRoles.map(mapRoleOption)
      : [],
    defaultCountryCode: getTenantDefaultCountryCode(tenant.settings),
    restrictLeadVisibilityToBranches:
      tenant.restrictLeadVisibilityToBranches ?? false,
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
    const phone = parsed.data.phone.trim();
    const countryCode = phone
      ? getAfricanCountryDialCodeOrDefault(parsed.data.countryCode)
      : undefined;
    const tenant = await requireCurrentTenant();
    const allowedOffices = tenant.restrictLeadVisibilityToBranches
      ? await getAllowedUserOffices()
      : [];
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

    if (Number.isFinite(userId)) {
      const userLogin = await upsertUserLogin({
        tenantId: tenant.id,
        fineractUserId: userId,
        username: parsed.data.username,
        email,
        phone,
        countryCode,
        canOverrideInitiatorDisbursement:
          parsed.data.canOverrideInitiatorDisbursement,
      });

      if (tenant.restrictLeadVisibilityToBranches) {
        await syncUserLeadBranchAccess({
          tenantId: tenant.id,
          userLoginId: userLogin.id,
          fineractUserId: userId,
          visibleLeadOfficeIds: parsed.data.visibleLeadOfficeIds,
          allowedOffices,
        });
      }
    }

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

    const tenant = await requireCurrentTenant();
    const allowedOffices = tenant.restrictLeadVisibilityToBranches
      ? await getAllowedUserOffices()
      : [];
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

    const userLogin = await upsertUserLogin({
      tenantId: tenant.id,
      fineractUserId: parsed.data.userId,
      username: parsed.data.username,
      email: parsed.data.email,
      phone: parsed.data.phone,
      countryCode: parsed.data.phone
        ? getAfricanCountryDialCodeOrDefault(parsed.data.countryCode)
        : null,
      canOverrideInitiatorDisbursement:
        parsed.data.canOverrideInitiatorDisbursement,
    });

    if (tenant.restrictLeadVisibilityToBranches) {
      await syncUserLeadBranchAccess({
        tenantId: tenant.id,
        userLoginId: userLogin.id,
        fineractUserId: parsed.data.userId,
        visibleLeadOfficeIds: parsed.data.visibleLeadOfficeIds,
        allowedOffices,
      });
    }

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

    const tenant = await requireCurrentTenant();
    await fetchFineractAPI(`/users/${parsed.data.userId}`, {
      method: "DELETE",
    });

    await deleteUserLogin(tenant.id, parsed.data.userId);
    await prisma.mfaChallenge.deleteMany({
      where: {
        tenantId: tenant.id,
        fineractUserId: parsed.data.userId,
      },
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

async function getUserBlockActionContext(userId: number) {
  const [tenant, session, user] = await Promise.all([
    requireCurrentTenant(),
    getSession(),
    fetchFineractAPI(`/users/${userId}`),
  ]);

  if (!session?.user?.userId || !session.user.name) {
    throw new Error("Your session could not be validated. Please sign in again.");
  }

  const mappedUser = mapUserDetail(user);
  const existingLogin = await getUserLoginByFineractUserId(tenant.id, userId);

  return {
    tenant,
    actorUserId: session.user.userId,
    actorName: session.user.name,
    mappedUser,
    existingLogin,
  };
}

export async function blockUserAccountAction(
  input: UserBlockAccountInput
): Promise<UserActionResult> {
  try {
    await ensurePermission(
      SpecificPermission.UPDATE_USER,
      "You do not have permission to block user accounts"
    );

    const parsed = blockAccountSchema.safeParse(input);
    if (!parsed.success) {
      return toFieldErrorResult(parsed.error, "A note is required to block this account");
    }

    const context = await getUserBlockActionContext(parsed.data.userId);

    if (context.existingLogin?.isBlocked) {
      return {
        success: false,
        error: `${context.mappedUser.displayName} is already blocked`,
      };
    }

    await blockUserLogin({
      tenantId: context.tenant.id,
      fineractUserId: parsed.data.userId,
      username: context.mappedUser.username,
      email: context.existingLogin?.email || context.mappedUser.email,
      phone: context.existingLogin?.phone,
      countryCode: context.existingLogin?.countryCode,
      note: parsed.data.note,
      source: "MANUAL",
      actorUserId: context.actorUserId,
      actorName: context.actorName,
    });

    revalidateUserPaths(parsed.data.userId);

    return {
      success: true,
      message: `${context.mappedUser.displayName} has been blocked`,
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to block user account"),
    };
  }
}

export async function unblockUserAccountAction(
  input: UserBlockAccountInput
): Promise<UserActionResult> {
  try {
    await ensurePermission(
      SpecificPermission.UPDATE_USER,
      "You do not have permission to unblock user accounts"
    );

    const parsed = blockAccountSchema.safeParse(input);
    if (!parsed.success) {
      return toFieldErrorResult(
        parsed.error,
        "A note is required to unblock this account"
      );
    }

    const context = await getUserBlockActionContext(parsed.data.userId);

    if (!context.existingLogin?.isBlocked) {
      return {
        success: false,
        error: `${context.mappedUser.displayName} is already active`,
      };
    }

    await unblockUserLogin({
      tenantId: context.tenant.id,
      fineractUserId: parsed.data.userId,
      username: context.mappedUser.username,
      email: context.existingLogin.email,
      phone: context.existingLogin.phone,
      countryCode: context.existingLogin.countryCode,
      note: parsed.data.note,
      source: "MANUAL",
      actorUserId: context.actorUserId,
      actorName: context.actorName,
    });

    revalidateUserPaths(parsed.data.userId);

    return {
      success: true,
      message: `${context.mappedUser.displayName} has been unblocked`,
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to unblock user account"),
    };
  }
}
