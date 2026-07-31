"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FieldLabelProps {
  htmlFor?: string;
  label: ReactNode;
  ariaLabel?: string;
  required?: boolean;
  tooltip?: string;
  className?: string;
  labelClassName?: string;
}

export function TooltipHelp({
  tooltip,
  ariaLabel = "More information",
}: {
  tooltip?: string;
  ariaLabel?: string;
}) {
  if (!tooltip) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(event) => event.stopPropagation()}
        >
          <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-sm leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function FieldLabel({
  htmlFor,
  label,
  ariaLabel,
  required,
  tooltip,
  className,
  labelClassName,
}: FieldLabelProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Label htmlFor={htmlFor} className={labelClassName}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <TooltipHelp
        tooltip={tooltip}
        ariaLabel={ariaLabel ?? `More information about ${typeof label === "string" ? label : "this field"}`}
      />
    </div>
  );
}
