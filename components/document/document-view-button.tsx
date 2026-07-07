"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
import {
  buildInlineDocumentPreviewUrl,
  isBrowserPreviewableDocument,
} from "@/lib/document-viewing";

export interface DocumentViewButtonProps extends Omit<ButtonProps, "onClick"> {
  documentUrl: string | null | undefined;
  fileName?: string | null;
  contentType?: string | null;
  mimeType?: string | null;
  documentType?: string | null;
  documentName?: string | null;
  originalName?: string | null;
  onFallbackDownload?: () => void | Promise<void>;
  children?: React.ReactNode;
}

function triggerBrowserDownload(
  documentUrl: string,
  fileName: string | null | undefined
) {
  const link = document.createElement("a");
  link.href = documentUrl;
  link.download = fileName || "document";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function DocumentViewButton({
  documentUrl,
  fileName,
  contentType,
  mimeType,
  documentType,
  documentName,
  originalName,
  onFallbackDownload,
  variant = "outline",
  size = "sm",
  className,
  children,
  disabled,
  ...buttonProps
}: DocumentViewButtonProps) {
  const handleClick = () => {
    if (!documentUrl) return;

    if (
      isBrowserPreviewableDocument({
        contentType,
        mimeType,
        type: documentType,
        fileName,
        name: documentName,
        originalName,
        url: documentUrl,
      })
    ) {
      const previewUrl = buildInlineDocumentPreviewUrl(documentUrl);
      window.open(previewUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (onFallbackDownload) {
      onFallbackDownload?.();
      return;
    }

    triggerBrowserDownload(documentUrl, fileName);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={disabled || !documentUrl}
      {...buttonProps}
    >
      {children ?? (
        <>
          <Eye className="h-4 w-4" />
          <span>View</span>
        </>
      )}
    </Button>
  );
}
