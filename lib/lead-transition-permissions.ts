type NullableId = string | number | null | undefined;

function normalizeId(value: NullableId) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

export interface LeadMovePermissionInput {
  currentUserId: NullableId;
  assignedToUserId: NullableId;
  isUserInCurrentStageTeam: boolean;
  canManageLead: boolean;
}

export function canMoveAssignedLead(input: LeadMovePermissionInput) {
  const currentUserId = normalizeId(input.currentUserId);
  const assignedToUserId = normalizeId(input.assignedToUserId);

  return Boolean(
    currentUserId &&
      assignedToUserId &&
      currentUserId === assignedToUserId &&
      input.isUserInCurrentStageTeam &&
      input.canManageLead
  );
}

export function getLeadMovePermissionDenial(
  input: LeadMovePermissionInput
) {
  const currentUserId = normalizeId(input.currentUserId);
  const assignedToUserId = normalizeId(input.assignedToUserId);

  if (!currentUserId) {
    return "You must be signed in to move this lead.";
  }

  if (!input.canManageLead) {
    return "You do not have branch access to move this lead.";
  }

  if (!assignedToUserId) {
    return "This lead must be assigned before it can be moved.";
  }

  if (currentUserId !== assignedToUserId) {
    return "Only the currently assigned user can move this lead.";
  }

  if (!input.isUserInCurrentStageTeam) {
    return "You are not a member of the team responsible for this lead's current stage.";
  }

  return null;
}
