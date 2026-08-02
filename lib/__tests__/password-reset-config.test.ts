import assert from "node:assert/strict";
import test from "node:test";

test("password reset configuration defaults to disabled", async () => {
  const { getTenantSelfPasswordResetConfig } = await import(
    "../../shared/types/tenant"
  );

  assert.deepEqual(getTenantSelfPasswordResetConfig(null), {
    enabled: false,
    notificationChannels: [],
  });
  assert.deepEqual(getTenantSelfPasswordResetConfig({}), {
    enabled: false,
    notificationChannels: [],
  });
});

test("password reset configuration accepts the canonical configuration keys", async () => {
  const { getTenantSelfPasswordResetConfig } = await import(
    "../../shared/types/tenant"
  );

  assert.deepEqual(
    getTenantSelfPasswordResetConfig({
      selfPasswordReset: {
        enabled: true,
        notificationChannels: ["sms", "email", "invalid", "sms"],
      },
    }),
    {
      enabled: true,
      notificationChannels: ["sms", "email"],
    }
  );

  assert.deepEqual(getTenantSelfPasswordResetConfig({
    wrongPasswordReset: {
      enabled: true,
      notificationChannels: ["email"],
    },
  }), {
    enabled: false,
    notificationChannels: [],
  });
});

test("password reset password policy rejects weak passwords", async () => {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/loan_matrix";
  const { validatePassword } = await import("../password-reset");

  assert.equal(validatePassword("short").valid, false);
  assert.equal(
    validatePassword("Very-Strong-123!").valid,
    true
  );
  assert.equal(validatePassword("Strong password-123!").valid, false);
  assert.equal(validatePassword("Strong-password-123!!").valid, false);
});

test("login remember-me control remains commented out", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = readFileSync(
    resolve(process.cwd(), "app/auth/login/page.tsx"),
    "utf8"
  );

  assert.match(source, /Remember me is temporarily disabled/);
  assert.match(source, /id="remember"/);
});
