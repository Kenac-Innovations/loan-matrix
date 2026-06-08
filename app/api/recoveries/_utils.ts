import { getSession } from "@/lib/auth";

export async function getActorName(fallback = "System"): Promise<string> {
  try {
    const session = await getSession();
    const user = session?.user as
      | {
          name?: string | null;
          email?: string | null;
          username?: string | null;
        }
      | undefined;

    return user?.name || user?.username || user?.email || fallback;
  } catch {
    return fallback;
  }
}

export function parseLoanId(value: string): number | null {
  const loanId = Number(value);
  return Number.isFinite(loanId) && loanId > 0 ? loanId : null;
}

export function normalizeRecoveryBucket(value: string | null): "30" | "60" | "90" | "npa" | "all" {
  if (value === "30" || value === "60" || value === "90" || value === "npa" || value === "all") {
    return value;
  }
  return "30";
}
