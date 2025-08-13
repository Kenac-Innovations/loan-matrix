import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Client form schema
const clientFormSchema = z.object({
  officeId: z.number(),
  officeName: z.string().optional(),
  legalFormId: z.number(),
  legalFormName: z.string().optional(),
  externalId: z.string(),
  firstname: z.string(),
  middlename: z.string().optional(),
  lastname: z.string(),
  dateOfBirth: z.date().optional(),
  gender: z.string().optional(),
  genderId: z.number().optional(),
  isStaff: z.boolean().default(false),
  mobileNo: z.string(),
  countryCode: z.string().default("+1"),
  emailAddress: z.string().email(),
  clientTypeId: z.number().optional(),
  clientTypeName: z.string().optional(),
  clientClassificationId: z.number().optional(),
  clientClassificationName: z.string().optional(),
  submittedOnDate: z.date().default(() => new Date()),
  active: z.boolean().default(true),
  activationDate: z.date().optional(),
  openSavingsAccount: z.boolean().default(false),
  savingsProductId: z.number().optional(),
  savingsProductName: z.string().optional(),
  currentStep: z.number().default(1),
  // Financial fields
  monthlyIncomeRange: z.string().optional(),
  employmentStatus: z.string().optional(),
  employerName: z.string().optional(),
  yearsAtCurrentJob: z.string().optional(),
  hasExistingLoans: z.boolean().default(false),
  monthlyDebtPayments: z.number().optional(),
  propertyOwnership: z.string().optional(),
  businessOwnership: z.boolean().default(false),
  businessType: z.string().optional(),
});

/**
 * POST /api/leads/operations
 * Handles lead operations like save draft, submit, etc.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operation, data, leadId } = body;

    switch (operation) {
      case 'saveDraft':
        return await handleSaveDraft(data, leadId);
      case 'submitLead':
        return await handleSubmitLead(leadId);
      case 'closeLead':
        return await handleCloseLead(leadId, data.reason);
      case 'addFamilyMember':
        return await handleAddFamilyMember(leadId, data);
      case 'removeFamilyMember':
        return await handleRemoveFamilyMember(data.id);
      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error in lead operation:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleSaveDraft(data: any, leadId?: string) {
  try {
    // Validate data
    const validatedData = clientFormSchema.parse(data);

    // Get current user ID (in a real app, this would come from auth)
    const userId = "user_1"; // Placeholder - replace with actual user ID from auth

    if (leadId) {
      // Update existing lead
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          officeId: validatedData.officeId,
          officeName: validatedData.officeName,
          legalFormId: validatedData.legalFormId,
          legalFormName: validatedData.legalFormName,
          externalId: validatedData.externalId,
          firstname: validatedData.firstname,
          middlename: validatedData.middlename,
          lastname: validatedData.lastname,
          dateOfBirth: validatedData.dateOfBirth || undefined,
          gender: validatedData.gender,
          genderId: validatedData.genderId || undefined,
          isStaff: validatedData.isStaff,
          mobileNo: validatedData.mobileNo,
          countryCode: validatedData.countryCode,
          emailAddress: validatedData.emailAddress,
          clientTypeId: validatedData.clientTypeId || undefined,
          clientTypeName: validatedData.clientTypeName,
          clientClassificationId: validatedData.clientClassificationId || undefined,
          clientClassificationName: validatedData.clientClassificationName,
          submittedOnDate: validatedData.submittedOnDate,
          active: validatedData.active,
          activationDate: validatedData.activationDate || undefined,
          openSavingsAccount: validatedData.openSavingsAccount,
          savingsProductId: validatedData.savingsProductId || undefined,
          savingsProductName: validatedData.savingsProductName,
          currentStep: validatedData.currentStep,
          // Financial fields
          monthlyIncomeRange: validatedData.monthlyIncomeRange,
          employmentStatus: validatedData.employmentStatus,
          employerName: validatedData.employerName,
          yearsAtCurrentJob: validatedData.yearsAtCurrentJob,
          hasExistingLoans: validatedData.hasExistingLoans,
          monthlyDebtPayments: validatedData.monthlyDebtPayments,
          propertyOwnership: validatedData.propertyOwnership,
          businessOwnership: validatedData.businessOwnership,
          businessType: validatedData.businessType,
          status: "DRAFT",
        },
      });

      return NextResponse.json({ success: true, leadId });
    } else {
      // Create new lead
      const newLead = await prisma.lead.create({
        data: {
          userId,
          officeId: validatedData.officeId,
          officeName: validatedData.officeName,
          legalFormId: validatedData.legalFormId,
          legalFormName: validatedData.legalFormName,
          externalId: validatedData.externalId,
          firstname: validatedData.firstname,
          middlename: validatedData.middlename,
          lastname: validatedData.lastname,
          dateOfBirth: validatedData.dateOfBirth || undefined,
          gender: validatedData.gender,
          genderId: validatedData.genderId || undefined,
          isStaff: validatedData.isStaff,
          mobileNo: validatedData.mobileNo,
          countryCode: validatedData.countryCode,
          emailAddress: validatedData.emailAddress,
          clientTypeId: validatedData.clientTypeId || undefined,
          clientTypeName: validatedData.clientTypeName,
          clientClassificationId: validatedData.clientClassificationId || undefined,
          clientClassificationName: validatedData.clientClassificationName,
          submittedOnDate: validatedData.submittedOnDate,
          active: validatedData.active,
          activationDate: validatedData.activationDate || undefined,
          openSavingsAccount: validatedData.openSavingsAccount,
          savingsProductId: validatedData.savingsProductId || undefined,
          savingsProductName: validatedData.savingsProductName,
          currentStep: validatedData.currentStep,
          // Financial fields
          monthlyIncomeRange: validatedData.monthlyIncomeRange,
          employmentStatus: validatedData.employmentStatus,
          employerName: validatedData.employerName,
          yearsAtCurrentJob: validatedData.yearsAtCurrentJob,
          hasExistingLoans: validatedData.hasExistingLoans,
          monthlyDebtPayments: validatedData.monthlyDebtPayments,
          propertyOwnership: validatedData.propertyOwnership,
          businessOwnership: validatedData.businessOwnership,
          businessType: validatedData.businessType,
          status: "DRAFT",
        },
      });

      return NextResponse.json({ success: true, leadId: newLead.id });
    }
  } catch (error: any) {
    console.error('Error saving draft:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save draft' },
      { status: 500 }
    );
  }
}

async function handleSubmitLead(leadId: string) {
  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: { 
        status: "ACTIVE",
        currentStep: 2 
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error submitting lead:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit lead' },
      { status: 500 }
    );
  }
}

async function handleCloseLead(leadId: string, reason: string) {
  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: { 
        status: "CLOSED",
        closedReason: reason 
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error closing lead:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to close lead' },
      { status: 500 }
    );
  }
}

async function handleAddFamilyMember(leadId: string, data: any) {
  try {
    const familyMember = await prisma.familyMember.create({
      data: {
        leadId,
        firstname: data.firstname,
        lastname: data.lastname,
        middlename: data.middlename,
        relationship: data.relationship,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        mobileNo: data.mobileNo,
        emailAddress: data.emailAddress,
        isDependent: data.isDependent || false,
      },
    });

    return NextResponse.json({ success: true, familyMember });
  } catch (error: any) {
    console.error('Error adding family member:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add family member' },
      { status: 500 }
    );
  }
}

async function handleRemoveFamilyMember(id: string) {
  try {
    await prisma.familyMember.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing family member:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove family member' },
      { status: 500 }
    );
  }
}
