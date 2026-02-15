import { Calendar, Clock, Info, Repeat } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type CronScheduleBuilderProps = {
  value: string;
  onChange: (value: string) => void;
};

type Frequency = "every-minute" | "every-n-minutes" | "hourly" | "daily" | "weekly" | "monthly";

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" }
] as const;

const MINUTE_INTERVALS = [
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "20", label: "20 minutes" },
  { value: "30", label: "30 minutes" }
] as const;

function parseCronToState(cron: string): {
  frequency: Frequency;
  minute: string;
  hour: string;
  dayOfMonth: string;
  dayOfWeek: string;
  interval: string;
} {
  if (!cron) {
    return {
      frequency: "daily",
      minute: "0",
      hour: "9",
      dayOfMonth: "1",
      dayOfWeek: "1",
      interval: "5"
    };
  }
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      frequency: "daily",
      minute: "0",
      hour: "9",
      dayOfMonth: "1",
      dayOfWeek: "1",
      interval: "5"
    };
  }

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  // Every minute
  if (minute === "*" && hour === "*" && dayOfMonth === "*" && dayOfWeek === "*") {
    return {
      frequency: "every-minute",
      minute: "0",
      hour: "0",
      dayOfMonth: "1",
      dayOfWeek: "1",
      interval: "5"
    };
  }

  // Every N minutes
  if (minute?.startsWith("*/") && hour === "*") {
    const interval = minute.slice(2);
    return {
      frequency: "every-n-minutes",
      minute: "0",
      hour: "0",
      dayOfMonth: "1",
      dayOfWeek: "1",
      interval
    };
  }

  // Hourly
  if (hour === "*" && dayOfMonth === "*" && dayOfWeek === "*") {
    return {
      frequency: "hourly",
      minute: minute ?? "0",
      hour: "0",
      dayOfMonth: "1",
      dayOfWeek: "1",
      interval: "5"
    };
  }

  // Weekly
  if (dayOfMonth === "*" && dayOfWeek !== "*") {
    return {
      frequency: "weekly",
      minute: minute ?? "0",
      hour: hour ?? "9",
      dayOfMonth: "1",
      dayOfWeek: dayOfWeek ?? "1",
      interval: "5"
    };
  }

  // Monthly
  if (dayOfMonth !== "*" && dayOfWeek === "*") {
    return {
      frequency: "monthly",
      minute: minute ?? "0",
      hour: hour ?? "9",
      dayOfMonth: dayOfMonth ?? "1",
      dayOfWeek: "1",
      interval: "5"
    };
  }

  // Daily (default)
  return {
    frequency: "daily",
    minute: minute ?? "0",
    hour: hour ?? "9",
    dayOfMonth: "1",
    dayOfWeek: "1",
    interval: "5"
  };
}

function buildCron(
  frequency: Frequency,
  minute: string,
  hour: string,
  dayOfMonth: string,
  dayOfWeek: string,
  interval: string
): string {
  switch (frequency) {
    case "every-minute":
      return "* * * * *";
    case "every-n-minutes":
      return `*/${interval} * * * *`;
    case "hourly":
      return `${minute} * * * *`;
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case "monthly":
      return `${minute} ${hour} ${dayOfMonth} * *`;
  }
}

