import { PrismaClient } from "@prisma/client";

// Use the correct path to the generated Prisma client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  try {
    // Seed offices
    console.log("Seeding offices...");
    await Promise.all([
      prisma.$executeRaw`INSERT INTO "Office" (name, description, "createdAt", "updatedAt") VALUES ('Head Office', 'Main headquarters', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "Office" (name, description, "createdAt", "updatedAt") VALUES ('Branch Office', 'Branch location', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "Office" (name, description, "createdAt", "updatedAt") VALUES ('Regional Office', 'Regional headquarters', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    ]);

    // Seed legal forms
    console.log("Seeding legal forms...");
    await Promise.all([
      prisma.$executeRaw`INSERT INTO "LegalForm" (name, description, "createdAt", "updatedAt") VALUES ('Individual', 'Individual person', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "LegalForm" (name, description, "createdAt", "updatedAt") VALUES ('Corporate', 'Corporate entity', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "LegalForm" (name, description, "createdAt", "updatedAt") VALUES ('Partnership', 'Business partnership', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    ]);

    // Seed genders
    console.log("Seeding genders...");
    await Promise.all([
      prisma.$executeRaw`INSERT INTO "Gender" (name, description, "createdAt", "updatedAt") VALUES ('Male', 'Male gender', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "Gender" (name, description, "createdAt", "updatedAt") VALUES ('Female', 'Female gender', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "Gender" (name, description, "createdAt", "updatedAt") VALUES ('Other', 'Other gender', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    ]);

    // Seed client types
    console.log("Seeding client types...");
    await Promise.all([
      prisma.$executeRaw`INSERT INTO "ClientType" (name, description, "createdAt", "updatedAt") VALUES ('Individual', 'Individual client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "ClientType" (name, description, "createdAt", "updatedAt") VALUES ('Corporate', 'Corporate client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "ClientType" (name, description, "createdAt", "updatedAt") VALUES ('Group', 'Group client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    ]);

    // Seed client classifications
    console.log("Seeding client classifications...");
    await Promise.all([
      prisma.$executeRaw`INSERT INTO "ClientClassification" (name, description, "createdAt", "updatedAt") VALUES ('Standard', 'Standard client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "ClientClassification" (name, description, "createdAt", "updatedAt") VALUES ('Premium', 'Premium client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "ClientClassification" (name, description, "createdAt", "updatedAt") VALUES ('VIP', 'VIP client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    ]);

    // Seed savings products
    console.log("Seeding savings products...");
    await Promise.all([
      prisma.$executeRaw`INSERT INTO "SavingsProduct" (name, description, "interestRate", "minBalance", "createdAt", "updatedAt") VALUES ('Basic Savings', 'Basic savings account', 0.5, 0, NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "SavingsProduct" (name, description, "interestRate", "minBalance", "createdAt", "updatedAt") VALUES ('Premium Savings', 'Premium savings account with higher interest', 1.5, 1000, NOW(), NOW()) ON CONFLICT DO NOTHING`,
      prisma.$executeRaw`INSERT INTO "SavingsProduct" (name, description, "interestRate", "minBalance", "createdAt", "updatedAt") VALUES ('Fixed Deposit', 'Fixed deposit account', 3.0, 5000, NOW(), NOW()) ON CONFLICT DO NOTHING`,
    ]);
  } catch (error) {
    console.error("Error seeding database:", error);
  }

  console.log("Database seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
