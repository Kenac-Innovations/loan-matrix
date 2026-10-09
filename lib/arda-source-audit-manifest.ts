import {
  classifyArdaSourceRecord,
  type ArdaSourceClassification,
  type ArdaSourceRecord,
} from "@/lib/arda-source-selection";

export type ArdaAuditRecord = ArdaSourceRecord & {
  id: string | number;
};

export type ArdaSourceAuditManifest = {
  generatedAt: string;
  source: {
    loanMatrixTenant: "omama";
    fineractTenant: "omama";
  };
  records: {
    inventory: Array<ArdaAuditRecord & { classification: ArdaSourceClassification }>;
    loanProducts: Array<ArdaAuditRecord & { classification: ArdaSourceClassification }>;
    contractTemplates: Array<ArdaAuditRecord & { classification: ArdaSourceClassification }>;
  };
  summary: {
    copyAllowed: number;
    reviewRequired: number;
    excluded: number;
  };
  safety: {
    sourceWriteOperations: 0;
    copyRequiresReviewApproval: true;
  };
};

function classifyRecords(records: ArdaAuditRecord[]) {
  return records.map((record) => ({
    ...record,
    classification: classifyArdaSourceRecord(record),
  }));
}

export function buildArdaSourceAuditManifest(input: {
  generatedAt?: string;
  inventory: ArdaAuditRecord[];
  loanProducts: ArdaAuditRecord[];
  contractTemplates: ArdaAuditRecord[];
}): ArdaSourceAuditManifest {
  const inventory = classifyRecords(input.inventory);
  const loanProducts = classifyRecords(input.loanProducts);
  const contractTemplates = classifyRecords(input.contractTemplates);
  const allRecords = [...inventory, ...loanProducts, ...contractTemplates];

  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    source: {
      loanMatrixTenant: "omama",
      fineractTenant: "omama",
    },
    records: { inventory, loanProducts, contractTemplates },
    summary: {
      copyAllowed: allRecords.filter(
        (record) => record.classification.kind === "automatic",
      ).length,
      reviewRequired: allRecords.filter(
        (record) => record.classification.kind === "review",
      ).length,
      excluded: allRecords.filter(
        (record) => record.classification.kind === "excluded",
      ).length,
    },
    safety: {
      sourceWriteOperations: 0,
      copyRequiresReviewApproval: true,
    },
  };
}
