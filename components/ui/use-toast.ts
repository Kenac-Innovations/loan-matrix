import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

export function toast({ title, description, variant = "default" }: ToastProps) {
  const isDestructive = variant === "destructive";

  if (isDestructive) {
    return sonnerToast.error(title, {
      description,
    });
  }

  return sonnerToast(title, {
    description,
  });
}
