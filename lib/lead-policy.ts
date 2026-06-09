import { Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { isHeadOfficeOffice } from "@/shared/user-management/lead-branch-visibility";

export interface LeadPolicyFlags {
  restrictLeadVisibilityToBranches: boolean;
  onlyOriginatorCanDisburse: boolean;
  autoAssignLeadOnApproval: boolean;
}

export interface LeadViewerAccessContext {
  flags: LeadPolicyFlags;
  visibleOfficeIds: number[] | null;
  canOverrideInitiatorDisbursement: boolean;
}

const DEFAULT_FLAGS: LeadPolicyFlags = {
  restrictLeadVisibilityToBranches: false,
  onlyOriginatorCanDisburse: false,
  autoAssignLeadOnApproval: false,
};

function normalizeMatchToken(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export async function getTenantLeadPolicyFlags(
  tenantId: string
): Promise<LeadPolicyFlags> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      restrictLeadVisibilityToBranches: true,
      onlyOriginatorCanDisburse: true,
      autoAssignLeadOnApproval: true,
    },
  });

  if (!tenant) {
    return DEFAULT_FLAGS;
  }

  return {
    restrictLeadVisibilityToBranches:
      tenant.restrictLeadVisibilityToBranches ?? false,
    onlyOriginatorCanDisburse: tenant.onlyOriginatorCanDisburse ?? false,
    autoAssignLeadOnApproval: tenant.autoAssignLeadOnApproval ?? false,
  };
}

export async function getLeadViewerAccessContext(
  tenantId: string,
  fineractUserId?: number | null
): Promise<LeadViewerAccessContext> {
  const flags = await getTenantLeadPolicyFlags(tenantId);

  if (!flags.restrictLeadVisibilityToBranches || !fineractUserId) {
    const userLogin = fineractUserId
      ? await prisma.userLogin.findUnique({
          where: {
            tenantId_fineractUserId: {
              tenantId,
              fineractUserId,
            },
          },
          select: {
            canOverrideInitiatorDisbursement: true,
          },
        })
      : null;

    return {
      flags,
      visibleOfficeIds: null,
      canOverrideInitiatorDisbursement:
        userLogin?.canOverrideInitiatorDisbursement ?? false,
    };
  }

  const userLogin = await prisma.userLogin.findUnique({
    where: {
      tenantId_fineractUserId: {
        tenantId,
        fineractUserId,
      },
    },
    select: {
      canOverrideInitiatorDisbursement: true,
      leadBranchAccesses: {
        select: {
          officeId: true,
          officeName: true,
        },
      },
    },
  });
  const hasHeadOfficeAccess =
    userLogin?.leadBranchAccesses.some((branch) =>
      isHeadOfficeOffice({ name: branch.officeName || "" })
    ) ?? false;

  return {
    flags,
    visibleOfficeIds: hasHeadOfficeAccess
      ? null
      : userLogin?.leadBranchAccesses.map((branch) => branch.officeId) ?? [],
    canOverrideInitiatorDisbursement:
      userLogin?.canOverrideInitiatorDisbursement ?? false,
  };
}

export function applyLeadVisibilityScope(
  where: Prisma.LeadWhereInput,
  visibleOfficeIds: number[] | null
): Prisma.LeadWhereInput {
  if (visibleOfficeIds === null) {
    return where;
  }

  return {
    AND: [
      where,
      {
        officeId: {
          in: visibleOfficeIds,
        },
      },
    ],
  };
}

export function canUserAccessLeadOffice(
  leadOfficeId: number | null | undefined,
  visibleOfficeIds: number[] | null
) {
  if (visibleOfficeIds === null) {
    return true;
  }

  if (leadOfficeId == null) {
    return false;
  }

  return visibleOfficeIds.includes(leadOfficeId);
}

export function isApprovalActionStage(
  stage:
    | {
        name?: string | null;
        fineractAction?: string | null;
        fineractStatus?: string | null;
      }
    | null
    | undefined
) {
  if (!stage) {
    return false;
  }

  const fineractAction = normalizeMatchToken(stage.fineractAction);
  const fineractStatus = normalizeMatchToken(stage.fineractStatus);
  const stageName = normalizeMatchToken(stage.name);

  return (
    fineractAction === "approve" ||
    fineractStatus.includes("approved") ||
    stageName.includes("approv")
  );
}

export function isDisbursementActionStage(
  stage:
    | {
        name?: string | null;
        fineractAction?: string | null;
        fineractStatus?: string | null;
      }
    | null
    | undefined
) {
  if (!stage) {
    return false;
  }

  const fineractAction = normalizeMatchToken(stage.fineractAction);
  const fineractStatus = normalizeMatchToken(stage.fineractStatus);
  const stageName = normalizeMatchToken(stage.name);

  return (
    fineractAction === "disburse" ||
    fineractStatus.includes("disburs") ||
    stageName.includes("disburs")
  );
}

export function getDisbursementBlockReason(input: {
  onlyOriginatorCanDisburse: boolean;
  designatedDisburserUserId?: number | null;
  designatedDisburserUserName?: string | null;
  currentFineractUserId?: number | null;
}) {
  if (!input.onlyOriginatorCanDisburse) {
    return null;
  }

  if (!input.designatedDisburserUserId) {
    return "This loan cannot be disbursed until a designated disburser is set.";
  }

  if (
    !input.currentFineractUserId ||
    Number(input.currentFineractUserId) !== Number(input.designatedDisburserUserId)
  ) {
    return input.designatedDisburserUserName
      ? `${input.designatedDisburserUserName} is the designated disburser for this loan.`
      : "Only the designated disburser can disburse this loan.";
  }

  return null;
}

export function getOriginatorAssignmentData(lead: {
  userId: string;
  createdByUserName?: string | null;
}) {
  const originatorUserId = Number.parseInt(lead.userId, 10);

  if (!Number.isFinite(originatorUserId)) {
    return null;
  }

  return {
    assignedToUserId: originatorUserId,
    assignedToUserName: lead.createdByUserName || null,
    assignedAt: new Date(),
    assignedByUserId: "system:auto-approval-assignment",
  };
}

export function getOriginatorDesignatedDisburserData(input: {
  originatorUserId: string;
  originatorUserName?: string | null;
  assignedByFineractUserId?: number | string | null;
}) {
  const designatedDisburserUserId = Number.parseInt(input.originatorUserId, 10);

  if (!Number.isFinite(designatedDisburserUserId)) {
    return null;
  }

  return {
    designatedDisburserUserId,
    designatedDisburserUserName: input.originatorUserName || null,
    designatedDisburserAssignedByUserId:
      input.assignedByFineractUserId != null
        ? String(input.assignedByFineractUserId)
        : String(designatedDisburserUserId),
    designatedDisburserAssignedAt: new Date(),
  };
}
