import OpenAI from "openai";
import { PrismaClient } from "@/app/generated/prisma";
import { getFineractService } from "./fineract-api";

export interface RAGDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  fineractId?: string;
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
    this.prisma = new PrismaClient();
    this.fineractService = getFineractService();
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

      console.log("Fineract data indexing completed successfully");
    } catch (error) {
      console.error("Error indexing Fineract data:", error);
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

      // Prepare context for the AI
      const context = this.prepareContext(searchResults, fineractData);

      // Generate response using OpenAI
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a helpful AI assistant for a loan management system powered by Apache Fineract. 
            You have access to client data, loan information, loan products, and transaction history.
            
            Provide accurate, helpful responses based on the provided context. If you don't have enough information, say so.
            Always cite your sources when referencing specific data.
            
            Format your responses clearly and include relevant details like amounts, dates, and account numbers when available.`,
          },
          {
            role: "user",
            content: `Query: ${query}
            
            Context:
            ${context}
            
            Please provide a comprehensive answer based on the available information.`,
          },
        ],
        max_tokens: 1000,
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
        fineractData,
        responseTime,
      };
    } catch (error) {
      console.error("Error generating RAG response:", error);
      throw error;
    }
  }

  // Prepare context for AI from search results and Fineract data
  private prepareContext(
    searchResults: RAGSearchResult[],
    fineractData: any[]
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
