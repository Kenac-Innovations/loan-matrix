import { format, isValid, parseISO } from "date-fns";
import { z } from "zod";

const MIN_ORGANIZATION_DATE = "2000-01-01";
const MAX_ORGANIZATION_DATE = "2100-01-01";

function isIsoCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
}

const calendarDate = z
  .string()
  .trim()
  .refine(isIsoCalendarDate, "Enter a valid calendar date.")
  .refine(
    (value) => value >= MIN_ORGANIZATION_DATE && value <= MAX_ORGANIZATION_DATE,
    `Enter a date between ${MIN_ORGANIZATION_DATE} and ${MAX_ORGANIZATION_DATE}.`,
  );

const nonEmptyName = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(100, "Name must be 100 characters or fewer.");

export const officeInputSchema = z.object({
  name: nonEmptyName,
  parentId: z.coerce.number().int().positive("Select a parent office."),
  openingDate: calendarDate,
  externalId: z
    .string()
    .trim()
    .max(100, "External ID must be 100 characters or fewer.")
    .optional()
    .default(""),
});

export const officeUpdateInputSchema = z.object({
  name: nonEmptyName,
  parentId: z.coerce.number().int().positive().optional(),
  openingDate: calendarDate,
  externalId: z
    .string()
    .trim()
    .max(100, "External ID must be 100 characters or fewer.")
    .optional()
    .default(""),
});

const repaymentRescheduleDate = calendarDate.optional().or(z.literal(""));

export const holidayCreateInputSchema = z
  .object({
    name: nonEmptyName,
    description: z
      .string()
      .trim()
      .max(500, "Description must be 500 characters or fewer.")
      .optional()
      .default(""),
    fromDate: calendarDate,
    toDate: calendarDate,
    reschedulingType: z.coerce
      .number()
      .int()
      .positive("Select a repayment scheduling type."),
    repaymentsRescheduledTo: repaymentRescheduleDate,
    officeIds: z
      .array(z.coerce.number().int().positive())
      .min(1, "Select at least one applicable office."),
  })
  .superRefine((value, context) => {
    if (value.toDate < value.fromDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toDate"],
        message: "End date cannot be before the start date.",
      });
    }

    if (value.reschedulingType === 2 && !value.repaymentsRescheduledTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repaymentsRescheduledTo"],
        message: "Choose the date to reschedule repayments to.",
      });
    }
  });

export const holidayUpdateInputSchema = z
  .object({
    name: nonEmptyName,
    description: z
      .string()
      .trim()
      .max(500, "Description must be 500 characters or fewer.")
      .optional()
      .default(""),
    fromDate: calendarDate.optional(),
    toDate: calendarDate.optional(),
    reschedulingType: z.coerce.number().int().positive().optional(),
    repaymentsRescheduledTo: repaymentRescheduleDate,
  })
  .superRefine((value, context) => {
    const hasScheduleFields =
      value.fromDate !== undefined ||
      value.toDate !== undefined ||
      value.reschedulingType !== undefined;

    if (
      hasScheduleFields &&
      (!value.fromDate || !value.toDate || !value.reschedulingType)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fromDate"],
        message: "Complete the holiday dates and repayment scheduling type.",
      });
      return;
    }

    if (value.fromDate && value.toDate && value.toDate < value.fromDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toDate"],
        message: "End date cannot be before the start date.",
      });
    }

    if (value.reschedulingType === 2 && !value.repaymentsRescheduledTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repaymentsRescheduledTo"],
        message: "Choose the date to reschedule repayments to.",
      });
    }
  });

export type OfficeInput = z.infer<typeof officeInputSchema>;
export type OfficeUpdateInput = z.infer<typeof officeUpdateInputSchema>;
export type HolidayCreateInput = z.infer<typeof holidayCreateInputSchema>;
export type HolidayUpdateInput = z.infer<typeof holidayUpdateInputSchema>;

export function formatOrganizationDateForFineract(value: string) {
  return format(parseISO(value), "dd MMMM yyyy");
}

export function toFineractOfficePayload(input: OfficeInput) {
  return {
    name: input.name.trim(),
    parentId: input.parentId,
    openingDate: formatOrganizationDateForFineract(input.openingDate),
    externalId: input.externalId?.trim() ?? "",
    dateFormat: "dd MMMM yyyy",
    locale: "en",
  };
}

export function toFineractOfficeUpdatePayload(input: OfficeUpdateInput) {
  return {
    name: input.name.trim(),
    ...(input.parentId ? { parentId: input.parentId } : {}),
    openingDate: formatOrganizationDateForFineract(input.openingDate),
    externalId: input.externalId?.trim() ?? "",
    dateFormat: "dd MMMM yyyy",
    locale: "en",
  };
}

export function toFineractHolidayCreatePayload(input: HolidayCreateInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    fromDate: formatOrganizationDateForFineract(input.fromDate),
    toDate: formatOrganizationDateForFineract(input.toDate),
    reschedulingType: input.reschedulingType,
    ...(input.reschedulingType === 2 && input.repaymentsRescheduledTo
      ? {
          repaymentsRescheduledTo: formatOrganizationDateForFineract(
            input.repaymentsRescheduledTo,
          ),
        }
      : {}),
    offices: input.officeIds.map((officeId) => ({ officeId })),
    dateFormat: "dd MMMM yyyy",
    locale: "en",
  };
}

export function toFineractHolidayUpdatePayload(input: HolidayUpdateInput) {
  const hasScheduleFields = Boolean(
    input.fromDate && input.toDate && input.reschedulingType,
  );

  return {
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    ...(hasScheduleFields
      ? {
          fromDate: formatOrganizationDateForFineract(input.fromDate!),
          toDate: formatOrganizationDateForFineract(input.toDate!),
          reschedulingType: input.reschedulingType,
          ...(input.reschedulingType === 2 && input.repaymentsRescheduledTo
            ? {
                repaymentsRescheduledTo: formatOrganizationDateForFineract(
                  input.repaymentsRescheduledTo,
                ),
              }
            : {}),
        }
      : {}),
    dateFormat: "dd MMMM yyyy",
    locale: "en",
  };
}

export function validationErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message || "Please review the entered details.";
}
