#!/usr/bin/env tsx

import { PrismaClient } from '../app/generated/prisma';
import axios from 'axios';

const prisma = new PrismaClient();

// Fineract API config - hardcoded for goodfellow tenant
const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || 'http://41.174.125.165:4032';
const FINERACT_TENANT_ID = 'goodfellow'; // Using goodfellow tenant
const SERVICE_TOKEN = 'bWlmb3M6cGFzc3dvcmQ='; // Base64 encoded credentials

async function fetchFineractJournalEntries(glAccountId: number) {
  try {
    console.log(`   Tenant: ${FINERACT_TENANT_ID}`);
    
    // Direct query for this GL account - fetch up to 1000 entries
    const directUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/journalentries?glAccountId=${glAccountId}&limit=1000&orderBy=id&sortOrder=DESC`;
    console.log(`   Fetching entries for GL ${glAccountId}...`);
    
    const directResp = await axios.get(directUrl, {
      headers: {
        'Fineract-Platform-TenantId': FINERACT_TENANT_ID,
        'Authorization': `Basic ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
    
    const entries = directResp.data?.pageItems || [];
    console.log(`   Total entries for GL ${glAccountId}: ${directResp.data?.totalFilteredRecords || entries.length}`);
    
    return directResp.data;
    
  } catch (error: any) {
    console.error('Fineract API Error:', error.message);
    return null;
  }
}

async function fetchGLAccountRunningBalance(glAccountId: number) {
  try {
    // Try to get running balance from GL account endpoint
    const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1/glaccounts/${glAccountId}?runningBalance=true`;
    
    const response = await axios.get(url, {
      headers: {
        'Fineract-Platform-TenantId': FINERACT_TENANT_ID,
        'Authorization': `Basic ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
    
    return response.data;
  } catch (error: any) {
    return null;
  }
}

async function fetchGLAccount(glAccountId: number) {
  try {
    const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1/glaccounts/${glAccountId}`;
    
    const response = await axios.get(url, {
      headers: {
        'Fineract-Platform-TenantId': FINERACT_TENANT_ID,
        'Authorization': `Basic ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Fineract GL Account API Error:', error.message);
    return null;
  }
}

