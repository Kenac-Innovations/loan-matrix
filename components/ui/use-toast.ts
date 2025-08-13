import { toast as sonnerToast } from "sonner";
import React from "react";

type ToastProps = {
  title?: string;
  description?: string | React.ReactNode;
  variant?: "default" | "destructive" | "success" | "info" | "warning";
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function toast({ 
  title, 
  description, 
  variant = "default",
  icon,
  action 
}: ToastProps) {
  const baseOptions = {
    description,
    action: action ? {
      label: action.label,
      onClick: action.onClick,
    } : undefined,
  };

  switch (variant) {
    case "success":
      return sonnerToast.success(title, {
        ...baseOptions,
        icon: icon || "✅",
      });
    
    case "destructive":
      return sonnerToast.error(title, {
        ...baseOptions,
        icon: icon || "❌",
      });
    
    case "warning":
      return sonnerToast.warning(title, {
        ...baseOptions,
        icon: icon || "⚠️",
      });
    
    case "info":
      return sonnerToast.info(title, {
        ...baseOptions,
        icon: icon || "ℹ️",
      });
    
    default:
      return sonnerToast(title, baseOptions);
  }
}
