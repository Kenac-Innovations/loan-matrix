import assert from "node:assert/strict";
import test from "node:test";

test("sendEmail posts the notification service email payload contract", async (t) => {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/loan_matrix";
  const previousNotificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL;
  const previousEmailNotificationServiceUrl =
    process.env.EMAIL_NOTIFICATION_SERVICE_URL;
  const previousMfaEmailFrom = process.env.MFA_EMAIL_FROM;

  t.after(() => {
    if (previousNotificationServiceUrl === undefined) {
      delete process.env.NOTIFICATION_SERVICE_URL;
    } else {
      process.env.NOTIFICATION_SERVICE_URL = previousNotificationServiceUrl;
    }

    if (previousEmailNotificationServiceUrl === undefined) {
      delete process.env.EMAIL_NOTIFICATION_SERVICE_URL;
    } else {
      process.env.EMAIL_NOTIFICATION_SERVICE_URL =
        previousEmailNotificationServiceUrl;
    }

    if (previousMfaEmailFrom === undefined) {
      delete process.env.MFA_EMAIL_FROM;
    } else {
      process.env.MFA_EMAIL_FROM = previousMfaEmailFrom;
    }
  });

  process.env.NOTIFICATION_SERVICE_URL = "https://notifications.example.test";
  delete process.env.EMAIL_NOTIFICATION_SERVICE_URL;
  delete process.env.MFA_EMAIL_FROM;

  const { sendEmail } = await import("../notification-service");
  let requestBody: Record<string, unknown> | null = null;

  t.mock.method(globalThis, "fetch", async (_url, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });

  const delivered = await sendEmail(
    [" borrower@example.com "],
    "Verification code",
    "<strong>123456</strong>",
    { text: "123456" }
  );

  assert.equal(delivered, true);
  assert.deepEqual(requestBody?.to, ["borrower@example.com"]);
  assert.equal(requestBody?.subject, "Verification code");
  assert.equal(requestBody?.body, "<strong>123456</strong>");
});
