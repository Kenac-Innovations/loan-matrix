import assert from "node:assert/strict";
import test from "node:test";

test("marks PDFs and images as browser previewable", async () => {
  const { isBrowserPreviewableDocument } = await import("../document-viewing");

  assert.equal(
    isBrowserPreviewableDocument({ contentType: "application/pdf" }),
    true
  );
  assert.equal(isBrowserPreviewableDocument({ type: "image/png" }), true);
  assert.equal(
    isBrowserPreviewableDocument({ fileName: "bank-statement.PDF" }),
    true
  );
  assert.equal(
    isBrowserPreviewableDocument({
      url: "/api/documents/abc/attachment?name=selfie.jpeg",
    }),
    true
  );
});

test("does not mark non-image and non-pdf documents as browser previewable", async () => {
  const { isBrowserPreviewableDocument } = await import("../document-viewing");

  assert.equal(
    isBrowserPreviewableDocument({
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    false
  );
  assert.equal(
    isBrowserPreviewableDocument({ fileName: "settlement.xlsx" }),
    false
  );
  assert.equal(
    isBrowserPreviewableDocument({ fileName: "repayments.csv" }),
    false
  );
  assert.equal(isBrowserPreviewableDocument({ fileName: "document" }), false);
});

test("builds inline preview URLs without losing existing query params", async () => {
  const { buildInlineDocumentPreviewUrl } = await import("../document-viewing");

  assert.equal(
    buildInlineDocumentPreviewUrl("/api/documents/abc"),
    "/api/documents/abc?disposition=inline"
  );
  assert.equal(
    buildInlineDocumentPreviewUrl("/api/documents/abc?name=selfie.jpeg"),
    "/api/documents/abc?name=selfie.jpeg&disposition=inline"
  );
});

test("converts attachment content disposition to inline", async () => {
  const { toInlineContentDisposition } = await import("../document-viewing");

  assert.equal(toInlineContentDisposition(""), "inline");
  assert.equal(
    toInlineContentDisposition('attachment; filename="selfie.png"'),
    'inline; filename="selfie.png"'
  );
  assert.equal(
    toInlineContentDisposition("INLINE; filename=statement.pdf"),
    "INLINE; filename=statement.pdf"
  );
});
