export type ToastType = "success" | "error" | "warning" | "info";

export type ToastPosition = 
  | "top-left" 
  | "top-right" 
  | "bottom-left" 
  | "bottom-right" 
  | "top-center" 
  | "bottom-center";

export interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  position?: ToastPosition;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
}

export interface ToastData extends ToastOptions {
  type: ToastType;
}

export interface ToastManagerInterface {
  success(options?: ToastOptions): void;
  error(options?: ToastOptions): void;
  warning(options?: ToastOptions): void;
  info(options?: ToastOptions): void;
  saveSuccess(entity?: string): void;
  saveError(entity?: string): void;
  deleteSuccess(entity?: string): void;
  deleteError(entity?: string): void;
  validationError(message?: string): void;
  networkError(): void;
  loadingSuccess(operation?: string): void;
  loadingError(operation?: string): void;
}

export interface UseToastReturn {
  toast: any; // The underlying toast function
  manager: ToastManagerInterface;
  success: (options?: ToastOptions) => void;
  error: (options?: ToastOptions) => void;
  warning: (options?: ToastOptions) => void;
  info: (options?: ToastOptions) => void;
  saveSuccess: (entity?: string) => void;
  saveError: (entity?: string) => void;
  deleteSuccess: (entity?: string) => void;
  deleteError: (entity?: string) => void;
  validationError: (message?: string) => void;
  networkError: () => void;
  loadingSuccess: (operation?: string) => void;
  loadingError: (operation?: string) => void;
}

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  icon?: React.ReactNode;
  action?: {
    altText: string;
    label: string;
    onClick: () => void;
  };
};
