import { NextRequest, NextResponse } from "next/server";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { prisma } from "@/lib/prisma";
import { isOmamaTenantSlug } from "@/lib/omama-tenant";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

/**
 * Read the local HTML template and inline any relative image `src` attributes
 * as base64 data-URLs so the HTML is fully self-contained.
 */
function loadLocalTemplate(templateDir: string, filename: string): string | null {
  const filePath = path.join(templateDir, filename);
  if (!fs.existsSync(filePath)) return null;

  let html = fs.readFileSync(filePath, "utf-8");

  html = html.replace(/(<img\s[^>]*?\bsrc=")([^"]+)(")/gi, (_match, before, src, after) => {
    if (src.startsWith("data:") || src.startsWith("http")) return `${before}${src}${after}`;
    const imgPath = path.resolve(templateDir, src);
    if (!fs.existsSync(imgPath)) return `${before}${src}${after}`;
    const ext = path.extname(imgPath).toLowerCase();
    const mime = MIME_BY_EXT[ext] || "application/octet-stream";
    const b64 = fs.readFileSync(imgPath).toString("base64");
    return `${before}data:${mime};base64,${b64}${after}`;
  });

  return html;
}

/**
 * Fetch an image URL server-side (follows redirects, ignores bad SSL certs)
 * and return it as a base64 data-URL string.  Returns null on any failure.
 */
async function fetchLogoAsDataUrl(url: string): Promise<string | null> {
  const MAX_REDIRECTS = 5;

  const doGet = (target: string, redirectsLeft: number): Promise<string | null> =>
    new Promise((resolve) => {
      const mod = target.startsWith("https") ? https : http;
      const req = mod.get(target, { rejectUnauthorized: false }, (res) => {
        if (
          redirectsLeft > 0 &&
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          const next = new URL(res.headers.location, target).href;
          resolve(doGet(next, redirectsLeft - 1));
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (buf.length === 0) { resolve(null); return; }
          const ct = res.headers["content-type"] || "image/png";
          const mime = ct.split(";")[0].trim();
          resolve(`data:${mime};base64,${buf.toString("base64")}`);
        });
        res.on("error", () => resolve(null));
      });
      req.on("error", () => resolve(null));
      req.setTimeout(10_000, () => { req.destroy(); resolve(null); });
    });

  return doGet(url, MAX_REDIRECTS);
}

const OMAMA_TEMPLATE = {
  dir: path.join(process.cwd(), "templates", "omama-full-loan"),
  file: "full-loan-template-from-db.html",
  name: "Omama Full Loan Contract",
};

function getLocalTemplateConfig(tenantSlug: string) {
  if (isOmamaTenantSlug(tenantSlug)) {
    return OMAMA_TEMPLATE;
  }

  return null;
}

/**
 * GET /api/tenant/contract-template?slug=full-loan
 * Returns the loan contract template HTML for the current tenant.
 * Only tenants with a configured template get one; others receive null.
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const slug =
      request.nextUrl?.searchParams?.get("slug") ?? "full-loan";

    if (slug !== "full-loan") {
      return NextResponse.json({ html: null, name: null });
    }

    const dbTemplate = await prisma.loanContractTemplate.findFirst({
      where: {
        tenantId: tenant.id,
        slug,
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: {
        content: true,
        name: true,
      },
    });

    let html = dbTemplate?.content || null;
    let name = dbTemplate?.name || null;

    if (!html) {
      const templateConfig = getLocalTemplateConfig(tenant.slug);
      if (!templateConfig) {
        return NextResponse.json({ html: null, name: null });
      }

      html = loadLocalTemplate(templateConfig.dir, templateConfig.file);
      name = templateConfig.name;
    }

    if (!html) {
      return NextResponse.json({ html: null, name: null });
    }

    let logoUrl: string | null = null;
    if (tenant.logoFileUrl) {
      logoUrl = await fetchLogoAsDataUrl(tenant.logoFileUrl);
    }

    return NextResponse.json({
      html,
      name,
      slug,
      logoUrl,
    });
  } catch (error) {
    console.error("Error fetching contract template:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract template" },
      { status: 500 }
    );
  }
}
