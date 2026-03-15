"use client";

import { useFormState } from "react-dom";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface ValidationError {
  field: string;
  message: string;
}

interface FormValidationState {
  errors: ValidationError[];
  isValid: boolean;
  hasErrors: boolean;
}

export function useFormValidation() {
  const { toast } = useToast();

  const validateField = (
    value: any,
    rules: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      custom?: (value: any) => string | null;
    }
  ): string | null => {
    // Required validation
    if (rules.required && (!value || value.toString().trim() === "")) {
      return "This field is required";
    }

    // Skip other validations if value is empty and not required
    if (!value || value.toString().trim() === "") {
      return null;
    }

    // Min length validation
    if (rules.minLength && value.toString().length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters`;
    }

    // Max length validation
    if (rules.maxLength && value.toString().length > rules.maxLength) {
      return `Must be no more than ${rules.maxLength} characters`;
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value.toString())) {
      return "Invalid format";
    }

    // Custom validation
    if (rules.custom) {
      return rules.custom(value);
    }

    return null;
  };

  const validateEmail = (email: string): string | null => {
    if (!email) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? null : "Please enter a valid email address";
  };

  const validatePhone = (phone: string): string | null => {
    if (!phone) return null;
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""))
      ? null
      : "Please enter a valid phone number";
  };

  const validateNationalId = (id: string): string | null => {
    if (!id) return null;
    // Basic national ID validation - adjust based on your country's format
    const idRegex = /^[A-Z0-9]{6,20}$/;
    return idRegex.test(id) ? null : "Please enter a valid National ID";
  };

  const showValidationErrors = (errors: ValidationError[]) => {
    if (errors.length === 0) return;

    const errorMessages = errors.map((error) => error.message).join(", ");
    toast({
      title: "Validation Error",
      description: errorMessages,
      variant: "destructive",
    });
  };

  const showFieldError = (field: string, message: string) => {
    toast({
      title: "Validation Error",
      description: `${field}: ${message}`,
      variant: "destructive",
    });
  };

  return {
    validateField,
    validateEmail,
    validatePhone,
    validateNationalId,
    showValidationErrors,
    showFieldError,
  };
}
