import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { canPrintLoanContract } from "@/lib/loan-contract-print";
import { fillOmamaContractTemplate } from "@/app/(application)/leads/new/components/omama-contract-template";
import { generateContractHTML } from "@/app/(application)/leads/new/components/contract-template";
import type { ContractData } from "@/app/(application)/leads/new/components/contract-types";

type TemplateResponse = {
  html?: string | null;
  logoUrl?: string | null;
};

type ContractDataResponse = {
  success?: boolean;
  data?: ContractData;
  error?: string;
};

function getForwardedHeaders(request: NextRequest): HeadersInit {
  const forwardedHeaders: HeadersInit = {};

  for (const headerName of ["cookie", "origin", "referer"]) {
    const value = request.headers.get(headerName);
    if (value) {
      forwardedHeaders[headerName] = value;
    }
  }

  return forwardedHeaders;
}

function injectContractChrome(
  html: string,
  origin: string,
  options: {
    action: "print" | "pdf" | "view";
    fileName: string;
  }
): string {
  const baseTag = `<base href="${origin}/">`;
  const toolbar = `
    <div style="position:sticky;top:0;z-index:9999;display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid #e5e7eb;background:#ffffff;">
      <button type="button" onclick="window.print()" style="border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;padding:10px 14px;font:600 14px sans-serif;cursor:pointer;">
        Print
      </button>
      <button type="button" id="download-pdf-btn" data-filename="${options.fileName}" style="border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;padding:10px 14px;font:600 14px sans-serif;cursor:pointer;">
        Download PDF
      </button>
      <button type="button" onclick="window.location.reload()" style="border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;padding:10px 14px;font:600 14px sans-serif;cursor:pointer;">
        Refresh
      </button>
      <span style="font:400 12px sans-serif;color:#64748b;">
        If the browser adds headers or footers, turn them off in the print dialog.
      </span>
    </div>
  `;
  const actionScript = `
    <script>
      window.addEventListener("load", function () {
        var action = ${JSON.stringify(options.action)};
        var btn = document.getElementById("download-pdf-btn");
        var exportPdf = function () {
          if (!btn || typeof window.html2pdf !== "function") {
            return;
          }

          var filename = btn.getAttribute("data-filename") || "loan-contract.pdf";
          var target = document.querySelector("[data-contract-content]");
          if (!target) {
            return;
          }

          btn.disabled = true;
          btn.textContent = "Generating PDF...";

          window.html2pdf()
            .set({
              margin: 10,
              filename: filename,
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
              pagebreak: { mode: ["avoid-all", "css", "legacy"] }
            })
            .from(target)
            .save()
            .then(function () {
              btn.disabled = false;
              btn.textContent = "Download PDF";
            })
            .catch(function () {
              btn.disabled = false;
              btn.textContent = "Download PDF";
            });
        };

        if (btn) {
          btn.addEventListener("click", exportPdf);
        }

        if (action === "print") {
          window.print();
          return;
        }

        if (action === "pdf") {
          exportPdf();
        }
      });
    </script>
  `;
  const pdfScript =
    options.action === "pdf"
      ? `<script src="/html2pdf.bundle.min.js"></script>`
      : "";

  let output = html;

  if (output.includes("<head>")) {
    output = output.replace("<head>", `<head>${baseTag}${pdfScript}`);
  } else if (/<head\s[^>]*>/.test(output)) {
    output = output.replace(
      /<head\s[^>]*>/,
      (match) => `${match}${baseTag}${pdfScript}`
    );
  } else {
    output = `${baseTag}${pdfScript}${output}`;
  }

  if (output.includes("<body>")) {
    output = output.replace("<body>", `<body>${toolbar}<div data-contract-content>`);
  } else if (/<body\s[^>]*>/.test(output)) {
    output = output.replace(/<body\s[^>]*>/, (match) => `${match}${toolbar}<div data-contract-content>`);
  } else {
    output = `${toolbar}<div data-contract-content>${output}`;
  }

  if (output.includes("</body>")) {
    output = output.replace("</body>", `</div>${actionScript}</body>`);
  } else {
    output = `${output}</div>${actionScript}`;
  }

  return output;
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
    const forwardedHeaders = getForwardedHeaders(request);
    const actionParam = request.nextUrl.searchParams.get("action");
    const action =
      actionParam === "pdf" || actionParam === "view" ? actionParam : "print";

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        fineractLoanId: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.fineractLoanId) {
      return NextResponse.json(
        { error: "This lead does not have a linked Fineract loan." },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    const loan = await fineractService.getLoan(Number(lead.fineractLoanId));
    const loanStatus = loan.status?.value || null;

    if (!canPrintLoanContract(tenantSlug, loanStatus)) {
      return NextResponse.json(
        {
          error:
            "Loan contracts can only be printed for Omama loans after the application has reached final approval.",
        },
        { status: 409 }
      );
    }

    const [contractDataResponse, templateResponse] = await Promise.all([
      fetch(`${request.nextUrl.origin}/api/leads/${leadId}/contract-data`, {
        headers: forwardedHeaders,
        cache: "no-store",
      }),
      fetch(`${request.nextUrl.origin}/api/tenant/contract-template?slug=full-loan`, {
        headers: forwardedHeaders,
        cache: "no-store",
      }),
    ]);

    const contractPayload = (await contractDataResponse.json()) as ContractDataResponse;

    if (!contractDataResponse.ok || !contractPayload.success || !contractPayload.data) {
      return NextResponse.json(
        {
          error:
            contractPayload.error ||
            "Failed to generate the latest contract data for printing.",
        },
        { status: contractDataResponse.status || 500 }
      );
    }

    const templatePayload = templateResponse.ok
      ? ((await templateResponse.json()) as TemplateResponse)
      : null;

    const contractHtml = templatePayload?.html
      ? fillOmamaContractTemplate(
          templatePayload.html,
          contractPayload.data,
          templatePayload.logoUrl || null
        )
      : generateContractHTML(contractPayload.data);

    const contractFileName = `loan-contract-${leadId}.pdf`;
    const printableHtml = injectContractChrome(contractHtml, request.nextUrl.origin, {
      action,
      fileName: contractFileName,
    });

    return new NextResponse(printableHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Loan-Contract-Tenant": tenantSlug,
      },
    });
  } catch (error) {
    console.error("Error printing loan contract:", error);
    const message =
      error instanceof Error ? error.message : "Failed to print loan contract";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
