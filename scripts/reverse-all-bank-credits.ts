/**
 * Script to reverse ALL credit entries to bank GL accounts
 * (including those without "Fund allocation" comments)
 * 
 * Usage:
 *   npx tsx scripts/reverse-all-bank-credits.ts --dry-run
 *   npx tsx scripts/reverse-all-bank-credits.ts
 */

const FINERACT_BASE_URL = "http://10.10.0.143:8443";
const FINERACT_TENANT_ID = "goodfellow";
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

// Bank GL account code prefixes
const BANK_GL_PREFIXES = ["1208", "1209", "1210", "1211", "1212", "1213"];

// Skip entries that are already corrections
const SKIP_COMMENTS = ["correction", "reversal", "opening balance"];

interface JournalEntry {
  id: number;
  glAccountId: number;
  glAccountCode: string;
  glAccountName: string;
  transactionId: string;
  transactionDate: number[];
  entryType: { value: string };
  amount: number;
  comments: string | null;
  referenceNumber: string;
  officeId: number;
  currency: { code: string };
  reversed: boolean;
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

async function findUncorrectedCredits(): Promise<JournalEntry[]> {
  console.log("Fetching GL accounts...");
  
  const glAccounts = await fetchFineractAPI("/glaccounts");
  const bankGlAccounts = glAccounts.filter((acc: any) => 
    BANK_GL_PREFIXES.some(prefix => acc.glCode.startsWith(prefix))
  );
  
  console.log(`Found ${bankGlAccounts.length} bank GL accounts`);
  
  const uncorrectedEntries: JournalEntry[] = [];
  
  for (const glAccount of bankGlAccounts) {
    try {
      const response = await fetchFineractAPI(
        `/journalentries?glAccountId=${glAccount.id}&limit=100&orderBy=id&sortOrder=ASC`
      );
      
      const entries: JournalEntry[] = response.pageItems || [];
      
      // Find CREDIT entries that haven't been corrected
      const credits = entries.filter(entry => {
        if (entry.entryType?.value !== "CREDIT") return false;
        if (entry.reversed) return false;
        
        // Skip if it's already a correction/reversal
        const comment = (entry.comments || "").toLowerCase();
        if (SKIP_COMMENTS.some(skip => comment.includes(skip))) return false;
        
        return true;
      });
      
      // For each credit, check if there's a corresponding correction (double debit)
      for (const credit of credits) {
        const hasCorrection = entries.some(entry => 
          entry.entryType?.value === "DEBIT" &&
          entry.amount === credit.amount * 2 &&
          entry.comments?.includes(`original: ${credit.id}`)
        );
        
        if (!hasCorrection) {
          uncorrectedEntries.push({
            ...credit,
            glAccountCode: glAccount.glCode,
            glAccountName: glAccount.name,
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching entries for GL ${glAccount.glCode}:`, error);
    }
  }
  
  return uncorrectedEntries;
}

async function findSourceAccount(transactionId: string, bankGlAccountId: number): Promise<number | null> {
  try {
    const response = await fetchFineractAPI(
      `/journalentries?transactionId=${transactionId}&limit=10`
    );
    
    const entries: JournalEntry[] = response.pageItems || [];
    const debitEntry = entries.find(entry => 
      entry.entryType?.value === "DEBIT" &&
      entry.glAccountId !== bankGlAccountId
    );
    
    return debitEntry?.glAccountId || null;
  } catch (error) {
    console.error(`Error finding source for ${transactionId}:`, error);
    return null;
  }
}

async function createCorrection(
  entry: JournalEntry,
  sourceGlAccountId: number,
  dryRun: boolean
): Promise<boolean> {
  const today = new Date();
  const txnDate = formatDateForFineract([
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  ]);
  
  const payload = {
    officeId: entry.officeId,
    currencyCode: entry.currency?.code || "ZMK",
    debits: [
      {
        glAccountId: entry.glAccountId,
        amount: entry.amount * 2,
      },
    ],
    credits: [
      {
        glAccountId: sourceGlAccountId,
        amount: entry.amount * 2,
      },
    ],
    referenceNumber: `CORRECTION-${entry.id}`,
    transactionDate: txnDate,
    comments: `Correction for incorrect allocation (original: ${entry.id}). Reversing wrong credit and applying correct debit.`,
    locale: "en",
    dateFormat: "dd MMMM yyyy",
  };
  
  if (dryRun) {
    console.log(`  [DRY RUN] Would create: Debit ${entry.glAccountCode} ${entry.amount * 2}, Credit source ${sourceGlAccountId}`);
    return true;
  }
  
  try {
    await fetchFineractAPI("/journalentries", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return true;
  } catch (error) {
    console.error(`  ERROR:`, error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  
  console.log("============================================================");
  console.log("Reverse ALL Uncorrected Bank Credits");
  console.log("============================================================");
  console.log(`Dry Run: ${dryRun}`);
  console.log("============================================================\n");
  
  const uncorrected = await findUncorrectedCredits();
  
  console.log(`\nFound ${uncorrected.length} uncorrected credit entries\n`);
  
  if (uncorrected.length === 0) {
    console.log("All entries have been corrected. Nothing to do.");
    return;
  }
  
  console.log("Entries to correct:");
  uncorrected.forEach((entry, i) => {
    console.log(`  ${i + 1}. ${entry.glAccountCode} - ${entry.glAccountName}`);
    console.log(`     ID: ${entry.id}, Amount: ${entry.amount} CREDIT`);
    console.log(`     Comment: ${entry.comments || "(none)"}`);
    console.log("");
  });
  
  let success = 0;
  let failed = 0;
  
  console.log("\nProcessing corrections...\n");
  
  for (const entry of uncorrected) {
    console.log(`Processing: ${entry.glAccountCode} - ${entry.amount} (ID: ${entry.id})`);
    
    const sourceId = await findSourceAccount(entry.transactionId, entry.glAccountId);
    
    if (!sourceId) {
      console.log(`  SKIP: Could not find source account`);
      failed++;
      continue;
    }
    
    const result = await createCorrection(entry, sourceId, dryRun);
    
    if (result) {
      console.log(`  ${dryRun ? "[DRY RUN]" : "SUCCESS"}`);
      success++;
    } else {
      console.log(`  FAILED`);
      failed++;
    }
  }
  
  console.log("\n============================================================");
  console.log("SUMMARY");
  console.log("============================================================");
  console.log(`Total: ${uncorrected.length}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log("============================================================");
  
  if (dryRun) {
    console.log("\nThis was a dry run. Remove --dry-run to execute.");
  }
}

main().catch(error => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
