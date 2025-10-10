export interface FineractConfig {
  baseUrl: string;
  username: string;
  password: string;
  tenantId: string;
}

export interface FineractClient {
  id: number;
  accountNo: string;
  status: {
    id: number;
    code: string;
    value: string;
  };
  active: boolean;
  activationDate: string[];
  firstname: string;
  middlename?: string;
  lastname: string;
  displayName: string;
  mobileNo?: string;
  dateOfBirth?: string[];
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
  officeId: number;
  officeName: string;
  transferToOfficeId?: number;
  transferToOfficeName?: string;
  imageId?: number;
  imagePresent?: boolean;
  staffId?: number;
  staffName?: string;
  timeline: {
    submittedOnDate: string[];
    submittedByUsername: string;
    submittedByFirstname: string;
    submittedByLastname: string;
    activatedOnDate: string[];
    activatedByUsername: string;
    activatedByFirstname: string;
    activatedByLastname: string;
  };
  savingsAccountId?: number;
  clientNonPersonDetails?: {
    constitution?: {
      id: number;
      name: string;
    };
    incorporationDate?: string[];
    incorporationNumber?: string;
    registeredOffice?: string;
  };
  externalId?: string;
  clientCollateralManagements?: any[];
  groups?: any[];
  staff?: any;
  office?: any;
  transferToOffice?: any;
  address?: {
    street?: string;
    addressLine1?: string;
    addressLine2?: string;
    addressLine3?: string;
    townVillage?: string;
    city?: string;
    stateProvinceId?: number;
    countryId?: number;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };
};
