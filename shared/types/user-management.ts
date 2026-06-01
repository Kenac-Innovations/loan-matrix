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
  officeId?: number;
  officeName?: string;
  roles: string[];
}

export interface UserDetail extends UserSummary {
  passwordNeverExpires: boolean;
  isSelfServiceUser: boolean;
  selectedRoles: UserRoleOption[];
  staff?: StaffOption | null;
}

export interface UsersTemplate {
  allowedOffices: OfficeOption[];
  availableRoles: UserRoleOption[];
}

export interface UserFormInput {
  userId?: number | string;
  username: string;
  email?: string;
  firstname: string;
  lastname: string;
  sendPasswordToEmail?: boolean;
  passwordNeverExpires?: boolean;
  officeId: number | string;
  staffId?: number | string | null;
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

export interface UserActionResult<T = undefined> {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  message?: string;
  data?: T;
}
