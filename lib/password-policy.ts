export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

/**
 * Password rules shared by the profile page and the change-password API.
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (!@#$%^&*(),.?":{}|<>)
 */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "8+ characters", test: (p) => p.length >= 8 },
  { id: "uppercase", label: "Uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "Lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "Number", test: (p) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "Special character",
    test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
  },
];

export function validateNewPassword(input: {
  currentPassword: string;
  password: string;
  repeatPassword: string;
}): { valid: boolean; errors: string[] } {
  const { currentPassword, password, repeatPassword } = input;
  const errors: string[] = [];

  if (!currentPassword) {
    errors.push("Enter your current password.");
  }

  if (!password) {
    errors.push("Enter a new password.");
  } else {
    if (password !== repeatPassword) {
      errors.push("Passwords don't match.");
    }

    const failedRules = PASSWORD_RULES.filter((rule) => !rule.test(password));
    if (failedRules.length > 0) {
      errors.push("Password doesn't meet every requirement.");
      errors.push(...failedRules.map((rule) => rule.label));
    }

    if (currentPassword && password === currentPassword) {
      errors.push("Choose a password that's different from your current one.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
