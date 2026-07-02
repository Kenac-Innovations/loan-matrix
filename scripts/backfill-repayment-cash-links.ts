/**
 * Backfill missing teller/cashier linkage for cash repayment rows in Loan Matrix.
 *
 * Why this exists:
 * Older cash repayments were posted successfully to Fineract, but Loan Matrix
 * saved RepaymentCashLink rows with isCash=true and null teller/cashier IDs.
 * This script repairs those rows by matching the Fineract transaction creator
 * to a cashier in the same office on the transaction date, then mapping that
 * Fineract cashier back to the local Loan Matrix cashier/teller records.
 *
 * Usage:
 *   FINERACT_DB_PASSWORD='...' npx tsx scripts/backfill-repayment-cash-links.ts --tenant=goodfellow
 *   FINERACT_DB_PASSWORD='...' npx tsx scripts/backfill-repayment-cash-links.ts --tenant=goodfellow --apply
 *   FINERACT_DB_PASSWORD='...' npx tsx scripts/backfill-repayment-cash-links.ts --tenant=goodfellow --tx=1209912
 *   FINERACT_DB_PASSWORD='...' npx tsx scripts/backfill-repayment-cash-links.ts --tenant=goodfellow --limit=100 --apply
 *
 * Required env:
 *   DATABASE_URL           -> Loan Matrix DB
 *   FINERACT_DB_PASSWORD   -> password for the target Fineract tenant DB
 *
 * PgBouncer note:
 *   If your Loan Matrix DB URL goes through PgBouncer (for example port 6432),
 *   prefer:
 *   ?schema=public&pgbouncer=true&connection_limit=1
 *   to avoid prepared-statement errors during longer repair runs.
 *
 * Optional env:
 *   FINERACT_DB_HOST       -> defaults to 10.10.198.40
 *   FINERACT_DB_PORT       -> defaults to 6432
 *   FINERACT_DB_USER       -> defaults to app
 *   FINERACT_DB_NAME       -> defaults to fineract_tenant_<tenantSlug>
 */

import { execFileSync } from "child_process";
import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

type CliOptions = {
  tenantSlug: string;
  apply: boolean;
  limit?: number;
  txIds?: number[];
};

type FineractTransactionInfo = {
  fineract_transaction_id: number;
  loan_id: number;
  office_id: number;
  office_name: string | null;
  transaction_date: string;
  created_on_utc: string | null;
  created_by: number;
  username: string | null;
  user_display_name: string | null;
};

type FineractCashierCandidate = {
  fineract_cashier_id: number;
  fineract_teller_id: number;
  office_id: number;
  teller_name: string | null;
  cashier_display_name: string | null;
  start_date: string | null;
  end_date: string | null;
};

