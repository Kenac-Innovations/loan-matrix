import { createHash, randomBytes, randomInt } from "crypto";
import { Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { normalizeSmsPhoneNumber } from "@/lib/phone-utils";
import { sendEmail, sendSms } from "@/lib/notification-service";
import {
  DEFAULT_MFA_MAX_ATTEMPTS,
  MFA_CODE_LENGTH,
  MFA_CODE_PATTERN,
} from "@/shared/constants/mfa";
import type { Role, SpecificPermission } from "@/shared/types/auth";
import type { MfaChannel } from "@/shared/types/tenant";
import type { FineractAuthenticatedUser } from "@/lib/fineract-auth";
import {
  blockUserLogin,
  getUserLoginByFineractUserId,
  isUserLoginBlocked,
  USER_LOGIN_BLOCKED_MESSAGE,
} from "@/lib/user-login-service";

const MFA_EXPIRY_MINUTES = 10;
const MFA_RESEND_COOLDOWN_SECONDS = 60;
const MFA_MAX_RESENDS = 5;
const MFA_ALLOWED_CHANNELS: MfaChannel[] = ["email", "sms"];

type MfaDestinations = Record<MfaChannel, string | null>;

type MfaDeliveryTarget = {
  channel: MfaChannel;
  destination: string;
};

function getMfaChannelLabel(channel: MfaChannel) {
  return channel === "sms" ? "SMS" : "email";
}

type SerializedMfaAuthContext = {
  id: string;
  tenantId: string;
  userId: number;
  username: string;
  name: string;
  email: string;
  accessToken: string;
  base64EncodedAuthenticationKey: string;
  officeId?: number;
  officeName?: string;
  roles: Role[];
  permissions: SpecificPermission[];
  rawPermissions: string[];
  shouldRenewPassword?: boolean;
  isTwoFactorAuthenticationRequired?: boolean;
};

type MfaAttemptState = {
  attemptsUsed: number;
  maxAttempts: number;
  remainingAttempts: number;
};

type MfaChallengeErrorDetails = Partial<MfaAttemptState> & {
  accountBlocked?: boolean;
};

export class MfaChallengeError extends Error {
  status: number;
  details?: MfaChallengeErrorDetails;

  constructor(message: string, status = 400, details?: MfaChallengeErrorDetails) {
    super(message);
    this.name = "MfaChallengeError";
    this.status = status;
    this.details = details;
  }
}

function getMfaAttemptState(challenge: {
  attempts: number;
  maxAttempts: number;
}): MfaAttemptState {
  return {
    attemptsUsed: challenge.attempts,
    maxAttempts: challenge.maxAttempts,
    remainingAttempts: Math.max(challenge.maxAttempts - challenge.attempts, 0),
  };
}

export function getTenantMfaConfig(settings: unknown): {
  usesMfa: boolean;
  channels: MfaChannel[];
  maxAttempts: number;
} {
  const config =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : {};
  const featureConfig =
    config.features && typeof config.features === "object"
      ? (config.features as Record<string, unknown>)
      : {};

  const usesMfa = (featureConfig.usesMFA ?? config.usesMFA) === true;

  const rawChannels = Array.isArray(featureConfig.mfaChannels)
    ? featureConfig.mfaChannels
    : Array.isArray(config.mfaChannels)
      ? config.mfaChannels
      : [];

  const configuredChannels = rawChannels.filter((channel): channel is MfaChannel =>
    MFA_ALLOWED_CHANNELS.includes(channel as MfaChannel)
  );
  const channels =
    configuredChannels.length > 0 ? configuredChannels : (["email"] as MfaChannel[]);
  const rawMaxAttempts = featureConfig.mfaMaxAttempts ?? config.mfaMaxAttempts;
  const parsedMaxAttempts =
    typeof rawMaxAttempts === "number"
      ? rawMaxAttempts
      : typeof rawMaxAttempts === "string"
        ? Number(rawMaxAttempts)
        : NaN;
  const maxAttempts =
    Number.isFinite(parsedMaxAttempts) && parsedMaxAttempts >= 1
      ? Math.floor(parsedMaxAttempts)
      : DEFAULT_MFA_MAX_ATTEMPTS;

  return {
    usesMfa,
    channels,
    maxAttempts,
  };
}

export function resolveMfaDestinations(input: {
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
}): MfaDestinations {
  const email =
    typeof input.email === "string" && input.email.trim()
      ? input.email.trim()
      : null;
  const phone = normalizeSmsPhoneNumber(input.phone || "", input.countryCode);

  return {
    email,
    sms: phone,
  };
}

export function getAvailableMfaChannels(
  configuredChannels: MfaChannel[],
  destinations: MfaDestinations
) {
  return configuredChannels.filter((channel) => Boolean(destinations[channel]));
}

export function resolveMfaDeliveryTargets(input: {
  configuredChannels: MfaChannel[];
  destinations: MfaDestinations;
}): MfaDeliveryTarget[] {
  const seenChannels = new Set<MfaChannel>();

  return input.configuredChannels.reduce<MfaDeliveryTarget[]>((targets, channel) => {
    if (seenChannels.has(channel)) {
      return targets;
    }

    seenChannels.add(channel);
    const destination = input.destinations[channel];

    if (!destination) {
      return targets;
    }

    targets.push({
      channel,
      destination,
    });
    return targets;
  }, []);
}

export function maskEmailAddress(email: string) {
  const trimmed = email.trim();
  const [localPart, domain] = trimmed.split("@");

  if (!localPart || !domain) {
    return "***";
  }

  const visibleLocal = localPart.slice(0, 1);
  return `${visibleLocal}${"*".repeat(Math.max(localPart.length - 1, 2))}@${domain}`;
}

export function maskPhoneNumber(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) {
    return "*".repeat(trimmed.length || 3);
  }

  return `${trimmed.slice(0, 3)}${"*".repeat(
    Math.max(trimmed.length - 5, 3)
  )}${trimmed.slice(-2)}`;
}

