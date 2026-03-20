"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { buildDocumentDownloadUrl } from "@/lib/document-utils";
import { cn } from "@/lib/utils";

export type DocumentPreviewType = "pdf" | "image" | "office" | "unknown";

function inferPreviewType(
  contentType?: string | null,
  fileName?: string | null,
  url?: string | null
): DocumentPreviewType {
  const ct = (contentType || "").toLowerCase();
  const name = (fileName || url || "").toLowerCase();
  if (ct.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    ct.includes("image/") ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(name)
  )
    return "image";
  if (
    ct.includes("word") ||
    ct.includes("document") ||
    /\.(doc|docx)(\?|$)/i.test(name)
  )
    return "office";
  if (
    ct.includes("sheet") ||
    ct.includes("excel") ||
    /\.(xls|xlsx)(\?|$)/i.test(name)
  )
    return "office";
  if (
    ct.includes("presentation") ||
    ct.includes("powerpoint") ||
    /\.(ppt|pptx)(\?|$)/i.test(name)
  )
    return "office";
  return "unknown";
}

export interface DocumentPreviewerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Stored document reference: full URL, path, or ID */
  documentUrl: string | null | undefined;
  fileName?: string | null;
  contentType?: string | null;
}

export function DocumentPreviewer({
  isOpen,
  onClose,
  documentUrl,
  fileName,
  contentType,
}: DocumentPreviewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const previewUrl = buildDocumentDownloadUrl(documentUrl);
  const type = inferPreviewType(contentType, fileName, documentUrl);

  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(false);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  const handleDownload = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = fileName || "document";
    a.rel = "noopener noreferrer";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [previewUrl, fileName]);

  if (!documentUrl) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col">
          <div className="flex items-center justify-center flex-1 text-muted-foreground">
            No document to preview.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const displayName = fileName || "Document";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col p-4 gap-4"
        )}
      >
        <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-2 pr-8">
          <DialogTitle className="truncate text-base">
            {displayName}
          </DialogTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </DialogHeader>

        <div className="flex-1 min-h-0 relative rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-medium">Unable to preview</p>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                Download instead
              </Button>
            </div>
          )}

          {!previewUrl ? (
            <p className="text-muted-foreground text-sm">Invalid document URL.</p>
          ) : type === "pdf" || type === "unknown" ? (
            <iframe
              src={previewUrl}
              title={displayName}
              className="w-full h-full border-0 rounded"
              onLoad={handleLoad}
              onError={handleError}
            />
          ) : type === "image" ? (
            <img
              src={previewUrl}
              alt={displayName}
              className="max-w-full max-h-full object-contain rounded"
              onLoad={handleLoad}
              onError={handleError}
            />
          ) : type === "office" ? (
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                typeof window !== "undefined" ? window.location.origin + previewUrl : previewUrl
              )}`}
              title={displayName}
              className="w-full h-full border-0 rounded"
              onLoad={handleLoad}
              onError={handleError}
            />
          ) : (
            <iframe
              src={previewUrl}
              title={displayName}
              className="w-full h-full border-0 rounded"
              onLoad={handleLoad}
              onError={handleError}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
