"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, endOfDay, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";

interface UssdDateRangeFilterProps {
  startDate?: string;
  endDate?: string;
  isAllDates?: boolean;
}

function toDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toDateParam(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

export function UssdDateRangeFilter({
  startDate,
  endDate,
  isAllDates = false,
}: UssdDateRangeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const selectedRange = useMemo(() => {
    if (isAllDates) {
      return undefined;
    }

    const from = toDate(startDate);
    const to = toDate(endDate);

    if (!from) {
      return undefined;
    }

    return {
      from,
      to: to || from,
    };
  }, [endDate, isAllDates, startDate]);

  const label = useMemo(() => {
    if (isAllDates) {
      return "All dates";
    }

    const from = toDate(startDate);
    const to = toDate(endDate);

    if (!from) {
      return "Select dates";
    }

    if (!to || toDateParam(from) === toDateParam(to)) {
      return format(from, "MMM d, yyyy");
    }

    return `${format(from, "MMM d, yyyy")} - ${format(to, "MMM d, yyyy")}`;
  }, [endDate, isAllDates, startDate]);

  const updateQuery = (params: URLSearchParams) => {
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  const setDateRange = (from: Date, to: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.set("startDate", toDateParam(startOfDay(from)));
    params.set("endDate", toDateParam(endOfDay(to)));
    updateQuery(params);
  };

  const setAllDates = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("startDate");
    params.delete("endDate");
    params.set("range", "all");
    updateQuery(params);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal min-w-[220px]",
            !selectedRange && !isAllDates && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={selectedRange?.from ?? new Date()}
          selected={selectedRange}
          onSelect={(range) => {
            if (range?.from) {
              setDateRange(range.from, range.to || range.from);
            }
          }}
          numberOfMonths={isMobile ? 1 : 2}
        />
        <div className="flex flex-wrap gap-2 border-t p-3">
          <Button variant="outline" size="sm" onClick={setAllDates}>
            All dates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              setDateRange(today, today);
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const weekAgo = new Date(today);
              weekAgo.setDate(today.getDate() - 7);
              setDateRange(weekAgo, today);
            }}
          >
            Last 7 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const monthStart = new Date(
                today.getFullYear(),
                today.getMonth(),
                1
              );
              setDateRange(monthStart, today);
            }}
          >
            This month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
