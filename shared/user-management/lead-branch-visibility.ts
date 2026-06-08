import type { OfficeOption } from "@/shared/types/user-management";

const HEAD_OFFICE_NAME_TOKENS = ["head office", "headquarter", "headquarters"];

function normalizeOfficeName(name: string | null | undefined) {
  return (name || "").trim().toLowerCase();
}

export function isHeadOfficeOffice(
  office: Pick<OfficeOption, "name"> | null | undefined
) {
  const normalizedName = normalizeOfficeName(office?.name);
  return HEAD_OFFICE_NAME_TOKENS.some((token) =>
    normalizedName.includes(token)
  );
}

export function getHeadOfficeOption(offices: OfficeOption[]) {
  return offices.find((office) => isHeadOfficeOffice(office)) ?? null;
}

export function normalizeVisibleLeadOfficeSelection(
  selectedOfficeIds: number[],
  offices: OfficeOption[]
) {
  const validOfficeIds = new Set(offices.map((office) => office.id));
  const normalizedSelection = [...new Set(selectedOfficeIds)].filter((officeId) =>
    validOfficeIds.has(officeId)
  );
  const headOffice = getHeadOfficeOption(offices);

  if (!headOffice) {
    return normalizedSelection;
  }

  if (normalizedSelection.includes(headOffice.id)) {
    return [headOffice.id];
  }

  const nonHeadOfficeIds = offices
    .filter((office) => office.id !== headOffice.id)
    .map((office) => office.id);

  if (
    nonHeadOfficeIds.length > 0 &&
    nonHeadOfficeIds.every((officeId) => normalizedSelection.includes(officeId))
  ) {
    return [headOffice.id];
  }

  return normalizedSelection.filter((officeId) => officeId !== headOffice.id);
}

export function collapseVisibleLeadOfficeSelection(
  selectedOfficeIds: number[],
  offices: OfficeOption[]
) {
  const headOffice = getHeadOfficeOption(offices);

  if (!headOffice) {
    return normalizeVisibleLeadOfficeSelection(selectedOfficeIds, offices);
  }

  const uniqueSelection = [...new Set(selectedOfficeIds)];
  const allOfficeIds = offices.map((office) => office.id);

  if (
    allOfficeIds.length > 0 &&
    allOfficeIds.every((officeId) => uniqueSelection.includes(officeId))
  ) {
    return [headOffice.id];
  }

  return normalizeVisibleLeadOfficeSelection(uniqueSelection, offices);
}

export function expandVisibleLeadOfficeSelection(
  selectedOfficeIds: number[],
  offices: OfficeOption[]
) {
  const collapsedSelection = collapseVisibleLeadOfficeSelection(
    selectedOfficeIds,
    offices
  );
  const headOffice = getHeadOfficeOption(offices);

  if (!headOffice || !collapsedSelection.includes(headOffice.id)) {
    return collapsedSelection;
  }

  return offices.map((office) => office.id);
}
