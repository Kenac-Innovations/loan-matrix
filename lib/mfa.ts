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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPublicBaseUrl() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).replace(/\/$/, "");
}

function getKenacLogoUrl() {
  const baseUrl = getPublicBaseUrl();
  return baseUrl ? `${baseUrl}/kenac_logo.png` : "/kenac_logo.png";
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

export function buildMfaChallengeEmail(input: {
  tenantName?: string | null;
  username: string;
  code: string;
}) {
  const trimmedTenantName = input.tenantName?.trim();
  const tenantProductName = trimmedTenantName
    ? `${trimmedTenantName} Loan Matrix`
    : "Loan Matrix";
  const safeTenantProductName = escapeHtml(tenantProductName);
  const safeUsername = escapeHtml(input.username || "there");
  const safeCode = escapeHtml(input.code);
  const logoUrl = escapeHtml(getKenacLogoUrl());
  const subject = `${tenantProductName} verification code`;
  const text = [
    `${tenantProductName}`,
    "",
    `Hello ${input.username || "there"},`,
    "",
    `Your verification code is ${input.code}.`,
    `This code expires in ${MFA_EXPIRY_MINUTES} minutes.`,
    "",
    "Do not share this code. Kenac will never ask for this code.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;margin:0;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbeafe;box-shadow:0 18px 42px rgba(37,99,235,0.14);">
            <tr>
              <td style="background:#2563eb;background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);padding:26px 30px 30px 30px;text-align:left;">
                <img src="${logoUrl}" width="118" alt="Kenac" style="display:block;border:0;outline:none;text-decoration:none;max-width:118px;height:auto;margin-bottom:22px;">
                <div style="font-size:13px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#bfdbfe;">Secure sign in</div>
                <h1 style="margin:8px 0 0 0;font-size:24px;line-height:31px;font-weight:800;color:#ffffff;">${safeTenantProductName}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 30px 10px 30px;">
                <p style="margin:0 0 10px 0;font-size:16px;line-height:24px;color:#111827;">Hello ${safeUsername},</p>
                <p style="margin:0;font-size:15px;line-height:23px;color:#4b5563;">Use this verification code to complete your Loan Matrix sign in.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 30px 8px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;">
                  <tr>
                    <td align="center" style="padding:24px 16px;">
                      <div style="font-size:12px;line-height:16px;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;color:#2563eb;margin-bottom:10px;">Verification code</div>
                      <div style="font-size:32px;line-height:38px;letter-spacing:0.28em;font-weight:800;color:#111827;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;">${safeCode}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 30px 30px 30px;">
                <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;color:#374151;">This code expires in ${MFA_EXPIRY_MINUTES} minutes.</p>
                <div style="border-left:4px solid #3b82f6;background:#f8fafc;border-radius:8px;padding:12px 14px;">
                  <p style="margin:0;font-size:13px;line-height:20px;color:#475569;">Do not share this code. Kenac will never ask for this code.</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;padding:18px 30px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;line-height:18px;color:#64748b;">If you did not request this code, contact your system administrator.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject,
    html,
    text,
  };
}

export async function sendMfaChallengeMessage(input: {
  tenantId: string;
  username: string;
  channel: MfaChannel;
  destination: string;
  code: string;
  tenantName?: string | null;
}) {
  const { tenantId, username, channel, destination, code, tenantName } = input;
  const message = `Your Loan Matrix ${MFA_CODE_LENGTH}-digit verification code is ${code}. It expires in ${MFA_EXPIRY_MINUTES} minutes.`;

  if (channel === "sms") {
    return sendSms([destination], message, {
      tenantId,
      logLabel: "mfa-login-sms",
    });
  }

  const email = buildMfaChallengeEmail({
    tenantName,
    username,
    code,
  });

  return sendEmail([destination], email.subject, email.html, {
    tenantId,
    text: email.text,
    logLabel: "mfa-login-email",
  });
}

export async function sendMfaChallengeMessages(input: {
  tenantId: string;
  username: string;
  tenantName?: string | null;
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
          tenantName: input.tenantName,
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
      select: { name: true, settings: true },
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
    tenantName: tenant?.name,
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
    tenantName: deliveryContext.tenantName,
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
