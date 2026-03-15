import { LoanOffer } from './loan';
import { AffordabilityModelTypeEnum } from './ui';

// DTI Model Configuration
export interface DtiModelConfig {
  maxDtiRatio: number;
  warningDtiRatio: number;
  includeMortgage: boolean;
  includeExistingLoans: boolean;
  includeProposedLoan: boolean;
  includeMinimumCreditCardPayments: boolean;
  includeAutoLoans?: boolean;
  includeStudentLoans?: boolean;
}

// Disposable Income Model Configuration
export interface DisposableIncomeModelConfig {
  minDisposableIncome: number;
  disposableIncomePercentage: number;
  includeBasicNeeds: boolean;
  includeTransportation: boolean;
  includeUtilities: boolean;
  includeEducation?: boolean;
  includeHealthcare?: boolean;
}

// Employer-based Model Configuration
export interface EmployerBasedModelConfig {
  governmentMultiplier: number;
  corporateMultiplier: number;
  smeMultiplier: number;
  startupMultiplier?: number;
  selfEmployedMultiplier: number;
  maxTermYears: number;
  minEmploymentYears: number;
}

export interface ExpenditureEstimationModelConfig {
  estimationMethod: string;
  lowerIncomePercentage: number;
  middleIncomePercentage: number;
  upperIncomePercentage: number;
  lowerIncomeThreshold: number;
  upperIncomeThreshold: number;
  urbanAdjustmentFactor: number;
  ruralAdjustmentFactor: number;
}

// Unified affordability model
export interface AffordabilityModel {
  id: string;
  name: string;
  description: string;
  type: "dti" | "disposableIncome" | "employerBased" | "expenditureEstimation";
  isActive: boolean;
  isDefault: boolean;
  config:
    | DtiModelConfig
    | DisposableIncomeModelConfig
    | EmployerBasedModelConfig
    | ExpenditureEstimationModelConfig;
}

// Extended IncomeDetails
export interface IncomeDetails {
  primaryIncome: number;
  secondaryIncome: number;
  otherIncome: number;
  employerType?:
    | "government"
    | "corporate"
    | "sme"
    | "startup"
    | "selfEmployed";
  yearsEmployed?: number;
}

type AffordabilityModelType = {
  id: string;
  name: string;
  description: string;
  type: AffordabilityModelTypeEnum;
  isActive: boolean;
  isDefault: boolean;
  config: any;
};
