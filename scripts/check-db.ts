#!/usr/bin/env tsx

import { PrismaClient } from '../app/generated/prisma';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Checking database connection...');
    
    // Check if UssdLoanApplication table exists and has data
    const ussdApps = await prisma.ussdLoanApplication.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 Found ${ussdApps.length} USSD applications in database`);
    
    if (ussdApps.length > 0) {
      console.log('\n📋 Recent applications:');
      ussdApps.forEach((app, index) => {
        console.log(`${index + 1}. ${app.userFullName} - ${app.messageId} - ${app.status} - $${app.principalAmount}`);
      });
    } else {
      console.log('❌ No USSD applications found in database');
    }
    
    // Check total count
    const totalCount = await prisma.ussdLoanApplication.count();
    console.log(`\n📈 Total USSD applications: ${totalCount}`);
    
    // Check by status
    const statusCounts = await prisma.ussdLoanApplication.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    console.log('\n📊 Status breakdown:');
    statusCounts.forEach(status => {
      console.log(`  ${status.status}: ${status._count.status}`);
    });
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();


