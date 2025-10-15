"use client";

import { toast as shadcnToast } from "@/components/ui/use-toast";

export interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const toast = {
  success: (options: ToastOptions = {}) => {
    shadcnToast({
      title: options.title || "Success",
      description: options.description || "Operation completed successfully",
      ...options,
    });
  },

  error: (options: ToastOptions = {}) => {
    shadcnToast({
      title: options.title || "Error",
      description: options.description || "An error occurred",
      variant: "destructive",
      ...options,
    });
  },

  warning: (options: ToastOptions = {}) => {
    shadcnToast({
      title: options.title || "Warning",
      description: options.description || "Please review the information",
      ...options,
    });
  },

  info: (options: ToastOptions = {}) => {
    shadcnToast({
      title: options.title || "Information",
      description: options.description || "Additional information available",
      ...options,
    });
  },

  // Convenience methods
  saveSuccess: (entity: string = "Data") => {
    shadcnToast({
      title: "Saved Successfully",
      description: `${entity} has been saved successfully.`,
    });
  },

  saveError: (entity: string = "Data") => {
    shadcnToast({
      title: "Save Failed",
      description: `Failed to save ${entity.toLowerCase()}. Please try again.`,
      variant: "destructive",
    });
  },

  deleteSuccess: (entity: string = "Item") => {
    shadcnToast({
      title: "Deleted Successfully",
      description: `${entity} has been deleted successfully.`,
    });
  },

  deleteError: (entity: string = "Item") => {
    shadcnToast({
      title: "Delete Failed",
      description: `Failed to delete ${entity.toLowerCase()}. Please try again.`,
      variant: "destructive",
    });
  },

  validationError: (message: string = "Please check your input") => {
    shadcnToast({
      title: "Validation Error",
      description: message,
      variant: "destructive",
    });
  },

  networkError: () => {
    shadcnToast({
      title: "Network Error",
      description: "Unable to connect to the server. Please check your connection.",
      variant: "destructive",
    });
  },
};

export function useToast() {
  return {
    toast: shadcnToast,
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
    saveSuccess: toast.saveSuccess,
    saveError: toast.saveError,
    deleteSuccess: toast.deleteSuccess,
    deleteError: toast.deleteError,
    validationError: toast.validationError,
    networkError: toast.networkError,
  };
}
