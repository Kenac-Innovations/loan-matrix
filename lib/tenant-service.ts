import { prisma } from "./prisma";
import { headers } from "next/headers";
import { TenantInfo } from "@/shared/types/tenant";

/**
 * Extract tenant slug from subdomain
 * Examples:
 * - acme.localhost:3000 -> acme
 * - company.example.com -> company
 * - localhost:3000 -> default (fallback)
 */
export function extractTenantSlug(host: string): string {
  if (!host) return "goodfellow";

  // Remove port if present
  const hostWithoutPort = host.split(":")[0];

  // Handle localhost development
  if (hostWithoutPort === "localhost") {
    return "goodfellow";
  }

  // Extract subdomain
  const parts = hostWithoutPort.split(".");
  if (parts.length > 2) {
    return parts[0]; // First part is the subdomain
  }

  // If no subdomain, use default
  return "goodfellow";
}

/**
 * Get tenant information from request headers
 */
export async function getTenantFromHeaders(): Promise<TenantInfo | null> {
  const headersList = await headers();
  const host = headersList.get("host");

  if (!host) return null;

  const tenantSlug = extractTenantSlug(host);
  return await getTenantBySlug(tenantSlug);
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(
  slug: string
): Promise<TenantInfo | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        settings: true,
      },
    });

    return tenant;
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return null;
  }
}

/**
 * Get or create default tenant
 */
export async function getOrCreateDefaultTenant(): Promise<TenantInfo> {
  // Try to find goodfellow tenant first
  let tenant = await getTenantBySlug("goodfellow");

  if (!tenant) {
    // Try to find or create default tenant using upsert to avoid race conditions
    tenant = await prisma.tenant.upsert({
      where: { slug: "default" },
      update: {}, // Don't update anything if it exists
      create: {
        name: "Default Organization",
        slug: "default",
        settings: {
          theme: "default",
          features: {
            statemachine: true,
            notifications: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        settings: true,
      },
    });
  }

  return tenant as TenantInfo;
}

/**
 * Create a new tenant
 */
export async function createTenant(data: {
  name: string;
  slug: string;
  domain?: string;
  settings?: any;
}): Promise<TenantInfo> {
  const tenant = await prisma.tenant.create({
    data: {
      ...data,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      domain: true,
      settings: true,
    },
  });

  // Create default pipeline stages for the new tenant
  await createDefaultPipelineStages(tenant.id);

  return tenant;
}

/**
 * Create default pipeline stages for a tenant
 */
export async function createDefaultPipelineStages(tenantId: string) {
  const defaultStages = [
    {
      name: "New Lead",
      description: "Initial lead entry point",
      order: 1,
      color: "#3b82f6",
      isInitialState: true,
      allowedTransitions: [], // Will be updated after all stages are created
    },
    {
      name: "Approved",
      description: "Lead has been approved",
      order: 2,
      color: "#10b981",
      allowedTransitions: [],
    },
    {
      name: "Rejected",
      description: "Lead has been rejected",
      order: 3,
      color: "#ef4444",
      isFinalState: true,
      allowedTransitions: [],
    },
    {
      name: "Pending Disbursement",
      description: "Waiting for loan disbursement",
      order: 4,
      color: "#f59e0b",
      allowedTransitions: [],
    },
    {
      name: "Disbursed",
      description: "Loan has been disbursed",
      order: 5,
      color: "#10b981",
      isFinalState: true,
      allowedTransitions: [],
    },
  ];

  // Create stages
  const createdStages = await Promise.all(
    defaultStages.map((stage) =>
      prisma.pipelineStage.create({
        data: {
          ...stage,
          tenantId,
        },
      })
    )
  );

  // Update allowed transitions
  const stageMap = new Map(
    createdStages.map((stage) => [stage.name, stage.id])
  );

  const transitions = {
    "New Lead": ["Approved", "Rejected"],
    Approved: ["Pending Disbursement", "Rejected"],
    Rejected: [],
    "Pending Disbursement": ["Disbursed", "Rejected"],
    Disbursed: [],
  };

  // Update each stage with its allowed transitions
  await Promise.all(
    createdStages.map((stage) => {
      const allowedTransitionNames =
        transitions[stage.name as keyof typeof transitions] || [];
      const allowedTransitionIds = allowedTransitionNames
        .map((name) => stageMap.get(name))
        .filter(Boolean) as string[];

      return prisma.pipelineStage.update({
        where: { id: stage.id },
        data: { allowedTransitions: allowedTransitionIds },
      });
    })
  );

  return createdStages;
}

/**
 * Get all tenants
 */
export async function getAllTenants(): Promise<TenantInfo[]> {
  return await prisma.tenant.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      domain: true,
      settings: true,
    },
    orderBy: { name: "asc" },
  });
}
