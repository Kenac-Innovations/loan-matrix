export type ArdaSourceAuditOptions = {
  sourceLoanMatrixUrl: string;
  sourceFineractBaseUrl: string;
  sourceFineractTenant: "omama";
  out: string;
};

export class ArdaSourceAuditOptionsError extends Error {}

function readOption(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length).trim() || undefined;
}

function requireOption(args: string[], name: string): string {
  const value = readOption(args, name);
  if (!value) {
    throw new ArdaSourceAuditOptionsError(`--${name}=... is required`);
  }
  return value;
}

export function parseArdaSourceAuditOptions(
  args: string[],
): ArdaSourceAuditOptions {
  const sourceFineractTenant = (
    readOption(args, "source-fineract-tenant") || "omama"
  ).toLowerCase();

  if (sourceFineractTenant !== "omama") {
    throw new ArdaSourceAuditOptionsError(
      "The ARDA source audit can only read from the Omama source tenant.",
    );
  }

  return {
    sourceLoanMatrixUrl: requireOption(args, "source-loan-matrix-url"),
    sourceFineractBaseUrl: requireOption(args, "source-fineract-base-url"),
    sourceFineractTenant: "omama",
    out: requireOption(args, "out"),
  };
}
