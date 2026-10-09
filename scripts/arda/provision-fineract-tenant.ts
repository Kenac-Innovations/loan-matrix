import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildArdaFineractProvisionPlan,
} from "@/lib/arda-fineract-provision-plan";
import {
  ArdaFineractProvisionOptionsError,
  parseArdaFineractProvisionOptions,
} from "@/lib/arda-fineract-provision-options";

const HELP = `Usage:
  pnpm exec tsx scripts/arda/provision-fineract-tenant.ts [--apply] [--out=artifacts/arda-fineract-provision-plan.json]

Without --apply this command only writes the reviewed provisioning plan. The plan creates a fresh ARDA Fineract tenant database and uses an isolated temporary registry for the matching Fineract Liquibase initialization job.`;

async function run() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  const options = parseArdaFineractProvisionOptions(args);
  const plan = buildArdaFineractProvisionPlan(options);
  const out = args.find((arg) => arg.startsWith("--out="))?.slice("--out=".length)
    || "artifacts/arda-fineract-provision-plan.json";

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(
    out,
    `${JSON.stringify({ applyRequested: options.apply, ...plan }, null, 2)}\n`,
    "utf8",
  );

  if (options.apply) {
    throw new ArdaFineractProvisionOptionsError(
      "--apply is intentionally blocked until the generated plan has been reviewed in this rollout. Use the approved production runner, not an unreviewed local command.",
    );
  }

  console.log(`ARDA Fineract provisioning plan written to ${out}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