export function maskMfaDestination(channel: MfaChannel, destination: string) {
  return channel === "email"
    ? maskEmailAddress(destination)
    : maskPhoneNumber(destination);
}

export function formatMfaDeliveryTargets(targets: MfaDeliveryTarget[]) {
  return targets
    .map(
      (target) =>
        `${getMfaChannelLabel(target.channel)} to ${maskMfaDestination(
          target.channel,
          target.destination
        )}`
    )
    .join(", ");
}

export function buildMissingMfaContactMessage(input: {
  configuredChannels: MfaChannel[];
  destinations: MfaDestinations;
  requestedChannel?: MfaChannel | null;
}) {
  const { configuredChannels, destinations, requestedChannel } = input;

  if (requestedChannel === "sms" && !destinations.sms) {
    return "Your phone number is not configured. Contact your system administrator for help.";
  }

  if (requestedChannel === "email" && !destinations.email) {
    return "Your email address is not configured. Contact your system administrator for help.";
  }

  const needsEmail = configuredChannels.includes("email");
  const needsSms = configuredChannels.includes("sms");
  const hasEmail = Boolean(destinations.email);
  const hasSms = Boolean(destinations.sms);

  if (needsEmail && needsSms && !hasEmail && !hasSms) {
    return "Your email address and phone number are not configured. Contact your system administrator for help.";
  }

  if (needsSms && !hasSms) {
    return "Your phone number is not configured. Contact your system administrator for help.";
  }

  if (needsEmail && !hasEmail) {
    return "Your email address is not configured. Contact your system administrator for help.";
  }

  return "Your multi-factor authentication details are not configured. Contact your system administrator for help.";
}

function getMfaHashSecret() {
  return process.env.NEXTAUTH_SECRET || "loan-matrix-mfa-secret";
}

export function hashMfaCode(challengeId: string, code: string) {
  return createHash("sha256")
    .update(`${challengeId}:${code}:${getMfaHashSecret()}`)
    .digest("hex");
}

