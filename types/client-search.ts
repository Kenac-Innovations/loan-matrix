export interface ClientSearchRequest {
  request: {
    text: string;
  };
  page: number;
  size: number;
}

export interface ClientSearchResponse {
  content: ClientSearchResult[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  last: boolean;
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

export interface ClientSearchResult {
  id: number;
  displayName: string;
  externalId: string;
  accountNumber: string;
  officeId: number;
  officeName: string;
  mobileNo: string;
  status: {
    id: number;
    code: string;
    value: string;
  };
  activationDate: string;
  createdDate: string;
}

export interface ClientSearchError {
  error: string;
  details?: any;
}
