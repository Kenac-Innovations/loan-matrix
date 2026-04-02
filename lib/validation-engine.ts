import { ValidationRule, ValidationResult } from "@/shared/types/validation";

export interface EvaluationContext {
  leadData: any;
  documents?: any[];
  communications?: any[];
  appraisalRows?: any[];
  appraisalHeaders?: any[];
  requiredDocuments?: any[];
}

export class ValidationEngine {
  static evaluateRule(
    rule: ValidationRule,
    leadData: any,
    documents: any[] = [],
    context?: EvaluationContext
  ): ValidationResult {
    const result: ValidationResult = {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      status: "passed",
    };

    const fullContext: EvaluationContext = context || {
      leadData,
      documents,
    };
    if (!fullContext.leadData) fullContext.leadData = leadData;
    if (!fullContext.documents) fullContext.documents = documents;

    try {
      const conditionResult = this.evaluateConditions(
        rule.conditions,
        fullContext
      );

      const actions = rule.actions && !Array.isArray(rule.actions) ? rule.actions : {} as any;
      if (conditionResult) {
        result.status = "passed";
        result.message = actions.onPass?.message || `${rule.name} passed`;
      } else {
        result.status = rule.severity === "error" ? "failed" : "warning";
        result.message = actions.onFail?.message || `${rule.name} failed`;
        result.suggestedAction = actions.onFail?.suggestedAction;
        result.actionUrl = actions.onFail?.actionUrl;
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
      result.status = "warning";
      result.message = "Unable to evaluate validation rule";
    }

    return result;
  }

  private static evaluateConditions(
    conditions: ValidationRule["conditions"],
    ctx: EvaluationContext
  ): boolean {
    const { type, rules } = conditions;

    const results = rules.map((rule) =>
      this.evaluateCondition(rule, ctx)
    );

    if (type === "AND") {
      return results.every((result) => result);
    } else if (type === "OR") {
      return results.some((result) => result);
    }

    return false;
  }

  private static evaluateCondition(
    rule: { field: string; operator: string; value?: any },
    ctx: EvaluationContext
  ): boolean {
    const { field, operator, value } = rule;
    const { leadData, documents = [], communications = [], appraisalRows = [], appraisalHeaders = [], requiredDocuments = [] } = ctx;

    if (field === "documents") {
      return this.evaluateDocumentCondition(operator, value, documents);
    }

    if (field === "requiredDocuments") {
      return this.evaluateRequiredDocumentCondition(operator, value, documents, requiredDocuments);
    }

    if (field === "communications") {
      return this.evaluateCommunicationCondition(operator, value, communications);
    }

    if (field === "appraisal") {
      return this.evaluateAppraisalCondition(operator, value, appraisalRows, leadData, appraisalHeaders);
    }

    if (field === "debtToIncomeRatio") {
      return this.evaluateDebtToIncomeRatio(operator, value, leadData);
    }

    if (field === "collateralRatio") {
      return this.evaluateCollateralRatio(operator, value, leadData);
    }

    const fieldValue = this.getFieldValue(field, leadData);

    switch (operator) {
      case "isNotEmpty":
        return (
          fieldValue != null && fieldValue !== "" && fieldValue !== undefined
        );

      case "isEmpty":
        return (
          fieldValue == null || fieldValue === "" || fieldValue === undefined
        );

      case "equals":
        return fieldValue === value;

      case "notEquals":
        return fieldValue !== value;

      case "greaterThan":
        return Number(fieldValue) > Number(value);

      case "greaterThanOrEqual":
        return Number(fieldValue) >= Number(value);

      case "lessThan":
        return Number(fieldValue) < Number(value);

      case "lessThanOrEqual":
        return Number(fieldValue) <= Number(value);

      case "contains":
        return String(fieldValue)
          .toLowerCase()
          .includes(String(value).toLowerCase());

      case "startsWith":
        return String(fieldValue)
          .toLowerCase()
          .startsWith(String(value).toLowerCase());

      case "endsWith":
        return String(fieldValue)
          .toLowerCase()
          .endsWith(String(value).toLowerCase());

      case "isValidEmail": {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(String(fieldValue));
      }

      case "isValidPhone": {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phoneRegex.test(String(fieldValue));
      }

      case "matchesPattern": {
        const regex = new RegExp(value);
        return regex.test(String(fieldValue));
      }

      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  private static evaluateDocumentCondition(
    operator: string,
    value: any,
    documents: any[]
  ): boolean {
    switch (operator) {
      case "hasMinimumCount":
        return documents.length >= Number(value);

      case "hasMaximumCount":
        return documents.length <= Number(value);

      case "hasExactCount":
        return documents.length === Number(value);

      case "hasVerifiedDocuments":
        return documents.some((doc) => doc.status === "verified");

      case "allDocumentsVerified":
        return (
          documents.length > 0 &&
          documents.every((doc) => doc.status === "verified")
        );

      case "hasDocumentType":
        return documents.some(
          (doc) => doc.type === value || doc.category === value
        );

      default:
        return false;
    }
  }

  private static evaluateRequiredDocumentCondition(
    operator: string,
    _value: any,
    documents: any[],
    requiredDocuments: any[]
  ): boolean {
    // Collect all searchable text from each document (name, fileName, description)
    const docTexts = documents.map((d: any) =>
      [d.name, d.fileName, d.description].filter(Boolean).join(" ").toLowerCase()
    );

    switch (operator) {
      case "allUploaded": {
        if (requiredDocuments.length === 0) return true;
        return requiredDocuments.every((rd) => {
          const target = rd.name.toLowerCase();
          return docTexts.some((text: string) => text.includes(target));
        });
      }

      case "anyUploaded":
        return documents.length > 0;

      default:
        return false;
    }
  }

  private static evaluateCommunicationCondition(
    operator: string,
    value: any,
    communications: any[]
  ): boolean {
    const contactPersons = communications
      .map((c: any) => (c.metadata as any)?.contactPerson)
      .filter(Boolean);

    switch (operator) {
      case "hasContactPerson":
        return contactPersons.includes(value);

      case "hasMinimumCount":
        return communications.length >= Number(value);

      case "hasAnyComms":
        return communications.length > 0;

      default:
        return false;
    }
  }

  private static isValueColumn(name: string): boolean {
    const lower = name?.toLowerCase() || "";
    return lower.includes("value") || lower.includes("amount") || lower.includes("price") || lower.includes("worth");
  }

  private static getAppraisalTotalValue(rows: any[], headers: any[]): number {
    const SYSTEM_COLS = new Set(["id", "client_id", "created_at", "updated_at"]);
    let valueIndices = headers
      .map((h: any, i: number) => this.isValueColumn(h.columnName || "") ? i : -1)
      .filter((i: number) => i >= 0);

    if (valueIndices.length === 0 && rows.length > 0) {
      valueIndices = headers
        .map((h: any, i: number) => {
          const col = (h.columnName || "").toLowerCase();
          if (SYSTEM_COLS.has(col)) return -1;
          if (col.includes("serial") || col.includes("phone") || col.includes("id") || col.includes("number")) return -1;
          const firstVal = rows[0]?.[i];
          if (firstVal != null && !isNaN(parseFloat(String(firstVal)))) return i;
          return -1;
        })
        .filter((i: number) => i >= 0);
    }

    let total = 0;
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      for (const idx of valueIndices) {
        const v = parseFloat(String(row[idx]));
        if (!isNaN(v)) total += v;
      }
    }
    return total;
  }

  private static evaluateAppraisalCondition(
    operator: string,
    value: any,
    appraisalRows: any[],
    leadData: any,
    appraisalHeaders: any[] = []
  ): boolean {
    switch (operator) {
      case "hasMinimumCount":
        return appraisalRows.length >= Number(value);

      case "hasAnyItems":
        return appraisalRows.length > 0;

      case "coverageAbove": {
        const requestedAmount = Number(leadData.requestedAmount);
        if (!requestedAmount || requestedAmount <= 0 || appraisalRows.length === 0)
          return false;
        const totalValue = this.getAppraisalTotalValue(appraisalRows, appraisalHeaders);
        return (totalValue / requestedAmount) * 100 >= Number(value);
      }

      default:
        return false;
    }
  }

  private static evaluateDebtToIncomeRatio(
    operator: string,
    value: any,
    leadData: any
  ): boolean {
    const monthlyIncome = Number(leadData.monthlyIncome);
    const totalDebt = Number(leadData.totalDebt);

    if (!monthlyIncome || !totalDebt) {
      return false;
    }

    const annualIncome = monthlyIncome * 12;
    const debtToIncomeRatio = totalDebt / annualIncome;

    switch (operator) {
      case "lessThan":
        return debtToIncomeRatio < Number(value);
      case "lessThanOrEqual":
        return debtToIncomeRatio <= Number(value);
      case "greaterThan":
        return debtToIncomeRatio > Number(value);
      case "greaterThanOrEqual":
        return debtToIncomeRatio >= Number(value);
      case "equals":
        return Math.abs(debtToIncomeRatio - Number(value)) < 0.01;
      default:
        return false;
    }
  }

  private static evaluateCollateralRatio(
    operator: string,
    value: any,
    leadData: any
  ): boolean {
    const collateralValue = Number(leadData.collateralValue);
    const requestedAmount = Number(leadData.requestedAmount);

    if (!collateralValue || !requestedAmount) {
      return false;
    }

    const collateralRatio = collateralValue / requestedAmount;

    switch (operator) {
      case "lessThan":
        return collateralRatio < Number(value);
      case "lessThanOrEqual":
        return collateralRatio <= Number(value);
      case "greaterThan":
        return collateralRatio > Number(value);
      case "greaterThanOrEqual":
        return collateralRatio >= Number(value);
      case "equals":
        return Math.abs(collateralRatio - Number(value)) < 0.01;
      default:
        return false;
    }
  }

  private static getFieldValue(field: string, leadData: any): any {
    // Handle nested field access with dot notation
    const fieldParts = field.split(".");
    let value = leadData;

    for (const part of fieldParts) {
      if (value && typeof value === "object") {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  static evaluateAllRules(
    rules: ValidationRule[],
    leadData: any,
    documents: any[] = [],
    context?: EvaluationContext
  ): ValidationResult[] {
    const ctx: EvaluationContext = context || { leadData, documents };
    return rules
      .filter((rule) => rule.enabled)
      .sort((a, b) => a.order - b.order)
      .map((rule) => this.evaluateRule(rule, leadData, documents, ctx));
  }

  static calculateSummary(results: ValidationResult[]) {
    const total = results.length;
    const passed = results.filter((r) => r.status === "passed").length;
    const warnings = results.filter((r) => r.status === "warning").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const passedPercentage = total > 0 ? Math.round((passed / total) * 100) : 0;
    const canProceed = failed === 0;

    return {
      total,
      passed,
      warnings,
      failed,
      passedPercentage,
      canProceed,
    };
  }
}
