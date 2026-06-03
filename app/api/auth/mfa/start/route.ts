import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateWithFineractCredentials,
  FineractAuthenticationError,
  getPermissionValidationError,
} from "@/lib/fineract-auth";
import {
  buildMissingMfaContactMessage,
  createMfaChallengeRecord,
  getAvailableMfaChannels,
  getTenantMfaConfig,
  invalidateActiveMfaChallenges,
  maskMfaDestination,
  resolveMfaDestinations,
  sendMfaChallengeMessage,
  serializeMfaAuthContext,
} from "@/lib/mfa";
import {
  isUserLoginBlocked,
  requireCurrentTenant,
  USER_LOGIN_BLOCKED_MESSAGE,
  upsertUserLogin,
} from "@/lib/user-login-service";
import type { MfaChannel } from "@/shared/types/tenant";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password =
      typeof body.password === "string" ? body.password : "";
    const requestedChannel =
      body.channel === "email" || body.channel === "sms"
        ? (body.channel as MfaChannel)
        : undefined;

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Username and password are required",
        },
        { status: 400 }
      );
    }

    const tenant = await requireCurrentTenant();
    const authUser = await authenticateWithFineractCredentials({
      username,
      password,
    });

    const validationError = getPermissionValidationError(authUser.rawPermissions);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 403 }
      );
    }

    const userLogin = await upsertUserLogin({
      tenantId: tenant.id,
      fineractUserId: authUser.userId,
      username: authUser.username,
      ...(authUser.fineractEmail
        ? { email: authUser.fineractEmail }
        : {}),
    });

    const tenantMfaConfig = getTenantMfaConfig(tenant.settings);
    if (!tenantMfaConfig.usesMfa) {
      return NextResponse.json({
        success: true,
        requiresMfa: false,
      });
    }

    if (isUserLoginBlocked(userLogin)) {
      return NextResponse.json(
        {
          success: false,
          error: USER_LOGIN_BLOCKED_MESSAGE,
        },
        { status: 423 }
      );
    }

    if (tenantMfaConfig.channels.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Multi-factor authentication is enabled for your tenant, but no channels are configured. Contact your system administrator for help.",
        },
        { status: 400 }
      );
    }

    const destinations = resolveMfaDestinations({
      email: userLogin.email || authUser.fineractEmail,
      phone: userLogin.phone,
      countryCode: userLogin.countryCode,
    });
    const availableChannels = getAvailableMfaChannels(
      tenantMfaConfig.channels,
      destinations
    );

    if (requestedChannel && !tenantMfaConfig.channels.includes(requestedChannel)) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected MFA channel is not enabled for your tenant.",
        },
        { status: 400 }
      );
    }

    if (
      requestedChannel &&
      !availableChannels.includes(requestedChannel)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: buildMissingMfaContactMessage({
            configuredChannels: tenantMfaConfig.channels,
            destinations,
            requestedChannel,
          }),
        },
        { status: 400 }
      );
    }

    if (availableChannels.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: buildMissingMfaContactMessage({
            configuredChannels: tenantMfaConfig.channels,
            destinations,
          }),
        },
        { status: 400 }
      );
    }

    if (!requestedChannel && availableChannels.length > 1) {
      return NextResponse.json({
        success: true,
        requiresMfa: true,
        requiresChannelSelection: true,
        availableChannels,
        destinations: Object.fromEntries(
          availableChannels.map((channel) => [
            channel,
            maskMfaDestination(
              channel,
              channel === "email"
                ? destinations.email || ""
                : destinations.sms || ""
            ),
          ])
        ),
      });
    }

    const chosenChannel = requestedChannel ?? availableChannels[0];
    const destination = destinations[chosenChannel];

    if (!destination) {
      return NextResponse.json(
        {
          success: false,
          error: buildMissingMfaContactMessage({
            configuredChannels: tenantMfaConfig.channels,
            destinations,
            requestedChannel: chosenChannel,
          }),
        },
        { status: 400 }
      );
    }

    await invalidateActiveMfaChallenges(tenant.id, authUser.userId);

    const { challenge, code } = await createMfaChallengeRecord({
      tenantId: tenant.id,
      fineractUserId: authUser.userId,
      username: authUser.username,
      channel: chosenChannel,
      destination,
      authContext: serializeMfaAuthContext({
        ...authUser,
        tenantId: tenant.id,
      }),
      maxAttempts: tenantMfaConfig.maxAttempts,
    });

    const delivered = await sendMfaChallengeMessage({
      tenantId: tenant.id,
      username: authUser.username,
      channel: chosenChannel,
      destination,
      code,
    });

    if (!delivered) {
      await prisma.mfaChallenge.update({
        where: { id: challenge.id },
        data: {
          invalidatedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          success: false,
          error:
            chosenChannel === "email"
              ? "We could not send a verification email. Contact your system administrator for help."
              : "We could not send a verification SMS. Contact your system administrator for help.",
        },
        { status: 500 }
      );
    }

    await upsertUserLogin({
      tenantId: tenant.id,
      fineractUserId: authUser.userId,
      username: authUser.username,
      email: userLogin.email || authUser.fineractEmail,
      phone: userLogin.phone,
      countryCode: userLogin.countryCode,
      lastMfaChannel: chosenChannel,
      lastMfaSentAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      requiresMfa: true,
      challengeId: challenge.id,
      channel: chosenChannel,
      maskedDestination: challenge.maskedDestination,
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    if (error instanceof FineractAuthenticationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error("Error starting MFA flow:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to start multi-factor authentication",
      },
      { status: 500 }
    );
  }
}
