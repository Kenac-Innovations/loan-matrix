#!/usr/bin/env tsx
/**
 * Script to reverse CORRECTION journal entries for bank GL accounts
 * 
 * This script:
 * 1. Fetches all banks with GL accounts configured
 * 2. Finds CORRECTION/REVERSAL entries that should not exist
 * 3. Creates reversing entries (CREDIT to cancel the incorrect DEBIT)
 * 
 * Usage:
 *   npx tsx scripts/reverse-correction-entries.ts --dry-run              # Preview all banks
 *   npx tsx scripts/reverse-correction-entries.ts --bank="MONZE" --dry-run   # Preview specific bank
 *   npx tsx scripts/reverse-correction-entries.ts --bank="MONZE"             # Execute for specific bank
 *   npx tsx scripts/reverse-correction-entries.ts                            # Execute for all banks
 */

import { PrismaClient } from '../app/generated/prisma';

const prisma = new PrismaClient();

// Configuration
const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://41.174.125.165:4032";
const FINERACT_TENANT_ID = "goodfellow";
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

// Patterns to identify correction entries that need reversal
// Only CORRECTION-XXX entries, NOT REVERSAL-BANK-ALLOC (those were intentional reversals)
const CORRECTION_PATTERNS = [
  /^CORRECTION-\d+$/i,  // Only CORRECTION-102, CORRECTION-123, etc.
];

interface JournalEntry {
  id: number;
  glAccountId: number;
  glAccountCode: string;
  glAccountName: string;
  transactionId: string;
  transactionDate: number[];
  entryType: { value: string };
  amount: number;
  comments: string;
  referenceNumber: string;
  officeId: number;
  officeName: string;
  currency: { code: string };
  reversed: boolean;
}

interface Bank {
  id: string;
  name: string;
  code: string;
  glAccountId: number | null;
  glAccountName: string | null;
}

