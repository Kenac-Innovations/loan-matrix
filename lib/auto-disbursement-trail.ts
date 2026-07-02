export type AutoDisbursementTrailStageLike = {
  stageId?: string | null;
  stageName?: string | null;
  fineractAction?: string | null;
};

export type AutoDisbursementTrailLike = {
  status?: string | null;
  triggerStageId?: string | null;
  triggerStageName?: string | null;
  cdeDecision?: string | null;
  attemptedStages?: AutoDisbursementTrailStageLike[] | null;
  lastCompletedStageId?: string | null;
  lastCompletedStageName?: string | null;
  stopReason?: string | null;
  completedAt?: string | null;
  lastAttemptedAt?: string | null;
};

export type AutoDisbursementTrailStage = {
  key: string;
  label: string;
};

export type AutoDisbursementTrail = {
  statusLabel: string | null;
  statusVariant: "default" | "secondary" | "outline" | "destructive";
  stages: AutoDisbursementTrailStage[];
};

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toTrailStage(
  stageId: unknown,
  stageName: unknown
): AutoDisbursementTrailStage | null {
  const label = normalizeLabel(stageName) || normalizeLabel(stageId);
  const key = normalizeLabel(stageId) || label;

  if (!label || !key) {
    return null;
  }

  return { key, label };
}

function normalizeStatusLabel(status: unknown): AutoDisbursementTrail["statusLabel"] {
  const normalized = normalizeLabel(status)?.toLowerCase();

  switch (normalized) {
    case "running":
      return "In Progress";
    case "completed":
      return "Completed";
    case "stopped":
      return "Stopped";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return normalizeLabel(status);
  }
}

function normalizeStatusVariant(
  status: unknown
): AutoDisbursementTrail["statusVariant"] {
  switch (normalizeLabel(status)?.toLowerCase()) {
    case "completed":
      return "default";
    case "running":
      return "secondary";
    case "stopped":
    case "failed":
      return "destructive";
    case "skipped":
      return "outline";
    default:
      return "outline";
  }
}

export function buildAutoDisbursementTrail(
  autoDisbursement: AutoDisbursementTrailLike | null | undefined
): AutoDisbursementTrail {
  if (!autoDisbursement) {
    return {
      statusLabel: null,
      statusVariant: "outline",
      stages: [],
    };
  }

  const stages: AutoDisbursementTrailStage[] = [];
  const seen = new Set<string>();
  const appendStage = (candidate: AutoDisbursementTrailStage | null) => {
    if (!candidate || seen.has(candidate.key)) {
      return;
    }

    seen.add(candidate.key);
    stages.push(candidate);
  };

  appendStage(
    toTrailStage(
      autoDisbursement.triggerStageId,
      autoDisbursement.triggerStageName
    )
  );

  for (const stage of autoDisbursement.attemptedStages ?? []) {
    appendStage(toTrailStage(stage?.stageId, stage?.stageName));
  }

  if (
    stages.length === 0 &&
    (autoDisbursement.lastCompletedStageId ||
      autoDisbursement.lastCompletedStageName)
  ) {
    appendStage(
      toTrailStage(
        autoDisbursement.lastCompletedStageId,
        autoDisbursement.lastCompletedStageName
      )
    );
  }

  return {
    statusLabel: normalizeStatusLabel(autoDisbursement.status),
    statusVariant: normalizeStatusVariant(autoDisbursement.status),
    stages,
  };
}
