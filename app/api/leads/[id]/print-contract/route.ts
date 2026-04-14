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

function injectPrintChrome(html: string, origin: string): string {
  const baseTag = `<base href="${origin}/">`;
  const printScript = `
    <script>
      window.addEventListener("load", function () {
        window.print();
      });
    </script>
  `;

  let output = html;

  if (output.includes("<head>")) {
    output = output.replace("<head>", `<head>${baseTag}`);
  } else if (/<head\s[^>]*>/.test(output)) {
    output = output.replace(/<head\s[^>]*>/, (match) => `${match}${baseTag}`);
  } else {
    output = `${baseTag}${output}`;
  }

  if (output.includes("</body>")) {
    output = output.replace("</body>", `${printScript}</body>`);
  } else {
    output = `${output}${printScript}`;
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

    const printableHtml = injectPrintChrome(contractHtml, request.nextUrl.origin);

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
