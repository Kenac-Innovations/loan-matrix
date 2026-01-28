/**
 * Script to reverse incorrect bank allocation journal entries
 * 
 * Problem: Previous allocations credited bank GL accounts instead of debiting them.
 * For asset accounts: DEBIT increases balance, CREDIT decreases balance.
 * 
 * This script:
 * 1. Finds all journal entries that credited bank GL accounts (1208-xxx through 1213-xxx)
 * 2. Creates reversing entries to correct the balance
 * 
 * Usage:
 *   npx tsx scripts/reverse-incorrect-allocations.ts --dry-run    # Preview only
 *   npx tsx scripts/reverse-incorrect-allocations.ts              # Execute reversals
 */

// Configuration - hardcoded for this script
const FINERACT_BASE_URL = "http://10.10.0.143:8443";
const FINERACT_TENANT_ID = "goodfellow";
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

// Bank GL account code prefixes (asset accounts that were incorrectly credited)
const BANK_GL_PREFIXES = ["1208", "1209", "1210", "1211", "1212", "1213"];

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

interface GLAccount {
  id: number;
  glCode: string;
  name: string;
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

function formatDateForFineract(dateArray: number[]): string {
  const [year, month, day] = dateArray;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${day.toString().padStart(2, "0")} ${monthNames[month - 1]} ${year}`;
}

async function findIncorrectAllocations(): Promise<JournalEntry[]> {
  console.log("Fetching journal entries from Fineract...");
  
  const incorrectEntries: JournalEntry[] = [];
  
  // Fetch GL accounts to identify bank accounts
  const glAccounts: GLAccount[] = await fetchFineractAPI("/glaccounts");
  const bankGlAccountIds = new Set<number>();
  
  glAccounts.forEach(acc => {
    if (BANK_GL_PREFIXES.some(prefix => acc.glCode.startsWith(prefix))) {
      bankGlAccountIds.add(acc.id);
    }
  });
  
  console.log(`Found ${bankGlAccountIds.size} bank GL accounts`);
  
  // Fetch journal entries for each bank GL account
  for (const glAccountId of bankGlAccountIds) {
    try {
      const response = await fetchFineractAPI(
        `/journalentries?glAccountId=${glAccountId}&limit=100&orderBy=id&sortOrder=DESC`
      );
      
      const entries: JournalEntry[] = response.pageItems || [];
      
      // Find CREDIT entries to bank accounts (these are incorrect for fund allocations)
      const incorrectCredits = entries.filter(entry => 
        entry.entryType?.value === "CREDIT" &&
        !entry.reversed &&
        (entry.comments?.toLowerCase().includes("fund allocation") ||
         entry.comments?.toLowerCase().includes("allocation to"))
      );
      
      incorrectEntries.push(...incorrectCredits);
    } catch (error) {
      console.error(`Error fetching entries for GL ${glAccountId}:`, error);
    }
  }
  
  return incorrectEntries;
}

async function findMatchingDebitEntry(transactionId: string, bankGlAccountId: number): Promise<JournalEntry | null> {
  // Find the corresponding debit entry for this transaction
  // The debit would have been made to the source account
  try {
    const response = await fetchFineractAPI(
      `/journalentries?transactionId=${transactionId}&limit=10`
    );
    
    const entries: JournalEntry[] = response.pageItems || [];
    
    // Find the DEBIT entry that's NOT the bank account
    const debitEntry = entries.find(entry => 
      entry.entryType?.value === "DEBIT" &&
      entry.glAccountId !== bankGlAccountId
    );
    
    return debitEntry || null;
  } catch (error) {
    console.error(`Error finding matching debit for transaction ${transactionId}:`, error);
    return null;
  }
}

async function createReversingEntry(
  originalEntry: JournalEntry,
  sourceGlAccountId: number,
  dryRun: boolean
): Promise<string | null> {
  const today = new Date();
  const txnDate = formatDateForFineract([
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  ]);
  
  // Reversing entry: DEBIT the bank (to correct the wrong credit), CREDIT the source
  const reversalPayload = {
    officeId: originalEntry.officeId,
    currencyCode: originalEntry.currency?.code || "ZMK",
    debits: [
      {
        glAccountId: originalEntry.glAccountId, // DEBIT bank (correct direction)
        amount: originalEntry.amount * 2, // Double the amount: one to reverse, one to add correctly
      },
    ],
    credits: [
      {
        glAccountId: sourceGlAccountId, // CREDIT source
        amount: originalEntry.amount * 2,
      },
    ],
    referenceNumber: `REVERSAL-${originalEntry.referenceNumber || originalEntry.transactionId}`,
    transactionDate: txnDate,
    comments: `Correction for incorrect allocation (original: ${originalEntry.id}). Reversing wrong credit and applying correct debit.`,
    locale: "en",
    dateFormat: "dd MMMM yyyy",
  };
  
  if (dryRun) {
    console.log(`  [DRY RUN] Would create reversal: Debit ${originalEntry.glAccountCode} ${originalEntry.amount * 2}, Credit source ${sourceGlAccountId}`);
    return `DRY-RUN-${Date.now()}`;
  }
  
  try {
    const result = await fetchFineractAPI("/journalentries", {
      method: "POST",
      body: JSON.stringify(reversalPayload),
    });
    
    return result.transactionId || result.resourceId || "success";
  } catch (error) {
    console.error(`  ERROR creating reversal:`, error);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  
  console.log("============================================================");
  console.log("Reverse Incorrect Bank Allocations Script");
  console.log("============================================================");
  console.log(`Dry Run: ${dryRun}`);
  console.log("============================================================\n");
  
  // Find all incorrect allocations
  const incorrectEntries = await findIncorrectAllocations();
  
  console.log(`\nFound ${incorrectEntries.length} incorrect allocation entries to reverse\n`);
  
  if (incorrectEntries.length === 0) {
    console.log("No incorrect entries found. Nothing to do.");
    return;
  }
  
  // Preview entries
  console.log("Entries to reverse:");
  incorrectEntries.forEach((entry, i) => {
    console.log(`  ${i + 1}. ${entry.glAccountCode} - ${entry.glAccountName}`);
    console.log(`     Amount: ${entry.amount} (CREDIT - incorrect)`);
    console.log(`     Date: ${entry.transactionDate?.join("-")}`);
    console.log(`     Comment: ${entry.comments || "none"}`);
    console.log(`     Transaction ID: ${entry.transactionId}`);
    console.log("");
  });
  
  // Process reversals
  let successCount = 0;
  let failCount = 0;
  
  console.log("\nProcessing reversals...\n");
  
  for (const entry of incorrectEntries) {
    console.log(`Processing: ${entry.glAccountCode} - ${entry.amount}`);
    
    // Find the matching debit entry (source account)
    const sourceEntry = await findMatchingDebitEntry(entry.transactionId, entry.glAccountId);
    
    if (!sourceEntry) {
      console.log(`  SKIP: Could not find source account for transaction ${entry.transactionId}`);
      failCount++;
      continue;
    }
    
    console.log(`  Source account: ${sourceEntry.glAccountCode} - ${sourceEntry.glAccountName}`);
    
    // Create reversing entry
    const result = await createReversingEntry(entry, sourceEntry.glAccountId, dryRun);
    
    if (result) {
      console.log(`  ${dryRun ? "[DRY RUN]" : "SUCCESS"}: Created reversal ${result}`);
      successCount++;
    } else {
      console.log(`  FAILED: Could not create reversal`);
      failCount++;
    }
    
    console.log("");
  }
  
  console.log("============================================================");
  console.log("SUMMARY");
  console.log("============================================================");
  console.log(`Total entries found: ${incorrectEntries.length}`);
  console.log(`Successful reversals: ${successCount}`);
  console.log(`Failed/Skipped: ${failCount}`);
  console.log("============================================================");
  
  if (dryRun) {
    console.log("\nThis was a dry run. No changes were made.");
    console.log("Remove --dry-run flag to execute the reversals.");
  }
}

main().catch(error => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
