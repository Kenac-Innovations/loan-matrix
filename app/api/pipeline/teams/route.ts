import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantBySlug,
  getOrCreateDefaultTenant,
  extractTenantSlugFromRequest,
} from "@/lib/tenant-service";

/**
 * GET /api/pipeline/teams
 * Fetches all teams for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    let tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      tenant = await getOrCreateDefaultTenant();
    }

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch teams with members
    const teams = await prisma.team.findMany({
      where: {
        tenantId: tenant.id,
      },
      include: {
        members: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Fetch pipeline stages for mapping IDs to names
    const stages = await prisma.pipelineStage.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { order: "asc" },
    });

    const stageMap = new Map(stages.map((s) => [s.id, s.name]));

    // Transform to frontend format
    const transformedTeams = teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description || "",
      pipelineStages: (team.pipelineStageIds || []).map(
        (id) => stageMap.get(id) || id
      ),
      pipelineStageIds: team.pipelineStageIds || [],
      assignmentStrategy: team.assignmentStrategy || "round_robin",
      assignmentConfig: team.assignmentConfig || {},
      members: team.members.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.name,
        email: member.email,
        role: member.role,
        approvalLimit: member.approvalLimit ?? null,
      })),
    }));

    return NextResponse.json({
      teams: transformedTeams,
      stages: stages.map((s) => ({ id: s.id, name: s.name })),
    });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pipeline/teams
 * Updates all teams for the current tenant
 */
export async function PUT(request: NextRequest) {
  try {
    const { teams } = await request.json();

    if (!teams || !Array.isArray(teams)) {
      return NextResponse.json(
        { error: "Teams array is required" },
        { status: 400 }
      );
    }

    const tenantSlug = extractTenantSlugFromRequest(request);
    let tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      tenant = await getOrCreateDefaultTenant();
    }

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get pipeline stages for name to ID mapping
    const stages = await prisma.pipelineStage.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
    });
    const stageNameToId = new Map(stages.map((s) => [s.name, s.id]));

    await prisma.$transaction(async (tx) => {
      // Get existing teams
      const existingTeams = await tx.team.findMany({
        where: { tenantId: tenant!.id },
        include: { members: true },
      });

      const existingIds = existingTeams.map((t) => t.id);
      const incomingIds = teams
        .filter(
          (t: any) => !t.id.startsWith("new-") && !String(t.id).match(/^\d+$/)
        )
        .map((t: any) => t.id);

      // Delete removed teams
      const teamsToDelete = existingIds.filter(
        (id) => !incomingIds.includes(id)
      );
      if (teamsToDelete.length > 0) {
        // Delete team members first
        await tx.teamMember.deleteMany({
          where: { teamId: { in: teamsToDelete } },
        });
        // Delete teams
        await tx.team.deleteMany({
          where: { id: { in: teamsToDelete } },
        });
      }

      // Create or update teams
      for (const team of teams) {
        const isNew =
          team.id.startsWith("new-") || String(team.id).match(/^\d+$/);

        // Convert stage names to IDs
        const pipelineStageIds = (team.pipelineStages || [])
          .map((name: string) => stageNameToId.get(name))
          .filter(Boolean) as string[];

        if (isNew) {
          // Create new team
          const newTeam = await tx.team.create({
            data: {
              tenantId: tenant!.id,
              name: team.name,
              description: team.description || "",
              pipelineStageIds,
              assignmentStrategy: team.assignmentStrategy || "round_robin",
              assignmentConfig: team.assignmentConfig || {},
            },
          });

          // Create team members
          for (const member of team.members || []) {
            await tx.teamMember.create({
              data: {
                teamId: newTeam.id,
                userId: member.userId,
                name: member.name,
                email: member.email,
                role: member.role || "Team Member",
                approvalLimit: member.approvalLimit ?? null,
              },
            });
          }
        } else {
          // Update existing team
          await tx.team.update({
            where: { id: team.id },
            data: {
              name: team.name,
              description: team.description || "",
              pipelineStageIds,
              assignmentStrategy: team.assignmentStrategy || "round_robin",
              assignmentConfig: team.assignmentConfig || {},
            },
          });

          // Get existing members
          const existingMembers = await tx.teamMember.findMany({
            where: { teamId: team.id },
          });

          const existingMemberIds = existingMembers.map((m) => m.id);
          const incomingMemberIds = (team.members || [])
            .filter(
              (m: any) =>
                !m.id.startsWith("new-") && !String(m.id).match(/^\d+$/)
            )
            .map((m: any) => m.id);

          // Delete removed members
          const membersToDelete = existingMemberIds.filter(
            (id) => !incomingMemberIds.includes(id)
          );
          if (membersToDelete.length > 0) {
            await tx.teamMember.deleteMany({
              where: { id: { in: membersToDelete } },
            });
          }

          // Create or update members
          for (const member of team.members || []) {
            const isNewMember =
              member.id.startsWith("new-") || String(member.id).match(/^\d+$/);

            if (isNewMember) {
              await tx.teamMember.create({
                data: {
                  teamId: team.id,
                  userId: member.userId,
                  name: member.name,
                  email: member.email,
                  role: member.role || "Team Member",
                  approvalLimit: member.approvalLimit ?? null,
                },
              });
            } else {
              await tx.teamMember.update({
                where: { id: member.id },
                data: {
                  userId: member.userId,
                  name: member.name,
                  email: member.email,
                  role: member.role || "Team Member",
                  approvalLimit: member.approvalLimit ?? null,
                },
              });
            }
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating teams:", error);
    return NextResponse.json(
      { error: "Failed to update teams" },
      { status: 500 }
    );
  }
}
