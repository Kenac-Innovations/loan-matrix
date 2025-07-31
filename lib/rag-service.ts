import OpenAI from "openai";
import { PrismaClient } from "@/app/generated/prisma";
import { getFineractService } from "./fineract-api";

const prisma = new PrismaClient();

export interface RAGDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  fineractId?: string;
  leadId?: string;
  tenantId?: string;
  metadata?: any;
  embedding?: number[];
}

export interface RAGSearchResult {
  document: RAGDocument;
  similarity: number;
  relevantChunk?: string;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSearchResult[];
  fineractData?: any[];
  responseTime: number;
}

export class RAGService {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private fineractService: any;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.prisma = prisma;
    this.fineractService = getFineractService(""); // Use fallback with env credentials
  }

  // Generate embeddings for text
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Store Fineract data as documents with embeddings
  async indexFineractData(): Promise<void> {
    console.log("Starting Fineract data indexing...");

    try {
      // Index clients
      console.log("Fetching clients...");
      const clientsResponse = await this.fineractService.getClients(0, 50);
      console.log("Clients response:", clientsResponse);

      // Handle different response formats
      const clients = Array.isArray(clientsResponse)
        ? clientsResponse
        : clientsResponse?.pageItems || clientsResponse?.content || [];

      console.log(`Processing ${clients.length} clients...`);
      for (const client of clients) {
        if (!client || !client.id) {
          console.warn("Skipping invalid client:", client);
          continue;
        }

        const content = this.formatClientForIndexing(client);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: client.id.toString(),
              documentType: "client",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Client: ${
              client.displayName || client.firstname + " " + client.lastname
            }`,
            content,
            documentType: "client",
            fineractId: client.id.toString(),
            metadata: client,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      // Index loan products
      console.log("Fetching loan products...");
      const loanProductsResponse = await this.fineractService.getLoanProducts();
      const loanProducts = Array.isArray(loanProductsResponse)
        ? loanProductsResponse
        : loanProductsResponse?.pageItems ||
          loanProductsResponse?.content ||
          [];

      console.log(`Processing ${loanProducts.length} loan products...`);
      for (const product of loanProducts) {
        if (!product || !product.id) {
          console.warn("Skipping invalid loan product:", product);
          continue;
        }

        const content = this.formatLoanProductForIndexing(product);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: product.id.toString(),
              documentType: "loan_product",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Loan Product: ${product.name}`,
            content,
            documentType: "loan_product",
            fineractId: product.id.toString(),
            metadata: product,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      // Index loans
      console.log("Fetching loans...");
      const loansResponse = await this.fineractService.getLoans(0, 100);
      const loans = Array.isArray(loansResponse)
        ? loansResponse
        : loansResponse?.pageItems || loansResponse?.content || [];

      console.log(`Processing ${loans.length} loans...`);
      for (const loan of loans) {
        if (!loan || !loan.id) {
          console.warn("Skipping invalid loan:", loan);
          continue;
        }

        const content = this.formatLoanForIndexing(loan);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: loan.id.toString(),
              documentType: "loan",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Loan: ${loan.accountNo} - ${
              loan.clientName || "Unknown Client"
            }`,
            content,
            documentType: "loan",
            fineractId: loan.id.toString(),
            metadata: loan,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      // Index full internal database
      await this.indexInternalDatabase();

      console.log("Fineract data indexing completed successfully");
    } catch (error) {
      console.error("Error indexing Fineract data:", error);
      throw error;
    }
  }

  // Index ALL internal database data
  async indexInternalDatabase(): Promise<void> {
    console.log("Starting full internal database indexing...");

    try {
      // Index leads data
      await this.indexLeadsData();

      // Index tenants data
      await this.indexTenantsData();

      // Index pipeline stages data
      await this.indexPipelineStagesData();

      // Index teams data
      await this.indexTeamsData();

      // Index communications data
      await this.indexCommunicationsData();

      // Index documents data
      await this.indexDocumentsData();

      // Index lookup tables data
      await this.indexLookupTablesData();

      console.log("Full internal database indexing completed successfully");
    } catch (error) {
      console.error("Error indexing internal database:", error);
      throw error;
    }
  }

  // Index internal leads data
  async indexLeadsData(): Promise<void> {
    console.log("Starting leads data indexing...");

    try {
      // Get all leads with related data
      const leads = await this.prisma.lead.findMany({
        include: {
          currentStage: true,
          familyMembers: true,
          documents: true,
          communications: true,
          stateTransitions: {
            orderBy: { triggeredAt: "desc" },
            take: 5,
          },
        },
      });

      console.log(`Processing ${leads.length} leads...`);
      for (const lead of leads) {
        const content = this.formatLeadForIndexing(lead);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: lead.id,
              documentType: "lead",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Lead: ${lead.firstname || ""} ${lead.lastname || ""} - ${
              lead.currentStage?.name || "Unknown Stage"
            }`.trim(),
            content,
            documentType: "lead",
            fineractId: lead.id,
            metadata: lead,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      console.log("Leads data indexing completed successfully");
    } catch (error) {
      console.error("Error indexing leads data:", error);
      throw error;
    }
  }

  // Index tenants data
  async indexTenantsData(): Promise<void> {
    console.log("Starting tenants data indexing...");

    try {
      const tenants = await this.prisma.tenant.findMany({
        include: {
          pipelineStages: true,
          teams: true,
          _count: {
            select: {
              leads: true,
              leadDocuments: true,
              leadCommunications: true,
            },
          },
        },
      });

      console.log(`Processing ${tenants.length} tenants...`);
      for (const tenant of tenants) {
        const content = this.formatTenantForIndexing(tenant);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: tenant.id,
              documentType: "tenant",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Tenant: ${tenant.name}`,
            content,
            documentType: "tenant",
            fineractId: tenant.id,
            metadata: tenant,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      console.log("Tenants data indexing completed successfully");
    } catch (error) {
      console.error("Error indexing tenants data:", error);
      throw error;
    }
  }

  // Index pipeline stages data
  async indexPipelineStagesData(): Promise<void> {
    console.log("Starting pipeline stages data indexing...");

    try {
      const stages = await this.prisma.pipelineStage.findMany({
        include: {
          tenant: true,
          validationRules: true,
          slaConfigs: true,
          _count: {
            select: {
              leadsInThisStage: true,
            },
          },
        },
      });

      console.log(`Processing ${stages.length} pipeline stages...`);
      for (const stage of stages) {
        const content = this.formatPipelineStageForIndexing(stage);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: stage.id,
              documentType: "pipeline_stage",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Pipeline Stage: ${stage.name} (${stage.tenant.name})`,
            content,
            documentType: "pipeline_stage",
            fineractId: stage.id,
            metadata: stage,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      console.log("Pipeline stages data indexing completed successfully");
    } catch (error) {
      console.error("Error indexing pipeline stages data:", error);
      throw error;
    }
  }

  // Index teams data
  async indexTeamsData(): Promise<void> {
    console.log("Starting teams data indexing...");

    try {
      const teams = await this.prisma.team.findMany({
        include: {
          tenant: true,
          members: true,
        },
      });

      console.log(`Processing ${teams.length} teams...`);
      for (const team of teams) {
        const content = this.formatTeamForIndexing(team);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: team.id,
              documentType: "team",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Team: ${team.name} (${team.tenant.name})`,
            content,
            documentType: "team",
            fineractId: team.id,
            metadata: team,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      console.log("Teams data indexing completed successfully");
    } catch (error) {
      console.error("Error indexing teams data:", error);
      throw error;
    }
  }

  // Index communications data
  async indexCommunicationsData(): Promise<void> {
    console.log("Starting communications data indexing...");

    try {
      const communications = await this.prisma.leadCommunication.findMany({
        include: {
          lead: true,
          tenant: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1000, // Limit to recent communications
      });

      console.log(`Processing ${communications.length} communications...`);
      for (const comm of communications) {
        const content = this.formatCommunicationForIndexing(comm);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: comm.id,
              documentType: "communication",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Communication: ${comm.type} - ${
              comm.subject || "No Subject"
            }`,
            content,
            documentType: "communication",
            fineractId: comm.id,
            metadata: comm,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      console.log("Communications data indexing completed successfully");
    } catch (error) {
      console.error("Error indexing communications data:", error);
      throw error;
    }
  }

  // Index documents data
  async indexDocumentsData(): Promise<void> {
    console.log("Starting documents data indexing...");

    try {
      const documents = await this.prisma.leadDocument.findMany({
        include: {
          lead: true,
          tenant: true,
        },
      });

      console.log(`Processing ${documents.length} documents...`);
      for (const doc of documents) {
        const content = this.formatDocumentForIndexing(doc);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: doc.id,
              documentType: "document",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Document: ${doc.name} (${doc.category})`,
            content,
            documentType: "document",
            fineractId: doc.id,
            metadata: doc,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      console.log("Documents data indexing completed successfully");
    } catch (error) {
      console.error("Error indexing documents data:", error);
      throw error;
    }
  }

  // Index lookup tables data
  async indexLookupTablesData(): Promise<void> {
    console.log("Starting lookup tables data indexing...");

    try {
      // Index offices
      const offices = await this.prisma.office.findMany();
      for (const office of offices) {
        const content = this.formatOfficeForIndexing(office);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: office.id.toString(),
              documentType: "office",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Office: ${office.name}`,
            content,
            documentType: "office",
            fineractId: office.id.toString(),
            metadata: office,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      // Index client types
      const clientTypes = await this.prisma.clientType.findMany();
      for (const clientType of clientTypes) {
        const content = this.formatClientTypeForIndexing(clientType);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: clientType.id.toString(),
              documentType: "client_type",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Client Type: ${clientType.name}`,
            content,
            documentType: "client_type",
            fineractId: clientType.id.toString(),
            metadata: clientType,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      // Index savings products
      const savingsProducts = await this.prisma.savingsProduct.findMany();
      for (const product of savingsProducts) {
        const content = this.formatSavingsProductForIndexing(product);
        const embedding = await this.generateEmbedding(content);

        await this.prisma.fineractDocument.upsert({
          where: {
            fineractId_documentType: {
              fineractId: product.id.toString(),
              documentType: "savings_product",
            },
          },
          update: {
            content,
            embedding: JSON.stringify(embedding),
            updatedAt: new Date(),
          },
          create: {
            title: `Savings Product: ${product.name}`,
            content,
            documentType: "savings_product",
            fineractId: product.id.toString(),
            metadata: product,
            embedding: JSON.stringify(embedding),
          },
        });
      }

      console.log("Lookup tables data indexing completed successfully");
    } catch (error) {
      console.error("Error indexing lookup tables data:", error);
      throw error;
    }
  }

  // Add or update a policy document
  async addPolicyDocument(
    title: string,
    content: string,
    metadata?: any
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);

      await this.prisma.fineractDocument.create({
        data: {
          title,
          content,
          documentType: "policy",
          metadata,
          embedding: JSON.stringify(embedding),
        },
      });

      console.log(`Policy document "${title}" added successfully`);
    } catch (error) {
      console.error("Error adding policy document:", error);
      throw error;
    }
  }

  // Update existing policy document
  async updatePolicyDocument(
    id: string,
    title?: string,
    content?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (title) updateData.title = title;
      if (metadata) updateData.metadata = metadata;
      if (content) {
        updateData.content = content;
        updateData.embedding = JSON.stringify(
          await this.generateEmbedding(content)
        );
      }

      await this.prisma.fineractDocument.update({
        where: { id },
        data: updateData,
      });

      console.log(`Policy document "${id}" updated successfully`);
    } catch (error) {
      console.error("Error updating policy document:", error);
      throw error;
    }
  }

  // Get all policy documents
  async getPolicyDocuments(): Promise<RAGDocument[]> {
    try {
      const documents = await this.prisma.fineractDocument.findMany({
        where: { documentType: "policy" },
        orderBy: { createdAt: "desc" },
      });

      return documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        documentType: doc.documentType,
        fineractId: doc.fineractId || undefined,
        metadata: doc.metadata,
        embedding: doc.embedding ? JSON.parse(doc.embedding) : undefined,
      }));
    } catch (error) {
      console.error("Error getting policy documents:", error);
      throw error;
    }
  }

  // Delete policy document
  async deletePolicyDocument(id: string): Promise<void> {
    try {
      await this.prisma.fineractDocument.delete({
        where: { id },
      });

      console.log(`Policy document "${id}" deleted successfully`);
    } catch (error) {
      console.error("Error deleting policy document:", error);
      throw error;
    }
  }

  // Format client data for indexing
  private formatClientForIndexing(client: any): string {
    return `
Client Information:
Name: ${client.displayName}
Account Number: ${client.accountNo}
External ID: ${client.externalId || "N/A"}
Status: ${client.status?.value || "Unknown"}
Active: ${client.active ? "Yes" : "No"}
Office: ${client.officeName}
Mobile: ${client.mobileNo || "N/A"}
Email: ${client.emailAddress || "N/A"}
Date of Birth: ${client.dateOfBirth || "N/A"}
Gender: ${client.gender?.name || "N/A"}
Client Type: ${client.clientType?.name || "N/A"}
Classification: ${client.clientClassification?.name || "N/A"}
Submitted Date: ${client.timeline?.submittedOnDate || "N/A"}
Activated Date: ${client.timeline?.activatedOnDate || "N/A"}
    `.trim();
  }

  // Format loan product data for indexing
  private formatLoanProductForIndexing(product: any): string {
    return `
Loan Product Information:
Name: ${product.name}
Short Name: ${product.shortName}
Description: ${product.description || "N/A"}
Status: ${product.status}
Currency: ${product.currency?.displayLabel || "N/A"}
Principal Range: ${product.principal?.min} - ${
      product.principal?.max
    } (Default: ${product.principal?.default})
Interest Rate Range: ${product.annualInterestRate?.min}% - ${
      product.annualInterestRate?.max
    }% (Default: ${product.annualInterestRate?.default}%)
Repayment Terms: ${product.numberOfRepayments?.min} - ${
      product.numberOfRepayments?.max
    } payments (Default: ${product.numberOfRepayments?.default})
Repayment Frequency: Every ${product.repaymentEvery} ${
      product.repaymentFrequencyType?.value || "periods"
    }
Interest Type: ${product.interestType?.value || "N/A"}
Amortization Type: ${product.amortizationType?.value || "N/A"}
    `.trim();
  }

  // Format loan data for indexing
  private formatLoanForIndexing(loan: any): string {
    return `
Loan Information:
Account Number: ${loan.accountNo}
Client: ${loan.clientName}
Product: ${loan.loanProductName}
Status: ${loan.status?.value || "Unknown"}
Principal: ${loan.currency?.displaySymbol || ""}${loan.principal}
Approved Principal: ${loan.currency?.displaySymbol || ""}${
      loan.approvedPrincipal
    }
Interest Rate: ${loan.annualInterestRate}% per annum
Term: ${loan.termFrequency} ${loan.termPeriodFrequencyType?.value || "periods"}
Repayments: ${loan.numberOfRepayments} payments every ${loan.repaymentEvery} ${
      loan.repaymentFrequencyType?.value || "periods"
    }
Outstanding Balance: ${loan.currency?.displaySymbol || ""}${
      loan.summary?.principalOutstanding || 0
    }
Total Outstanding: ${loan.currency?.displaySymbol || ""}${
      loan.summary?.totalOutstanding || 0
    }
Overdue Amount: ${loan.currency?.displaySymbol || ""}${
      loan.summary?.totalOverdue || 0
    }
Submitted Date: ${loan.timeline?.submittedOnDate || "N/A"}
Approved Date: ${loan.timeline?.approvedOnDate || "N/A"}
Disbursed Date: ${loan.timeline?.actualDisbursementDate || "N/A"}
Expected Maturity: ${loan.timeline?.expectedMaturityDate || "N/A"}
Loan Officer: ${loan.loanOfficerName || "N/A"}
    `.trim();
  }

  // Format tenant data for indexing
  private formatTenantForIndexing(tenant: any): string {
    return `
Tenant Information:
Name: ${tenant.name}
Slug: ${tenant.slug}
Domain: ${tenant.domain || "N/A"}
Active: ${tenant.isActive ? "Yes" : "No"}
Pipeline Stages: ${tenant.pipelineStages?.length || 0}
Teams: ${tenant.teams?.length || 0}
Total Leads: ${tenant._count?.leads || 0}
Total Documents: ${tenant._count?.leadDocuments || 0}
Total Communications: ${tenant._count?.leadCommunications || 0}
Settings: ${tenant.settings ? JSON.stringify(tenant.settings) : "Default"}
Created: ${new Date(tenant.createdAt).toLocaleDateString()}
Last Updated: ${new Date(tenant.updatedAt).toLocaleDateString()}
    `.trim();
  }

  // Format pipeline stage data for indexing
  private formatPipelineStageForIndexing(stage: any): string {
    return `
Pipeline Stage Information:
Name: ${stage.name}
Description: ${stage.description || "N/A"}
Tenant: ${stage.tenant.name}
Order: ${stage.order}
Color: ${stage.color}
Active: ${stage.isActive ? "Yes" : "No"}
Initial State: ${stage.isInitialState ? "Yes" : "No"}
Final State: ${stage.isFinalState ? "Yes" : "No"}
Allowed Transitions: ${stage.allowedTransitions?.join(", ") || "None"}
Current Leads: ${stage._count?.leadsInThisStage || 0}
Validation Rules: ${stage.validationRules?.length || 0}
SLA Configs: ${stage.slaConfigs?.length || 0}
Created: ${new Date(stage.createdAt).toLocaleDateString()}
Last Updated: ${new Date(stage.updatedAt).toLocaleDateString()}
    `.trim();
  }

  // Format team data for indexing
  private formatTeamForIndexing(team: any): string {
    const membersList =
      team.members?.map((m: any) => `${m.name} (${m.role})`).join(", ") ||
      "No members";

    return `
Team Information:
Name: ${team.name}
Description: ${team.description || "N/A"}
Tenant: ${team.tenant.name}
Active: ${team.isActive ? "Yes" : "No"}
Pipeline Stages: ${team.pipelineStageIds?.join(", ") || "None"}
Members: ${membersList}
Total Members: ${team.members?.length || 0}
Created: ${new Date(team.createdAt).toLocaleDateString()}
Last Updated: ${new Date(team.updatedAt).toLocaleDateString()}
    `.trim();
  }

  // Format communication data for indexing
  private formatCommunicationForIndexing(comm: any): string {
    return `
Communication Information:
Type: ${comm.type}
Direction: ${comm.direction}
Subject: ${comm.subject || "N/A"}
Content: ${comm.content}
Status: ${comm.status}
Lead: ${comm.lead?.firstname || ""} ${comm.lead?.lastname || ""}
Tenant: ${comm.tenant?.name || "N/A"}
From Email: ${comm.fromEmail || "N/A"}
To Email: ${comm.toEmail || "N/A"}
From Phone: ${comm.fromPhone || "N/A"}
To Phone: ${comm.toPhone || "N/A"}
Provider: ${comm.provider || "N/A"}
Created By: ${comm.createdBy}
Assigned To: ${comm.assignedTo || "N/A"}
Scheduled At: ${
      comm.scheduledAt ? new Date(comm.scheduledAt).toLocaleDateString() : "N/A"
    }
Sent At: ${comm.sentAt ? new Date(comm.sentAt).toLocaleDateString() : "N/A"}
Created: ${new Date(comm.createdAt).toLocaleDateString()}
    `.trim();
  }

  // Format document data for indexing
  private formatDocumentForIndexing(doc: any): string {
    return `
Document Information:
Name: ${doc.name}
Original Name: ${doc.originalName}
Type: ${doc.type}
Category: ${doc.category}
Status: ${doc.status}
Size: ${doc.size} bytes
MIME Type: ${doc.mimeType || "N/A"}
Lead: ${doc.lead?.firstname || ""} ${doc.lead?.lastname || ""}
Tenant: ${doc.tenant?.name || "N/A"}
Uploaded By: ${doc.uploadedBy}
Verified By: ${doc.verifiedBy || "Not verified"}
Verified At: ${
      doc.verifiedAt
        ? new Date(doc.verifiedAt).toLocaleDateString()
        : "Not verified"
    }
Notes: ${doc.notes || "No notes"}
File Path: ${doc.filePath || "N/A"}
Created: ${new Date(doc.createdAt).toLocaleDateString()}
Last Updated: ${new Date(doc.updatedAt).toLocaleDateString()}
    `.trim();
  }

  // Format office data for indexing
  private formatOfficeForIndexing(office: any): string {
    return `
Office Information:
Name: ${office.name}
Description: ${office.description || "N/A"}
Created: ${new Date(office.createdAt).toLocaleDateString()}
Last Updated: ${new Date(office.updatedAt).toLocaleDateString()}
    `.trim();
  }

  // Format client type data for indexing
  private formatClientTypeForIndexing(clientType: any): string {
    return `
Client Type Information:
Name: ${clientType.name}
Description: ${clientType.description || "N/A"}
Created: ${new Date(clientType.createdAt).toLocaleDateString()}
Last Updated: ${new Date(clientType.updatedAt).toLocaleDateString()}
    `.trim();
  }

  // Format savings product data for indexing
  private formatSavingsProductForIndexing(product: any): string {
    return `
Savings Product Information:
Name: ${product.name}
Description: ${product.description || "N/A"}
Interest Rate: ${product.interestRate}%
Minimum Balance: $${product.minBalance.toLocaleString()}
Created: ${new Date(product.createdAt).toLocaleDateString()}
Last Updated: ${new Date(product.updatedAt).toLocaleDateString()}
    `.trim();
  }

  // Format lead data for indexing
  private formatLeadForIndexing(lead: any): string {
    const familyMembersText =
      lead.familyMembers?.length > 0
        ? lead.familyMembers
            .map(
              (fm: any) => `${fm.firstname} ${fm.lastname} (${fm.relationship})`
            )
            .join(", ")
        : "None";

    const documentsText =
      lead.documents?.length > 0
        ? lead.documents
            .map((doc: any) => `${doc.name} (${doc.category}) - ${doc.status}`)
            .join(", ")
        : "None";

    const communicationsText =
      lead.communications?.length > 0
        ? lead.communications
            .slice(0, 3)
            .map(
              (comm: any) =>
                `${comm.type}: ${
                  comm.subject || comm.content.substring(0, 50)
                }...`
            )
            .join("; ")
        : "None";

    const transitionsText =
      lead.stateTransitions?.length > 0
        ? lead.stateTransitions
            .slice(0, 3)
            .map(
              (trans: any) =>
                `${trans.event} (${new Date(
                  trans.triggeredAt
                ).toLocaleDateString()})`
            )
            .join("; ")
        : "None";

    return `
Lead Information:
Name: ${lead.firstname || ""} ${lead.middlename || ""} ${lead.lastname || ""}
External ID: ${lead.externalId || "N/A"}
Status: ${lead.status}
Current Stage: ${lead.currentStage?.name || "Unknown"}
Mobile: ${lead.mobileNo || "N/A"}
Email: ${lead.emailAddress || "N/A"}
Date of Birth: ${
      lead.dateOfBirth ? new Date(lead.dateOfBirth).toLocaleDateString() : "N/A"
    }
Gender: ${lead.gender || "N/A"}
Employment Status: ${lead.employmentStatus || "N/A"}
Employer: ${lead.employerName || "N/A"}
Annual Income: ${
      lead.annualIncome ? `$${lead.annualIncome.toLocaleString()}` : "N/A"
    }
Monthly Income: ${
      lead.monthlyIncome ? `$${lead.monthlyIncome.toLocaleString()}` : "N/A"
    }
Monthly Expenses: ${
      lead.monthlyExpenses ? `$${lead.monthlyExpenses.toLocaleString()}` : "N/A"
    }
Credit Score: ${lead.creditScore || "N/A"}
Risk Score: ${lead.riskScore || "N/A"}
Risk Category: ${lead.riskCategory || "N/A"}
Requested Amount: ${
      lead.requestedAmount ? `$${lead.requestedAmount.toLocaleString()}` : "N/A"
    }
Loan Purpose: ${lead.loanPurpose || "N/A"}
Loan Term: ${lead.loanTerm ? `${lead.loanTerm} months` : "N/A"}
Property Ownership: ${lead.propertyOwnership || "N/A"}
Existing Loans: ${lead.existingLoans || 0}
Total Debt: ${lead.totalDebt ? `$${lead.totalDebt.toLocaleString()}` : "N/A"}
Bank: ${lead.bankName || "N/A"}
Family Members: ${familyMembersText}
Documents: ${documentsText}
Recent Communications: ${communicationsText}
Recent State Transitions: ${transitionsText}
Created: ${new Date(lead.createdAt).toLocaleDateString()}
Last Updated: ${new Date(lead.updatedAt).toLocaleDateString()}
    `.trim();
  }

  // Search for relevant documents
  async searchDocuments(query: string, limit = 5): Promise<RAGSearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      // Get all documents with embeddings
      const documents = await this.prisma.fineractDocument.findMany({
        where: {
          embedding: {
            not: null,
          },
        },
      });

      // Calculate similarities
      const results: RAGSearchResult[] = [];

      for (const doc of documents) {
        if (doc.embedding) {
          const docEmbedding = JSON.parse(doc.embedding);
          const similarity = this.cosineSimilarity(
            queryEmbedding,
            docEmbedding
          );

          if (similarity > 0.7) {
            // Threshold for relevance
            results.push({
              document: {
                id: doc.id,
                title: doc.title,
                content: doc.content,
                documentType: doc.documentType,
                fineractId: doc.fineractId || undefined,
                metadata: doc.metadata,
              },
              similarity,
            });
          }
        }
      }

      // Sort by similarity and return top results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error("Error searching documents:", error);
      throw error;
    }
  }

  // Get real-time Fineract data based on query intent
  async getFineractData(query: string): Promise<any[]> {
    const lowerQuery = query.toLowerCase();
    const fineractData: any[] = [];

    try {
      // Client-related queries
      if (lowerQuery.includes("client") || lowerQuery.includes("customer")) {
        if (lowerQuery.includes("overdue") || lowerQuery.includes("late")) {
          const overdueLoansResponse =
            await this.fineractService.getOverdueLoans();
          const overdueLoans = Array.isArray(overdueLoansResponse)
            ? overdueLoansResponse
            : overdueLoansResponse?.pageItems ||
              overdueLoansResponse?.content ||
              [];
          fineractData.push(...overdueLoans);
        } else {
          const clientsResponse = await this.fineractService.getClients(0, 10);
          const clients = Array.isArray(clientsResponse)
            ? clientsResponse
            : clientsResponse?.pageItems || clientsResponse?.content || [];
          fineractData.push(...clients);
        }
      }

      // Loan-related queries
      if (lowerQuery.includes("loan") || lowerQuery.includes("credit")) {
        if (lowerQuery.includes("product")) {
          const loanProductsResponse =
            await this.fineractService.getLoanProducts();
          const loanProducts = Array.isArray(loanProductsResponse)
            ? loanProductsResponse
            : loanProductsResponse?.pageItems ||
              loanProductsResponse?.content ||
              [];
          fineractData.push(...loanProducts);
        } else if (
          lowerQuery.includes("overdue") ||
          lowerQuery.includes("late")
        ) {
          const overdueLoansResponse =
            await this.fineractService.getOverdueLoans();
          const overdueLoans = Array.isArray(overdueLoansResponse)
            ? overdueLoansResponse
            : overdueLoansResponse?.pageItems ||
              overdueLoansResponse?.content ||
              [];
          fineractData.push(...overdueLoans);
        } else {
          const loansResponse = await this.fineractService.getLoans(0, 10);
          const loans = Array.isArray(loansResponse)
            ? loansResponse
            : loansResponse?.pageItems || loansResponse?.content || [];
          fineractData.push(...loans);
        }
      }

      // Interest rate queries
      if (lowerQuery.includes("interest") || lowerQuery.includes("rate")) {
        const loanProductsResponse =
          await this.fineractService.getLoanProducts();
        const loanProducts = Array.isArray(loanProductsResponse)
          ? loanProductsResponse
          : loanProductsResponse?.pageItems ||
            loanProductsResponse?.content ||
            [];
        fineractData.push(...loanProducts);
      }

      // Portfolio/summary queries
      if (
        lowerQuery.includes("portfolio") ||
        lowerQuery.includes("summary") ||
        lowerQuery.includes("report")
      ) {
        const portfolioSummary =
          await this.fineractService.getPortfolioSummary();
        // Portfolio summary might be a single object, not an array
        if (portfolioSummary) {
          fineractData.push(portfolioSummary);
        }
      }

      return fineractData;
    } catch (error) {
      console.error("Error fetching Fineract data:", error);
      return [];
    }
  }

  // Generate AI response using RAG
  async generateResponse(query: string, userId: string): Promise<RAGResponse> {
    const startTime = Date.now();

    try {
      // Search for relevant documents
      const searchResults = await this.searchDocuments(query);

      // Get real-time Fineract data
      const fineractData = await this.getFineractData(query);

      // Generate business analytics if query is about pipeline efficiency or performance
      const businessAnalytics = await this.generateBusinessAnalytics(query);

      // Prepare context for the AI
      const context = this.prepareContext(
        searchResults,
        fineractData,
        businessAnalytics
      );

      // Generate response using OpenAI
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a business intelligence AI assistant for a loan management system. 
            You provide actionable insights for business users, not just technical data.
            
            When answering business questions:
            1. Start with a clear executive summary
            2. Provide specific metrics and KPIs
            3. Include actionable recommendations
            4. Use business language, not technical jargon
            5. When analytics data is available, reference specific charts and metrics
            6. Focus on business impact and outcomes
            
            For pipeline efficiency questions, always include:
            - Conversion rates between stages
            - Average time in each stage
            - Bottlenecks and recommendations
            - Performance trends
            
            Format responses for business stakeholders who need actionable insights.`,
          },
          {
            role: "user",
            content: `Query: ${query}
            
            Context:
            ${context}
            
            Please provide a business-focused answer with actionable insights and recommendations.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      const answer =
        completion.choices[0]?.message?.content ||
        "I couldn't generate a response.";
      const responseTime = Date.now() - startTime;

      // Log the query
      await this.logQuery(userId, query, fineractData, answer, responseTime);

      return {
        answer,
        sources: searchResults,
        fineractData: [
          ...fineractData,
          ...(businessAnalytics ? [businessAnalytics] : []),
        ],
        responseTime,
      };
    } catch (error) {
      console.error("Error generating RAG response:", error);
      throw error;
    }
  }

  // Generate business analytics for pipeline and performance queries
  async generateBusinessAnalytics(query: string): Promise<any | null> {
    const lowerQuery = query.toLowerCase();

    // Check if query is about pipeline efficiency, performance, or analytics
    if (
      lowerQuery.includes("pipeline") ||
      lowerQuery.includes("efficient") ||
      lowerQuery.includes("performance") ||
      lowerQuery.includes("conversion") ||
      lowerQuery.includes("bottleneck") ||
      lowerQuery.includes("analytics")
    ) {
      try {
        // Get pipeline analytics
        const pipelineAnalytics = await this.calculatePipelineAnalytics();
        return {
          type: "business_analytics",
          data: pipelineAnalytics,
        };
      } catch (error) {
        console.error("Error generating business analytics:", error);
        return null;
      }
    }

    return null;
  }

  // Calculate comprehensive pipeline analytics
  async calculatePipelineAnalytics(): Promise<any> {
    try {
      // Get all leads with stage transitions
      const leads = await this.prisma.lead.findMany({
        include: {
          currentStage: true,
          stateTransitions: {
            orderBy: { triggeredAt: "asc" },
          },
        },
      });

      // Get all pipeline stages
      const stages = await this.prisma.pipelineStage.findMany({
        orderBy: { order: "asc" },
      });

      // Calculate stage distribution
      const stageDistribution = stages.map((stage) => ({
        stage: stage.name,
        count: leads.filter((lead) => lead.currentStageId === stage.id).length,
        percentage:
          Math.round(
            (leads.filter((lead) => lead.currentStageId === stage.id).length /
              leads.length) *
              100
          ) || 0,
      }));

      // Calculate conversion rates between stages
      const conversionRates = [];
      for (let i = 0; i < stages.length - 1; i++) {
        const currentStage = stages[i];
        const nextStage = stages[i + 1];

        const leadsInCurrent = leads.filter((lead) =>
          lead.stateTransitions.some((t) => t.toStageId === currentStage.id)
        ).length;

        const leadsMovedToNext = leads.filter((lead) =>
          lead.stateTransitions.some(
            (t) =>
              t.fromStageId === currentStage.id && t.toStageId === nextStage.id
          )
        ).length;

        const conversionRate =
          leadsInCurrent > 0
            ? Math.round((leadsMovedToNext / leadsInCurrent) * 100)
            : 0;

        conversionRates.push({
          from: currentStage.name,
          to: nextStage.name,
          rate: conversionRate,
          converted: leadsMovedToNext,
          total: leadsInCurrent,
        });
      }

      // Calculate average time in each stage
      const stageTimings = stages.map((stage) => {
        const stageTransitions = leads.flatMap((lead) =>
          lead.stateTransitions.filter((t) => t.toStageId === stage.id)
        );

        const stageDurations = stageTransitions
          .map((transition) => {
            const lead = leads.find((l) => l.id === transition.leadId);
            if (!lead) return 0;

            const nextTransition = lead.stateTransitions.find(
              (t) =>
                t.fromStageId === stage.id &&
                t.triggeredAt > transition.triggeredAt
            );

            if (nextTransition) {
              return Math.round(
                (new Date(nextTransition.triggeredAt).getTime() -
                  new Date(transition.triggeredAt).getTime()) /
                  (1000 * 60 * 60 * 24)
              );
            }

            // If still in this stage, calculate time from transition to now
            if (lead.currentStageId === stage.id) {
              return Math.round(
                (new Date().getTime() -
                  new Date(transition.triggeredAt).getTime()) /
                  (1000 * 60 * 60 * 24)
              );
            }

            return 0;
          })
          .filter((duration) => duration > 0);

        const avgDuration =
          stageDurations.length > 0
            ? Math.round(
                stageDurations.reduce((sum, d) => sum + d, 0) /
                  stageDurations.length
              )
            : 0;

        return {
          stage: stage.name,
          averageDays: avgDuration,
          leadsProcessed: stageDurations.length,
        };
      });

      // Calculate overall pipeline metrics
      const totalLeads = leads.length;
      const completedLeads = leads.filter(
        (lead) => lead.currentStage?.isFinalState
      ).length;

      const overallConversionRate =
        totalLeads > 0 ? Math.round((completedLeads / totalLeads) * 100) : 0;

      // Calculate average pipeline duration
      const completedLeadDurations = leads
        .filter((lead) => lead.currentStage?.isFinalState)
        .map((lead) => {
          const firstTransition = lead.stateTransitions[0];
          const lastTransition =
            lead.stateTransitions[lead.stateTransitions.length - 1];

          if (firstTransition && lastTransition) {
            return Math.round(
              (new Date(lastTransition.triggeredAt).getTime() -
                new Date(firstTransition.triggeredAt).getTime()) /
                (1000 * 60 * 60 * 24)
            );
          }
          return 0;
        })
        .filter((duration) => duration > 0);

      const avgPipelineDuration =
        completedLeadDurations.length > 0
          ? Math.round(
              completedLeadDurations.reduce((sum, d) => sum + d, 0) /
                completedLeadDurations.length
            )
          : 0;

      // Identify bottlenecks (stages with longest average duration)
      const bottlenecks = stageTimings
        .filter((timing) => timing.averageDays > 0)
        .sort((a, b) => b.averageDays - a.averageDays)
        .slice(0, 3);

      // Recent performance (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentLeads = leads.filter(
        (lead) => new Date(lead.createdAt) >= thirtyDaysAgo
      );

      const recentCompletedLeads = recentLeads.filter(
        (lead) => lead.currentStage?.isFinalState
      );

      return {
        summary: {
          totalLeads,
          completedLeads,
          overallConversionRate,
          avgPipelineDuration,
          recentLeads: recentLeads.length,
          recentCompletedLeads: recentCompletedLeads.length,
        },
        stageDistribution,
        conversionRates,
        stageTimings,
        bottlenecks,
        chartData: {
          stageDistributionChart: {
            type: "pie",
            data: stageDistribution.map((s) => ({
              name: s.stage,
              value: s.count,
            })),
          },
          conversionFunnelChart: {
            type: "funnel",
            data: conversionRates.map((c) => ({
              stage: c.from,
              value: c.total,
              converted: c.converted,
              rate: c.rate,
            })),
          },
          stageTimingChart: {
            type: "bar",
            data: stageTimings.map((t) => ({
              stage: t.stage,
              days: t.averageDays,
            })),
          },
        },
      };
    } catch (error) {
      console.error("Error calculating pipeline analytics:", error);
      throw error;
    }
  }

  // Prepare context for AI from search results and Fineract data
  private prepareContext(
    searchResults: RAGSearchResult[],
    fineractData: any[],
    businessAnalytics?: any
  ): string {
    let context = "";

    // Add search results
    if (searchResults.length > 0) {
      context += "Relevant Documents:\n";
      searchResults.forEach((result, index) => {
        context += `${index + 1}. ${result.document.title}\n`;
        context += `${result.document.content}\n\n`;
      });
    }

    // Add real-time Fineract data
    if (fineractData.length > 0) {
      context += "Current Fineract Data:\n";
      fineractData.forEach((data, index) => {
        context += `${index + 1}. ${JSON.stringify(data, null, 2)}\n\n`;
      });
    }

    // Add business analytics if available
    if (businessAnalytics) {
      context += "Business Analytics:\n";
      context += `${JSON.stringify(businessAnalytics, null, 2)}\n\n`;
    }

    return context;
  }

  // Log query for analytics
  private async logQuery(
    userId: string,
    query: string,
    fineractData: any[],
    response: string,
    responseTime: number
  ): Promise<void> {
    try {
      await this.prisma.queryLog.create({
        data: {
          userId,
          userQuery: query,
          fineractDataUsed: fineractData,
          response,
          responseTime,
        },
      });
    } catch (error) {
      console.error("Error logging query:", error);
    }
  }

  // Clean up expired cache entries
  async cleanupExpiredCache(): Promise<void> {
    try {
      await this.prisma.fineractDataCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
    } catch (error) {
      console.error("Error cleaning up expired cache:", error);
    }
  }

  // Get indexing statistics
  async getIndexingStats(): Promise<any> {
    try {
      const stats = await this.prisma.fineractDocument.groupBy({
        by: ["documentType"],
        _count: {
          id: true,
        },
      });

      const totalDocuments = await this.prisma.fineractDocument.count();
      const documentsWithEmbeddings = await this.prisma.fineractDocument.count({
        where: {
          embedding: {
            not: null,
          },
        },
      });

      const lastIndexed = await this.prisma.fineractDocument.findFirst({
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          updatedAt: true,
        },
      });

      return {
        totalDocuments,
        documentsWithEmbeddings,
        documentsByType: stats.reduce((acc, stat) => {
          acc[stat.documentType] = stat._count.id;
          return acc;
        }, {} as Record<string, number>),
        lastIndexed: lastIndexed?.updatedAt || null,
        indexingProgress:
          totalDocuments > 0
            ? (documentsWithEmbeddings / totalDocuments) * 100
            : 0,
      };
    } catch (error) {
      console.error("Error getting indexing stats:", error);
      throw error;
    }
  }
}

// Singleton instance
let ragService: RAGService | null = null;

export function getRAGService(): RAGService {
  if (!ragService) {
    ragService = new RAGService();
  }
  return ragService;
}
