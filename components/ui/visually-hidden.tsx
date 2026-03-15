import * as React from "react"
import { cn } from "@/lib/utils"

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
}

/**
 * A component that visually hides its content while keeping it accessible to screen readers.
 * Useful for providing accessible labels and descriptions for UI components.
 */
export function VisuallyHidden({ 
  children, 
  className, 
  ...props 
}: VisuallyHiddenProps) {
  return (
    <span
      className={cn(
        "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0",
        "clip-path-[inset(50%)]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
