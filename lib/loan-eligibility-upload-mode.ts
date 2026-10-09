export const DEFAULT_REPLACE_EXISTING_ELIGIBILITY = false;

export function shouldBeginEligibilityReplacement(params: {
  replaceExisting: boolean;
  isFirstSync: boolean;
  batchIndex: number;
}): boolean {
  return params.replaceExisting && params.isFirstSync && params.batchIndex === 0;
}
