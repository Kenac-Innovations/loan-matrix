export type FineractHoliday = {
  id?: number;
  name?: string;
  fromDate?: number[];
  toDate?: number[];
  status?: {
    id?: number;
    code?: string;
    value?: string;
  };
};

export type FineractWorkingDays = {
  id?: number;
  recurrence?: string;
};

export type FineractBusinessCalendar = {
  officeId: number;
  holidays: FineractHoliday[];
  workingDays: FineractWorkingDays | null;
};

type BusinessCalendarRules = {
  holidayDateKeys: Set<string>;
  workingDayIndexes: Set<number> | null;
  isDisabled: (date: Date) => boolean;
};

const BYDAY_TO_DAY_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalDate(parts?: number[]) {
  if (!parts || parts.length < 3) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

function getActiveHolidays(holidays: FineractHoliday[]) {
  return holidays.filter((holiday) => {
    const statusCode = holiday.status?.code?.toLowerCase() || "";
    const statusValue = holiday.status?.value?.toLowerCase() || "";
    return statusCode.includes("active") || statusValue === "active";
  });
}

function buildHolidayDateKeys(holidays: FineractHoliday[]) {
  const holidayDateKeys = new Set<string>();

  for (const holiday of getActiveHolidays(holidays)) {
    const startDate = toLocalDate(holiday.fromDate);
    const endDate = toLocalDate(holiday.toDate) ?? startDate;

    if (!startDate || !endDate) continue;

    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);

    const inclusiveEndDate = new Date(endDate);
    inclusiveEndDate.setHours(0, 0, 0, 0);

    while (cursor <= inclusiveEndDate) {
      holidayDateKeys.add(formatLocalDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return holidayDateKeys;
}

function parseWorkingDayIndexes(recurrence?: string) {
  if (!recurrence) return null;

  const byDayMatch = recurrence.match(/BYDAY=([^;]+)/i);
  if (!byDayMatch?.[1]) return null;

  const codes = byDayMatch[1]
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  if (!codes.length) return null;

  const indexes = new Set<number>();
  for (const code of codes) {
    const dayIndex = BYDAY_TO_DAY_INDEX[code];
    if (dayIndex !== undefined) {
      indexes.add(dayIndex);
    }
  }

  return indexes.size ? indexes : null;
}

export function buildFineractBusinessCalendarRules(
  calendar?: FineractBusinessCalendar | null
): BusinessCalendarRules {
  const holidayDateKeys = buildHolidayDateKeys(calendar?.holidays || []);
  const workingDayIndexes = parseWorkingDayIndexes(
    calendar?.workingDays?.recurrence
  );

  return {
    holidayDateKeys,
    workingDayIndexes,
    isDisabled(date: Date) {
      if (holidayDateKeys.has(formatLocalDateKey(date))) {
        return true;
      }

      if (workingDayIndexes && !workingDayIndexes.has(date.getDay())) {
        return true;
      }

      return false;
    },
  };
}
