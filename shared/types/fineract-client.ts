export interface FineractClient {
    id: number;
    accountNo: string;
    status: {
      id: number;
      code: string;
      value: string;
    };
    active: boolean;
    activationDate?: string | number[];
    officeName: string;
    staffName?: string;
    firstname: string;
    lastname: string;
    displayName: string;
    mobileNo?: string;
    emailAddress?: string;
    dateOfBirth?: string | number[];
    gender?: {
      id: number;
      name: string;
    };
    clientType?: {
      id: number;
      name: string;
    };
    clientClassification?: {
      id: number;
      name: string;
    };
    timeline: {
      submittedOnDate: string | number[];
      submittedByUsername: string;
      activatedOnDate?: string | number[];
      activatedByUsername?: string;
    };
  }