import { cn } from "@/lib/utils";

/**
 * Generates consistent error styling for form inputs
 */
export function getInputErrorStyling(
  hasError: boolean,
  baseClasses: string = ""
): string {
  return cn(
    baseClasses,
    hasError &&
      "border-red-500 focus:border-red-500 focus:ring-red-500 focus:ring-1"
  );
}

/**
 * Generates consistent error styling for select inputs
 */
export function getSelectErrorStyling(
  hasError: boolean,
  baseClasses: string = ""
): string {
  return cn(
    baseClasses,
    hasError &&
      "border-red-500 focus:border-red-500 focus:ring-red-500 focus:ring-1"
  );
}

/**
 * Generates consistent error styling for textarea inputs
 */
export function getTextareaErrorStyling(
  hasError: boolean,
  baseClasses: string = ""
): string {
  return cn(
    baseClasses,
    hasError &&
      "border-red-500 focus:border-red-500 focus:ring-red-500 focus:ring-1"
  );
}

/**
 * Helper to check if a field has an error
 */
export function hasFieldError(
  form: any,
  fieldName: string,
  externalForm?: any
): boolean {
  if (externalForm) {
    return !!externalForm.formState.errors[fieldName];
  }
  return !!form.formState.errors[fieldName];
}

/**
 * Helper to get field error message
 */
export function getFieldError(
  form: any,
  fieldName: string,
  externalForm?: any
): string | undefined {
  if (externalForm) {
    return externalForm.formState.errors[fieldName]?.message;
  }
  return form.formState.errors[fieldName]?.message;
}
