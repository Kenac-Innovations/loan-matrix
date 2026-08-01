import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  getFineractServiceWithSystemAuth,
} from "@/lib/fineract-api";
import {
  getTenantSelfPasswordResetConfig,
  type SelfPasswordResetChannel,
} from "@/shared/types/tenant";
import {
  normalizeSmsPhoneNumber,
  sendEmail,
  sendSms,
} from "@/lib/notification-service";
import { upsertUserLogin } from "@/lib/user-login-service";

export const PASSWORD_RESET_DISABLED_MESSAGE =
  "Self password reset is not configured. Please contact your system administrator.";
export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If the username is registered and has a configured contact, a verification code has been sent.";

const PASSWORD_RESET_EXPIRY_MINUTES = 10;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_MAX_RESENDS = 5;
const PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 60;
const PASSWORD_RESET_CODE_LENGTH = 6;

type PasswordResetContext = {
  requestIp?: string | null;
  userAgent?: string | null;
};

type PasswordResetUser = {
  fineractUserId: number;
  username: string;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
};

type DeliveryTarget = {
  channel: SelfPasswordResetChannel;
  destination: string;
};

export class PasswordResetError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PasswordResetError";
    this.status = status;
  }
}

function getPasswordResetSecret() {
  return process.env.NEXTAUTH_SECRET || "loan-matrix-password-reset-secret";
}

function hashPasswordResetValue(challengeId: string, value: string) {
  return createHash("sha256")
    .update(`${challengeId}:${value}:${getPasswordResetSecret()}`)
    .digest("hex");
}

function matchesHash(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function generatePasswordResetCode() {
  return randomInt(0, 10 ** PASSWORD_RESET_CODE_LENGTH)
    .toString()
    .padStart(PASSWORD_RESET_CODE_LENGTH, "0");
}

function generateVerificationToken() {
  return randomBytes(24).toString("hex");
}

function getExpiryDate() {
  return new Date(
    Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000
  );
}

function getResendAvailableAt(lastSentAt: Date) {
  return new Date(
    lastSentAt.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_SECONDS * 1000
  );
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return email || null;
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  const phone = value.trim();
  return phone || null;
}

function maskEmail(email: string) {
  const [localPart, domain] = email.trim().split("@");
  if (!localPart || !domain) return "***";
  return `${localPart.slice(0, 1)}${"*".repeat(
    Math.max(localPart.length - 1, 2)
  )}@${domain}`;
}

function maskPhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "*".repeat(trimmed.length || 3);
  return `${trimmed.slice(0, 3)}${"*".repeat(
    Math.max(trimmed.length - 5, 3)
  )}${trimmed.slice(-2)}`;
}

function maskDestination(channel: SelfPasswordResetChannel, destination: string) {
  return channel === "email"
    ? `Email to ${maskEmail(destination)}`
    : `SMS to ${maskPhone(destination)}`;
}

function getRequestDescription(targets: DeliveryTarget[]) {
  return targets
    .map((target) => maskDestination(target.channel, target.destination))
    .join(", ");
}

