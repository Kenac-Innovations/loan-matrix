import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { fetchFineractAPI } from "@/lib/api";

type ContactDirectoryEntry = {
  id: string;
  name: string;
  role: string;
  category: "BORROWER" | "GUARANTOR" | "REFERENCE" | "EMPLOYER" | "OTHER";
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  source: "lead" | "family-member" | "state" | "fineract-guarantor";
};

type JsonMap = Record<string, unknown>;

function buildName(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function formatPhone(
  phone?: string | null,
  countryCode?: string | null
): string | null {
  const trimmedPhone = (phone || "").trim();
  if (!trimmedPhone) {
    return null;
  }

  if (trimmedPhone.startsWith("+")) {
    return trimmedPhone;
  }

  const trimmedCountryCode = (countryCode || "").trim();
  return trimmedCountryCode
    ? `${trimmedCountryCode} ${trimmedPhone}`.trim()
    : trimmedPhone;
}

function getValueByPath(source: JsonMap | null | undefined, path: string): unknown {
  if (!source) {
    return undefined;
  }

  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return (value as Record<string, unknown>)[key];
  }, source);
}

function getStringValue(
  sources: Array<JsonMap | null | undefined>,
  keys: string[]
): string | null {
  for (const key of keys) {
    for (const source of sources) {
      const value = getValueByPath(source, key);
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return null;
}

function getArrayValue(
  sources: Array<JsonMap | null | undefined>,
  keys: string[]
): unknown[] {
  for (const key of keys) {
    for (const source of sources) {
      const value = getValueByPath(source, key);
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

function inferCategory(role: string): ContactDirectoryEntry["category"] {
  const normalizedRole = role.toLowerCase();

  if (normalizedRole.includes("guarantor") || normalizedRole.includes("surety")) {
    return "GUARANTOR";
  }

  if (
    normalizedRole.includes("reference") ||
    normalizedRole.includes("referee") ||
    normalizedRole.includes("relative") ||
    normalizedRole.includes("kin")
  ) {
    return "REFERENCE";
  }

  if (normalizedRole.includes("employer")) {
    return "EMPLOYER";
  }

  if (normalizedRole.includes("borrower")) {
    return "BORROWER";
  }

  return "OTHER";
}

function dedupeContactDirectory(
  entries: ContactDirectoryEntry[]
): ContactDirectoryEntry[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = [
      entry.name.trim().toLowerCase(),
      (entry.phone || "").trim().toLowerCase(),
      (entry.email || "").trim().toLowerCase(),
      entry.role.trim().toLowerCase(),
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function getFineractGuarantors(
  fineractLoanId?: number | null
): Promise<ContactDirectoryEntry[]> {
  if (!fineractLoanId) {
    return [];
  }

  try {
    const guarantorPayload = await fetchFineractAPI(
      `/loans/${fineractLoanId}?associations=guarantors`
    );
    const guarantors = Array.isArray(guarantorPayload?.guarantors)
      ? guarantorPayload.guarantors
      : [];

    return guarantors
      .map((guarantor: Record<string, unknown>, index: number) => {
        const name = buildName([
          typeof guarantor.firstname === "string" ? guarantor.firstname : null,
          typeof guarantor.lastname === "string" ? guarantor.lastname : null,
        ]) || (typeof guarantor.name === "string" ? guarantor.name.trim() : "");
        const phone =
          typeof guarantor.mobileNumber === "string"
            ? guarantor.mobileNumber.trim()
            : typeof guarantor.mobileNo === "string"
              ? guarantor.mobileNo.trim()
              : null;
        const email =
          typeof guarantor.emailAddress === "string"
            ? guarantor.emailAddress.trim()
            : null;
        const address =
          typeof guarantor.addressLine1 === "string"
            ? guarantor.addressLine1.trim()
            : typeof guarantor.address === "string"
              ? guarantor.address.trim()
              : null;

        if (!name && !phone && !email && !address) {
          return null;
        }

        return {
          id: `fineract-guarantor-${index}`,
          name: name || `Guarantor ${index + 1}`,
          role: "Loan Guarantor",
          category: "GUARANTOR" as const,
          phone,
          email,
          address,
          source: "fineract-guarantor" as const,
        };
      })
      .filter((entry): entry is ContactDirectoryEntry => entry !== null);
  } catch (error) {
    console.warn("Failed to fetch Fineract guarantors for communications tab:", error);
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify lead exists and belongs to tenant
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        firstname: true,
        middlename: true,
        lastname: true,
        emailAddress: true,
        mobileNo: true,
        countryCode: true,
        businessAddress: true,
        employerName: true,
        fineractLoanId: true,
        stateContext: true,
        stateMetadata: true,
        familyMembers: {
          select: {
            id: true,
            firstname: true,
            middlename: true,
            lastname: true,
            relationship: true,
            mobileNo: true,
            emailAddress: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Fetch communications for the lead
    const communications = await prisma.leadCommunication.findMany({
      where: {
        leadId,
        tenantId: tenant.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate summary statistics
    const totalCommunications = communications.length;
    const emailCount = communications.filter((c) => c.type === "EMAIL").length;
    const smsCount = communications.filter((c) => c.type === "SMS").length;
    const callCount = communications.filter((c) => c.type === "CALL").length;
    const meetingCount = communications.filter(
      (c) => c.type === "MEETING"
    ).length;
    const noteCount = communications.filter((c) => c.type === "NOTE").length;

    const inboundCount = communications.filter(
      (c) => c.direction === "INBOUND"
    ).length;
    const outboundCount = communications.filter(
      (c) => c.direction === "OUTBOUND"
    ).length;

    const lastCommunication = communications[0];
    const lastCommunicationDate = lastCommunication?.createdAt;

    const summary = {
      total: totalCommunications,
      byType: {
        email: emailCount,
        sms: smsCount,
        call: callCount,
        meeting: meetingCount,
        note: noteCount,
      },
      byDirection: {
        inbound: inboundCount,
        outbound: outboundCount,
      },
      lastCommunication: lastCommunicationDate,
    };

    const stateContext = (lead.stateContext as JsonMap | null) || null;
    const stateMetadata = (lead.stateMetadata as JsonMap | null) || null;
    const stateSources = [stateContext, stateMetadata];
    const borrowerName = buildName([
      lead.firstname,
      lead.middlename,
      lead.lastname,
    ]);

    const leadContacts: ContactDirectoryEntry[] = [];

    if (borrowerName || lead.mobileNo || lead.emailAddress || lead.businessAddress) {
      leadContacts.push({
        id: "borrower-primary",
        name: borrowerName || "Borrower",
        role: "Borrower",
        category: "BORROWER",
        phone: formatPhone(lead.mobileNo, lead.countryCode),
        email: lead.emailAddress,
        address: lead.businessAddress,
        source: "lead",
      });
    }

    if (lead.employerName?.trim()) {
      leadContacts.push({
        id: "employer-primary",
        name: lead.employerName.trim(),
        role: "Employer",
        category: "EMPLOYER",
        source: "lead",
      });
    }

    const familyContacts = lead.familyMembers
      .map((member) => {
        const name = buildName([
          member.firstname,
          member.middlename,
          member.lastname,
        ]);
        const role = member.relationship || "Related Contact";
        const phone = formatPhone(member.mobileNo, lead.countryCode);
        const email = member.emailAddress?.trim() || null;

        if (!name && !phone && !email) {
          return null;
        }

        return {
          id: member.id,
          name: name || role,
          role,
          category: inferCategory(role),
          phone,
          email,
          source: "family-member" as const,
        };
      })
      .filter((entry): entry is ContactDirectoryEntry => entry !== null);

    const stateContacts: ContactDirectoryEntry[] = [];

    const spouseName = getStringValue(stateSources, [
      "spouseName",
      "husbandName",
      "wifeName",
    ]);
    const spousePhone = getStringValue(stateSources, [
      "spousePhone",
      "husbandPhone",
      "wifePhone",
    ]);
    const closestRelativeName = getStringValue(stateSources, [
      "closestRelativeName",
      "nextOfKinName",
      "relativeName",
    ]);
    const closestRelativePhone = getStringValue(stateSources, [
      "closestRelativePhone",
      "nextOfKinPhone",
      "relativePhone",
    ]);
    const closestRelativeRelationship = getStringValue(stateSources, [
      "closestRelativeRelationship",
      "nextOfKinRelationship",
    ]);
    const guarantorName = getStringValue(stateSources, [
      "guarantorName",
      "guarantorFullName",
      "guarantor.name",
      "guarantor.fullName",
      "suretyName",
    ]);
    const guarantorPhone = getStringValue(stateSources, [
      "guarantorPhone",
      "guarantorTelephone",
      "guarantor.mobileNo",
      "suretyPhone",
    ]);
    const guarantorAddress = getStringValue(stateSources, [
      "guarantorAddress",
      "guarantor.address",
      "guarantor.residentialAddress",
      "suretyAddress",
    ]);

    if (spouseName || spousePhone) {
      stateContacts.push({
        id: "state-spouse",
        name: spouseName || "Spouse",
        role: "Spouse",
        category: "OTHER",
        phone: formatPhone(spousePhone, lead.countryCode),
        source: "state",
      });
    }

    if (closestRelativeName || closestRelativePhone) {
      stateContacts.push({
        id: "state-closest-relative",
        name: closestRelativeName || "Closest Relative",
        role: closestRelativeRelationship || "Closest Relative",
        category: "REFERENCE",
        phone: formatPhone(closestRelativePhone, lead.countryCode),
        source: "state",
      });
    }

    if (guarantorName || guarantorPhone || guarantorAddress) {
      stateContacts.push({
        id: "state-guarantor",
        name: guarantorName || "Guarantor",
        role: "Guarantor",
        category: "GUARANTOR",
        phone: formatPhone(guarantorPhone, lead.countryCode),
        address: guarantorAddress,
        source: "state",
      });
    }

    const refereeEntries = getArrayValue(stateSources, ["referees"]).map(
      (referee, index) => {
        if (!referee || typeof referee !== "object") {
          return null;
        }

        const record = referee as Record<string, unknown>;
        const name =
          typeof record.name === "string" && record.name.trim()
            ? record.name.trim()
            : null;
        const phone =
          typeof record.phone === "string" && record.phone.trim()
            ? formatPhone(record.phone.trim(), lead.countryCode)
            : null;
        const address =
          typeof record.address === "string" && record.address.trim()
            ? record.address.trim()
            : null;
        const relation =
          typeof record.relation === "string" && record.relation.trim()
            ? record.relation.trim()
            : null;
        const occupation =
          typeof record.occupation === "string" && record.occupation.trim()
            ? record.occupation.trim()
            : null;

        if (!name && !phone && !address) {
          return null;
        }

        return {
          id: `state-referee-${index}`,
          name: name || `Referee ${index + 1}`,
          role: relation ? `Referee • ${relation}` : "Referee",
          category: "REFERENCE" as const,
          phone,
          address,
          notes: occupation,
          source: "state" as const,
        };
      }
    ).filter((entry): entry is ContactDirectoryEntry => entry !== null);

    const fineractGuarantors = await getFineractGuarantors(lead.fineractLoanId);

    const contactDirectory = dedupeContactDirectory([
      ...leadContacts,
      ...fineractGuarantors,
      ...familyContacts,
      ...stateContacts,
      ...refereeEntries,
    ]).filter(
      (entry) => entry.phone || entry.email || entry.address || entry.notes
    );

    return NextResponse.json({
      communications,
      summary,
      leadInfo: {
        id: lead.id,
        name: borrowerName,
        email: lead.emailAddress,
        phone: formatPhone(lead.mobileNo, lead.countryCode),
      },
      contactDirectory,
    });
  } catch (error) {
    console.error("Error fetching lead communications:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead communications" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const body = await request.json();

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify lead exists and belongs to tenant
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
        tenantId: tenant.id,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Validate required fields
    const { type, direction, content, createdBy } = body;
    if (!type || !direction || !content || !createdBy) {
      return NextResponse.json(
        {
          error: "Missing required fields: type, direction, content, createdBy",
        },
        { status: 400 }
      );
    }

    // Create the communication record
    const communication = await prisma.leadCommunication.create({
      data: {
        leadId,
        tenantId: tenant.id,
        type,
        direction,
        subject: body.subject,
        content,
        status: body.status || "sent",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        sentAt: body.sentAt ? new Date(body.sentAt) : new Date(),
        fromEmail: body.fromEmail,
        toEmail: body.toEmail || (type === "EMAIL" ? lead.emailAddress : null),
        fromPhone: body.fromPhone,
        toPhone:
          body.toPhone ||
          (type === "SMS" || type === "CALL" ? lead.mobileNo : null),
        provider: body.provider,
        providerId: body.providerId,
        metadata: body.metadata,
        attachments: body.attachments,
        createdBy,
        assignedTo: body.assignedTo,
      },
    });

    return NextResponse.json(communication, { status: 201 });
  } catch (error) {
    console.error("Error creating lead communication:", error);
    return NextResponse.json(
      { error: "Failed to create lead communication" },
      { status: 500 }
    );
  }
}
