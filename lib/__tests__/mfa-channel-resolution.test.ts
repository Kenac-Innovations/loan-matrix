import assert from "node:assert/strict";
import test from "node:test";

test("defaults MFA channels to email when tenant settings do not configure channels", () => {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/loan_matrix";

  return import("../mfa").then(({ getTenantMfaConfig }) => {
  assert.deepEqual(
    getTenantMfaConfig({ features: { usesMFA: true } }).channels,
    ["email"]
  );

  assert.deepEqual(
    getTenantMfaConfig({ features: { usesMFA: true, mfaChannels: [] } }).channels,
    ["email"]
  );
  });
});

test("builds MFA delivery targets only for configured channels with destinations", async () => {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/loan_matrix";

  const { resolveMfaDeliveryTargets } = await import("../mfa");

  assert.deepEqual(
    resolveMfaDeliveryTargets({
      configuredChannels: ["sms", "email"],
      destinations: {
        sms: "+260971234567",
        email: "user@example.com",
      },
    }),
    [
      { channel: "sms", destination: "+260971234567" },
      { channel: "email", destination: "user@example.com" },
    ]
  );

  assert.deepEqual(
    resolveMfaDeliveryTargets({
      configuredChannels: ["sms"],
      destinations: {
        sms: "+260971234567",
        email: "user@example.com",
      },
    }),
    [{ channel: "sms", destination: "+260971234567" }]
  );

  assert.deepEqual(
    resolveMfaDeliveryTargets({
      configuredChannels: ["email"],
      destinations: {
        sms: "+260971234567",
        email: null,
      },
    }),
    []
  );
});

test("sends MFA challenge messages to every target and counts successful deliveries", async () => {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/loan_matrix";

  const { sendMfaChallengeMessages } = await import("../mfa");
  const calls: Array<{ channel: string; destination: string; code: string }> = [];

  const result = await sendMfaChallengeMessages({
    tenantId: "tenant-1",
    username: "alice",
    code: "123456",
    targets: [
      { channel: "sms", destination: "+260971234567" },
      { channel: "email", destination: "user@example.com" },
    ],
    sendMessage: async ({ channel, destination, code }) => {
      calls.push({ channel, destination, code });
      return channel === "email";
    },
  });

  assert.deepEqual(calls, [
    { channel: "sms", destination: "+260971234567", code: "123456" },
    { channel: "email", destination: "user@example.com", code: "123456" },
  ]);
  assert.equal(result.successfulDeliveries, 1);
  assert.deepEqual(result.deliveredChannels, ["email"]);
});

test("builds a branded MFA email template with tenant name, logo, prominent OTP, and security copy", async () => {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/loan_matrix";
  process.env.NEXTAUTH_URL = "https://app.kenacloanmatrix.com";

  const { buildMfaChallengeEmail } = await import("../mfa");

  const email = buildMfaChallengeEmail({
    tenantName: "Goodfellow",
    username: "alice",
    code: "123456",
  });

  assert.equal(email.subject, "Goodfellow Loan Matrix verification code");
  assert.match(email.html, /Goodfellow Loan Matrix/);
  assert.match(email.html, /https:\/\/app\.kenacloanmatrix\.com\/kenac_logo\.png/);
  assert.match(email.html, /123456/);
  assert.match(email.html, /letter-spacing:\s*0\.28em/);
  assert.match(email.html, /font-size:\s*32px/);
  assert.match(email.html, /This code expires in 10 minutes/);
  assert.match(email.html, /Kenac will never ask for this code/);
  assert.match(email.text, /Goodfellow Loan Matrix/);
  assert.match(email.text, /123456/);
});
