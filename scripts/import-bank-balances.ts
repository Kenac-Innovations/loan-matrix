/**
 * Script to import bank and teller opening balances from Excel
 * 
 * Usage:
 *   npx tsx scripts/import-bank-balances.ts --file ./bank-balances.xlsx [options]
 * 
 * Options:
 *   --file              Path to Excel file (required)
 *   --opening-account   GL account ID for opening balance (credit side), default: 9550
 *   --office-id         Office ID for transactions, default: 1
 *   --currency          Currency code, default: ZMW
 *   --dry-run           Preview changes without committing
 *   --sheet             Sheet name or index, default: 0
 */

import * as XLSX from "xlsx";
import { PrismaClient } from "../app/generated/prisma";

// Configuration - hardcoded for this import script
// Change these values to match your target Fineract instance
const FINERACT_BASE_URL = "http://10.10.0.143:8443";
const FINERACT_TENANT_ID = "goodfellow";
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

const prisma = new PrismaClient();

interface BankBalanceRow {
  accountNumber: string;
  bankName: string;
  tellerBalance: number;
  bankBalance: number;
  location: string;
}

interface GLAccount {
  id: number;
  name: string;
  glCode: string;
  type: { id: number; value: string };
  usage: { id: number; value: string };
  manualEntriesAllowed: boolean;
}

interface ImportStats {
  totalRows: number;
  banksCreated: number;
  banksUpdated: number;
  tellersCreated: number;
  tellersUpdated: number;
  journalEntriesCreated: number;
  allocationsCreated: number;
  errors: string[];
  skipped: string[];
}

// Parse command line arguments
function parseArgs(): {
  file: string;
  openingAccountId: number;
  officeId: number;
  currency: string;
  dryRun: boolean;
  sheet: string | number;
} {
  const args = process.argv.slice(2);
  const result = {
    file: "",
    openingAccountId: 9550,
    officeId: 1,
    currency: "ZMW",
    dryRun: false,
    sheet: 0 as string | number,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--file":
        result.file = args[++i];
        break;
      case "--opening-account":
        result.openingAccountId = parseInt(args[++i]);
        break;
      case "--office-id":
        result.officeId = parseInt(args[++i]);
        break;
      case "--currency":
        result.currency = args[++i];
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--sheet":
        const sheetArg = args[++i];
        result.sheet = isNaN(parseInt(sheetArg)) ? sheetArg : parseInt(sheetArg);
        break;
    }
  }

  if (!result.file) {
    console.error("Error: --file argument is required");
    console.log("\nUsage: npx tsx scripts/import-bank-balances.ts --file ./bank-balances.xlsx [options]");
    console.log("\nOptions:");
    console.log("  --file              Path to Excel file (required)");
    console.log("  --opening-account   GL account ID for opening balance (credit side), default: 9550");
    console.log("  --office-id         Office ID for transactions, default: 1");
    console.log("  --currency          Currency code, default: ZMW");
    console.log("  --dry-run           Preview changes without committing");
    console.log("  --sheet             Sheet name or index, default: 0");
    process.exit(1);
  }

  return result;
}

// Fetch from Fineract API
async function fetchFineractAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
    Authorization: `Basic ${SERVICE_TOKEN}`,
    "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }
  
  return response.json();
}

// Get all GL accounts from Fineract
async function getGLAccounts(): Promise<GLAccount[]> {
  console.log("Fetching GL accounts from Fineract...");
  const accounts = await fetchFineractAPI("/glaccounts");
  console.log(`Found ${accounts.length} GL accounts`);
  return accounts;
}

// Find GL account by code
function findGLAccountByCode(accounts: GLAccount[], code: string): GLAccount | undefined {
  return accounts.find(acc => acc.glCode === code);
}

// Parse Excel file
function parseExcelFile(filePath: string, sheet: string | number): BankBalanceRow[] {
  console.log(`Reading Excel file: ${filePath}`);
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = typeof sheet === "number" ? workbook.SheetNames[sheet] : sheet;
  
  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new Error(`Sheet "${sheet}" not found. Available sheets: ${workbook.SheetNames.join(", ")}`);
  }
  
  console.log(`Using sheet: ${sheetName}`);
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON - assume headers in first row
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  // Skip header row and parse data
  const rows: BankBalanceRow[] = [];
  
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || !row[0]) continue; // Skip empty rows
    
    // Parse the row - adjust column indices based on actual Excel structure
    // Column 1: ACCOUNT, Column 2: BANK BRANCH, Column 3: BANK (vault balance), Column 4: VAULT (teller balance), Column 5: TELLER BRANCH
    const accountNumber = String(row[0] || "").trim();
    const bankName = String(row[1] || "").trim();
    const bankBalance = parseFloat(String(row[2] || "0").replace(/,/g, "").replace(/-/g, "")) || 0;  // Column 3 = Bank vault balance
    const tellerBalance = parseFloat(String(row[3] || "0").replace(/,/g, "").replace(/-/g, "")) || 0;  // Column 4 = Teller balance
    const location = String(row[4] || "").trim();
    
    if (accountNumber && bankName) {
      rows.push({
        accountNumber,
        bankName,
        tellerBalance,
        bankBalance,
        location,
      });
    }
  }
  
  console.log(`Parsed ${rows.length} data rows`);
  return rows;
}

