/**
 * Normalizes a mobile number to the canonical Fineract format:
 * no spaces, no leading +, country code prefix included.
 * e.g. "97 123 4567" + "+260" → "260971234567"
 *
 * Rules:
 * - Strip all whitespace
 * - Strip leading +
 * - If already starts with country code digits → return as-is
 * - Strip leading zeros
 * - If 9 digits remain → prepend country code digits
 */
export function formatMobileForFineract(
  mobileNo: string,
  countryCode: string = "+260"
): string {
  if (!mobileNo) return mobileNo;

  // Strip whitespace
  let digits = mobileNo.replace(/\s+/g, "");

  // Country code digits e.g. "+260" → "260"
  const ccDigits = countryCode.replace(/^\+/, "");

  // Strip leading +
  digits = digits.replace(/^\+/, "");

  // Already fully prefixed
  if (digits.startsWith(ccDigits)) {
    return digits;
  }

  // Strip leading zeros
  digits = digits.replace(/^0+/, "");

  // 9-digit local number → prepend country code
  if (digits.length === 9) {
    return ccDigits + digits;
  }

  return digits;
}