/** Describe a cron expression in plain English */
export function describeCron(cron: string): string {
  if (!cron) return "No schedule set";
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid schedule";

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Every minute
  if (minute === "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "Every minute";
  }

  // Every N minutes
  if (minute?.startsWith("*/") && hour === "*") {
    const n = minute.slice(2);
    return `Every ${n} minutes`;
  }

  // Hourly
  if (hour === "*" && dayOfMonth === "*" && dayOfWeek === "*") {
    const min = Number.parseInt(minute ?? "0", 10);
    const minStr = min === 0 ? "on the hour" : `at ${min} minute${min !== 1 ? "s" : ""} past`;
    return `Every hour ${minStr}`;
  }

  const h = Number.parseInt(hour ?? "0", 10);
  const m = Number.parseInt(minute ?? "0", 10);
  const timeStr = formatTime(h, m);

  // Weekly
  if (dayOfMonth === "*" && dayOfWeek !== "*" && month === "*") {
    const dayName = getDayName(dayOfWeek ?? "0");
    // Handle day ranges
    if (dayOfWeek?.includes("-")) {
      const [start, end] = dayOfWeek.split("-");
      const startName = getDayName(start ?? "0");
      const endName = getDayName(end ?? "0");
      return `${startName} through ${endName} at ${timeStr}`;
    }
    // Handle multiple days
    if (dayOfWeek?.includes(",")) {
      const days = dayOfWeek.split(",").map((d) => getDayName(d.trim()));
      return `Every ${days.join(", ")} at ${timeStr}`;
    }
    return `Every ${dayName} at ${timeStr}`;
  }

  // Monthly
  if (dayOfMonth !== "*" && dayOfWeek === "*" && month === "*") {
    const day = Number.parseInt(dayOfMonth ?? "1", 10);
    const ordinal = getOrdinal(day);
    return `Monthly on the ${ordinal} at ${timeStr}`;
  }

  // Daily
  if (dayOfMonth === "*" && dayOfWeek === "*" && month === "*") {
    return `Every day at ${timeStr}`;
  }

  return `Runs at: ${cron}`;
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m} ${period}`;
}

function getDayName(day: string): string {
  const names: Record<string, string> = {
    "0": "Sunday",
    "1": "Monday",
    "2": "Tuesday",
    "3": "Wednesday",
    "4": "Thursday",
    "5": "Friday",
    "6": "Saturday",
    "7": "Sunday"
  };
  return names[day] ?? day;
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function CronScheduleBuilder({ value, onChange }: CronScheduleBuilderProps) {
  const parsed = useMemo(() => parseCronToState(value), [value]);

  const [frequency, setFrequency] = useState<Frequency>(parsed.frequency);
  const [minute, setMinute] = useState(parsed.minute);
  const [hour, setHour] = useState(parsed.hour);
  const [dayOfMonth, setDayOfMonth] = useState(parsed.dayOfMonth);
  const [dayOfWeek, setDayOfWeek] = useState(parsed.dayOfWeek);
  const [interval, setInterval] = useState(parsed.interval);

  // Sync local state when the external cron value changes (e.g. when editing existing message)
  useEffect(() => {
    const p = parseCronToState(value);
    setFrequency(p.frequency);
    setMinute(p.minute);
    setHour(p.hour);
    setDayOfMonth(p.dayOfMonth);
    setDayOfWeek(p.dayOfWeek);
    setInterval(p.interval);
  }, [value]);

  const updateCron = useCallback(
    (f: Frequency, m: string, h: string, dom: string, dow: string, intv: string) => {
      const newCron = buildCron(f, m, h, dom, dow, intv);
      if (newCron !== value) {
        onChange(newCron);
      }
    },
    [onChange, value]
  );

  const handleFrequencyChange = (f: Frequency) => {
    setFrequency(f);
    updateCron(f, minute, hour, dayOfMonth, dayOfWeek, interval);
  };

  const handleMinuteChange = (m: string) => {
    setMinute(m);
    updateCron(frequency, m, hour, dayOfMonth, dayOfWeek, interval);
  };

  const handleHourChange = (h: string) => {
    setHour(h);
    updateCron(frequency, minute, h, dayOfMonth, dayOfWeek, interval);
  };

  const handleDayOfMonthChange = (d: string) => {
    setDayOfMonth(d);
    updateCron(frequency, minute, hour, d, dayOfWeek, interval);
  };

  const handleDayOfWeekChange = (d: string) => {
    setDayOfWeek(d);
    updateCron(frequency, minute, hour, dayOfMonth, d, interval);
  };

  const handleIntervalChange = (intv: string) => {
    setInterval(intv);
    updateCron(frequency, minute, hour, dayOfMonth, dayOfWeek, intv);
  };

  const description = describeCron(value);

  const showMinute =
    frequency === "hourly" ||
    frequency === "daily" ||
    frequency === "weekly" ||
    frequency === "monthly";
  const showHour = frequency === "daily" || frequency === "weekly" || frequency === "monthly";
  const showDayOfWeek = frequency === "weekly";
  const showDayOfMonth = frequency === "monthly";
  const showInterval = frequency === "every-n-minutes";

  return (
    <div className="space-y-4">
      {/* Frequency selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          Frequency
        </Label>
        <Select value={frequency} onValueChange={(v) => handleFrequencyChange(v as Frequency)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="every-minute">Every minute</SelectItem>
            <SelectItem value="every-n-minutes">Every N minutes</SelectItem>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Interval for every-n-minutes */}
      {showInterval ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Interval</Label>
          <Select value={interval} onValueChange={handleIntervalChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTE_INTERVALS.map((mi) => (
                <SelectItem key={mi.value} value={mi.value}>
                  Every {mi.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Time selectors */}
      {showMinute || showHour ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Time
          </Label>
          <div className="flex gap-2">
            {showHour ? (
              <Select value={hour} onValueChange={handleHourChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => {
                    const period = i >= 12 ? "PM" : "AM";
                    const h12 = i % 12 || 12;
                    const val = String(i);
                    return (
                      <SelectItem key={val} value={val}>
                        {h12} {period}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : null}
            {showMinute ? (
              <Select value={minute} onValueChange={handleMinuteChange}>
                <SelectTrigger className={showHour ? "flex-1" : "w-full"}>
                  <SelectValue placeholder="Minute" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 60 }, (_, i) => {
                    const val = String(i);
                    return (
                      <SelectItem key={val} value={val}>
                        :{i.toString().padStart(2, "0")}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Day of week */}
      {showDayOfWeek ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Day of week
          </Label>
          <Select value={dayOfWeek} onValueChange={handleDayOfWeekChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map((day) => (
                <SelectItem key={day.value} value={day.value}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Day of month */}
      {showDayOfMonth ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Day of month
          </Label>
          <Select value={dayOfMonth} onValueChange={handleDayOfMonthChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => {
                const val = String(i + 1);
                return (
                  <SelectItem key={val} value={val}>
                    {getOrdinal(i + 1)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Plain-English description */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border/50 px-3 py-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm text-foreground/80">{description}</p>
      </div>
    </div>
  );
}
