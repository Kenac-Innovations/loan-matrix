"use client";

import { useState, useMemo, useCallback } from "react";
import { Eye, FileText } from "lucide-react";
import { buildDocumentDownloadUrl } from "@/lib/document-utils";
import { DocumentPreviewer } from "./document-previewer";
import { cn } from "@/lib/utils";

function inferPreviewType(
  contentType?: string | null,
  fileName?: string | null,
  url?: string | null
): "pdf" | "image" | "unknown" {
  const ct = (contentType || "").toLowerCase();
  const name = (fileName || url || "").toLowerCase();
  if (ct.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    ct.includes("image/") ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(name)
  )
    return "image";
  return "unknown";
}

export interface DocumentPreviewCardProps {
  /** Stored document reference: full URL, path, or ID */
  documentUrl: string | null | undefined;
  fileName?: string | null;
  contentType?: string | null;
  className?: string;
}

export function DocumentPreviewCard({
  documentUrl,
  fileName,
  contentType,
  className,
}: DocumentPreviewCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const normalizedUrl = useMemo(
    () => buildDocumentDownloadUrl(documentUrl),
    [documentUrl]
  );
  const type = inferPreviewType(contentType, fileName, documentUrl);
  const displayName = fileName || "Document";
  const typeLabel =
    type === "pdf"
      ? "PDF Document"
      : type === "image"
        ? "Image"
        : "Document";

  const handleThumbError = useCallback(() => setThumbError(true), []);

  if (!documentUrl || !normalizedUrl) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-muted/30 p-4 flex flex-col items-center justify-center gap-2 min-h-[120px] text-muted-foreground text-sm",
          className
        )}
      >
        <FileText className="h-10 w-10" />
        <span>No document</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPreviewOpen(true)}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden",
          "flex flex-col transition-colors hover:bg-accent/50 hover:border-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "text-left w-full",
          className
        )}
      >
        <div className="relative h-48 w-full bg-muted/30 flex items-center justify-center overflow-hidden">
          {type === "image" && !thumbError ? (
            <img
              src={normalizedUrl}
              alt=""
              className="w-full h-full object-contain"
              onError={handleThumbError}
            />
          ) : type === "pdf" ? (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <FileText className="h-12 w-12" />
              <span className="text-xs">PDF</span>
            </div>
          ) : thumbError || type === "unknown" ? (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <FileText className="h-12 w-12" />
              <span className="text-xs">{typeLabel}</span>
            </div>
          ) : null}
          <div className="absolute bottom-2 right-2 rounded-md bg-background/90 px-2 py-1 flex items-center gap-1 text-xs font-medium">
            <Eye className="h-3 w-3" />
            View
          </div>
        </div>
        <div className="p-3 flex flex-col gap-0.5">
          <span className="font-medium text-sm truncate" title={displayName}>
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground">{typeLabel}</span>
        </div>
      </button>

      <DocumentPreviewer
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        documentUrl={documentUrl}
        fileName={fileName}
        contentType={contentType}
      />
    </>
  );
}
