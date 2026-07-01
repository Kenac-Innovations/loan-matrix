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
  getTenantMfaConfig,
  invalidateActiveMfaChallenges,
  formatMfaDeliveryTargets,
  resolveMfaDeliveryTargets,
  resolveMfaDestinations,
  sendMfaChallengeMessages,
  serializeMfaAuthContext,
} from "@/lib/mfa";
import {
  isUserLoginBlocked,
  requireCurrentTenant,
  USER_LOGIN_BLOCKED_MESSAGE,
  upsertUserLogin,
} from "@/lib/user-login-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

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

    const destinations = resolveMfaDestinations({
      email: userLogin.email || authUser.fineractEmail,
      phone: userLogin.phone,
      countryCode: userLogin.countryCode,
    });
    const deliveryTargets = resolveMfaDeliveryTargets({
      configuredChannels: tenantMfaConfig.channels,
      destinations,
    });

    if (deliveryTargets.length === 0) {
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

    const primaryTarget = deliveryTargets[0];

    await invalidateActiveMfaChallenges(tenant.id, authUser.userId);

    const { challenge, code } = await createMfaChallengeRecord({
      tenantId: tenant.id,
      fineractUserId: authUser.userId,
      username: authUser.username,
      channel: primaryTarget.channel,
      destination: primaryTarget.destination,
      authContext: serializeMfaAuthContext({
        ...authUser,
        tenantId: tenant.id,
      }),
      maxAttempts: tenantMfaConfig.maxAttempts,
    });

    const delivery = await sendMfaChallengeMessages({
      tenantId: tenant.id,
      username: authUser.username,
      tenantName: tenant.name,
      targets: deliveryTargets,
      code,
    });

    if (delivery.successfulDeliveries === 0) {
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
            "We could not send a verification code through any configured MFA channel. Contact your system administrator for help.",
        },
        { status: 500 }
      );
    }

    const primaryDeliveredTarget = delivery.deliveredTargets[0];
    if (!primaryDeliveredTarget) {
      return NextResponse.json(
        {
          success: false,
          error:
            "We could not send a verification code through any configured MFA channel. Contact your system administrator for help.",
        },
        { status: 500 }
      );
    }

    const deliveredChallenge = await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: {
        channel: primaryDeliveredTarget.channel,
        destination: primaryDeliveredTarget.destination,
        maskedDestination: formatMfaDeliveryTargets(delivery.deliveredTargets),
      },
    });

    await upsertUserLogin({
      tenantId: tenant.id,
      fineractUserId: authUser.userId,
      username: authUser.username,
      email: userLogin.email || authUser.fineractEmail,
      phone: userLogin.phone,
      countryCode: userLogin.countryCode,
      lastMfaChannel: delivery.deliveredChannels.join(","),
      lastMfaSentAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      requiresMfa: true,
      challengeId: deliveredChallenge.id,
      channel: deliveredChallenge.channel,
      maskedDestination: deliveredChallenge.maskedDestination,
      deliveryDescription: deliveredChallenge.maskedDestination,
      expiresAt: deliveredChallenge.expiresAt,
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