// Format date for Fineract
function formatDateForFineract(date: Date = new Date()): string {
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// Create journal entry in Fineract
async function createJournalEntry(
  debitAccountId: number,
  creditAccountId: number,
  amount: number,
  officeId: number,
  currency: string,
  description: string,
  dryRun: boolean
): Promise<string | null> {
  const payload = {
    officeId,
    currencyCode: currency,
    debits: [{ glAccountId: debitAccountId, amount }],
    credits: [{ glAccountId: creditAccountId, amount }],
    referenceNumber: `OPENING-BAL-${Date.now()}`,
    transactionDate: formatDateForFineract(),
    comments: description,
    locale: "en",
    dateFormat: "dd MMMM yyyy",
  };
  
  if (dryRun) {
    console.log(`  [DRY RUN] Would create journal entry: Debit ${debitAccountId}, Credit ${creditAccountId}, Amount ${amount}`);
    return "DRY-RUN-" + Date.now();
  }
  
  const result = await fetchFineractAPI("/journalentries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  
  return result.transactionId || result.resourceId;
}

// Get tenant ID
async function getTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "goodfellow", isActive: true },
  });
  
  if (!tenant) {
    throw new Error("Tenant 'goodfellow' not found");
  }
  
  return tenant.id;
}

// Find bank by location/name matching
async function findBankByLocation(tenantId: string, location: string, bankName: string): Promise<any | null> {
  // Normalize location for matching
  const normalizedLocation = location.toUpperCase().trim();
  
  // Try to find bank by code (location)
  let bank = await prisma.bank.findFirst({
    where: {
      tenantId,
      code: normalizedLocation,
      glAccountId: { not: null },  // Must have GL account linked
    },
  });
  
  if (bank) return bank;
  
  // Try partial match on code
  bank = await prisma.bank.findFirst({
    where: {
      tenantId,
      code: { contains: normalizedLocation, mode: 'insensitive' },
      glAccountId: { not: null },
    },
  });
  
  if (bank) return bank;
  
  // Try matching by GL account name containing the location
  bank = await prisma.bank.findFirst({
    where: {
      tenantId,
      glAccountName: { contains: normalizedLocation, mode: 'insensitive' },
      glAccountId: { not: null },
    },
  });
  
  return bank;
}

