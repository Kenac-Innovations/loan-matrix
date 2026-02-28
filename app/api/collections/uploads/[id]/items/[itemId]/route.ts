import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();

    const allowedFields = [
      "loanId",
      "amount",
      "paymentTypeId",
      "paymentTypeName",
      "transactionDate",
      "accountNumber",
      "chequeNumber",
      "routingCode",
      "receiptNumber",
      "bankNumber",
      "note",
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        if (field === "transactionDate" && body[field]) {
          updateData[field] = new Date(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await prisma.bulkRepaymentItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      amount: updated.amount.toString(),
    });
  } catch (error) {
    console.error("Error updating item:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;

    await prisma.bulkRepaymentItem.delete({
      where: { id: itemId },
    });

    // Update upload total rows
    const remaining = await prisma.bulkRepaymentItem.count({
      where: { uploadId: id },
    });

    await prisma.bulkRepaymentUpload.update({
      where: { id },
      data: { totalRows: remaining },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting item:", error);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    );
  }
}
