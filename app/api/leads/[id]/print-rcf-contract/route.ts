import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { generateRcfContractHTML } from "@/app/(application)/leads/new/components/rcf-contract-template";
import type { RcfContractData } from "@/app/(application)/leads/new/components/rcf-contract-types";

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (host) return `${forwardedProto || "https"}://${host}`;
  return request.nextUrl.origin;
}

function getForwardedHeaders(request: NextRequest): HeadersInit {
  const headers: HeadersInit = {};
  for (const name of ["cookie", "origin", "referer", "x-forwarded-host", "x-forwarded-proto", "host"]) {
    const val = request.headers.get(name);
    if (val) headers[name] = val;
  }
  return headers;
}

function injectContractChrome(
  html: string,
  origin: string,
  options: { action: "print" | "pdf" | "view"; fileName: string }
): string {
  const baseTag = `<base href="${origin}/">`;
  const toolbar = `
    <div style="position:sticky;top:0;z-index:9999;display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid #e5e7eb;background:#ffffff;">
      <span style="flex:1;font:400 12px sans-serif;color:#64748b;">
        To hide browser headers and footers when printing, open print settings and turn off headers/footers.
      </span>
      <button type="button" id="download-pdf-btn" data-filename="${options.fileName}" style="border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:10px 14px;font:600 14px sans-serif;cursor:pointer;">
        Download PDF
      </button>
      <button type="button" onclick="window.print()" style="border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:10px 14px;font:600 14px sans-serif;cursor:pointer;">
        Print
      </button>
    </div>
  `;
  const actionScript = `
    <script>
      window.addEventListener("load", function () {
        var action = ${JSON.stringify(options.action)};
        var btn = document.getElementById("download-pdf-btn");
        var exportPdf = function () {
          if (!btn || typeof window.html2pdf !== "function") return;
          var filename = btn.getAttribute("data-filename") || "rcf-agreement.pdf";
          var target = document.querySelector("[data-contract-content]");
          if (!target) return;
          btn.disabled = true;
          btn.textContent = "Generating PDF...";
          window.html2pdf().set({
            margin: 10,
            filename: filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["avoid-all", "css", "legacy"] }
          }).from(target).save()
            .then(function () { btn.disabled = false; btn.textContent = "Download PDF"; })
            .catch(function () { btn.disabled = false; btn.textContent = "Download PDF"; });
        };
        if (btn) btn.addEventListener("click", exportPdf);
        if (action === "print") { window.print(); return; }
        if (action === "pdf") exportPdf();
      });
    </script>
  `;
  const pdfScript = `<script src="/html2pdf.bundle.min.js"></script>`;

  let out = html;
  if (out.includes("<head>")) {
    out = out.replace("<head>", `<head>${baseTag}${pdfScript}`);
  } else {
    out = `${baseTag}${pdfScript}${out}`;
  }
  if (out.includes("<body>")) {
    out = out.replace("<body>", `<body>${toolbar}<div data-contract-content>`);
  } else if (/<body\s[^>]*>/.test(out)) {
    out = out.replace(/<body\s[^>]*>/, (m) => `${m}${toolbar}<div data-contract-content>`);
  } else {
    out = `${toolbar}<div data-contract-content>${out}`;
  }
  if (out.includes("</body>")) {
    out = out.replace("</body>", `</div>${actionScript}</body>`);
  } else {
    out = `${out}</div>${actionScript}`;
  }
  return out;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = await context.params;
    const tenantSlug = extractTenantSlugFromRequest(request);
    const actionParam = request.nextUrl.searchParams.get("action");
    const validateOnly = request.nextUrl.searchParams.get("validate") === "true";
    const action =
      actionParam === "pdf" || actionParam === "view" ? actionParam : "print";

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { facilityType: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.facilityType !== "REVOLVING_CREDIT") {
      return NextResponse.json(
        { error: "RCF contracts are only available for revolving credit facility leads" },
        { status: 409 }
      );
    }

    const requestOrigin = getRequestOrigin(request);
    const forwardedHeaders = getForwardedHeaders(request);

    const dataResponse = await fetch(
      `${requestOrigin}/api/leads/${leadId}/rcf-contract-data`,
      { headers: forwardedHeaders, cache: "no-store" }
    );
    const payload = await dataResponse.json() as { success?: boolean; data?: RcfContractData; error?: string };

    if (!dataResponse.ok || !payload.success || !payload.data) {
      return NextResponse.json(
        { error: payload.error || "Failed to generate RCF contract data" },
        { status: dataResponse.status || 500 }
      );
    }

    if (validateOnly) {
      return NextResponse.json({ success: true });
    }

    const contractHtml = generateRcfContractHTML(payload.data);
    const fileName = `rcf-agreement-${leadId}.pdf`;
    const printableHtml = injectContractChrome(contractHtml, requestOrigin, { action, fileName });

    return new NextResponse(printableHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-RCF-Contract-Tenant": tenantSlug,
      },
    });
  } catch (error) {
    console.error("Error printing RCF contract:", error);
    const message = error instanceof Error ? error.message : "Failed to print RCF contract";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
