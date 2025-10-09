"use client";

import { useState, useCallback, useMemo } from "react";
import { FormError } from "@/app/(application)/leads/new/components/global-error-handler";

interface UseFormErrorHandlerOptions {
  persistErrors?: boolean;
  autoClearOnStepChange?: boolean;
  maxErrorsPerStep?: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: FormError[];
}

export function useFormErrorHandler(options: UseFormErrorHandlerOptions = {}) {
  const {
    persistErrors = true,
    autoClearOnStepChange = false,
    maxErrorsPerStep = 10,
  } = options;

  const [errors, setErrors] = useState<FormError[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("");

  // Add a new error
  const addError = useCallback(
    (error: Omit<FormError, "timestamp">) => {
      const newError: FormError = {
        ...error,
        timestamp: new Date(),
      };

      setErrors((prevErrors) => {
        // Check if error already exists for this field and step
        const existingErrorIndex = prevErrors.findIndex(
          (e) => e.field === error.field && e.step === error.step
        );

        if (existingErrorIndex >= 0) {
          // Update existing error
          const updatedErrors = [...prevErrors];
          updatedErrors[existingErrorIndex] = newError;
          return updatedErrors;
        }

        // Check if we've reached the max errors per step
        const stepErrors = prevErrors.filter((e) => e.step === error.step);
        if (stepErrors.length >= maxErrorsPerStep) {
          return prevErrors;
        }

        // Add new error
        return [...prevErrors, newError];
      });
    },
    [maxErrorsPerStep]
  );

  // Add multiple errors at once
  const addErrors = useCallback((newErrors: Omit<FormError, "timestamp">[]) => {
    const errorsWithTimestamp = newErrors.map((error) => ({
      ...error,
      timestamp: new Date(),
    }));

    setErrors((prevErrors) => {
      const updatedErrors = [...prevErrors];

      errorsWithTimestamp.forEach((newError) => {
        const existingIndex = updatedErrors.findIndex(
          (e) => e.field === newError.field && e.step === newError.step
        );

        if (existingIndex >= 0) {
          updatedErrors[existingIndex] = newError;
        } else {
          updatedErrors.push(newError);
        }
      });

      return updatedErrors;
    });
  }, []);

  // Clear a specific error
  const clearError = useCallback((errorId: string) => {
    setErrors((prevErrors) =>
      prevErrors.filter((error) => `${error.step}-${error.field}` !== errorId)
    );
  }, []);

  // Clear all errors for a specific step
  const clearStepErrors = useCallback((step: string) => {
    setErrors((prevErrors) => prevErrors.filter((error) => error.step !== step));
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Clear errors for a specific field
  const clearFieldError = useCallback((step: string, field: string) => {
    setErrors((prevErrors) =>
      prevErrors.filter(
        (error) => !(error.step === step && error.field === field)
      )
    );
  }, []);

  // Update current step and optionally clear errors
  const setStep = useCallback(
    (step: string) => {
      setCurrentStep(step);
      if (autoClearOnStepChange) {
        clearStepErrors(step);
      }
    },
    [autoClearOnStepChange, clearStepErrors]
  );

  // Validate a specific step
  const validateStep = useCallback(
    (step: string, validationFn: () => ValidationResult) => {
      const result = validationFn();
      
      if (!result.isValid) {
        addErrors(result.errors);
      } else {
        clearStepErrors(step);
      }

      return result;
    },
    [addErrors, clearStepErrors]
  );

  // Get errors for a specific step
  const getStepErrors = useCallback(
    (step: string) => {
      return errors.filter((error) => error.step === step);
    },
    [errors]
  );

  // Get errors for a specific field
  const getFieldError = useCallback(
    (step: string, field: string) => {
      return errors.find(
        (error) => error.step === step && error.field === field
      );
    },
    [errors]
  );

  // Check if a step has errors
  const hasStepErrors = useCallback(
    (step: string) => {
      return errors.some((error) => error.step === step);
    },
    [errors]
  );

  // Check if a field has errors
  const hasFieldError = useCallback(
    (step: string, field: string) => {
      return errors.some(
        (error) => error.step === step && error.field === field
      );
    },
    [errors]
  );

  // Get error summary
  const errorSummary = useMemo(() => {
    const totalErrors = errors.filter((e) => e.severity === "error").length;
    const totalWarnings = errors.filter((e) => e.severity === "warning").length;
    const totalInfo = errors.filter((e) => e.severity === "info").length;

    return {
      totalErrors,
      totalWarnings,
      totalInfo,
      totalIssues: totalErrors + totalWarnings + totalInfo,
      hasErrors: totalErrors > 0,
      hasWarnings: totalWarnings > 0,
      hasIssues: totalErrors > 0 || totalWarnings > 0,
    };
  }, [errors]);

  // Get step error summary
  const getStepErrorSummary = useCallback(
    (step: string) => {
      const stepErrors = getStepErrors(step);
      const errorCount = stepErrors.filter((e) => e.severity === "error").length;
      const warningCount = stepErrors.filter((e) => e.severity === "warning").length;
      const infoCount = stepErrors.filter((e) => e.severity === "info").length;

      return {
        step,
        errorCount,
        warningCount,
        infoCount,
        totalIssues: errorCount + warningCount + infoCount,
        hasErrors: errorCount > 0,
        hasWarnings: warningCount > 0,
        hasIssues: errorCount > 0 || warningCount > 0,
        errors: stepErrors,
      };
    },
    [getStepErrors]
  );

  // Persist errors to localStorage if enabled
  const persistErrorsToStorage = useCallback(() => {
    if (persistErrors && typeof window !== "undefined") {
      try {
        localStorage.setItem("form-errors", JSON.stringify(errors));
      } catch (error) {
        console.warn("Failed to persist errors to localStorage:", error);
      }
    }
  }, [errors, persistErrors]);

  // Load errors from localStorage if enabled
  const loadErrorsFromStorage = useCallback(() => {
    if (persistErrors && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("form-errors");
        if (stored) {
          const parsedErrors = JSON.parse(stored);
          // Convert timestamp strings back to Date objects
          const errorsWithDates = parsedErrors.map((error: any) => ({
            ...error,
            timestamp: new Date(error.timestamp),
          }));
          setErrors(errorsWithDates);
        }
      } catch (error) {
        console.warn("Failed to load errors from localStorage:", error);
      }
    }
  }, [persistErrors]);

  // Clear persisted errors
  const clearPersistedErrors = useCallback(() => {
    if (persistErrors && typeof window !== "undefined") {
      try {
        localStorage.removeItem("form-errors");
      } catch (error) {
        console.warn("Failed to clear persisted errors:", error);
      }
    }
  }, [persistErrors]);

  return {
    // State
    errors,
    currentStep,
    errorSummary,

    // Actions
    addError,
    addErrors,
    clearError,
    clearStepErrors,
    clearAllErrors,
    clearFieldError,
    setStep,

    // Validation
    validateStep,

    // Getters
    getStepErrors,
    getFieldError,
    hasStepErrors,
    hasFieldError,
    getStepErrorSummary,

    // Persistence
    persistErrorsToStorage,
    loadErrorsFromStorage,
    clearPersistedErrors,
  };
}
