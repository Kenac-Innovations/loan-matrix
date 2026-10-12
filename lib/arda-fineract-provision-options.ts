export type ArdaFineractProvisionOptions = {
  apply: boolean;
  fineractImage: string;
  namespace: string;
  registryDatabase: string;
  setupDatabase: string;
  targetDatabase: string;
};

export class ArdaFineractProvisionOptionsError extends Error {}

const DEFAULTS = {
  fineractImage: "ghcr.io/kenac-innovations/fineract-1.11.0:dev-e9d62dd",
  namespace: "fineract",
  registryDatabase: "fineract_tenants",
  setupDatabase: "fineract_tenants_arda_setup",
  targetDatabase: "fineract_tenant_arda",
} as const;

function readOption(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length).trim() || undefined;
}

function readDatabaseOption(
  args: string[],
  name: keyof Pick<
    ArdaFineractProvisionOptions,
    "registryDatabase" | "setupDatabase" | "targetDatabase"
  >,
): string {
  const value = readOption(args, name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)) || DEFAULTS[name];
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new ArdaFineractProvisionOptionsError(
      `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} must be a safe PostgreSQL database identifier`,
    );
  }
  return value;
}

export function parseArdaFineractProvisionOptions(
  args: string[],
): ArdaFineractProvisionOptions {
  const namespace = readOption(args, "namespace") || DEFAULTS.namespace;
  if (!/^[a-z0-9-]+$/.test(namespace)) {
    throw new ArdaFineractProvisionOptionsError(
      "--namespace must be a safe Kubernetes namespace name",
    );
  }

  return {
    apply: args.includes("--apply"),
    fineractImage: readOption(args, "fineract-image") || DEFAULTS.fineractImage,
    namespace,
    registryDatabase: readDatabaseOption(args, "registryDatabase"),
    setupDatabase: readDatabaseOption(args, "setupDatabase"),
    targetDatabase: readDatabaseOption(args, "targetDatabase"),
  };
}
