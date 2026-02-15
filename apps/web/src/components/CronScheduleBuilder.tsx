import { Calendar, Clock, Info, Repeat } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type CronScheduleBuilderProps = {
  value: string;
  onChange: (value: string) => void;
};

type Frequency =
  | "every-second"
  | "every-n-seconds"
  | "every-minute"
  | "every-n-minutes"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly";

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

const SECOND_INTERVALS = [
  { value: "2", label: "2 seconds" },
  { value: "5", label: "5 seconds" },
  { value: "10", label: "10 seconds" },
  { value: "15", label: "15 seconds" },
  { value: "30", label: "30 seconds" }
] as const;

function parseCronToState(cron: string): {
  frequency: Frequency;
  second: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  dayOfWeek: string;
  minuteInterval: string;
  secondInterval: string;
} {
  if (!cron) {
    return {
      frequency: "daily",
      second: "0",
      minute: "0",
      hour: "9",
      dayOfMonth: "1",
      dayOfWeek: "1",
      minuteInterval: "5",
      secondInterval: "5"
    };
  }

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) {
    return {
      frequency: "daily",
      second: "0",
      minute: "0",
      hour: "9",
      dayOfMonth: "1",
      dayOfWeek: "1",
      minuteInterval: "5",
      secondInterval: "5"
    };
  }

  const [second, minute, hour, dayOfMonth, month, dayOfWeek] =
    parts.length === 6 ? parts : ["0", ...parts];

  // Every second
  if (
    second === "*" &&
    minute === "*" &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return {
      frequency: "every-second",
      second: "0",
      minute: "0",
      hour: "0",
      dayOfMonth: "1",
      dayOfWeek: "1",
      minuteInterval: "5",
      secondInterval: "5"
    };
  }

  // Every N seconds
  if (
    second?.startsWith("*/") &&
    minute === "*" &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    const secondInterval = second.slice(2);
    return {
      frequency: "every-n-seconds",
      second: "0",
      minute: "0",
      hour: "0",
      dayOfMonth: "1",
      dayOfWeek: "1",
      minuteInterval: "5",
      secondInterval
    };
  }

  // Every minute
  if (
    (second === "0" || second === "*") &&
    minute === "*" &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return {
      frequency: "every-minute",
      second: "0",
      minute: "0",
      hour: "0",
      dayOfMonth: "1",
      dayOfWeek: "1",
      minuteInterval: "5",
      secondInterval: "5"
    };
  }

  // Every N minutes
  if (
    (second === "0" || second === "*") &&
    minute?.startsWith("*/") &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    const minuteInterval = minute.slice(2);
    return {
      frequency: "every-n-minutes",
      second: "0",
      minute: "0",
      hour: "0",
      dayOfMonth: "1",
      dayOfWeek: "1",
      minuteInterval,
      secondInterval: "5"
    };
  }

  // Hourly
  if (
    (second === "0" || second === "*") &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return {
      frequency: "hourly",
      second,
      minute: minute ?? "0",
      hour: "0",
      dayOfMonth: "1",
      dayOfWeek: "1",
      minuteInterval: "5",
      secondInterval: "5"
    };
  }

  // Weekly
  if ((second === "0" || second === "*") && dayOfMonth === "*" && dayOfWeek !== "*") {
    return {
      frequency: "weekly",
      second,
      minute: minute ?? "0",
      hour: hour ?? "9",
      dayOfMonth: "1",
      dayOfWeek: dayOfWeek ?? "1",
      minuteInterval: "5",
      secondInterval: "5"
    };
  }

  // Monthly
  if ((second === "0" || second === "*") && dayOfMonth !== "*" && dayOfWeek === "*") {
    return {
      frequency: "monthly",
      second,
      minute: minute ?? "0",
      hour: hour ?? "9",
      dayOfMonth: dayOfMonth ?? "1",
      dayOfWeek: "1",
      minuteInterval: "5",
      secondInterval: "5"
    };
  }

  // Daily (default)
  return {
    frequency: "daily",
    second,
    minute: minute ?? "0",
    hour: hour ?? "9",
    dayOfMonth: "1",
    dayOfWeek: "1",
    minuteInterval: "5",
    secondInterval: "5"
  };
}

