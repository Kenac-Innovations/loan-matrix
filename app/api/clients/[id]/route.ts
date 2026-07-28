import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { hasSuperAdminServer } from "@/lib/authorization";
import {
  formatMobileForFineract,
  resolveCountryDialCodeForPhone,
} from "@/lib/phone-utils";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { normalizeUssdPhoneNumber } from "@/lib/ussd-admin-client";
import {
  updateUssdClientPhone,
  USSD_PHONE_UPDATE_NON_BLOCKING_STATUSES,
} from "@/lib/ussd-client-sync";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getErrorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status;
    if (status >= 400 && status < 600) {
      return status;
    }
  }
  return 500;
}

function getErrorDetails(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "errorData" in error
  ) {
    return (error as { errorData?: unknown }).errorData ?? null;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = parseInt(id);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const template = searchParams.get("template");
    const staffInSelectedOfficeOnly = searchParams.get(
      "staffInSelectedOfficeOnly"
    );

    const query = new URLSearchParams();
    if (template) {
      query.set("template", template);
    }
    if (staffInSelectedOfficeOnly) {
      query.set("staffInSelectedOfficeOnly", staffInSelectedOfficeOnly);
    }

    const endpoint = query.size
      ? `/clients/${clientId}?${query.toString()}`
      : `/clients/${clientId}`;

    const data = await fetchFineractAPI(endpoint, { authMode: "service" });
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Failed to get client:", error);
    return NextResponse.json(
      { error: "Failed to get client" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await hasSuperAdminServer())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const clientId = parseInt(id);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const body = await request.json();
    const outboundBody =
      typeof body === "object" && body !== null ? { ...body } : body;

    let ussdPhoneSyncWarning: { status: string; message: string } | null =
      null;

    if (
      typeof outboundBody === "object" &&
      outboundBody !== null &&
      typeof outboundBody.mobileNo === "string" &&
      outboundBody.mobileNo.trim()
    ) {
      let existingMobileNo: string | null | undefined;

      try {
        const currentClient = (await fetchFineractAPI(
          `/clients/${clientId}`
        )) as { mobileNo?: string | null };
        existingMobileNo = currentClient?.mobileNo;
      } catch (lookupError) {
        console.warn(
          `Failed to fetch current client ${clientId} for phone normalization:`,
          lookupError
        );
      }

      const formattedMobileNo = formatMobileForFineract(
        outboundBody.mobileNo,
        resolveCountryDialCodeForPhone(outboundBody.mobileNo, existingMobileNo)
      );
      outboundBody.mobileNo = formattedMobileNo;

      const phoneNumberChanged =
        !!existingMobileNo &&
        normalizeUssdPhoneNumber(existingMobileNo) !==
          normalizeUssdPhoneNumber(formattedMobileNo);

      if (phoneNumberChanged) {
        const tenant = await getTenantFromHeaders();
        const ussdServiceTenantId = tenant?.ussdServiceTenantId?.trim();

        if (ussdServiceTenantId) {
          try {
            const ussdResult = await updateUssdClientPhone({
              ussdServiceTenantId,
              externalId: clientId,
              currentPhoneNumber: existingMobileNo as string,
              newPhoneNumber: formattedMobileNo,
            });

            if (
              !ussdResult.success &&
              !USSD_PHONE_UPDATE_NON_BLOCKING_STATUSES.has(ussdResult.status)
            ) {
              console.warn(
                `USSD phone sync failed for client ${clientId} (status=${ussdResult.status}); leaving phone number unchanged in Fineract.`
              );
              delete outboundBody.mobileNo;
              ussdPhoneSyncWarning = {
                status: ussdResult.status,
                message: ussdResult.message,
              };
            }
          } catch (ussdError) {
            console.error(
              `USSD phone sync failed for client ${clientId}:`,
              ussdError
            );
            delete outboundBody.mobileNo;
            ussdPhoneSyncWarning = {
              status: "USSD_UNAVAILABLE",
              message:
                "Could not reach the USSD service to sync the phone number",
            };
          }
        }
      }
    }

    const data = await fetchFineractAPI(`/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outboundBody),
    });

    if (ussdPhoneSyncWarning) {
      const responseBody =
        typeof data === "object" && data !== null
          ? { ...data, ussdPhoneSync: { success: false, ...ussdPhoneSyncWarning } }
          : { data, ussdPhoneSync: { success: false, ...ussdPhoneSyncWarning } };
      return NextResponse.json(responseBody);
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Failed to update client:", error);
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to update client"),
        details: getErrorDetails(error),
      },
      { status: getErrorStatus(error) }
    );
  }
}
