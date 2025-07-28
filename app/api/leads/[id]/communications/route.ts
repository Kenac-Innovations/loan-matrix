import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
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

    return NextResponse.json({
      communications,
      summary,
      leadInfo: {
        id: lead.id,
        name: `${lead.firstname || ""} ${lead.lastname || ""}`.trim(),
        email: lead.emailAddress,
        phone: lead.mobileNo,
      },
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

    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
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