// Main import function
async function importBankBalances(
  rows: BankBalanceRow[],
  glAccounts: GLAccount[],
  openingAccountId: number,
  officeId: number,
  currency: string,
  dryRun: boolean
): Promise<ImportStats> {
  const stats: ImportStats = {
    totalRows: rows.length,
    banksCreated: 0,
    banksUpdated: 0,
    tellersCreated: 0,
    tellersUpdated: 0,
    journalEntriesCreated: 0,
    allocationsCreated: 0,
    errors: [],
    skipped: [],
  };
  
  const tenantId = await getTenantId();
  console.log(`Using tenant ID: ${tenantId}`);
  
  // Verify opening balance account exists by fetching it directly
  let openingAccount = glAccounts.find(acc => acc.id === openingAccountId);
  if (!openingAccount) {
    // Try fetching directly by ID
    try {
      console.log(`Opening account not in list, fetching by ID ${openingAccountId}...`);
      openingAccount = await fetchFineractAPI(`/glaccounts/${openingAccountId}`);
      console.log(`Fetched: ${JSON.stringify(openingAccount)}`);
    } catch (error) {
      console.error(`Fetch error: ${error}`);
      throw new Error(`Opening balance account ID ${openingAccountId} not found in Fineract`);
    }
  }
  if (!openingAccount || !openingAccount.glCode) {
    throw new Error(`Opening balance account ID ${openingAccountId} not found or invalid`);
  }
  console.log(`Opening balance account: ${openingAccount.glCode} - ${openingAccount.name}`);
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(`\n[${i + 1}/${rows.length}] Processing: ${row.bankName} - ${row.location}`);
    
    try {
      // Find existing bank by location/name
      const bank = await findBankByLocation(tenantId, row.location, row.bankName);
      
      if (!bank) {
        stats.skipped.push(`${row.bankName} (${row.location}): No matching bank with GL account in local DB`);
        console.log(`  SKIPPED: No matching bank found for location "${row.location}"`);
        continue;
      }
      
      if (!bank.glAccountId) {
        stats.skipped.push(`${row.bankName} (${row.location}): Bank has no GL account linked`);
        console.log(`  SKIPPED: Bank "${bank.name}" has no GL account linked`);
        continue;
      }
      
      console.log(`  Found Bank: ${bank.name} (${bank.code}) -> GL: ${bank.glAccountCode} - ${bank.glAccountName}`);
      
      // Create journal entry for bank vault balance (if > 0)
      if (row.bankBalance > 0) {
        const transactionId = await createJournalEntry(
          bank.glAccountId,  // Debit bank account (increases asset)
          openingAccountId,  // Credit opening balance account
          row.bankBalance,
          officeId,
          currency,
          `Opening balance for ${bank.name} - ${row.location}`,
          dryRun
        );
        
        if (transactionId) {
          console.log(`  Created journal entry: ${transactionId} for ${row.bankBalance} ${currency} (Bank Vault)`);
          stats.journalEntriesCreated++;
        }
      } else {
        console.log(`  Skipped journal entry (bank balance is 0)`);
      }
      
      // Find or create Teller linked to this bank
      let teller = await prisma.teller.findFirst({
        where: { tenantId, bankId: bank.id, isActive: true },
      });
      
      if (!teller) {
        if (!dryRun) {
          teller = await prisma.teller.create({
            data: {
              tenantId,
              bankId: bank.id,
              name: `${bank.name} ${row.location} Teller`,
              description: `Teller for ${bank.name} - ${row.location}`,
              officeId: bank.officeId || officeId,
              officeName: row.location || "Head Office",
              status: "ACTIVE",
              isActive: true,
              startDate: new Date(),
            },
          });
          console.log(`  Created Teller: ${teller.name}`);
          stats.tellersCreated++;
        } else {
          teller = { id: "DRY-RUN-TELLER-" + i, name: `${bank.name} ${row.location} Teller` } as any;
          console.log(`  [DRY RUN] Would create Teller: ${teller.name}`);
          stats.tellersCreated++;
        }
      } else {
        console.log(`  Found existing Teller: ${teller.name}`);
      }
      
      // Create CashAllocation for teller balance (if > 0)
      if (row.tellerBalance > 0 && teller) {
        if (!dryRun) {
          await prisma.cashAllocation.create({
            data: {
              tenantId,
              tellerId: teller.id,
              cashierId: null,  // Teller vault allocation
              amount: row.tellerBalance,
              currency,
              allocatedBy: "SYSTEM-IMPORT",
              notes: `Opening balance import for ${bank.name} - ${row.location}`,
              status: "ACTIVE",
            },
          });
        }
        console.log(`  Created teller allocation: ${row.tellerBalance} ${currency}`);
        stats.allocationsCreated++;
      } else {
        console.log(`  Skipped teller allocation (balance is 0)`);
      }
      
      stats.banksUpdated++;  // Count as processed
      
    } catch (error) {
      const errorMsg = `${row.bankName} (${row.location}): ${error instanceof Error ? error.message : String(error)}`;
      stats.errors.push(errorMsg);
      console.error(`  ERROR: ${errorMsg}`);
    }
  }
  
  return stats;
}

// Print summary
function printSummary(stats: ImportStats, dryRun: boolean) {
  console.log("\n" + "=".repeat(60));
  console.log(dryRun ? "DRY RUN SUMMARY" : "IMPORT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total rows processed: ${stats.totalRows}`);
  console.log(`Banks created: ${stats.banksCreated}`);
  console.log(`Banks updated: ${stats.banksUpdated}`);
  console.log(`Tellers created: ${stats.tellersCreated}`);
  console.log(`Tellers updated: ${stats.tellersUpdated}`);
  console.log(`Journal entries created: ${stats.journalEntriesCreated}`);
  console.log(`Teller allocations created: ${stats.allocationsCreated}`);
  
  if (stats.skipped.length > 0) {
    console.log(`\nSkipped (${stats.skipped.length}):`);
    stats.skipped.forEach(s => console.log(`  - ${s}`));
  }
  
  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`  - ${e}`));
  }
  
  console.log("=".repeat(60));
}

// Main entry point
async function main() {
  const args = parseArgs();
  
  console.log("=".repeat(60));
  console.log("Bank Balance Import Script");
  console.log("=".repeat(60));
  console.log(`File: ${args.file}`);
  console.log(`Opening Balance Account ID: ${args.openingAccountId}`);
  console.log(`Office ID: ${args.officeId}`);
  console.log(`Currency: ${args.currency}`);
  console.log(`Dry Run: ${args.dryRun}`);
  console.log("=".repeat(60));
  
  try {
    // Parse Excel file
    const rows = parseExcelFile(args.file, args.sheet);
    
    if (rows.length === 0) {
      console.log("No data rows found in Excel file");
      return;
    }
    
    // Preview first few rows
    console.log("\nFirst 3 rows preview:");
    rows.slice(0, 3).forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.accountNumber} | ${row.bankName} | Teller: ${row.tellerBalance} | Bank: ${row.bankBalance} | ${row.location}`);
    });
    
    // Fetch GL accounts
    const glAccounts = await getGLAccounts();
    
    // Run import
    const stats = await importBankBalances(
      rows,
      glAccounts,
      args.openingAccountId,
      args.officeId,
      args.currency,
      args.dryRun
    );
    
    // Print summary
    printSummary(stats, args.dryRun);
    
    if (args.dryRun) {
      console.log("\nThis was a dry run. No changes were made.");
      console.log("Remove --dry-run flag to execute the import.");
    }
    
  } catch (error) {
    console.error("\nFatal error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
