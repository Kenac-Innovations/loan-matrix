// Background job initialization — this module starts on server boot (see
// instrumentation.ts).
//
// There is no RabbitMQ (or any other message broker) used by this app
// anymore. Both background flows that used to run through AMQP consumers
// now work by polling Postgres:
//
// - Bulk repayments (Collections): loan-matrix-be polls BulkRepaymentItem
//   directly for QUEUED rows and posts to Fineract itself — see
//   zw.co.kenac.loanmatrixbe.bulkrepayments. Nothing to start here.
// - USSD loan applications: loan-matrix-be still consumes
//   ussdloanapplications.queue (see
//   zw.co.kenac.loanmatrixbe.ussdloans.service.UssdLoanApplicationListener)
//   and inserts rows here, but the auto-lead-creation /
//   CDE-decisioning / auto-disbursement pipeline is Next.js-only business
//   logic that stayed here — see lib/ussd-auto-processing-poller.ts. This
//   module just runs that poller on an interval.

import { pollUssdAutoProcessing } from "./ussd-auto-processing-poller";

declare global {
  var __ussdAutoProcessingPollerStarted: boolean | undefined;
}

const POLL_INTERVAL_MS = 5000;

const pollersDisabled =
  process.env.DISABLE_QUEUE_CONSUMERS === "true" ||
  process.env.DISABLE_QUEUE_CONSUMERS === "1";

if (pollersDisabled) {
  console.log("Background pollers disabled via DISABLE_QUEUE_CONSUMERS");
}

if (
  !pollersDisabled &&
  process.env.NODE_ENV !== "test" &&
  !global.__ussdAutoProcessingPollerStarted
) {
  global.__ussdAutoProcessingPollerStarted = true;

  console.log(
    `USSD auto-processing poller started (every ${POLL_INTERVAL_MS}ms)`
  );
  setInterval(() => {
    pollUssdAutoProcessing().catch((error) => {
      console.error("USSD auto-processing poll tick failed:", error);
    });
  }, POLL_INTERVAL_MS);
}