async function checkMonzeBalance() {
  try {
    console.log('🔍 Looking for bank...\n');
    
    // Find the bank - check by name or code
    const bankSearch = process.argv[2] || 'CHINGOLA';
    console.log(`Searching for bank: ${bankSearch}\n`);
    
    const bank = await prisma.bank.findFirst({
      where: {
        OR: [
          { name: { contains: bankSearch, mode: 'insensitive' } },
          { code: { contains: bankSearch, mode: 'insensitive' } },
        ],
        glAccountId: { not: null }
      },
      include: {
        allocations: true,
        tellers: {
          include: {
            cashAllocations: {
              where: {
                status: 'ACTIVE',
                cashierId: null // Only vault allocations
              }
            }
          }
        }
      }
    });

    if (!bank) {
      console.log(`❌ No bank found matching "${bankName}"`);
      
      // List all banks with GL configured
      const allBanks = await prisma.bank.findMany({
        where: { glAccountId: { not: null } },
        select: { id: true, name: true, code: true, glAccountId: true }
      });
      console.log('\n📋 Available banks (with GL):');
      allBanks.forEach(b => console.log(`  - ${b.name} (GL: ${b.glAccountId})`));
      return;
    }

    console.log(`✅ Found bank: ${bank.name}`);
    console.log(`   Code: ${bank.code}`);
    console.log(`   GL Account ID: ${bank.glAccountId || 'Not configured'}`);
    console.log(`   GL Account Name: ${bank.glAccountName || 'N/A'}`);
    console.log(`   Status: ${bank.status}`);

    // Calculate local allocations (BankAllocation)
    const totalBankAllocations = bank.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    console.log(`\n💰 Bank Allocations (local): ${totalBankAllocations.toLocaleString()}`);

    // Calculate teller vault allocations
    let totalTellerAllocations = 0;
    console.log(`\n👥 Tellers (${bank.tellers.length}):`);
    for (const teller of bank.tellers) {
      const tellerVault = teller.cashAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      totalTellerAllocations += tellerVault;
      console.log(`   - ${teller.name}: ${tellerVault.toLocaleString()} (${teller.cashAllocations.length} allocations)`);
    }

    // Get all active cash allocations for tellers at this bank (vault level)
    const tellerAllocations = await prisma.cashAllocation.findMany({
      where: {
        teller: { bankId: bank.id },
        cashierId: null,
        status: 'ACTIVE'
      }
    });
    
    const allocatedToTellers = tellerAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);

    console.log(`\n📊 Summary (Local Database):`);
    console.log(`   Total Bank Allocations (local):  ${totalBankAllocations.toLocaleString()}`);
    console.log(`   Allocated to Tellers:            ${allocatedToTellers.toLocaleString()}`);
    console.log(`   Available (local calc):          ${(totalBankAllocations - allocatedToTellers).toLocaleString()}`);

    // Show raw cash allocations for this bank's tellers
    console.log(`\n📝 Raw Cash Allocations (vault level):`);
    for (const alloc of tellerAllocations) {
      const teller = bank.tellers.find(t => t.id === alloc.tellerId);
      console.log(`   ${teller?.name || alloc.tellerId}: ${alloc.amount.toLocaleString()} ${alloc.currency} (${alloc.status})`);
    }

    // Fetch Fineract GL balance
    if (bank.glAccountId) {
      console.log(`\n🔄 Fetching Fineract GL Account Details (GL ID: ${bank.glAccountId})...`);
      
      // First get the GL account details
      const glAccount = await fetchGLAccount(bank.glAccountId);
      if (glAccount) {
        console.log(`\n📋 GL Account Info:`);
        console.log(`   Name: ${glAccount.name}`);
        console.log(`   Code: ${glAccount.glCode}`);
        console.log(`   Type: ${glAccount.type?.value || 'N/A'}`);
        console.log(`   Usage: ${glAccount.usage?.value || 'N/A'}`);
        console.log(`   Manual Entries: ${glAccount.manualEntriesAllowed ? 'Yes' : 'No'}`);
        console.log(`   Disabled: ${glAccount.disabled ? 'Yes' : 'No'}`);
      }
      
      // Try to get running balance
      const glWithBalance = await fetchGLAccountRunningBalance(bank.glAccountId);
      if (glWithBalance) {
        console.log(`\n💰 GL Running Balance Info:`);
        console.log(`   organizationRunningBalance: ${glWithBalance.organizationRunningBalance?.toLocaleString() || 'N/A'}`);
      }
      
      console.log(`\n🔄 Fetching Journal Entries...`);
      const journalData = await fetchFineractJournalEntries(bank.glAccountId);
      
      if (journalData?.pageItems && journalData.pageItems.length > 0) {
        // Calculate balance from all entries (ASSET account: DEBIT adds, CREDIT subtracts)
        let calculatedBalance = 0;
        let totalDebits = 0;
        let totalCredits = 0;
        
        for (const entry of journalData.pageItems) {
          if (entry.entryType?.value === 'DEBIT') {
            calculatedBalance += entry.amount || 0;
            totalDebits += entry.amount || 0;
          } else if (entry.entryType?.value === 'CREDIT') {
            calculatedBalance -= entry.amount || 0;
            totalCredits += entry.amount || 0;
          }
        }
        
        const latestEntry = journalData.pageItems[0];
        const currency = latestEntry?.currency?.code || 'ZMW';
        
        console.log(`\n💵 FINERACT GL BALANCE:`);
        console.log(`   Total Entries:      ${journalData.pageItems.length}`);
        console.log(`   Total Debits:       ${totalDebits.toLocaleString()} ${currency}`);
        console.log(`   Total Credits:      ${totalCredits.toLocaleString()} ${currency}`);
        console.log(`   ─────────────────────────────────`);
        console.log(`   GL Balance:         ${calculatedBalance.toLocaleString()} ${currency}`);
        console.log(`   Allocated to Tellers: ${allocatedToTellers.toLocaleString()} ${currency}`);
        console.log(`   Available Balance:  ${(calculatedBalance - allocatedToTellers).toLocaleString()} ${currency}`);
        
        // Show ALL entries with IDs and reference numbers
        console.log(`\n📜 All Journal Entries for GL ${bank.glAccountId}:`);
        for (const entry of journalData.pageItems) {
          const date = entry.transactionDate ? `${entry.transactionDate[2]}/${entry.transactionDate[1]}/${entry.transactionDate[0]}` : 'N/A';
          const type = entry.entryType?.value || 'N/A';
          const amount = entry.amount?.toLocaleString() || '0';
          const desc = entry.comments || 'No description';
          const id = entry.id || 'N/A';
          const refNum = entry.referenceNumber || 'N/A';
          const transactionId = entry.transactionId || 'N/A';
          const typeSign = type === 'DEBIT' ? '+' : '-';
          
          console.log(`\n   ${typeSign}ZMW ${amount}`);
          console.log(`   ID: ${id} | Ref: ${refNum} | TransID: ${transactionId}`);
          console.log(`   Date: ${date} | Type: ${type}`);
          console.log(`   "${desc.substring(0, 70)}"`);
        }
        
        // Correct entries from user
        const correctRefs = ['649980d5fd622', '64975825d369a', '6495a5306aed2', '6494e7e98129a'];
        
        console.log(`\n\n🎯 ENTRIES TO REMOVE (not in correct list):`);
        console.log(`   Correct references: ${correctRefs.join(', ')}`);
        
        const toRemove = journalData.pageItems.filter((e: any) => 
          !correctRefs.includes(e.referenceNumber) && !correctRefs.includes(e.transactionId?.toString())
        );
        
        let removeTotal = 0;
        for (const entry of toRemove) {
          const date = entry.transactionDate ? `${entry.transactionDate[2]}/${entry.transactionDate[1]}/${entry.transactionDate[0]}` : 'N/A';
          const type = entry.entryType?.value || 'N/A';
          const amount = entry.amount || 0;
          const refNum = entry.referenceNumber || 'N/A';
          
          if (type === 'DEBIT') {
            removeTotal += amount;
          } else {
            removeTotal -= amount;
          }
          
          console.log(`\n   ❌ REMOVE: ${type} ${amount.toLocaleString()} ZMW`);
          console.log(`      ID: ${entry.id} | Ref: ${refNum}`);
          console.log(`      Date: ${date}`);
          console.log(`      "${entry.comments?.substring(0, 60) || 'No description'}"`);
        }
        
        console.log(`\n   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   Total impact of removal: ${removeTotal.toLocaleString()} ZMW`);
        console.log(`   New balance after removal: ${(calculatedBalance - removeTotal).toLocaleString()} ZMW`);
        
        // Calculate what needs to be removed to reach target
        const targetBalance = 300000;
        const excessAmount = calculatedBalance - targetBalance;
        
        console.log(`\n🎯 TO REACH TARGET BALANCE OF ${targetBalance.toLocaleString()}:`);
        console.log(`   Current GL Balance:  ${calculatedBalance.toLocaleString()}`);
        console.log(`   Target Balance:      ${targetBalance.toLocaleString()}`);
        console.log(`   Excess to remove:    ${excessAmount.toLocaleString()}`);
        
        // Identify correction entries that might need removal
        const correctionEntries = journalData.pageItems.filter((e: any) => 
          e.comments?.toLowerCase().includes('correction') || 
          e.comments?.toLowerCase().includes('reversi')
        );
        
        console.log(`\n⚠️  PROBLEMATIC ENTRIES (Corrections/Reversals):`);
        let correctionTotal = 0;
        for (const entry of correctionEntries) {
          const date = entry.transactionDate ? `${entry.transactionDate[2]}/${entry.transactionDate[1]}/${entry.transactionDate[0]}` : 'N/A';
          const type = entry.entryType?.value || 'N/A';
          const amount = entry.amount || 0;
          correctionTotal += type === 'DEBIT' ? amount : -amount;
          console.log(`   ID ${entry.id}: ${type} ${amount.toLocaleString()} on ${date}`);
          console.log(`      "${entry.comments?.substring(0, 70)}"`);
        }
        console.log(`   Total from corrections: ${correctionTotal.toLocaleString()} (${type === 'DEBIT' ? 'added' : 'subtracted'})`);
        
        // Show recommendation
        console.log(`\n📋 ENTRIES TO REVERSE (to reduce balance by ${excessAmount.toLocaleString()}):`);
        let remaining = excessAmount;
        const toReverse: any[] = [];
        
        // Sort by amount descending to find best matches
        const debitEntries = journalData.pageItems
          .filter((e: any) => e.entryType?.value === 'DEBIT')
          .sort((a: any, b: any) => b.amount - a.amount);
        
        for (const entry of debitEntries) {
          if (remaining <= 0) break;
          if (entry.amount <= remaining) {
            toReverse.push(entry);
            remaining -= entry.amount;
          }
        }
        
        if (remaining === 0) {
          console.log(`   The following DEBIT entries should be CREDITED to reverse:`);
          for (const entry of toReverse) {
            const date = entry.transactionDate ? `${entry.transactionDate[2]}/${entry.transactionDate[1]}/${entry.transactionDate[0]}` : 'N/A';
            console.log(`   ❌ ID ${entry.id}: CREDIT ${entry.amount.toLocaleString()} (reverse the DEBIT from ${date})`);
            console.log(`      "${entry.comments?.substring(0, 60)}"`);
          }
        } else {
          console.log(`   Could not find exact match. Remaining: ${remaining.toLocaleString()}`);
          console.log(`   Manual review needed.`);
        }
      } else {
        console.log(`   ⚠️ No journal entries found for GL account ${bank.glAccountId}`);
      }
    } else {
      console.log(`\n⚠️ No GL Account configured for this bank`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMonzeBalance();
