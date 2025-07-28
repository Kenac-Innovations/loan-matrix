interface ValidationRule {
  id: string;
  name: string;
  description: string;
  conditions: {
    type: "AND" | "OR";
    rules: Array<{
      field: string;
      operator: string;
      value?: any;
    }>;
  };
  actions: {
    onPass: { message: string };
    onFail: {
      message: string;
      suggestedAction?: string;
      actionUrl?: string;
    };
  };
  severity: "info" | "warning" | "error";
  enabled: boolean;
  order: number;
  pipelineStageId: string | null;
}

interface ValidationResult {
  id: string;
  name: string;
  description: string;
  status: "passed" | "failed" | "warning";
  message?: string;
  suggestedAction?: string;
  actionUrl?: string;
  severity: "info" | "warning" | "error";
}

export class ValidationEngine {
  static evaluateRule(
    rule: ValidationRule,
    leadData: any,
    documents: any[] = []
  ): ValidationResult {
    const result: ValidationResult = {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      status: "passed",
    };

    try {
      const conditionResult = this.evaluateConditions(
        rule.conditions,
        leadData,
        documents
      );

      if (conditionResult) {
        result.status = "passed";
        result.message = rule.actions.onPass.message;
      } else {
        result.status = rule.severity === "error" ? "failed" : "warning";
        result.message = rule.actions.onFail.message;
        result.suggestedAction = rule.actions.onFail.suggestedAction;
        result.actionUrl = rule.actions.onFail.actionUrl;
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
    leadData: any,
    documents: any[]
  ): boolean {
    const { type, rules } = conditions;

    const results = rules.map((rule) =>
      this.evaluateCondition(rule, leadData, documents)
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
    leadData: any,
    documents: any[]
  ): boolean {
    const { field, operator, value } = rule;

    // Handle special fields
    if (field === "documents") {
      return this.evaluateDocumentCondition(operator, value, documents);
    }

    if (field === "debtToIncomeRatio") {
      return this.evaluateDebtToIncomeRatio(operator, value, leadData);
    }

    if (field === "collateralRatio") {
      return this.evaluateCollateralRatio(operator, value, leadData);
    }

    // Get field value from lead data
    const fieldValue = this.getFieldValue(field, leadData);

    // Evaluate based on operator
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

      case "isValidEmail":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(String(fieldValue));

      case "isValidPhone":
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phoneRegex.test(String(fieldValue));

      case "matchesPattern":
        const regex = new RegExp(value);
        return regex.test(String(fieldValue));

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
    documents: any[] = []
  ): ValidationResult[] {
    return rules
      .filter((rule) => rule.enabled)
      .sort((a, b) => a.order - b.order)
      .map((rule) => this.evaluateRule(rule, leadData, documents));
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