export function hashMfaVerificationToken(
  challengeId: string,
  verificationToken: string
) {
  return createHash("sha256")
    .update(`${challengeId}:${verificationToken}:${getMfaHashSecret()}`)
    .digest("hex");
}

export function generateMfaCode() {
  return randomInt(0, 10 ** MFA_CODE_LENGTH)
    .toString()
    .padStart(MFA_CODE_LENGTH, "0");
}

export function generateMfaVerificationToken() {
  return randomBytes(24).toString("hex");
}

export function getMfaExpiryDate() {
  return new Date(Date.now() + MFA_EXPIRY_MINUTES * 60 * 1000);
}

export function getMfaResendAvailableAt(lastSentAt: Date) {
  return new Date(lastSentAt.getTime() + MFA_RESEND_COOLDOWN_SECONDS * 1000);
}

export function getMfaResendCooldownSeconds() {
  return MFA_RESEND_COOLDOWN_SECONDS;
}

export function serializeMfaAuthContext(
  user: FineractAuthenticatedUser
): SerializedMfaAuthContext {
  return {
    id: user.id,
    tenantId: user.tenantId,
    userId: user.userId,
    username: user.username,
    name: user.name,
    email: user.email,
    accessToken: user.accessToken,
    base64EncodedAuthenticationKey: user.base64EncodedAuthenticationKey,
    officeId: user.officeId,
    officeName: user.officeName,
    roles: user.roles,
    permissions: user.permissions,
    rawPermissions: user.rawPermissions,
    shouldRenewPassword: user.shouldRenewPassword,
    isTwoFactorAuthenticationRequired: user.isTwoFactorAuthenticationRequired,
  };
}

export function parseMfaAuthContext(
  authContext: unknown
): SerializedMfaAuthContext | null {
  if (!authContext || typeof authContext !== "object") {
    return null;
  }

  const data = authContext as Record<string, unknown>;

  if (
    typeof data.tenantId !== "string" ||
    typeof data.id !== "string" ||
    typeof data.userId !== "number" ||
    typeof data.username !== "string" ||
    typeof data.name !== "string" ||
    typeof data.email !== "string" ||
    typeof data.accessToken !== "string" ||
    typeof data.base64EncodedAuthenticationKey !== "string" ||
    !Array.isArray(data.roles) ||
    !Array.isArray(data.permissions) ||
    !Array.isArray(data.rawPermissions)
  ) {
    return null;
  }

  return {
    id: data.id,
    tenantId: data.tenantId,
    userId: data.userId,
    username: data.username,
    name: data.name,
    email: data.email,
    accessToken: data.accessToken,
    base64EncodedAuthenticationKey: data.base64EncodedAuthenticationKey,
    officeId: typeof data.officeId === "number" ? data.officeId : undefined,
    officeName:
      typeof data.officeName === "string" ? data.officeName : undefined,
    roles: data.roles,
    permissions: data.permissions,
    rawPermissions: data.rawPermissions,
    shouldRenewPassword:
      typeof data.shouldRenewPassword === "boolean"
        ? data.shouldRenewPassword
        : undefined,
    isTwoFactorAuthenticationRequired:
      typeof data.isTwoFactorAuthenticationRequired === "boolean"
        ? data.isTwoFactorAuthenticationRequired
        : undefined,
  };
}

export async function sendMfaChallengeMessage(input: {
  tenantId: string;
  username: string;
  channel: MfaChannel;
  destination: string;
  code: string;
}) {
  const { tenantId, username, channel, destination, code } = input;
  const message = `Your Loan Matrix ${MFA_CODE_LENGTH}-digit verification code is ${code}. It expires in ${MFA_EXPIRY_MINUTES} minutes.`;

  if (channel === "sms") {
    return sendSms([destination], message, {
      tenantId,
      logLabel: "mfa-login-sms",
    });
  }

  const subject = "Your Loan Matrix verification code";
  const html = `<p>Hello ${username},</p><p>Your Loan Matrix ${MFA_CODE_LENGTH}-digit verification code is <strong>${code}</strong>.</p><p>This code expires in ${MFA_EXPIRY_MINUTES} minutes.</p>`;

  return sendEmail([destination], subject, html, {
    tenantId,
    text: `Hello ${username},\n\n${message}`,
    logLabel: "mfa-login-email",
  });
}

