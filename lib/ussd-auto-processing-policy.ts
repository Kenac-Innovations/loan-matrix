export type UssdAutoProcessingStatus =
  | "completed"
  | "manual_review"
  | "stopped"
  | "failed";

export function shouldAutoProgressFromCde(
  decision: string | null | undefined
): boolean {
  return decision?.trim().toUpperCase() === "APPROVED";
}

export function classifyUssdAutoProcessingOutcome(input: {
  cdeDecision?: string | null;
  autoProgressMessage?: string | null;
}): UssdAutoProcessingStatus {
  const decision = input.cdeDecision?.trim().toUpperCase() ?? null;
  const message = input.autoProgressMessage?.trim().toLowerCase() ?? "";

  if (!decision) {
    return "failed";
  }

  if (decision === "MANUAL_REVIEW") {
    return "manual_review";
  }

  if (decision !== "APPROVED") {
    return "stopped";
  }

  if (
    message.includes("completed") ||
    message.includes("already_completed") ||
    message.includes("already_disbursed")
  ) {
    return "completed";
  }

  return "stopped";
}

export async function runWithBoundedRetries<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    maxAttempts: number;
    shouldRetry: (error: unknown) => boolean;
  }
): Promise<T> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= maxAttempts || !options.shouldRetry(error)) {
        throw error;
      }
    }
  }

  throw new Error("USSD automatic processing retry loop exhausted");
}
