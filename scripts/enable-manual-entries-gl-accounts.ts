/**
 * Script to enable manual journal entries for all GL accounts in Fineract
 * 
 * This script fetches all GL accounts and updates them to allow manual entries.
 * 
 * Usage: npx ts-node scripts/enable-manual-entries-gl-accounts.ts
 */

// Hardcoded configuration - update these values as needed
const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";
const FINERACT_TENANT_ID = process.env.FINERACT_TENANT_ID || "goodfellow";
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ="; // Base64 encoded mifos:password

interface GLAccount {
  id: number;
  name: string;
  glCode: string;
  manualEntriesAllowed: boolean;
  description?: string;
  parentId?: number;
  tagId?: number;
  type: {
    id: number;
    code: string;
    value: string;
  };
  usage: {
    id: number;
    code: string;
    value: string;
  };
  disabled: boolean;
}

async function fetchFineractAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
    Authorization: `Basic ${SERVICE_TOKEN}`,
    "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
    "Content-Type": "application/json",
  };

  // For HTTP URLs, use standard fetch
  if (url.startsWith("http://")) {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    return response.json();
  }

  // For HTTPS URLs, skip SSL verification (development only)
  const https = require("https");
  const agent = new https.Agent({ rejectUnauthorized: false });

  const response = await fetch(url, {
    ...options,
    headers,
    //@ts-ignore
    agent,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
    );
  }

  return response.json();
}

async function getAllGLAccounts(): Promise<GLAccount[]> {
  console.log("Fetching all GL accounts...");
  const accounts = await fetchFineractAPI("/glaccounts");
  console.log(`Found ${accounts.length} GL accounts`);
  return accounts;
}

async function getGLAccountDetails(accountId: number): Promise<GLAccount> {
  return fetchFineractAPI(`/glaccounts/${accountId}`);
}

async function updateGLAccount(account: GLAccount): Promise<boolean> {
  try {
    // Fineract requires the full payload when updating
    const payload = {
      type: account.type.id,
      name: account.name,
      usage: account.usage.id,
      glCode: account.glCode,
      parentId: account.parentId || null,
      tagId: account.tagId || 0,
      manualEntriesAllowed: true,
      description: account.description || account.name,
    };

    await fetchFineractAPI(`/glaccounts/${account.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return true;
  } catch (error) {
    console.error(`  Failed to update account ${account.id} (${account.name}):`, error);
    return false;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("GL Accounts Manual Entries Enabler");
  console.log("=".repeat(60));
  console.log(`Fineract URL: ${FINERACT_BASE_URL}`);
  console.log(`Tenant ID: ${FINERACT_TENANT_ID}`);
  console.log("=".repeat(60));
  console.log("");

  try {
    // Fetch all GL accounts
    const accounts = await getAllGLAccounts();

    // Filter accounts that don't allow manual entries
    const accountsToUpdate = accounts.filter(
      (account) => !account.manualEntriesAllowed
    );

    if (accountsToUpdate.length === 0) {
      console.log("\n✓ All GL accounts already allow manual entries!");
      return;
    }

    console.log(`\nFound ${accountsToUpdate.length} accounts that need updating:\n`);

    // Show accounts to be updated
    accountsToUpdate.forEach((account, index) => {
      console.log(
        `  ${index + 1}. [${account.glCode}] ${account.name} (ID: ${account.id})`
      );
    });

    console.log("\nUpdating accounts...\n");

    // Update each account
    let successCount = 0;
    let failCount = 0;

    for (const account of accountsToUpdate) {
      process.stdout.write(`  Updating [${account.glCode}] ${account.name}... `);
      
      try {
        // Fetch full account details first (the list may not have all fields)
        const fullAccount = await getGLAccountDetails(account.id);
        const success = await updateGLAccount(fullAccount);
        
        if (success) {
          console.log("✓");
          successCount++;
        } else {
          console.log("✗");
          failCount++;
        }
      } catch (error) {
        console.log("✗");
        console.error(`    Error: ${error}`);
        failCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("Summary:");
    console.log(`  Successfully updated: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log("=".repeat(60));

    if (failCount > 0) {
      console.log("\nNote: Some accounts may have failed due to permissions or validation rules.");
      console.log("You may need to update them manually in Fineract.");
    }

  } catch (error) {
    console.error("\nError:", error);
    process.exit(1);
  }
}

main();
