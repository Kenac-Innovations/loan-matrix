"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { buildDocumentDownloadUrl } from "@/lib/document-utils";
import { DocumentPreviewer } from "./document-previewer";
import type { ButtonProps } from "@/components/ui/button";

export interface DocumentPreviewButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Stored document reference: full URL, path, or ID */
  documentUrl: string | null | undefined;
  fileName?: string | null;
  contentType?: string | null;
  children?: React.ReactNode;
}

export function DocumentPreviewButton({
  documentUrl,
  fileName,
  contentType,
  variant = "ghost",
  size = "sm",
  className,
  children,
  ...buttonProps
}: DocumentPreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const normalizedUrl = useMemo(
    () => buildDocumentDownloadUrl(documentUrl),
    [documentUrl]
  );

  if (!documentUrl || !normalizedUrl) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsOpen(true)}
        {...buttonProps}
      >
        {children ?? (
          <>
            <Eye className="h-4 w-4" />
            View
          </>
        )}
      </Button>
      <DocumentPreviewer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        documentUrl={documentUrl}
        fileName={fileName}
        contentType={contentType}
      />
    </>
  );
}
