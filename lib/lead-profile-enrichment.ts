import { fetchFineractAPI } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type EmploymentProfile = {
  employerName?: string;
  employmentStatus?: string;
  occupation?: string;
  industry?: string;
};

type PriorLeadProfile = {
  annualIncome?: number | null;
  employmentStatus?: string | null;
  employerName?: string | null;
  grossMonthlyIncome?: number | null;
  monthlyIncome?: number | null;
  monthlyIncomeRange?: string | null;
  stateMetadata?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function isMissingString(value: unknown): boolean {
  return !cleanString(value);
}

function normalizeColumnName(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function resolveCodeLookupValue(header: any, rawValue: unknown): string | undefined {
  if (rawValue == null) {
    return undefined;
  }

  if (
    header?.columnDisplayType === "CODELOOKUP" &&
    Array.isArray(header?.columnValues)
  ) {
    const match = header.columnValues.find(
      (columnValue: any) =>
        columnValue?.id === rawValue || columnValue?.id === Number(rawValue)
    );

    return (
      cleanString(match?.value) ??
      cleanString(match?.name) ??
      cleanString(rawValue)
    );
  }

  return cleanString(rawValue);
}

function readDatatableValue(
  headers: any[],
  row: unknown[],
  predicate: (name: string) => boolean
): string | undefined {
  const index = headers.findIndex((header: any) =>
    predicate(normalizeColumnName(header?.columnName))
  );

  if (index < 0) {
    return undefined;
  }

  return resolveCodeLookupValue(headers[index], row[index]);
}

async function fetchEmploymentProfileFromClientDatatables(
  fineractClientId: number
): Promise<EmploymentProfile> {
  const profile: EmploymentProfile = {};

  try {
    const datatables = await fetchFineractAPI("/datatables?apptable=m_client", {
      authMode: "service",
    });
    const tableList = Array.isArray(datatables) ? datatables : [];

    for (const datatable of tableList) {
      const tableName = cleanString((datatable as any)?.registeredTableName);
      if (!tableName) {
        continue;
      }

      try {
        const data = await fetchFineractAPI(
          `/datatables/${encodeURIComponent(
            tableName
          )}/${fineractClientId}?genericResultSet=true`,
          { authMode: "service" }
        );

        const headers = Array.isArray((data as any)?.columnHeaders)
          ? (data as any).columnHeaders
          : [];
        const rows = Array.isArray((data as any)?.data) ? (data as any).data : [];

        for (const rowObject of rows) {
          const row = Array.isArray((rowObject as any)?.row)
            ? (rowObject as any).row
            : [];

          if (!profile.occupation) {
            profile.occupation = readDatatableValue(headers, row, (name) =>
              name.includes("occupation") ||
              name.includes("job_title") ||
              name === "job" ||
              name.includes("profession") ||
              name.includes("trade")
            );
          }

          if (!profile.employerName) {
            profile.employerName = readDatatableValue(headers, row, (name) =>
              name.includes("employer") ||
              name.includes("company_name") ||
              name === "company" ||
              name.includes("work_place")
            );
          }

          if (!profile.employmentStatus) {
            profile.employmentStatus = readDatatableValue(headers, row, (name) =>
              (name.includes("employment") && !name.includes("employer")) ||
              name.includes("work_status") ||
              name.includes("employer_type")
            );
          }

          if (!profile.industry) {
            profile.industry = readDatatableValue(headers, row, (name) =>
              name.includes("industry") ||
              name.includes("sector") ||
              name.includes("business_sector")
            );
          }

          if (
            profile.occupation &&
            profile.employerName &&
            profile.employmentStatus &&
            profile.industry
          ) {
            return profile;
          }
        }
      } catch (error) {
        console.warn(`Failed to inspect client datatable "${tableName}":`, error);
      }
    }
  } catch (error) {
    console.warn("Failed to fetch client datatables for lead enrichment:", error);
  }

  return profile;
}

async function findPriorLeadProfile(lead: any): Promise<PriorLeadProfile | null> {
  const stateMetadata = asRecord(lead.stateMetadata);
  const userNationalId =
    cleanString(stateMetadata.userNationalId) ?? cleanString(lead.externalId);

  const identityFilters: Record<string, unknown>[] = [];

  if (typeof lead.fineractClientId === "number" && Number.isFinite(lead.fineractClientId)) {
    identityFilters.push({ fineractClientId: lead.fineractClientId });
  }

  if (cleanString(lead.externalId)) {
    identityFilters.push({ externalId: lead.externalId });
  }

  if (userNationalId) {
    identityFilters.push({
      stateMetadata: {
        path: ["userNationalId"],
        equals: userNationalId,
      },
    });
  }

  if (identityFilters.length === 0) {
    return null;
  }

  return prisma.lead.findFirst({
    where: {
      tenantId: lead.tenantId,
      id: { not: lead.id },
      AND: [
        { OR: identityFilters },
        {
          OR: [
            { monthlyIncome: { gt: 0 } },
            { grossMonthlyIncome: { gt: 0 } },
          ],
        },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      annualIncome: true,
      employmentStatus: true,
      employerName: true,
      grossMonthlyIncome: true,
      monthlyIncome: true,
      monthlyIncomeRange: true,
      stateMetadata: true,
    },
  });
}

export function deriveLeadProfileUpdates(
  lead: any,
  fallbacks: {
    employmentProfile?: EmploymentProfile | null;
    priorLead?: PriorLeadProfile | null;
  }
): { mergedLead: any; updateData: Record<string, unknown> } {
  const currentMetadata = asRecord(lead.stateMetadata);
  const priorMetadata = asRecord(fallbacks.priorLead?.stateMetadata);
  const metadataPatch: Record<string, unknown> = {};
  const updateData: Record<string, unknown> = {};

  const employmentStatusFallback =
    cleanString(fallbacks.employmentProfile?.employmentStatus) ??
    cleanString(fallbacks.priorLead?.employmentStatus);
  const employerNameFallback =
    cleanString(fallbacks.employmentProfile?.employerName) ??
    cleanString(fallbacks.priorLead?.employerName);
  const occupationFallback =
    cleanString(fallbacks.employmentProfile?.occupation) ??
    cleanString(priorMetadata.occupation);
  const industryFallback =
    cleanString(fallbacks.employmentProfile?.industry) ??
    cleanString(priorMetadata.industry);
  const monthlyIncomeFallback = positiveNumber(fallbacks.priorLead?.monthlyIncome);
  const grossMonthlyIncomeFallback = positiveNumber(
    fallbacks.priorLead?.grossMonthlyIncome
  );
  const annualIncomeFallback =
    positiveNumber(fallbacks.priorLead?.annualIncome) ??
    (monthlyIncomeFallback ? monthlyIncomeFallback * 12 : undefined);
  const monthlyIncomeRangeFallback = cleanString(
    fallbacks.priorLead?.monthlyIncomeRange
  );

  if (isMissingString(lead.employmentStatus) && employmentStatusFallback) {
    updateData.employmentStatus = employmentStatusFallback;
  }

  if (isMissingString(lead.employerName) && employerNameFallback) {
    updateData.employerName = employerNameFallback;
  }

  if (!positiveNumber(lead.monthlyIncome) && monthlyIncomeFallback) {
    updateData.monthlyIncome = monthlyIncomeFallback;
  }

  if (!positiveNumber(lead.grossMonthlyIncome) && grossMonthlyIncomeFallback) {
    updateData.grossMonthlyIncome = grossMonthlyIncomeFallback;
  }

  if (isMissingString(lead.monthlyIncomeRange) && monthlyIncomeRangeFallback) {
    updateData.monthlyIncomeRange = monthlyIncomeRangeFallback;
  }

  if (!positiveNumber(lead.annualIncome) && annualIncomeFallback) {
    updateData.annualIncome = annualIncomeFallback;
  }

  if (isMissingString(currentMetadata.occupation) && occupationFallback) {
    metadataPatch.occupation = occupationFallback;
  }

  if (isMissingString(currentMetadata.industry) && industryFallback) {
    metadataPatch.industry = industryFallback;
  }

  if (Object.keys(metadataPatch).length > 0) {
    updateData.stateMetadata = {
      ...currentMetadata,
      ...metadataPatch,
    };
  }

  return {
    mergedLead: {
      ...lead,
      ...updateData,
      stateMetadata: (updateData.stateMetadata as Record<string, unknown>) ??
        currentMetadata,
    },
    updateData,
  };
}

export async function enrichLeadBorrowerProfile(lead: any): Promise<any> {
  const currentMetadata = asRecord(lead.stateMetadata);
  const needsEmploymentProfile =
    isMissingString(lead.employmentStatus) ||
    isMissingString(lead.employerName) ||
    isMissingString(currentMetadata.occupation) ||
    isMissingString(currentMetadata.industry);
  const needsIncomeFallback =
    !positiveNumber(lead.monthlyIncome) ||
    !positiveNumber(lead.grossMonthlyIncome) ||
    !positiveNumber(lead.annualIncome) ||
    isMissingString(lead.monthlyIncomeRange);

  if (!needsEmploymentProfile && !needsIncomeFallback) {
    return lead;
  }

  const [employmentProfile, priorLead] = await Promise.all([
    needsEmploymentProfile && typeof lead.fineractClientId === "number"
      ? fetchEmploymentProfileFromClientDatatables(lead.fineractClientId)
      : Promise.resolve(null),
    needsIncomeFallback ? findPriorLeadProfile(lead) : Promise.resolve(null),
  ]);

  const { mergedLead, updateData } = deriveLeadProfileUpdates(lead, {
    employmentProfile,
    priorLead,
  });

  if (Object.keys(updateData).length === 0) {
    return lead;
  }

  console.log("Applying lead profile enrichment:", {
    leadId: lead.id,
    updatedFields: Object.keys(updateData),
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: updateData,
  });

  return mergedLead;
}