export async function sendMfaChallengeMessages(input: {
  tenantId: string;
  username: string;
  targets: MfaDeliveryTarget[];
  code: string;
  sendMessage?: typeof sendMfaChallengeMessage;
}) {
  const sendMessage = input.sendMessage ?? sendMfaChallengeMessage;
  const results = await Promise.all(
    input.targets.map(async (target) => {
      try {
        const delivered = await sendMessage({
          tenantId: input.tenantId,
          username: input.username,
          channel: target.channel,
          destination: target.destination,
          code: input.code,
        });

        return {
          ...target,
          delivered,
        };
      } catch (error) {
        console.error(
          `Failed to send MFA ${target.channel} notification:`,
          error
        );
        return {
          ...target,
          delivered: false,
        };
      }
    })
  );
  const deliveredTargets = results.filter((result) => result.delivered);

  return {
    results,
    deliveredTargets,
    deliveredChannels: deliveredTargets.map((target) => target.channel),
    successfulDeliveries: deliveredTargets.length,
  };
}

export async function invalidateActiveMfaChallenges(
  tenantId: string,
  fineractUserId: number
) {
  await prisma.mfaChallenge.updateMany({
    where: {
      tenantId,
      fineractUserId,
      consumedAt: null,
      invalidatedAt: null,
    },
    data: {
      invalidatedAt: new Date(),
    },
  });
}

export async function createMfaChallengeRecord(input: {
  tenantId: string;
  fineractUserId: number;
  username: string;
  channel: MfaChannel;
  destination: string;
  authContext: SerializedMfaAuthContext;
  maxAttempts: number;
}) {
  const code = generateMfaCode();
  const expiresAt = getMfaExpiryDate();
  const challenge = await prisma.mfaChallenge.create({
    data: {
      tenantId: input.tenantId,
      fineractUserId: input.fineractUserId,
      username: input.username,
      channel: input.channel,
      destination: input.destination,
      maskedDestination: maskMfaDestination(input.channel, input.destination),
      codeHash: "",
      authContext: input.authContext as unknown as Prisma.InputJsonValue,
      expiresAt,
      maxAttempts: input.maxAttempts,
    },
  });

  const codeHash = hashMfaCode(challenge.id, code);
  const updatedChallenge = await prisma.mfaChallenge.update({
    where: { id: challenge.id },
    data: {
      codeHash,
    },
  });

  return {
    challenge: updatedChallenge,
    code,
  };
}

async function getTenantChallengeOrThrow(tenantId: string, challengeId: string) {
  const challenge = await prisma.mfaChallenge.findFirst({
    where: {
      id: challengeId,
      tenantId,
    },
  });

  if (!challenge) {
    throw new MfaChallengeError("Verification challenge not found.", 404);
  }

  return challenge;
}

async function getMfaChallengeDeliveryContext(
  tenantId: string,
  challenge: {
    fineractUserId: number;
    authContext: unknown;
  }
) {
  const [tenant, userLogin] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    }),
    getUserLoginByFineractUserId(tenantId, challenge.fineractUserId),
  ]);
  const tenantMfaConfig = getTenantMfaConfig(tenant?.settings);
  const authContext = parseMfaAuthContext(challenge.authContext);
  const destinations = resolveMfaDestinations({
    email: userLogin?.email || authContext?.email,
    phone: userLogin?.phone,
    countryCode: userLogin?.countryCode,
  });

  return {
    configuredChannels: tenantMfaConfig.channels,
    destinations,
    targets: resolveMfaDeliveryTargets({
      configuredChannels: tenantMfaConfig.channels,
      destinations,
    }),
  };
}

