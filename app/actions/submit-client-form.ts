"use server";

import { autoSaveField } from "./client-actions-with-autosave";
import { submitLead } from "./client-actions";
import { redirect } from "next/navigation";

export async function submitClientForm(formData: FormData) {
  try {
    console.log("🚀 Form submission started with server action");

    // Extract form data
    const data = {
      officeId: parseInt(formData.get("officeId") as string),
      legalFormId: parseInt(formData.get("legalFormId") as string),
      externalId: formData.get("externalId") as string,
      firstname: formData.get("firstname") as string,
      middlename: (formData.get("middlename") as string) || undefined,
      lastname: formData.get("lastname") as string,
      dateOfBirth: formData.get("dateOfBirth")
        ? new Date(formData.get("dateOfBirth") as string)
        : undefined,
      genderId: parseInt(formData.get("genderId") as string),
      isStaff: formData.get("isStaff") === "on",
      mobileNo: formData.get("mobileNo") as string,
      countryCode: (formData.get("countryCode") as string) || "+263",
      emailAddress: formData.get("emailAddress") as string,
      clientTypeId: parseInt(formData.get("clientTypeId") as string),
      clientClassificationId: parseInt(
        formData.get("clientClassificationId") as string
      ),
      submittedOnDate: formData.get("submittedOnDate")
        ? new Date(formData.get("submittedOnDate") as string)
        : new Date(),
      active: formData.get("active") === "on",
      activationDate: formData.get("activationDate")
        ? new Date(formData.get("activationDate") as string)
        : undefined,
      openSavingsAccount: formData.get("openSavingsAccount") === "on",
      savingsProductId: formData.get("savingsProductId")
        ? parseInt(formData.get("savingsProductId") as string)
        : undefined,
      currentStep: 1,
      // Financial fields
      monthlyIncomeRange:
        (formData.get("monthlyIncomeRange") as string) || undefined,
      employmentStatus:
        (formData.get("employmentStatus") as string) || undefined,
      employerName: (formData.get("employerName") as string) || undefined,
      yearsAtCurrentJob:
        (formData.get("yearsAtCurrentJob") as string) || undefined,
      hasExistingLoans: formData.get("hasExistingLoans") === "on",
      monthlyDebtPayments: formData.get("monthlyDebtPayments")
        ? parseFloat(formData.get("monthlyDebtPayments") as string)
        : undefined,
      propertyOwnership:
        (formData.get("propertyOwnership") as string) || undefined,
      businessOwnership: formData.get("businessOwnership") === "on",
      businessType: (formData.get("businessType") as string) || undefined,
    };

    console.log("📝 Extracted form data:", data);

    // Get the current lead ID from hidden field
    const currentLeadId =
      (formData.get("currentLeadId") as string) || undefined;

    // Use the auto-save action for final submission
    const result = await autoSaveField(data, currentLeadId);

    if (!result.success) {
      throw new Error(result.error || "Failed to submit form");
    }

    // Submit the lead
    const submitResult = await submitLead(result.leadId!);

    if (!submitResult.success) {
      throw new Error(submitResult.error || "Failed to submit lead");
    }

    console.log("✅ Form submitted successfully");

    // Redirect to leads page on success
    redirect("/leads");
  } catch (error) {
    console.error("Form submission error:", error);
    throw error;
  }
}