async function fetchFineractAPI(endpoint: string, options?: RequestInit) {
  const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Basic ${SERVICE_TOKEN}`,
      "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function isCorrectionEntry(entry: JournalEntry): boolean {
  if (!entry.referenceNumber) return false;
  return CORRECTION_PATTERNS.some(pattern => pattern.test(entry.referenceNumber));
}

async function getJournalEntriesForGL(glAccountId: number): Promise<JournalEntry[]> {
  const response = await fetchFineractAPI(
    `/journalentries?glAccountId=${glAccountId}&limit=1000&orderBy=id&sortOrder=DESC`
  );
  return response.pageItems || [];
}

async function findCorrectionEntries(glAccountId: number): Promise<JournalEntry[]> {
  const entries = await getJournalEntriesForGL(glAccountId);
  
  // Find DEBIT entries that are corrections (these need to be reversed with CREDIT)
  return entries.filter(entry => 
    entry.entryType?.value === "DEBIT" &&
    !entry.reversed &&
    isCorrectionEntry(entry)
  );
}

async function reverseJournalEntry(
  entry: JournalEntry,
  dryRun: boolean
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  
  if (dryRun) {
    console.log(`    [DRY RUN] Would reverse transaction ${entry.transactionId} via Fineract API`);
    return { success: true, transactionId: `DRY-RUN-${entry.transactionId}` };
  }
  
  try {
    // Use Fineract's built-in reversal API
    // POST /journalentries/{transactionId}?command=reverse
    const result = await fetchFineractAPI(
      `/journalentries/${entry.transactionId}?command=reverse`,
      {
        method: "POST",
        body: JSON.stringify({
          comments: `Reversal of correction entry (ID: ${entry.id}, Ref: ${entry.referenceNumber})`,
        }),
      }
    );
    
    return { 
      success: true, 
      transactionId: result.transactionId || result.resourceId || "reversed" 
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

async function processBank(bank: Bank, dryRun: boolean): Promise<{
  bankName: string;
  glAccountId: number;
  correctionEntries: number;
  reversed: number;
  failed: number;
  totalAmount: number;
}> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${bank.name} (${bank.code})`);
  console.log(`GL Account: ${bank.glAccountId} - ${bank.glAccountName}`);
  console.log(`${'='.repeat(60)}`);
  
  if (!bank.glAccountId) {
    console.log("  ⚠️ No GL account configured, skipping...");
    return {
      bankName: bank.name,
      glAccountId: 0,
      correctionEntries: 0,
      reversed: 0,
      failed: 0,
      totalAmount: 0,
    };
  }
  
  // Find correction entries
  const correctionEntries = await findCorrectionEntries(bank.glAccountId);
  
  if (correctionEntries.length === 0) {
    console.log("  ✅ No correction entries found");
    return {
      bankName: bank.name,
      glAccountId: bank.glAccountId,
      correctionEntries: 0,
      reversed: 0,
      failed: 0,
      totalAmount: 0,
    };
  }
  
  console.log(`\n  Found ${correctionEntries.length} correction entries to reverse:\n`);
  
  let reversed = 0;
  let failed = 0;
  let totalAmount = 0;
  
  for (const entry of correctionEntries) {
    const date = entry.transactionDate 
      ? `${entry.transactionDate[2]}/${entry.transactionDate[1]}/${entry.transactionDate[0]}` 
      : 'N/A';
    
    console.log(`  📋 Entry ID: ${entry.id}`);
    console.log(`     Ref: ${entry.referenceNumber}`);
    console.log(`     Amount: ${entry.amount.toLocaleString()} ${entry.currency?.code || 'ZMW'} (DEBIT)`);
    console.log(`     Date: ${date}`);
    console.log(`     Comment: "${entry.comments?.substring(0, 50) || 'none'}..."`);
    
    const result = await reverseJournalEntry(entry, dryRun);
    
    if (result.success) {
      console.log(`     ✅ ${dryRun ? '[DRY RUN] Would reverse' : 'Reversed'}: ${result.transactionId}`);
      reversed++;
      totalAmount += entry.amount;
    } else {
      console.log(`     ❌ FAILED: ${result.error}`);
      failed++;
    }
    console.log('');
  }
  
  return {
    bankName: bank.name,
    glAccountId: bank.glAccountId,
    correctionEntries: correctionEntries.length,
    reversed,
    failed,
    totalAmount,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  
  // Parse --bank argument
  const bankArg = args.find(arg => arg.startsWith("--bank="));
  const bankFilter = bankArg ? bankArg.split("=")[1].toUpperCase() : null;
  
  console.log("\n" + "═".repeat(60));
  console.log("  REVERSE CORRECTION ENTRIES SCRIPT");
  console.log("═".repeat(60));
  console.log(`  Mode: ${dryRun ? "DRY RUN (preview only)" : "EXECUTE"}`);
  console.log(`  Bank Filter: ${bankFilter || "ALL BANKS"}`);
  console.log(`  Fineract: ${FINERACT_BASE_URL}`);
  console.log(`  Tenant: ${FINERACT_TENANT_ID}`);
  console.log("═".repeat(60) + "\n");
  
  // Get banks from database
  let whereClause: any = { glAccountId: { not: null } };
  if (bankFilter) {
    whereClause = {
      ...whereClause,
      OR: [
        { code: { contains: bankFilter, mode: 'insensitive' } },
        { name: { contains: bankFilter, mode: 'insensitive' } },
      ],
    };
  }
  
  const banks = await prisma.bank.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      code: true,
      glAccountId: true,
      glAccountName: true,
    },
    orderBy: { name: 'asc' },
  });
  
  console.log(`Found ${banks.length} bank(s) with GL accounts configured\n`);
  
  if (banks.length === 0) {
    console.log("No banks found matching criteria. Exiting.");
    await prisma.$disconnect();
    return;
  }
  
  // Process each bank
  const results: any[] = [];
  
  for (const bank of banks) {
    const result = await processBank(bank as Bank, dryRun);
    results.push(result);
  }
  
  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("  SUMMARY");
  console.log("═".repeat(60));
  
  const totalEntries = results.reduce((sum, r) => sum + r.correctionEntries, 0);
  const totalReversed = results.reduce((sum, r) => sum + r.reversed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalAmount = results.reduce((sum, r) => sum + r.totalAmount, 0);
  
  console.log(`\n  Banks processed:      ${results.length}`);
  console.log(`  Correction entries:   ${totalEntries}`);
  console.log(`  ${dryRun ? 'Would reverse' : 'Reversed'}:        ${totalReversed}`);
  console.log(`  Failed:               ${totalFailed}`);
  console.log(`  Total amount:         ${totalAmount.toLocaleString()} ZMW`);
  
  if (results.some(r => r.correctionEntries > 0)) {
    console.log("\n  Per-bank breakdown:");
    for (const r of results.filter(r => r.correctionEntries > 0)) {
      console.log(`    ${r.bankName}: ${r.correctionEntries} entries, ${r.totalAmount.toLocaleString()} ZMW`);
    }
  }
  
  console.log("\n" + "═".repeat(60));
  
  if (dryRun) {
    console.log("\n  ⚠️  This was a DRY RUN. No changes were made.");
    console.log("  Remove --dry-run flag to execute the reversals.\n");
  } else {
    console.log("\n  ✅ Reversals completed.\n");
  }
  
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("\n❌ Fatal error:", error);
  await prisma.$disconnect();
  process.exit(1);
});