function getPasswordResetTargets(
  config: ReturnType<typeof getTenantSelfPasswordResetConfig>,
  user: PasswordResetUser
) {
  const destinations: Partial<Record<SelfPasswordResetChannel, string>> = {
    email: normalizeEmail(user.email) ?? undefined,
    sms: normalizeSmsPhoneNumber(user.phone ?? "", user.countryCode) ?? undefined,
  };

  return config.notificationChannels.reduce<DeliveryTarget[]>(
    (targets, channel) => {
      const destination = destinations[channel];
      if (destination) {
        targets.push({ channel, destination });
      }
      return targets;
    },
    []
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPasswordResetEmail(input: {
  tenantName?: string | null;
  username: string;
  code: string;
}) {
  const productName = input.tenantName?.trim()
    ? `${input.tenantName.trim()} Loan Matrix`
    : "Loan Matrix";
  const subject = `${productName} password reset code`;
  const safeProductName = escapeHtml(productName);
  const safeUsername = escapeHtml(input.username);
  const safeCode = escapeHtml(input.code);
  const text = [
    productName,
    "",
    `Hello ${input.username},`,
    "",
    `Your password reset verification code is ${input.code}.`,
    `This code expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes.`,
    "",
    "If you did not request this, contact your system administrator.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:28px 12px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dbeafe;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#2563eb;padding:26px 30px;color:#ffffff;">
            <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#bfdbfe;">Password reset</div>
            <h1 style="margin:8px 0 0;font-size:24px;line-height:31px;">${safeProductName}</h1>
          </td></tr>
          <tr><td style="padding:32px 30px 12px;">
            <p style="margin:0 0 10px;font-size:16px;line-height:24px;">Hello ${safeUsername},</p>
            <p style="margin:0;font-size:15px;line-height:23px;color:#4b5563;">Use this code to reset your Loan Matrix password.</p>
          </td></tr>
          <tr><td style="padding:22px 30px 8px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:24px;text-align:center;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:#2563eb;margin-bottom:10px;">Verification code</div>
              <div style="font-size:32px;line-height:38px;letter-spacing:.28em;font-weight:800;font-family:monospace;">${safeCode}</div>
            </div>
          </td></tr>
          <tr><td style="padding:16px 30px 30px;color:#475569;font-size:14px;line-height:22px;">
            This code expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes. Do not share it with anyone.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

async function writePasswordResetLog(input: {
  tenantId: string;
  challengeId?: string | null;
  fineractUserId?: number | null;
  username: string;
  event: string;
  configuredChannels?: string[];
  deliveredChannels?: string[];
  maskedDestinations?: string[];
  failureReason?: string | null;
  context?: PasswordResetContext;
}) {
  await prisma.passwordResetLog.create({
    data: {
      tenantId: input.tenantId,
      challengeId: input.challengeId ?? null,
      fineractUserId: input.fineractUserId ?? null,
      username: input.username,
      event: input.event,
      configuredChannels: input.configuredChannels ?? [],
      deliveredChannels: input.deliveredChannels ?? [],
      maskedDestinations: input.maskedDestinations ?? [],
      failureReason: input.failureReason ?? null,
      requestIp: input.context?.requestIp ?? null,
      userAgent: input.context?.userAgent ?? null,
    },
  });
}

async function findPasswordResetUser(
  tenantId: string,
  username: string
): Promise<PasswordResetUser | null> {
  const normalizedUsername = username.trim();
  const localUser = await prisma.userLogin.findFirst({
    where: {
      tenantId,
      username: {
        equals: normalizedUsername,
        mode: "insensitive",
      },
    },
  });

  let fineractUser: Record<string, unknown> | null = null;
  const fineractService = await getFineractServiceWithSystemAuth();

  if (localUser) {
    try {
      fineractUser = (await fineractService.getUser(
        localUser.fineractUserId
      )) as Record<string, unknown>;
    } catch (error) {
      console.warn("Unable to enrich password reset user from Fineract:", error);
    }
  } else {
    const users = await fineractService.getUsers();
    fineractUser =
      users.find(
        (user) =>
          typeof user?.username === "string" &&
          user.username.trim().toLowerCase() === normalizedUsername.toLowerCase()
      ) ?? null;
  }

  if (!localUser && !fineractUser) {
    return null;
  }

  const fineractUserId = localUser?.fineractUserId ?? Number(fineractUser?.id);
  if (!Number.isInteger(fineractUserId) || fineractUserId <= 0) {
    return null;
  }

  const resolvedUsername =
    (typeof fineractUser?.username === "string" && fineractUser.username.trim()) ||
    localUser?.username ||
    normalizedUsername;
  const email =
    normalizeEmail(localUser?.email) ?? normalizeEmail(fineractUser?.email);
  const phone =
    normalizePhone(localUser?.phone) ??
    normalizePhone(fineractUser?.phone) ??
    normalizePhone(fineractUser?.mobileNo);
  const countryCode = localUser?.countryCode ?? null;

  await upsertUserLogin({
    tenantId,
    fineractUserId,
    username: resolvedUsername,
    email,
    phone,
    countryCode,
  });

  return {
    fineractUserId,
    username: resolvedUsername,
    email,
    phone,
    countryCode,
  };
}

async function sendPasswordResetCode(input: {
  tenantId: string;
  tenantName: string;
  username: string;
  code: string;
  targets: DeliveryTarget[];
}) {
  const results = await Promise.all(
    input.targets.map(async (target) => {
      try {
        const delivered =
          target.channel === "sms"
            ? await sendSms(
                [target.destination],
                `Your ${input.tenantName} Loan Matrix password reset code is ${input.code}. It expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes.`,
                { tenantId: input.tenantId, logLabel: "password-reset-sms" }
              )
            : await (async () => {
                const email = buildPasswordResetEmail({
                  tenantName: input.tenantName,
                  username: input.username,
                  code: input.code,
                });
                return sendEmail(
                  [target.destination],
                  email.subject,
                  email.html,
                  {
                    tenantId: input.tenantId,
                    text: email.text,
                    logLabel: "password-reset-email",
                  }
                );
              })();

        return { ...target, delivered };
      } catch (error) {
        console.error(`Failed to send password reset ${target.channel}:`, error);
        return { ...target, delivered: false };
      }
    })
  );

  return {
    deliveredTargets: results.filter((result) => result.delivered),
    deliveredChannels: results
      .filter((result) => result.delivered)
      .map((result) => result.channel),
  };
}

async function getActiveChallenge(tenantId: string, challengeId: string) {
  const challenge = await prisma.passwordResetChallenge.findFirst({
    where: { id: challengeId, tenantId },
  });

  if (!challenge) {
    throw new PasswordResetError("Password reset challenge not found.", 404);
  }

  if (challenge.invalidatedAt || challenge.consumedAt) {
    throw new PasswordResetError(
      "This password reset request is no longer active.",
      410
    );
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new PasswordResetError(
      "This password reset request has expired. Please start again.",
      410
    );
  }

  return challenge;
}

export function validatePassword(password: string) {
  const errors: string[] = [];

  if (password.length < 12) errors.push("Password must be at least 12 characters long");
  if (password.length > 50) errors.push("Password must not exceed 50 characters");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must contain a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must contain a number");
  if (!/[^\w\s]/.test(password)) errors.push("Password must contain a special character");

  return { valid: errors.length === 0, errors };
}

export async function requestPasswordReset(input: {
  tenantId: string;
  tenantName: string;
  tenantSettings: unknown;
  username: string;
  context?: PasswordResetContext;
}) {
  const username = input.username.trim();
  const config = getTenantSelfPasswordResetConfig(input.tenantSettings);

  if (!config.enabled) {
    await writePasswordResetLog({
      tenantId: input.tenantId,
      username,
      event: "DISABLED",
      configuredChannels: config.notificationChannels,
      context: input.context,
    });
    throw new PasswordResetError(PASSWORD_RESET_DISABLED_MESSAGE, 403);
  }

  const user = await findPasswordResetUser(input.tenantId, username);
  if (!user) {
    await writePasswordResetLog({
      tenantId: input.tenantId,
      username,
      event: "UNKNOWN_USER",
      configuredChannels: config.notificationChannels,
      context: input.context,
    });
    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  const targets = getPasswordResetTargets(config, user);
  const maskedDestinations = targets.map((target) =>
    maskDestination(target.channel, target.destination)
  );

  if (targets.length === 0) {
    await writePasswordResetLog({
      tenantId: input.tenantId,
      fineractUserId: user.fineractUserId,
      username: user.username,
      event: "NO_DESTINATION",
      configuredChannels: config.notificationChannels,
      maskedDestinations,
      context: input.context,
    });
    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  await prisma.passwordResetChallenge.updateMany({
    where: {
      tenantId: input.tenantId,
      fineractUserId: user.fineractUserId,
      consumedAt: null,
      invalidatedAt: null,
    },
    data: { invalidatedAt: new Date() },
  });

  const code = generatePasswordResetCode();
  const challenge = await prisma.passwordResetChallenge.create({
    data: {
      tenantId: input.tenantId,
      fineractUserId: user.fineractUserId,
      username: user.username,
      codeHash: "pending",
      configuredChannels: config.notificationChannels,
      maskedDestinations,
      maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
      expiresAt: getExpiryDate(),
    },
  });

  await prisma.passwordResetChallenge.update({
    where: { id: challenge.id },
    data: { codeHash: hashPasswordResetValue(challenge.id, code) },
  });

  await writePasswordResetLog({
    tenantId: input.tenantId,
    challengeId: challenge.id,
    fineractUserId: user.fineractUserId,
    username: user.username,
    event: "REQUESTED",
    configuredChannels: config.notificationChannels,
    maskedDestinations,
    context: input.context,
  });

  const delivery = await sendPasswordResetCode({
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    username: user.username,
    code,
    targets,
  });

  if (delivery.deliveredTargets.length === 0) {
    await prisma.passwordResetChallenge.update({
      where: { id: challenge.id },
      data: { invalidatedAt: new Date() },
    });
    await writePasswordResetLog({
      tenantId: input.tenantId,
      challengeId: challenge.id,
      fineractUserId: user.fineractUserId,
      username: user.username,
      event: "DELIVERY_FAILED",
      configuredChannels: config.notificationChannels,
      maskedDestinations,
      failureReason: "No configured notification channel accepted the reset code.",
      context: input.context,
    });
    throw new PasswordResetError(
      "We could not send a password reset code. Please contact your system administrator.",
      502
    );
  }

  const deliveredTargets = delivery.deliveredTargets;
  await prisma.passwordResetChallenge.update({
    where: { id: challenge.id },
    data: {
      deliveredChannels: delivery.deliveredChannels,
      maskedDestinations: deliveredTargets.map((target) =>
        maskDestination(target.channel, target.destination)
      ),
    },
  });
  await writePasswordResetLog({
    tenantId: input.tenantId,
    challengeId: challenge.id,
    fineractUserId: user.fineractUserId,
    username: user.username,
    event: "CODE_SENT",
    configuredChannels: config.notificationChannels,
    deliveredChannels: delivery.deliveredChannels,
    maskedDestinations: deliveredTargets.map((target) =>
      maskDestination(target.channel, target.destination)
    ),
    context: input.context,
  });

  return {
    challengeId: challenge.id,
    message: PASSWORD_RESET_GENERIC_MESSAGE,
    deliveryDescription: getRequestDescription(deliveredTargets),
    expiresAt: challenge.expiresAt,
  };
}

export async function resendPasswordResetCode(input: {
  tenantId: string;
  tenantName: string;
  tenantSettings: unknown;
  challengeId: string;
  context?: PasswordResetContext;
}) {
  const config = getTenantSelfPasswordResetConfig(input.tenantSettings);
  if (!config.enabled) {
    throw new PasswordResetError(PASSWORD_RESET_DISABLED_MESSAGE, 403);
  }

  const challenge = await getActiveChallenge(input.tenantId, input.challengeId);
  if (challenge.resendCount >= PASSWORD_RESET_MAX_RESENDS) {
    throw new PasswordResetError(
      "Too many resend attempts. Please start the password reset again.",
      429
    );
  }

  const resendAvailableAt = getResendAvailableAt(challenge.lastSentAt);
  if (resendAvailableAt.getTime() > Date.now()) {
    throw new PasswordResetError(
      `Please wait ${Math.ceil(
        (resendAvailableAt.getTime() - Date.now()) / 1000
      )} seconds before requesting another code.`,
      429
    );
  }

  const user = await findPasswordResetUser(input.tenantId, challenge.username);
  if (!user) {
    throw new PasswordResetError("Password reset user could not be resolved.", 404);
  }

  const targets = getPasswordResetTargets(config, user);
  if (targets.length === 0) {
    throw new PasswordResetError(
      "No configured contact is available for this password reset.",
      400
    );
  }

  const code = generatePasswordResetCode();
  const expiresAt = getExpiryDate();
  await prisma.passwordResetChallenge.update({
    where: { id: challenge.id },
    data: {
      codeHash: hashPasswordResetValue(challenge.id, code),
      verificationTokenHash: null,
      verifiedAt: null,
      attempts: 0,
      resendCount: { increment: 1 },
      lastSentAt: new Date(),
      expiresAt,
      configuredChannels: config.notificationChannels,
      deliveredChannels: [],
      maskedDestinations: targets.map((target) =>
        maskDestination(target.channel, target.destination)
      ),
    },
  });

  const delivery = await sendPasswordResetCode({
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    username: challenge.username,
    code,
    targets,
  });

  if (delivery.deliveredTargets.length === 0) {
    await prisma.passwordResetChallenge.update({
      where: { id: challenge.id },
      data: { invalidatedAt: new Date() },
    });
    await writePasswordResetLog({
      tenantId: input.tenantId,
      challengeId: challenge.id,
      fineractUserId: challenge.fineractUserId,
      username: challenge.username,
      event: "RESEND_FAILED",
      configuredChannels: config.notificationChannels,
      failureReason: "No configured notification channel accepted the reset code.",
      context: input.context,
    });
    throw new PasswordResetError(
      "We could not resend the password reset code. Please start again.",
      502
    );
  }

  await prisma.passwordResetChallenge.update({
    where: { id: challenge.id },
    data: {
      deliveredChannels: delivery.deliveredChannels,
      maskedDestinations: delivery.deliveredTargets.map((target) =>
        maskDestination(target.channel, target.destination)
      ),
    },
  });
  await writePasswordResetLog({
    tenantId: input.tenantId,
    challengeId: challenge.id,
    fineractUserId: challenge.fineractUserId,
    username: challenge.username,
    event: "CODE_RESENT",
    configuredChannels: config.notificationChannels,
    deliveredChannels: delivery.deliveredChannels,
    maskedDestinations: delivery.deliveredTargets.map((target) =>
      maskDestination(target.channel, target.destination)
    ),
    context: input.context,
  });

  return {
    message: PASSWORD_RESET_GENERIC_MESSAGE,
    deliveryDescription: getRequestDescription(delivery.deliveredTargets),
    expiresAt,
    resendAvailableAt: getResendAvailableAt(new Date()),
  };
}

export async function verifyPasswordResetCode(input: {
  tenantId: string;
  challengeId: string;
  code: string;
  context?: PasswordResetContext;
}) {
  const challenge = await getActiveChallenge(input.tenantId, input.challengeId);

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new PasswordResetError(
      "Too many incorrect verification attempts. Please start again.",
      429
    );
  }

  const normalizedCode = input.code.trim();
  const expectedHash = hashPasswordResetValue(challenge.id, normalizedCode);
  if (!matchesHash(challenge.codeHash, expectedHash)) {
    const attempts = challenge.attempts + 1;
    const invalidated = attempts >= challenge.maxAttempts;
    await prisma.passwordResetChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts,
        ...(invalidated ? { invalidatedAt: new Date() } : {}),
      },
    });
    await writePasswordResetLog({
      tenantId: input.tenantId,
      challengeId: challenge.id,
      fineractUserId: challenge.fineractUserId,
      username: challenge.username,
      event: invalidated ? "MAX_ATTEMPTS" : "INVALID_CODE",
      configuredChannels: challenge.configuredChannels,
      deliveredChannels: challenge.deliveredChannels,
      maskedDestinations: challenge.maskedDestinations,
      context: input.context,
    });
    throw new PasswordResetError(
      invalidated
        ? "Too many incorrect verification attempts. Please start again."
        : "The verification code you entered is incorrect.",
      invalidated ? 429 : 400
    );
  }

  const verificationToken = generateVerificationToken();
  await prisma.passwordResetChallenge.update({
    where: { id: challenge.id },
    data: {
      verificationTokenHash: hashPasswordResetValue(
        challenge.id,
        verificationToken
      ),
      verifiedAt: new Date(),
    },
  });
  await writePasswordResetLog({
    tenantId: input.tenantId,
    challengeId: challenge.id,
    fineractUserId: challenge.fineractUserId,
    username: challenge.username,
    event: "CODE_VERIFIED",
    configuredChannels: challenge.configuredChannels,
    deliveredChannels: challenge.deliveredChannels,
    maskedDestinations: challenge.maskedDestinations,
    context: input.context,
  });

  return { verificationToken };
}

export async function completePasswordReset(input: {
  tenantId: string;
  challengeId: string;
  verificationToken: string;
  password: string;
  context?: PasswordResetContext;
}) {
  const challenge = await getActiveChallenge(input.tenantId, input.challengeId);

  if (!challenge.verifiedAt || !challenge.verificationTokenHash) {
    throw new PasswordResetError(
      "Verify the password reset code before setting a new password.",
      400
    );
  }

  const expectedHash = hashPasswordResetValue(
    challenge.id,
    input.verificationToken
  );
  if (!matchesHash(challenge.verificationTokenHash, expectedHash)) {
    await writePasswordResetLog({
      tenantId: input.tenantId,
      challengeId: challenge.id,
      fineractUserId: challenge.fineractUserId,
      username: challenge.username,
      event: "INVALID_VERIFICATION_TOKEN",
      configuredChannels: challenge.configuredChannels,
      deliveredChannels: challenge.deliveredChannels,
      maskedDestinations: challenge.maskedDestinations,
      context: input.context,
    });
    throw new PasswordResetError("This password reset verification is invalid.", 400);
  }

  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.valid) {
    throw new PasswordResetError(passwordValidation.errors.join(". "), 400);
  }

  try {
    const fineractService = await getFineractServiceWithSystemAuth();
    await fineractService.updateUserPassword(
      challenge.fineractUserId,
      input.password,
      input.password
    );
  } catch (error) {
    console.error("Fineract password reset failed:", error);
    await writePasswordResetLog({
      tenantId: input.tenantId,
      challengeId: challenge.id,
      fineractUserId: challenge.fineractUserId,
      username: challenge.username,
      event: "PASSWORD_UPDATE_FAILED",
      configuredChannels: challenge.configuredChannels,
      deliveredChannels: challenge.deliveredChannels,
      maskedDestinations: challenge.maskedDestinations,
      failureReason: "Fineract rejected or could not process the password update.",
      context: input.context,
    });
    throw new PasswordResetError(
      "We could not update your password. Please try again or contact your system administrator.",
      502
    );
  }

  await prisma.passwordResetChallenge.update({
    where: { id: challenge.id },
    data: {
      consumedAt: new Date(),
      verificationTokenHash: null,
    },
  });
  await writePasswordResetLog({
    tenantId: input.tenantId,
    challengeId: challenge.id,
    fineractUserId: challenge.fineractUserId,
    username: challenge.username,
    event: "PASSWORD_RESET_COMPLETED",
    configuredChannels: challenge.configuredChannels,
    deliveredChannels: challenge.deliveredChannels,
    maskedDestinations: challenge.maskedDestinations,
    context: input.context,
  });

  return { message: "Password reset successfully. Please sign in with your new password." };
}
