export interface UserRoleOption {
  id: number;
  name: string;
  description?: string;
  disabled?: boolean;
}

export interface OfficeOption {
  id: number;
  name: string;
}

export interface StaffOption {
  id: number;
  displayName: string;
}

export interface UserSummary {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  displayName: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  isBlocked: boolean;
  blockedAt?: string | null;
  officeId?: number;
  officeName?: string;
  roles: string[];
}

export type UserLoginBlockAction = "BLOCK" | "UNBLOCK";
export type UserLoginBlockSource = "MANUAL" | "SYSTEM_MFA_MAX_ATTEMPTS";

export interface UserLoginBlockEvent {
  id: string;
  action: UserLoginBlockAction;
  source: UserLoginBlockSource;
  note: string;
  actorUserId?: number | null;
  actorName?: string | null;
  createdAt: string;
}

export interface UserBlockHistoryPage {
  items: UserLoginBlockEvent[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UserDetail extends UserSummary {
  passwordNeverExpires: boolean;
  isSelfServiceUser: boolean;
  canOverrideInitiatorDisbursement: boolean;
  visibleLeadOffices: OfficeOption[];
  blockedSource?: UserLoginBlockSource | null;
  blockedNote?: string | null;
  blockedByActorName?: string | null;
  selectedRoles: UserRoleOption[];
  staff?: StaffOption | null;
  blockHistory: UserLoginBlockEvent[];
}

export interface UsersTemplate {
  allowedOffices: OfficeOption[];
  availableRoles: UserRoleOption[];
  defaultCountryCode: string;
  restrictLeadVisibilityToBranches: boolean;
}

export interface UserFormInput {
  userId?: number | string;
  username: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  firstname: string;
  lastname: string;
  sendPasswordToEmail?: boolean;
  passwordNeverExpires?: boolean;
  canOverrideInitiatorDisbursement?: boolean;
  officeId: number | string;
  staffId?: number | string | null;
  visibleLeadOfficeIds?: Array<number | string>;
  roles: Array<number | string>;
  password?: string;
  repeatPassword?: string;
}

export interface UserPasswordChangeInput {
  userId: number | string;
  firstname?: string;
  password: string;
  repeatPassword: string;
}

export interface UserBlockAccountInput {
  userId: number | string;
  note: string;
}

export interface UserBlockHistoryInput {
  userId: number | string;
  page?: number | string;
}

export interface UserActionResult<T = undefined> {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  message?: string;
  data?: T;
}
