export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 50;

export const PASSWORD_REQUIREMENTS = [
  {
    key: "minLength",
    label: "At least 12 characters",
    error: "Password must be at least 12 characters long",
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    key: "maxLength",
    label: "50 characters or fewer",
    error: "Password must not exceed 50 characters",
    test: (value: string) => value.length > 0 && value.length <= PASSWORD_MAX_LENGTH,
  },
  {
    key: "uppercase",
    label: "One uppercase letter",
    error: "Password must contain an uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    key: "lowercase",
    label: "One lowercase letter",
    error: "Password must contain a lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    key: "number",
    label: "One number",
    error: "Password must contain a number",
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    key: "specialCharacter",
    label: "One special character",
    error: "Password must contain a special character",
    test: (value: string) => /[^\w\s]/.test(value),
  },
  {
    key: "noSpaces",
    label: "No spaces",
    error: "Password must not contain spaces",
    test: (value: string) => value.length > 0 && !/\s/.test(value),
  },
  {
    key: "noConsecutiveRepeats",
    label: "No consecutive repeating characters",
    error: "Password must not contain consecutive repeating characters",
    test: (value: string) => value.length > 0 && !/(.)\1/.test(value),
  },
] as const;

export function validatePassword(password: string) {
  const errors = PASSWORD_REQUIREMENTS.filter(({ test }) => !test(password)).map(
    ({ error }) => error
  );

  return { valid: errors.length === 0, errors };
}
