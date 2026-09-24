/**
 * Remove fields that this Fineract deployment rejects during loan creation.
 *
 * Some callers build payloads from the broader Mifos contract shape, but the
 * deployed Fineract version does not accept these optional fields on POST
 * /loans. Keep this compatibility boundary server-side so every loan-create
 * route applies the same rules.
 */
export function sanitizeFineractLoanCreatePayload(
  body: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const sanitized = { ...body };

  delete sanitized.balloonPaymentAmount;
  delete sanitized.allowPartialPeriodInterestCalculation;

  return sanitized;
}
