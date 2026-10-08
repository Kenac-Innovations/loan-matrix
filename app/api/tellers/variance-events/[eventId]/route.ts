import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { hasFineractPermissionServer, hasSuperAdminServer } from "@/lib/authorization";
import { resolveStaffIdForFineractUser } from "@/lib/current-user-cashier";
import {
  planVarianceAction,
  authorizeVarianceAction,
  vaultAdjustmentFor,
  type VarianceAction,
} from "@/lib/cash-variance-resolution";

/**
 * GET /api/tellers/variance-events/[eventId]
 *
 * Get detailed view of a variance event including session summary and audit logs.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const params = await context.params;
    const { eventId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the variance event with all related data using findFirst
    const event = await prisma.cashVarianceEvent.findFirst({
      where: { id: eventId, tenantId: tenant.id },
      include: {
        cashier: {
          select: {
            id: true,
            staffId: true,
            staffName: true,
            tellerId: true,
            teller: {
              select: {
                id: true,
                name: true,
                officeId: true,
                officeName: true,
              },
            },
          },
        },
        session: {
          select: {
            id: true,
            declaredAmount: true,
            managerCountedAmount: true,
            closureInitiatedBy: true,
            closedBy: true,
            closedAt: true,
          },
        },
        logs: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            action: true,
            fromStatus: true,
            toStatus: true,
            notes: true,
            performedBy: true,
            createdAt: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Variance event not found" }, { status: 404 });
    }

    // Check if user can act on this variance
    const hasPermission =
      (await hasFineractPermissionServer("SETTLECASHFROMCASHIER_TELLER")) ||
      (await hasSuperAdminServer());

    const staff = await resolveStaffIdForFineractUser(session.user.userId);

    const authResult = authorizeVarianceAction({
      hasPermission,
      staff,
      eventCashierStaffId: event.cashier.staffId,
    });

    const canAct = authResult.ok;

    // Format response
    return NextResponse.json({
      event: {
        id: event.id,
        type: event.type,
        amount: event.amount,
        currency: event.currency,
        status: event.status,
        businessDate: event.businessDate.toISOString().split("T")[0],
        expectedBalance: event.expectedBalance,
        countedAmount: event.countedAmount,
        raisedAt: event.raisedAt.toISOString(),
        raisedBy: event.raisedBy,
        resolutionType: event.resolutionType,
        resolvedAt: event.resolvedAt ? event.resolvedAt.toISOString() : null,
        resolvedBy: event.resolvedBy,
        resolutionNotes: event.resolutionNotes,
        cashier: {
          id: event.cashier.id,
          staffId: event.cashier.staffId,
          staffName: event.cashier.staffName,
        },
        teller: {
          id: event.cashier.teller.id,
          name: event.cashier.teller.name,
        },
        officeId: event.officeId,
        officeName: event.cashier.teller.officeName,
        sessionId: event.sessionId,
      },
      session: {
        declaredAmount: event.session.declaredAmount,
        managerCountedAmount: event.session.managerCountedAmount,
        closureInitiatedBy: event.session.closureInitiatedBy,
        closedBy: event.session.closedBy,
        closedAt: event.session.closedAt ? event.session.closedAt.toISOString() : null,
      },
      logs: event.logs.map((log) => ({
        id: log.id,
        action: log.action,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        notes: log.notes,
        performedBy: log.performedBy,
        createdAt: log.createdAt.toISOString(),
      })),
      canAct,
    });
  } catch (error) {
    console.error("Error fetching variance event detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch variance event" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tellers/variance-events/[eventId]
 *
 * Execute a variance action (start-review, add-note, resolve, reopen).
 *
 * Body:
 * - action: "start-review" | "add-note" | "resolve" | "reopen"
 * - resolutionType?: string (required for resolve)
 * - notes?: string (required for add-note, resolve, reopen)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const params = await context.params;
    const { eventId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actorId = session.user.id;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { action, resolutionType, notes } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // Validate notes if present: must be a string
    if (notes !== undefined && typeof notes !== "string") {
      return NextResponse.json(
        { error: "notes must be a string" },
        { status: 400 }
      );
    }

    // Fetch the current variance event using findFirst
    const event = await prisma.cashVarianceEvent.findFirst({
      where: { id: eventId, tenantId: tenant.id },
      include: {
        cashier: {
          select: {
            id: true,
            staffId: true,
            staffName: true,
            tellerId: true,
            teller: {
              select: {
                id: true,
                name: true,
                officeId: true,
                officeName: true,
              },
            },
          },
        },
        session: {
          select: {
            id: true,
            declaredAmount: true,
            managerCountedAmount: true,
            closureInitiatedBy: true,
            closedBy: true,
            closedAt: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Variance event not found" }, { status: 404 });
    }

    // Check authorization
    const hasPermission =
      (await hasFineractPermissionServer("SETTLECASHFROMCASHIER_TELLER")) ||
      (await hasSuperAdminServer());

    const staff = await resolveStaffIdForFineractUser(session.user.userId);

    const authResult = authorizeVarianceAction({
      hasPermission,
      staff,
      eventCashierStaffId: event.cashier.staffId,
    });

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    // Plan the action
    const plan = planVarianceAction({
      status: event.status,
      action: action as VarianceAction,
      varianceType: event.type,
      resolutionType,
      notes,
    });

    if (!plan.ok) {
      return NextResponse.json(
        { error: plan.error, code: plan.code },
        { status: plan.status }
      );
    }

    // Execute the action in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let vaultAllocationIdForEvent: string | null = null;
      let vaultAdjustmentAmount: number | null = null;

      // For add-note, verify event exists; for others, update status
      if (plan.logAction === "NOTE_ADDED") {
        // Verify event still exists using findFirst
        const existing = await tx.cashVarianceEvent.findFirst({
          where: { id: eventId, tenantId: tenant.id },
        });
        if (!existing) {
          throw new Error("Variance event not found");
        }
      } else if (plan.logAction === "RESOLVED") {
        // Update status for RESOLVED
        const updated = await tx.cashVarianceEvent.updateMany({
          where: { id: eventId, tenantId: tenant.id, status: plan.fromStatus },
          data: {
            status: plan.toStatus,
            resolutionType: plan.resolutionType,
            resolutionNotes: plan.notes,
            resolvedBy: actorId,
            resolvedAt: new Date(),
          },
        });

        if (updated.count !== 1) {
          throw new Error("VARIANCE_STATE_CONFLICT");
        }

        // Create vault allocation if needed and store its ID
        const adjustment = vaultAdjustmentFor(
          event.type,
          plan.resolutionType!,
          event.amount
        );

        vaultAdjustmentAmount = adjustment;

        if (adjustment !== 0) {
          const allocation = await tx.cashAllocation.create({
            data: {
              tenantId: tenant.id,
              tellerId: event.tellerId,
              cashierId: null, // Vault allocation
              amount: adjustment,
              currency: event.currency,
              allocatedBy: actorId,
              status: "ACTIVE",
              notes: `Variance ${event.type.toLowerCase()} ${plan.resolutionType} — event ${eventId}`,
            },
          });
          vaultAllocationIdForEvent = allocation.id;
        }

        // Update event with vault allocation ID
        if (vaultAllocationIdForEvent) {
          await tx.cashVarianceEvent.update({
            where: { id: eventId },
            data: { vaultAllocationId: vaultAllocationIdForEvent },
          });
        }
      } else if (plan.logAction === "REOPENED") {
        // Guard the updateMany with resolutionType and vaultAllocationId checks
        const updated = await tx.cashVarianceEvent.updateMany({
          where: {
            id: eventId,
            tenantId: tenant.id,
            status: plan.fromStatus,
            resolutionType: event.resolutionType,
            vaultAllocationId: event.vaultAllocationId,
          },
          data: {
            status: plan.toStatus,
            resolutionType: null,
            resolutionNotes: null,
            resolvedBy: null,
            resolvedAt: null,
            vaultAllocationId: null,
          },
        });

        if (updated.count !== 1) {
          throw new Error("VARIANCE_STATE_CONFLICT");
        }

        // If event.vaultAllocationId is set, reverse it
        if (event.vaultAllocationId) {
          const reversed = await tx.cashAllocation.updateMany({
            where: {
              id: event.vaultAllocationId,
              tenantId: tenant.id,
              status: "ACTIVE",
            },
            data: { status: "REVERSED" },
          });

          if (reversed.count === 1) {
            // Store the reversal adjustment (negative of original)
            const originalAdjustment = vaultAdjustmentFor(
              event.type,
              event.resolutionType!,
              event.amount
            );
            vaultAdjustmentAmount = -originalAdjustment;
          } else {
            vaultAdjustmentAmount = null;
          }
        }
      } else {
        // For STATUS_CHANGED (start-review), just update status
        const updated = await tx.cashVarianceEvent.updateMany({
          where: { id: eventId, tenantId: tenant.id, status: plan.fromStatus },
          data: { status: plan.toStatus },
        });

        if (updated.count !== 1) {
          throw new Error("VARIANCE_STATE_CONFLICT");
        }
      }

      // Create audit log with resolution type always recorded
      await tx.cashVarianceEventLog.create({
        data: {
          tenantId: tenant.id,
          eventId,
          action: plan.logAction,
          fromStatus: plan.logAction !== "NOTE_ADDED" ? plan.fromStatus : null,
          toStatus: plan.logAction !== "NOTE_ADDED" ? plan.toStatus : null,
          notes: plan.notes,
          resolutionType: plan.resolutionType || event.resolutionType || null,
          vaultAdjustment: vaultAdjustmentAmount,
          vaultAllocationId: vaultAllocationIdForEvent || (plan.logAction === "REOPENED" ? event.vaultAllocationId : null),
          performedBy: actorId,
        },
      });

      return true;
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to update variance event" },
        { status: 500 }
      );
    }

    // Fetch updated event with all related data using findFirst
    const updatedEvent = await prisma.cashVarianceEvent.findFirst({
      where: { id: eventId, tenantId: tenant.id },
      include: {
        cashier: {
          select: {
            id: true,
            staffId: true,
            staffName: true,
            tellerId: true,
            teller: {
              select: {
                id: true,
                name: true,
                officeId: true,
                officeName: true,
              },
            },
          },
        },
        session: {
          select: {
            id: true,
            declaredAmount: true,
            managerCountedAmount: true,
            closureInitiatedBy: true,
            closedBy: true,
            closedAt: true,
          },
        },
        logs: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            action: true,
            fromStatus: true,
            toStatus: true,
            notes: true,
            performedBy: true,
            createdAt: true,
          },
        },
      },
    });

    if (!updatedEvent) {
      return NextResponse.json({ error: "Failed to fetch updated event" }, { status: 500 });
    }

    return NextResponse.json({
      event: {
        id: updatedEvent.id,
        type: updatedEvent.type,
        amount: updatedEvent.amount,
        currency: updatedEvent.currency,
        status: updatedEvent.status,
        businessDate: updatedEvent.businessDate.toISOString().split("T")[0],
        expectedBalance: updatedEvent.expectedBalance,
        countedAmount: updatedEvent.countedAmount,
        raisedAt: updatedEvent.raisedAt.toISOString(),
        raisedBy: updatedEvent.raisedBy,
        resolutionType: updatedEvent.resolutionType,
        resolvedAt: updatedEvent.resolvedAt ? updatedEvent.resolvedAt.toISOString() : null,
        resolvedBy: updatedEvent.resolvedBy,
        resolutionNotes: updatedEvent.resolutionNotes,
        cashier: {
          id: updatedEvent.cashier.id,
          staffId: updatedEvent.cashier.staffId,
          staffName: updatedEvent.cashier.staffName,
        },
        teller: {
          id: updatedEvent.cashier.teller.id,
          name: updatedEvent.cashier.teller.name,
        },
        officeId: updatedEvent.officeId,
        officeName: updatedEvent.cashier.teller.officeName,
        sessionId: updatedEvent.sessionId,
      },
      session: {
        declaredAmount: updatedEvent.session.declaredAmount,
        managerCountedAmount: updatedEvent.session.managerCountedAmount,
        closureInitiatedBy: updatedEvent.session.closureInitiatedBy,
        closedBy: updatedEvent.session.closedBy,
        closedAt: updatedEvent.session.closedAt ? updatedEvent.session.closedAt.toISOString() : null,
      },
      logs: updatedEvent.logs.map((log) => ({
        id: log.id,
        action: log.action,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        notes: log.notes,
        performedBy: log.performedBy,
        createdAt: log.createdAt.toISOString(),
      })),
      canAct: true,
    });
  } catch (error: unknown) {
    console.error("Error updating variance event:", error);

    if (error instanceof Error && error.message === "VARIANCE_STATE_CONFLICT") {
      return NextResponse.json(
        {
          error: "The variance event state changed; please refresh and try again",
          code: "VARIANCE_STATE_CONFLICT",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update variance event" },
      { status: 500 }
    );
  }
}