function buildCron(
  frequency: Frequency,
  minute: string,
  hour: string,
  dayOfMonth: string,
  dayOfWeek: string,
  minuteInterval: string,
  secondInterval: string
): string {
  switch (frequency) {
    case "every-second":
      return "* * * * * *";
    case "every-n-seconds":
      return `*/${secondInterval} * * * * *`;
    case "every-minute":
      return "* * * * *";
    case "every-n-minutes":
      return `*/${minuteInterval} * * * *`;
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
  if (parts.length !== 5 && parts.length !== 6) return "Invalid schedule";

  const [second, minute, hour, dayOfMonth, month, dayOfWeek] =
    parts.length === 6 ? parts : ["0", ...parts];

  // Every second
  if (
    second === "*" &&
    minute === "*" &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return "Every second";
  }

  // Every N seconds
  if (
    second?.startsWith("*/") &&
    minute === "*" &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    const n = second.slice(2);
    return `Every ${n} seconds`;
  }

  // Every minute
  if (
    (second === "0" || second === "*") &&
    minute === "*" &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return "Every minute";
  }

  // Every N minutes
  if (
    (second === "0" || second === "*") &&
    minute?.startsWith("*/") &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    const n = minute.slice(2);
    return `Every ${n} minutes`;
  }

  // Hourly
  if (
    (second === "0" || second === "*") &&
    hour === "*" &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    const min = Number.parseInt(minute ?? "0", 10);
    const sec = Number.parseInt(second ?? "0", 10);
    const minStr =
      min === 0 && sec === 0
        ? "on the hour"
        : `at ${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `Every hour ${minStr}`;
  }

  const s = Number.parseInt(second ?? "0", 10);
  const h = Number.parseInt(hour ?? "0", 10);
  const m = Number.parseInt(minute ?? "0", 10);
  const timeStr = formatTime(h, m, s);

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

function formatTime(hour: number, minute: number, second = 0): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, "0");
  const s = second.toString().padStart(2, "0");
  return second > 0 ? `${h}:${m}:${s} ${period}` : `${h}:${m} ${period}`;
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
  const [minuteInterval, setMinuteInterval] = useState(parsed.minuteInterval);
  const [secondInterval, setSecondInterval] = useState(parsed.secondInterval);

  // Sync local state when the external cron value changes (e.g. when editing existing message)
  useEffect(() => {
    const p = parseCronToState(value);
    setFrequency(p.frequency);
    setMinute(p.minute);
    setHour(p.hour);
    setDayOfMonth(p.dayOfMonth);
    setDayOfWeek(p.dayOfWeek);
    setMinuteInterval(p.minuteInterval);
    setSecondInterval(p.secondInterval);
  }, [value]);

  const updateCron = useCallback(
    (
      f: Frequency,
      m: string,
      h: string,
      dom: string,
      dow: string,
      minuteIntv: string,
      secondIntv: string
    ) => {
      const newCron = buildCron(f, m, h, dom, dow, minuteIntv, secondIntv);
      if (newCron !== value) {
        onChange(newCron);
      }
    },
    [onChange, value]
  );

  const handleFrequencyChange = (f: Frequency) => {
    setFrequency(f);
    updateCron(f, minute, hour, dayOfMonth, dayOfWeek, minuteInterval, secondInterval);
  };

  const handleMinuteChange = (m: string) => {
    setMinute(m);
    updateCron(frequency, m, hour, dayOfMonth, dayOfWeek, minuteInterval, secondInterval);
  };

  const handleHourChange = (h: string) => {
    setHour(h);
    updateCron(frequency, minute, h, dayOfMonth, dayOfWeek, minuteInterval, secondInterval);
  };

  const handleDayOfMonthChange = (d: string) => {
    setDayOfMonth(d);
    updateCron(frequency, minute, hour, d, dayOfWeek, minuteInterval, secondInterval);
  };

  const handleDayOfWeekChange = (d: string) => {
    setDayOfWeek(d);
    updateCron(frequency, minute, hour, dayOfMonth, d, minuteInterval, secondInterval);
  };

  const handleMinuteIntervalChange = (intv: string) => {
    setMinuteInterval(intv);
    updateCron(frequency, minute, hour, dayOfMonth, dayOfWeek, intv, secondInterval);
  };

  const handleSecondIntervalChange = (intv: string) => {
    setSecondInterval(intv);
    updateCron(frequency, minute, hour, dayOfMonth, dayOfWeek, minuteInterval, intv);
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
  const showMinuteInterval = frequency === "every-n-minutes";
  const showSecondInterval = frequency === "every-n-seconds";

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
            <SelectItem value="every-second">Every second</SelectItem>
            <SelectItem value="every-n-seconds">Every N seconds</SelectItem>
            <SelectItem value="every-minute">Every minute</SelectItem>
            <SelectItem value="every-n-minutes">Every N minutes</SelectItem>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Interval for every-n-seconds */}
      {showSecondInterval ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Interval</Label>
          <Select value={secondInterval} onValueChange={handleSecondIntervalChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECOND_INTERVALS.map((si) => (
                <SelectItem key={si.value} value={si.value}>
                  Every {si.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Interval for every-n-minutes */}
      {showMinuteInterval ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Interval</Label>
          <Select value={minuteInterval} onValueChange={handleMinuteIntervalChange}>
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
