const IMAGE_CONTENT_TYPE_PATTERN = /^image\//i;
const PDF_CONTENT_TYPE_PATTERN = /(?:^|[/;+.-])pdf(?:$|[/;+.-])/i;
const IMAGE_FILE_EXTENSION_PATTERN =
  /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)(?:[?#].*)?$/i;
const PDF_FILE_EXTENSION_PATTERN = /\.pdf(?:[?#].*)?$/i;

export interface BrowserPreviewableDocumentInput {
  contentType?: string | null;
  mimeType?: string | null;
  type?: string | null;
  fileName?: string | null;
  name?: string | null;
  originalName?: string | null;
  url?: string | null;
}

function hasPreviewableContentType(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim();
  return (
    IMAGE_CONTENT_TYPE_PATTERN.test(normalized) ||
    PDF_CONTENT_TYPE_PATTERN.test(normalized)
  );
}

function hasPreviewableFileExtension(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim();
  return (
    IMAGE_FILE_EXTENSION_PATTERN.test(normalized) ||
    PDF_FILE_EXTENSION_PATTERN.test(normalized)
  );
}

export function isBrowserPreviewableDocument({
  contentType,
  mimeType,
  type,
  fileName,
  name,
  originalName,
  url,
}: BrowserPreviewableDocumentInput): boolean {
  return (
    [contentType, mimeType, type].some(hasPreviewableContentType) ||
    [fileName, name, originalName, url].some(hasPreviewableFileExtension)
  );
}

export function buildInlineDocumentPreviewUrl(
  url: string | null | undefined
): string {
  const trimmed = url?.trim();
  if (!trimmed) return "";

  const [withoutHash, hash] = trimmed.split("#", 2);
  const [path, query = ""] = withoutHash.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("disposition", "inline");

  return `${path}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

export function toInlineContentDisposition(
  contentDisposition: string | null | undefined
): string {
  const trimmed = contentDisposition?.trim();
  if (!trimmed) return "inline";
  if (/^inline(?:\s*;|$)/i.test(trimmed)) return trimmed;
  if (/^attachment(?:\s*;|$)/i.test(trimmed)) {
    return trimmed.replace(/^attachment/i, "inline");
  }
  return `inline; ${trimmed}`;
}