type Resolution = {
  repaymentCashLinkId: string;
  fineractTransactionId: number;
  fineractLoanId: number;
  amount: number;
  resolution: "updated" | "dry-run" | "skipped";
  reason: string;
  username?: string | null;
  officeName?: string | null;
  matchedFineractCashierId?: number;
  matchedFineractTellerId?: number;
  matchedLocalCashierId?: string;
  matchedLocalTellerId?: string;
  matchedCashierName?: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const tenantArg = argv.find((arg) => arg.startsWith("--tenant="));
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const txArg = argv.find((arg) => arg.startsWith("--tx="));
  const apply = argv.includes("--apply");

  const tenantSlug = tenantArg?.split("=")[1]?.trim();
  if (!tenantSlug) {
    console.error("Missing required argument: --tenant=<tenant-slug>");
    process.exit(1);
  }

  const limitValue = limitArg?.split("=")[1];
  const limit =
    limitValue && !Number.isNaN(Number(limitValue))
      ? Number(limitValue)
      : undefined;

  const txIds = txArg
    ? txArg
        .split("=")[1]
        ?.split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0)
    : undefined;

  return {
    tenantSlug,
    apply,
    limit,
    txIds: txIds && txIds.length > 0 ? txIds : undefined,
  };
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function tokenizeName(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

function isSubsetMatch(source: string[], candidate: string[]): boolean {
  if (source.length === 0 || candidate.length === 0) return false;
  return source.every((token) => candidate.includes(token));
}

function buildFineractDbConfig(tenantSlug: string) {
  const host = process.env.FINERACT_DB_HOST || "10.10.198.40";
  const port = process.env.FINERACT_DB_PORT || "6432";
  const user = process.env.FINERACT_DB_USER || "app";
  const password = process.env.FINERACT_DB_PASSWORD;
  const database =
    process.env.FINERACT_DB_NAME || `fineract_tenant_${tenantSlug}`;

  if (!password) {
    console.error("Missing required env: FINERACT_DB_PASSWORD");
    process.exit(1);
  }

  return { host, port, user, password, database };
}

function runPsqlJson<T>(
  config: ReturnType<typeof buildFineractDbConfig>,
  database: string,
  sql: string
): T[] {
  const args = [
    "-h",
    config.host,
    "-p",
    config.port,
    "-U",
    config.user,
    "-d",
    database,
    "-X",
    "-A",
    "-t",
    "-c",
    sql,
  ];

  const output = execFileSync("psql", args, {
    env: {
      ...process.env,
      PGPASSWORD: config.password,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  if (!output) return [];
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function getTransactionInfo(
  config: ReturnType<typeof buildFineractDbConfig>,
  fineractDatabase: string,
  fineractTransactionId: number
): FineractTransactionInfo | null {
  const sql = `
    select row_to_json(x)
    from (
      select
        t.id as fineract_transaction_id,
        t.loan_id,
        t.office_id,
        o.name as office_name,
        t.transaction_date::text as transaction_date,
        t.created_on_utc::text as created_on_utc,
        t.created_by,
        u.username,
        s.display_name as user_display_name
      from m_loan_transaction t
      left join m_appuser u on u.id = t.created_by
      left join m_staff s on s.id = u.staff_id
      left join m_office o on o.id = t.office_id
      where t.id = ${fineractTransactionId}
      limit 1
    ) x;
  `;

  const rows = runPsqlJson<FineractTransactionInfo>(config, fineractDatabase, sql);
  return rows[0] ?? null;
}

function getCashierCandidates(
  config: ReturnType<typeof buildFineractDbConfig>,
  fineractDatabase: string,
  officeId: number,
  transactionDate: string
): FineractCashierCandidate[] {
  const sql = `
    select row_to_json(x)
    from (
      select
        c.id as fineract_cashier_id,
        c.teller_id as fineract_teller_id,
        t.office_id,
        t.name as teller_name,
        s.display_name as cashier_display_name,
        c.start_date::text as start_date,
        c.end_date::text as end_date
      from m_cashiers c
      join m_tellers t on t.id = c.teller_id
      left join m_staff s on s.id = c.staff_id
      where t.office_id = ${officeId}
        and c.start_date <= ${sqlLiteral(transactionDate)}::date
        and (
          c.end_date is null
          or c.end_date >= ${sqlLiteral(transactionDate)}::date
        )
      order by c.start_date desc nulls last, c.id desc
    ) x;
  `;

  return runPsqlJson<FineractCashierCandidate>(config, fineractDatabase, sql);
}

function chooseCandidate(
  transaction: FineractTransactionInfo,
  candidates: FineractCashierCandidate[]
): FineractCashierCandidate | null {
  if (candidates.length === 0) return null;

  const sourceNames = [
    transaction.username,
    transaction.user_display_name,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const exactMatches = candidates.filter((candidate) => {
    const candidateKey = normalizeName(candidate.cashier_display_name);
    return sourceNames.some((name) => normalizeName(name) === candidateKey);
  });

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const subsetMatches = candidates.filter((candidate) => {
    const candidateTokens = tokenizeName(candidate.cashier_display_name);
    return sourceNames.some((name) =>
      isSubsetMatch(tokenizeName(name), candidateTokens)
    );
  });

  if (subsetMatches.length === 1) {
    return subsetMatches[0];
  }

  return null;
}

function formatResolution(resolution: Resolution): string {
  return [
    `${resolution.resolution.toUpperCase()}: txn ${resolution.fineractTransactionId}`,
    `loan ${resolution.fineractLoanId}`,
    `amount ${resolution.amount}`,
    resolution.username ? `user ${resolution.username}` : null,
    resolution.officeName ? `office ${resolution.officeName}` : null,
    resolution.matchedCashierName
      ? `cashier ${resolution.matchedCashierName}`
      : null,
    resolution.reason,
  ]
    .filter(Boolean)
    .join(" | ");
}

const options = parseArgs(process.argv.slice(2));

async function main() {
  const fineractConfig = buildFineractDbConfig(options.tenantSlug);

  console.log("Backfilling repayment cash links");
  console.log(`Tenant slug: ${options.tenantSlug}`);
  console.log(`Fineract DB: ${fineractConfig.database}`);
  console.log(`Mode: ${options.apply ? "APPLY" : "DRY RUN"}`);
  if (options.limit) console.log(`Limit: ${options.limit}`);
  if (options.txIds?.length) {
    console.log(`Transaction filter: ${options.txIds.join(", ")}`);
  }
  console.log("");

  const tenant = await prisma.tenant.findUnique({
    where: { slug: options.tenantSlug },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    throw new Error(`Tenant not found for slug "${options.tenantSlug}"`);
  }

  const orphanLinks = await prisma.repaymentCashLink.findMany({
    where: {
      tenantId: tenant.id,
      isCash: true,
      OR: [
        { tellerId: null },
        { cashierId: null },
        { tellerId: "" },
        { cashierId: "" },
      ],
      ...(options.txIds?.length
        ? { fineractTransactionId: { in: options.txIds } }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { fineractTransactionId: "asc" }],
    take: options.limit,
  });

  console.log(`Found ${orphanLinks.length} broken cash repayment link(s).\n`);

  const resolutions: Resolution[] = [];

  for (const link of orphanLinks) {
    const transaction = getTransactionInfo(
      fineractConfig,
      fineractConfig.database,
      link.fineractTransactionId
    );

    if (!transaction) {
      resolutions.push({
        repaymentCashLinkId: link.id,
        fineractTransactionId: link.fineractTransactionId,
        fineractLoanId: link.loanId,
        amount: link.amount,
        resolution: "skipped",
        reason: "Fineract transaction not found",
      });
      continue;
    }

    const candidates = getCashierCandidates(
      fineractConfig,
      fineractConfig.database,
      transaction.office_id,
      transaction.transaction_date
    );

    const matchedCandidate = chooseCandidate(transaction, candidates);
    if (!matchedCandidate) {
      resolutions.push({
        repaymentCashLinkId: link.id,
        fineractTransactionId: link.fineractTransactionId,
        fineractLoanId: link.loanId,
        amount: link.amount,
        resolution: "skipped",
        reason: `No unique cashier match found for user "${transaction.username ?? "unknown"}" in office ${transaction.office_name ?? transaction.office_id}`,
        username: transaction.username,
        officeName: transaction.office_name,
      });
      continue;
    }

    const localTeller = await prisma.teller.findFirst({
      where: {
        tenantId: tenant.id,
        fineractTellerId: matchedCandidate.fineract_teller_id,
      },
      select: {
        id: true,
        name: true,
        officeId: true,
        officeName: true,
      },
    });

    if (!localTeller) {
      resolutions.push({
        repaymentCashLinkId: link.id,
        fineractTransactionId: link.fineractTransactionId,
        fineractLoanId: link.loanId,
        amount: link.amount,
        resolution: "skipped",
        reason: `Loan Matrix teller not found for Fineract teller ${matchedCandidate.fineract_teller_id}`,
        username: transaction.username,
        officeName: transaction.office_name,
        matchedFineractCashierId: matchedCandidate.fineract_cashier_id,
        matchedFineractTellerId: matchedCandidate.fineract_teller_id,
      });
      continue;
    }

    const localCashier = await prisma.cashier.findFirst({
      where: {
        tenantId: tenant.id,
        fineractCashierId: matchedCandidate.fineract_cashier_id,
      },
      select: {
        id: true,
        tellerId: true,
        staffName: true,
      },
    });

    if (!localCashier) {
      resolutions.push({
        repaymentCashLinkId: link.id,
        fineractTransactionId: link.fineractTransactionId,
        fineractLoanId: link.loanId,
        amount: link.amount,
        resolution: "skipped",
        reason: `Loan Matrix cashier not found for Fineract cashier ${matchedCandidate.fineract_cashier_id}`,
        username: transaction.username,
        officeName: transaction.office_name,
        matchedFineractCashierId: matchedCandidate.fineract_cashier_id,
        matchedFineractTellerId: matchedCandidate.fineract_teller_id,
      });
      continue;
    }

    if (localCashier.tellerId !== localTeller.id) {
      resolutions.push({
        repaymentCashLinkId: link.id,
        fineractTransactionId: link.fineractTransactionId,
        fineractLoanId: link.loanId,
        amount: link.amount,
        resolution: "skipped",
        reason: `Local cashier ${localCashier.id} belongs to teller ${localCashier.tellerId}, not ${localTeller.id}`,
        username: transaction.username,
        officeName: transaction.office_name,
        matchedFineractCashierId: matchedCandidate.fineract_cashier_id,
        matchedFineractTellerId: matchedCandidate.fineract_teller_id,
        matchedLocalCashierId: localCashier.id,
        matchedLocalTellerId: localTeller.id,
        matchedCashierName: localCashier.staffName,
      });
      continue;
    }

    if (options.apply) {
      await prisma.repaymentCashLink.update({
        where: { id: link.id },
        data: {
          tellerId: localTeller.id,
          cashierId: localCashier.id,
        },
      });
    }

    resolutions.push({
      repaymentCashLinkId: link.id,
      fineractTransactionId: link.fineractTransactionId,
      fineractLoanId: link.loanId,
      amount: link.amount,
      resolution: options.apply ? "updated" : "dry-run",
      reason: options.apply
        ? "Repayment cash link repaired"
        : "Would repair repayment cash link",
      username: transaction.username,
      officeName: transaction.office_name,
      matchedFineractCashierId: matchedCandidate.fineract_cashier_id,
      matchedFineractTellerId: matchedCandidate.fineract_teller_id,
      matchedLocalCashierId: localCashier.id,
      matchedLocalTellerId: localTeller.id,
      matchedCashierName: localCashier.staffName,
    });
  }

  for (const resolution of resolutions) {
    console.log(formatResolution(resolution));
  }

  const summary = resolutions.reduce(
    (acc, resolution) => {
      acc[resolution.resolution] += 1;
      return acc;
    },
    { updated: 0, "dry-run": 0, skipped: 0 } as Record<
      Resolution["resolution"],
      number
    >
  );

  console.log("\nSummary");
  console.log(`Updated: ${summary.updated}`);
  console.log(`Dry-run matches: ${summary["dry-run"]}`);
  console.log(`Skipped: ${summary.skipped}`);
}

main()
  .catch((error) => {
    console.error("\nBackfill failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
