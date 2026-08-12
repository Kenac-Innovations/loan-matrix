import assert from "node:assert/strict";
import test from "node:test";

import {
  getRequiredPaymentServiceCallbackUrl,
  resolvePaymentServiceCallbackUrl,
} from "../payment-service-callback-url";

function withCallbackEnv(
  env: {
    PAYMENT_SERVICE_CALLBACK_URL?: string | undefined;
    CDE_DISBURSEMENT_CALLBACK_URL?: string | undefined;
  },
  run: () => void
) {
  const previousPaymentServiceCallbackUrl =
    process.env.PAYMENT_SERVICE_CALLBACK_URL;
  const previousCdeDisbursementCallbackUrl =
    process.env.CDE_DISBURSEMENT_CALLBACK_URL;

  if (env.PAYMENT_SERVICE_CALLBACK_URL === undefined) {
    delete process.env.PAYMENT_SERVICE_CALLBACK_URL;
  } else {
    process.env.PAYMENT_SERVICE_CALLBACK_URL =
      env.PAYMENT_SERVICE_CALLBACK_URL;
  }

  if (env.CDE_DISBURSEMENT_CALLBACK_URL === undefined) {
    delete process.env.CDE_DISBURSEMENT_CALLBACK_URL;
  } else {
    process.env.CDE_DISBURSEMENT_CALLBACK_URL =
      env.CDE_DISBURSEMENT_CALLBACK_URL;
  }

  try {
    run();
  } finally {
    if (previousPaymentServiceCallbackUrl === undefined) {
      delete process.env.PAYMENT_SERVICE_CALLBACK_URL;
    } else {
      process.env.PAYMENT_SERVICE_CALLBACK_URL =
        previousPaymentServiceCallbackUrl;
    }

    if (previousCdeDisbursementCallbackUrl === undefined) {
      delete process.env.CDE_DISBURSEMENT_CALLBACK_URL;
    } else {
      process.env.CDE_DISBURSEMENT_CALLBACK_URL =
        previousCdeDisbursementCallbackUrl;
    }
  }
}

test("resolvePaymentServiceCallbackUrl prefers PAYMENT_SERVICE_CALLBACK_URL", () => {
  withCallbackEnv(
    {
      PAYMENT_SERVICE_CALLBACK_URL: "  https://callback.example/primary  ",
      CDE_DISBURSEMENT_CALLBACK_URL: "https://callback.example/fallback",
    },
    () => {
      assert.equal(
        resolvePaymentServiceCallbackUrl(),
        "https://callback.example/primary"
      );
    }
  );
});

test("resolvePaymentServiceCallbackUrl falls back to CDE_DISBURSEMENT_CALLBACK_URL", () => {
  withCallbackEnv(
    {
      PAYMENT_SERVICE_CALLBACK_URL: undefined,
      CDE_DISBURSEMENT_CALLBACK_URL: "  https://callback.example/fallback  ",
    },
    () => {
      assert.equal(
        resolvePaymentServiceCallbackUrl(),
        "https://callback.example/fallback"
      );
    }
  );
});

test("getRequiredPaymentServiceCallbackUrl throws when callback env vars are missing", () => {
  withCallbackEnv(
    {
      PAYMENT_SERVICE_CALLBACK_URL: undefined,
      CDE_DISBURSEMENT_CALLBACK_URL: undefined,
    },
    () => {
      assert.throws(() => getRequiredPaymentServiceCallbackUrl(), {
        message:
          "PAYMENT_SERVICE_CALLBACK_URL or CDE_DISBURSEMENT_CALLBACK_URL is required for Yango USSD disbursements",
      });
    }
  );
});