export async function getMfaChallengeSummary(tenantId: string, challengeId: string) {
  const challenge = await getTenantChallengeOrThrow(tenantId, challengeId);

  if (challenge.invalidatedAt || challenge.consumedAt) {
    throw new MfaChallengeError("Verification challenge is no longer active.", 410);
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new MfaChallengeError("Verification challenge has expired. Please log in again.", 410);
  }

  return {
    id: challenge.id,
    username: challenge.username,
    channel: challenge.channel as MfaChannel,
    maskedDestination: challenge.maskedDestination,
    deliveryDescription: challenge.maskedDestination,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: getMfaResendAvailableAt(challenge.lastSentAt),
    ...getMfaAttemptState(challenge),
  };
}

export async function resendMfaChallenge(tenantId: string, challengeId: string) {
  const challenge = await getTenantChallengeOrThrow(tenantId, challengeId);
  const userLogin = await getUserLoginByFineractUserId(
    tenantId,
    challenge.fineractUserId
  );

  if (isUserLoginBlocked(userLogin)) {
    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: {
        invalidatedAt: new Date(),
      },
    });

    throw new MfaChallengeError(USER_LOGIN_BLOCKED_MESSAGE, 423);
  }

  if (challenge.invalidatedAt || challenge.consumedAt) {
    throw new MfaChallengeError("Verification challenge is no longer active.", 410);
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new MfaChallengeError("Verification challenge has expired. Please log in again.", 410);
  }

  if (challenge.resendCount >= MFA_MAX_RESENDS) {
    throw new MfaChallengeError(
      "Too many resend attempts. Please log in again.",
      429
    );
  }

  const resendAvailableAt = getMfaResendAvailableAt(challenge.lastSentAt);

  if (resendAvailableAt.getTime() > Date.now()) {
    throw new MfaChallengeError(
      `Please wait ${Math.ceil(
        (resendAvailableAt.getTime() - Date.now()) / 1000
      )} seconds before requesting another code.`,
      429
    );
  }

  const code = generateMfaCode();
  const expiresAt = getMfaExpiryDate();
  const deliveryContext = await getMfaChallengeDeliveryContext(
    tenantId,
    challenge
  );

  if (deliveryContext.targets.length === 0) {
    throw new MfaChallengeError(
      buildMissingMfaContactMessage({
        configuredChannels: deliveryContext.configuredChannels,
        destinations: deliveryContext.destinations,
      }),
      400
    );
  }

  const updatedChallenge = await prisma.mfaChallenge.update({
    where: { id: challenge.id },
    data: {
      codeHash: hashMfaCode(challenge.id, code),
      verificationTokenHash: null,
      verifiedAt: null,
      attempts: 0,
      resendCount: {
        increment: 1,
      },
      lastSentAt: new Date(),
      expiresAt,
    },
  });

  const delivery = await sendMfaChallengeMessages({
    tenantId,
    username: updatedChallenge.username,
    targets: deliveryContext.targets,
    code,
  });

  if (delivery.successfulDeliveries === 0) {
    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: {
        invalidatedAt: new Date(),
      },
    });

    throw new MfaChallengeError(
      "We could not resend the verification code. Please log in again or contact your system administrator for help.",
      500
    );
  }

  const primaryDeliveredTarget = delivery.deliveredTargets[0];
  if (!primaryDeliveredTarget) {
    throw new MfaChallengeError(
      "We could not resend the verification code. Please log in again or contact your system administrator for help.",
      500
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

  return {
    id: deliveredChallenge.id,
    channel: deliveredChallenge.channel as MfaChannel,
    maskedDestination: deliveredChallenge.maskedDestination,
    deliveryDescription: deliveredChallenge.maskedDestination,
    expiresAt: deliveredChallenge.expiresAt,
    resendAvailableAt: getMfaResendAvailableAt(deliveredChallenge.lastSentAt),
    ...getMfaAttemptState(deliveredChallenge),
  };
}

export async function verifyMfaChallengeCode(input: {
  tenantId: string;
  challengeId: string;
  code: string;
}) {
  const { tenantId, challengeId, code } = input;
  const normalizedCode = code.trim();
  const challenge = await getTenantChallengeOrThrow(tenantId, challengeId);
  const userLogin = await getUserLoginByFineractUserId(
    tenantId,
    challenge.fineractUserId
  );

  if (isUserLoginBlocked(userLogin)) {
    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: {
        invalidatedAt: new Date(),
      },
    });

    throw new MfaChallengeError(USER_LOGIN_BLOCKED_MESSAGE, 423);
  }

  if (challenge.invalidatedAt || challenge.consumedAt) {
    throw new MfaChallengeError("Verification challenge is no longer active.", 410);
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new MfaChallengeError("Verification challenge has expired. Please log in again.", 410);
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new MfaChallengeError(
      "Too many incorrect verification attempts. Please log in again.",
      429,
      {
        ...getMfaAttemptState(challenge),
        accountBlocked: true,
      }
    );
  }

  if (!MFA_CODE_PATTERN.test(normalizedCode)) {
    throw new MfaChallengeError(
      `Enter the ${MFA_CODE_LENGTH}-digit verification code.`,
      400
    );
  }

  const incomingHash = hashMfaCode(challenge.id, normalizedCode);

  if (incomingHash !== challenge.codeHash) {
    const nextAttempts = challenge.attempts + 1;
    const nextAttemptState = getMfaAttemptState({
      attempts: nextAttempts,
      maxAttempts: challenge.maxAttempts,
    });
    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: nextAttempts,
        ...(nextAttempts >= challenge.maxAttempts
          ? { invalidatedAt: new Date() }
          : {}),
      },
    });

    if (nextAttempts >= challenge.maxAttempts) {
      await blockUserLogin({
        tenantId,
        fineractUserId: challenge.fineractUserId,
        username: challenge.username,
        note: `Auto-blocked after ${challenge.maxAttempts} incorrect MFA verification attempt${challenge.maxAttempts === 1 ? "" : "s"}.`,
        source: "SYSTEM_MFA_MAX_ATTEMPTS",
      });

      throw new MfaChallengeError(
        "Too many incorrect verification attempts. Please log in again.",
        429,
        {
          ...nextAttemptState,
          accountBlocked: true,
        }
      );
    }

    throw new MfaChallengeError(
      "The verification code you entered is incorrect.",
      400,
      nextAttemptState
    );
  }

  const verificationToken = generateMfaVerificationToken();
  await prisma.mfaChallenge.update({
    where: { id: challenge.id },
    data: {
      verificationTokenHash: hashMfaVerificationToken(
        challenge.id,
        verificationToken
      ),
      verifiedAt: new Date(),
    },
  });

  return {
    challengeId: challenge.id,
    verificationToken,
  };
}

export async function consumeVerifiedMfaChallenge(input: {
  challengeId: string;
  verificationToken: string;
}) {
  const challenge = await prisma.mfaChallenge.findUnique({
    where: {
      id: input.challengeId,
    },
  });

  if (!challenge) {
    return null;
  }

  if (
    challenge.invalidatedAt ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() <= Date.now() ||
    !challenge.verifiedAt ||
    !challenge.verificationTokenHash
  ) {
    return null;
  }

  const expectedTokenHash = hashMfaVerificationToken(
    challenge.id,
    input.verificationToken
  );

  if (expectedTokenHash !== challenge.verificationTokenHash) {
    return null;
  }

  const authContext = parseMfaAuthContext(challenge.authContext);
  if (!authContext) {
    return null;
  }

  await prisma.mfaChallenge.update({
    where: { id: challenge.id },
    data: {
      consumedAt: new Date(),
      verificationTokenHash: null,
    },
  });

  return authContext;
}
