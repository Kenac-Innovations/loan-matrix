export const MFA_CODE_LENGTH = 6;
export const MFA_CODE_PATTERN = new RegExp(`^\\d{${MFA_CODE_LENGTH}}$`);
export const DEFAULT_MFA_MAX_ATTEMPTS = 3;
