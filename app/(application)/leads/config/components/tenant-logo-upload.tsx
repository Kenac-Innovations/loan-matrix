"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ImageIcon, Loader2 } from "lucide-react";

interface TenantLogoUploadProps {
  /** Callback after successful upload (e.g. to refresh tenant info) */
  onUploaded?: () => void;
}

export function TenantLogoUpload({ onUploaded }: TenantLogoUploadProps) {
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/tenant")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.logoFileUrl && setCurrentLogoUrl(data.logoFileUrl))
      .catch(() => {});
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(false);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/tenant/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      if (data.logoFileUrl) setCurrentLogoUrl(data.logoFileUrl);
      setSuccess(true);
      onUploaded?.();
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Logo</CardTitle>
        <CardDescription>
          Upload a logo for your organization. It will appear in the sidebar and header. One logo per
          organization; uploading a new image replaces the previous one. Use PNG, JPG, or SVG.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentLogoUrl && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Current logo:</span>
            <img
              src={currentLogoUrl}
              alt="Organization logo"
              className="h-12 w-auto object-contain rounded border border-border"
            />
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-500 bg-green-500/10 text-green-600 dark:text-green-400">
            <AlertTitle>Logo updated</AlertTitle>
            <AlertDescription>Refresh the page to see the new logo in the sidebar.</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            {uploading ? "Uploading…" : currentLogoUrl ? "Replace logo" : "Upload logo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
