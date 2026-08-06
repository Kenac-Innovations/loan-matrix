import { NextRequest, NextResponse } from "next/server";
import { resolveSupersetRequestContext } from "@/lib/superset-server";
import {
  createSupersetAssertion,
  renderSupersetLaunchForm,
} from "@/lib/superset-sso";

export const dynamic = "force-dynamic";

function auditLaunch(fields: Record<string, string | number | boolean | null>) {
  console.info(JSON.stringify({ event: "superset_sso_launch", ...fields }));
}

export async function POST(request: NextRequest) {
  const { decision, displayName, email } =
    await resolveSupersetRequestContext(request);

  if (!decision.allowed) {
    auditLaunch({
      allowed: false,
      tenant: null,
      username: null,
      role: null,
      reason: decision.reason,
    });
    return NextResponse.json(
      { error: "Advanced Analytics is unavailable." },
      { status: decision.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const privateKey = process.env.SUPERSET_SSO_PRIVATE_KEY?.replaceAll(
    "\\n",
    "\n"
  );
  if (!privateKey) {
    auditLaunch({
      allowed: false,
      tenant: decision.tenantSlug,
      username: decision.username,
      role: decision.role,
      reason: "signing_key_missing",
    });
    return NextResponse.json(
      { error: "Advanced Analytics is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const assertion = await createSupersetAssertion(
      {
        subject: String(decision.userId),
        username: decision.username,
        name: displayName,
        email,
        tenantSlug: decision.tenantSlug,
        role: decision.role,
      },
      privateKey
    );
    const html = renderSupersetLaunchForm(decision.baseUrl, assertion);
    const formOrigin = new URL(decision.baseUrl).origin;

    auditLaunch({
      allowed: true,
      tenant: decision.tenantSlug,
      username: decision.username,
      role: decision.role,
      reason: "approved",
    });

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'none'; form-action ${formOrigin}; script-src 'unsafe-inline'; style-src 'unsafe-inline'`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    auditLaunch({
      allowed: false,
      tenant: decision.tenantSlug,
      username: decision.username,
      role: decision.role,
      reason: "assertion_signing_failed",
    });
    console.error("Superset SSO signing failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Advanced Analytics is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
