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
}

export interface PolicyDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  embedding?: number[];
}

export interface IndexingStats {
  totalDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
  indexingProgress: number;
}
