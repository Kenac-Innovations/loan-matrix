export interface FineractReport {
    id: number;
    reportName: string;
    reportType: string;
    reportCategory: string;
    description?: string;
    coreReport: boolean;
    useReport: boolean;
    reportParameters: Array<{
      id: number;
      parameterId: number;
      parameterName: string;
    }>;
  }