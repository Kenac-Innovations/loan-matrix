import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

export async function GET(_request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const uploads = await prisma.bulkRepaymentUpload.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json(uploads);
  } catch (error) {
    console.error("Error fetching uploads:", error);
    return NextResponse.json(
      { error: "Failed to fetch uploads" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { fileName, columnMapping, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    const existingUpload = await prisma.bulkRepaymentUpload.findFirst({
      where: {
        tenantId: tenant.id,
        fileName: fileName || "upload.csv",
        totalRows: items.length,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingUpload) {
      return NextResponse.json(
        {
          error: `A file named "${existingUpload.fileName}" with ${existingUpload.totalRows} rows was already uploaded on ${existingUpload.createdAt.toLocaleDateString()}. Please rename the file or remove the previous upload before uploading again.`,
        },
        { status: 409 }
      );
    }

    const totalAmount = items.reduce(
      (sum: number, item: any) => sum + (parseFloat(item.amount) || 0),
      0
    );

    const upload = await prisma.bulkRepaymentUpload.create({
      data: {
        tenantId: tenant.id,
        fileName: fileName || "upload.csv",
        uploadedBy: "system",
        status: "STAGING",
        totalRows: items.length,
        totalAmount,
        columnMapping: columnMapping || null,
        items: {
          create: items.map((item: any) => ({
            rowNumber: item.rowNumber,
            loanId: item.loanId,
            loanAccountNo: item.loanAccountNo || null,
            clientName: item.clientName || null,
            amount: item.amount || 0,
            paymentTypeId: item.paymentTypeId || null,
            paymentTypeName: item.paymentTypeName || null,
            accountNumber: item.accountNumber || null,
            chequeNumber: item.chequeNumber || null,
            routingCode: item.routingCode || null,
            receiptNumber: item.receiptNumber || null,
            bankNumber: item.bankNumber || null,
            note: item.note || null,
            transactionDate: item.transactionDate
              ? new Date(item.transactionDate)
              : null,
            status: "STAGED",
          })),
        },
      },
    });

    return NextResponse.json({ id: upload.id, totalRows: upload.totalRows });
  } catch (error) {
    console.error("Error creating upload:", error);
    return NextResponse.json(
      { error: "Failed to create upload" },
      { status: 500 }
    );
  }
}
