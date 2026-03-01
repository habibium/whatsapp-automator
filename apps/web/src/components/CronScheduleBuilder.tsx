import { Cron } from "croner";
import cronstrue from "cronstrue";
import { format } from "date-fns";
import { CalendarDays, Clock, Code2, Globe, Info, Repeat, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "./ui/select";
import { Separator } from "./ui/separator";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

// ─── Types ──────────────────────────────────────────────────────────
export type ScheduleValue = {
  scheduleType: "once" | "recurring";
  cronExpression: string | null;
  scheduledAt: string | null;
};

type CronScheduleBuilderProps = {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
  /** Server timezone info e.g. { timezone: "Asia/Dhaka", offset: "GMT+6" } */
  serverTimezone?: { timezone: string; offset: string } | null | undefined;
};

type ScheduleMode = "once" | "recurring";

type Frequency =
  | "every-second"
  | "every-n-seconds"
  | "every-minute"
  | "every-n-minutes"
  | "every-n-hours"
  | "daily"
  | "every-n-days"
  | "weekly"
  | "specific-weekdays"
  | "monthly"
  | "every-n-months";

// ─── Constants ──────────────────────────────────────────────────────
const WEEKDAYS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" }
] as const;

// ─── Cron Builder ───────────────────────────────────────────────────
function buildCron(
  frequency: Frequency,
  minute: string,
  hour: string,
  dayOfMonth: string,
  weekdays: string[],
  intervalN: string
): string {
  const m = minute || "0";
  const h = hour || "9";
  const dom = dayOfMonth || "1";
  const n = intervalN || "2";

  switch (frequency) {
    case "every-second":
      return "* * * * * *";
    case "every-n-seconds":
      return `*/${n} * * * * *`;
    case "every-minute":
      return "* * * * *";
    case "every-n-minutes":
      return `*/${n} * * * *`;
    case "every-n-hours":
      return `${m} */${n} * * *`;
    case "daily":
      return `${m} ${h} * * *`;
    case "every-n-days":
      return `${m} ${h} */${n} * *`;
    case "weekly":
      return `${m} ${h} * * ${weekdays[0] ?? "1"}`;
    case "specific-weekdays": {
      const days = weekdays.length > 0 ? weekdays.sort().join(",") : "1";
      return `${m} ${h} * * ${days}`;
    }
    case "monthly":
      return `${m} ${h} ${dom} * *`;
    case "every-n-months":
      return `${m} ${h} ${dom} */${n} *`;
  }
}

// ─── Cron Parser ────────────────────────────────────────────────────
interface ParsedState {
  scheduleMode: ScheduleMode;
  frequency: Frequency;
  minute: string;
  hour: string;
  dayOfMonth: string;
  weekdays: string[];
  intervalN: string;
  onceDate: Date | undefined;
  onceTime: string;
}

function parseCronToState(cron: string): ParsedState {
  const defaults: ParsedState = {
    scheduleMode: "recurring",
    frequency: "daily",
    minute: "0",
    hour: "9",
    dayOfMonth: "1",
    weekdays: ["1"],
    intervalN: "2",
    onceDate: undefined,
    onceTime: "09:00:00"
  };

  if (!cron) return defaults;

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return defaults;

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
    return { ...defaults, frequency: "every-second" };
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
    return { ...defaults, frequency: "every-n-seconds", intervalN: second.slice(2) };
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
    return { ...defaults, frequency: "every-minute" };
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
    return { ...defaults, frequency: "every-n-minutes", intervalN: minute.slice(2) };
  }

  // Every N hours
  if (
    (second === "0" || second === "*") &&
    hour?.startsWith("*/") &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return {
      ...defaults,
      frequency: "every-n-hours",
      minute: minute ?? "0",
      intervalN: hour.slice(2)
    };
  }

  // Every N days
  if (
    (second === "0" || second === "*") &&
    dayOfMonth?.startsWith("*/") &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return {
      ...defaults,
      frequency: "every-n-days",
      minute: minute ?? "0",
      hour: hour ?? "9",
      intervalN: dayOfMonth.slice(2)
    };
  }

  // Specific weekdays (multiple)
  if (
    (second === "0" || second === "*") &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek !== "*" &&
    dayOfWeek?.includes(",")
  ) {
    return {
      ...defaults,
      frequency: "specific-weekdays",
      minute: minute ?? "0",
      hour: hour ?? "9",
      weekdays: dayOfWeek.split(",").map((d) => d.trim())
    };
  }

  // Weekly (single day)
  if (
    (second === "0" || second === "*") &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek !== "*"
  ) {
    return {
      ...defaults,
      frequency: "weekly",
      minute: minute ?? "0",
      hour: hour ?? "9",
      weekdays: [dayOfWeek]
    };
  }

  // Every N months
  if (
    (second === "0" || second === "*") &&
    dayOfMonth !== "*" &&
    month?.startsWith("*/") &&
    dayOfWeek === "*"
  ) {
    return {
      ...defaults,
      frequency: "every-n-months",
      minute: minute ?? "0",
      hour: hour ?? "9",
      dayOfMonth: dayOfMonth ?? "1",
      intervalN: month.slice(2)
    };
  }

  // Monthly
  if (
    (second === "0" || second === "*") &&
    dayOfMonth !== "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return {
      ...defaults,
      frequency: "monthly",
      minute: minute ?? "0",
      hour: hour ?? "9",
      dayOfMonth: dayOfMonth ?? "1"
    };
  }

  // Daily (default)
  return {
    ...defaults,
    frequency: "daily",
    minute: minute ?? "0",
    hour: hour ?? "9"
  };
}

function parseScheduleValueToState(value: ScheduleValue): ParsedState {
  if (value.scheduleType === "once" && value.scheduledAt) {
    const date = new Date(value.scheduledAt);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return {
      scheduleMode: "once",
      frequency: "daily",
      minute: "0",
      hour: "9",
      dayOfMonth: "1",
      weekdays: ["1"],
      intervalN: "2",
      onceDate: date,
      onceTime: `${h}:${m}:${s}`
    };
  }
  const parsed = parseCronToState(value.cronExpression ?? "");
  return { ...parsed, scheduleMode: "recurring" };
}

// ─── Describe Cron ──────────────────────────────────────────────────
export function describeCron(cron: string): string {
  if (!cron) return "No schedule set";
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return "Invalid schedule";

  try {
    return cronstrue.toString(cron, {
      use24HourTimeFormat: false,
      verbose: true
    });
  } catch {
    return `Runs at: ${cron}`;
  }
}

export function describeSchedule(value: ScheduleValue): string {
  if (value.scheduleType === "once" && value.scheduledAt) {
    const date = new Date(value.scheduledAt);
    return `Once on ${format(date, "PPP 'at' h:mm:ss a")}`;
  }
  return describeCron(value.cronExpression ?? "");
}

// ─── Helpers ────────────────────────────────────────────────────────
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

function isValidCron(cron: string): boolean {
  if (!cron) return false;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return false;
  const pattern = /^(\*|\d+|\*\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*)$/;
  return parts.every((p) => pattern.test(p));
}

function clampN(val: string, min: number, max: number): string {
  const n = Number.parseInt(val, 10);
  if (Number.isNaN(n)) return String(min);
  return String(Math.max(min, Math.min(max, n)));
}

function buildScheduledAt(date: Date | undefined, time: string): string | null {
  if (!date || !time) return null;
  const [hours, minutes, seconds] = time.split(":");
  const h = Number.parseInt(hours ?? "0", 10);
  const m = Number.parseInt(minutes ?? "0", 10);
  const s = Number.parseInt(seconds ?? "0", 10);
  const result = new Date(date);
  result.setHours(h, m, s, 0);
  return result.toISOString();
}

// ─── Sub-Components ─────────────────────────────────────────────────

function DatePicker({
  value,
  onChange
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          {value ? format(value, "PPP") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          className="rounded-lg border"
        />
      </PopoverContent>
    </Popover>
  );
}

function HourSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="flex-1">
        <SelectValue placeholder="Hour" />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 24 }, (_, i) => {
          const period = i >= 12 ? "PM" : "AM";
          const h12 = i % 12 || 12;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static hour list
            <SelectItem key={i} value={String(i)}>
              {h12} {period}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function MinuteSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="flex-1">
        <SelectValue placeholder="Minute" />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 60 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static minute list
          <SelectItem key={i} value={String(i)}>
            :{String(i).padStart(2, "0")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function IntervalInput({
  value,
  onChange,
  unit,
  min = 2,
  max = 60
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Interval</Label>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground shrink-0">Every</span>
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clampN(e.target.value, min, max))}
          className="w-20 text-center"
        />
        <span className="text-sm text-muted-foreground shrink-0">{unit}</span>
      </div>
    </div>
  );
}

function WeekdaySelector({
  value,
  onChange
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        Days
      </Label>
      <ToggleGroup
        type="multiple"
        value={value}
        onValueChange={(val) => {
          if (val.length > 0) onChange(val);
        }}
        className="flex flex-wrap gap-1.5 justify-start"
      >
        {WEEKDAYS.map((day) => (
          <ToggleGroupItem
            key={day.value}
            value={day.value}
            size="sm"
            variant="outline"
            className="h-9 w-12 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
          >
            {day.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function DayOfMonthSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        Day of month
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 31 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static day list
            <SelectItem key={i + 1} value={String(i + 1)}>
              {getOrdinal(i + 1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CronSyntaxReference() {
  return (
    <div className="rounded-lg bg-muted/50 border border-border/50 px-3.5 py-3 space-y-3">
      <p className="text-xs font-medium text-foreground/70">Cron Syntax</p>
      <pre className="text-[11px] leading-relaxed text-muted-foreground font-mono whitespace-pre overflow-x-auto">
        {` ┌────────────── second (optional)
 │ ┌──────────── minute
 │ │ ┌────────── hour
 │ │ │ ┌──────── day of month
 │ │ │ │ ┌────── month
 │ │ │ │ │ ┌──── day of week
 │ │ │ │ │ │
 * * * * * *`}
      </pre>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-1 pr-4 font-medium text-foreground/70">Field</th>
              <th className="text-left py-1 font-medium text-foreground/70">Allowed values</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground font-mono">
            <tr className="border-b border-border/30">
              <td className="py-1 pr-4">second</td>
              <td className="py-1">0-59</td>
            </tr>
            <tr className="border-b border-border/30">
              <td className="py-1 pr-4">minute</td>
              <td className="py-1">0-59</td>
            </tr>
            <tr className="border-b border-border/30">
              <td className="py-1 pr-4">hour</td>
              <td className="py-1">0-23</td>
            </tr>
            <tr className="border-b border-border/30">
              <td className="py-1 pr-4">day of month</td>
              <td className="py-1">1-31</td>
            </tr>
            <tr className="border-b border-border/30">
              <td className="py-1 pr-4">month</td>
              <td className="py-1">1-12 (or names)</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">day of week</td>
              <td className="py-1">0-7 (or names, 0 or 7 are sunday)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Grouped Frequency Select ───────────────────────────────────────
function FrequencySelect({
  value,
  onChange
}: {
  value: Frequency;
  onChange: (v: Frequency) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Frequency)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Seconds</SelectLabel>
          <SelectItem value="every-second">Every second</SelectItem>
          <SelectItem value="every-n-seconds">Every N seconds</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Minutes</SelectLabel>
          <SelectItem value="every-minute">Every minute</SelectItem>
          <SelectItem value="every-n-minutes">Every N minutes</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Hours</SelectLabel>
          <SelectItem value="every-n-hours">Every N hours</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Days</SelectLabel>
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="every-n-days">Every N days</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Weeks</SelectLabel>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="specific-weekdays">Specific days of week</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Months</SelectLabel>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="every-n-months">Every N months</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function CronScheduleBuilder({ value, onChange, serverTimezone }: CronScheduleBuilderProps) {
  const parsed = useMemo(() => parseScheduleValueToState(value), [value]);

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(parsed.scheduleMode);
  const [manualMode, setManualMode] = useState(false);
  const [manualCron, setManualCron] = useState(value.cronExpression ?? "");

  // Once mode
  const [onceDate, setOnceDate] = useState<Date | undefined>(parsed.onceDate);
  const [onceTime, setOnceTime] = useState(parsed.onceTime);

  // Recurring mode
  const [frequency, setFrequency] = useState<Frequency>(parsed.frequency);
  const [minute, setMinute] = useState(parsed.minute);
  const [hour, setHour] = useState(parsed.hour);
  const [dayOfMonth, setDayOfMonth] = useState(parsed.dayOfMonth);
  const [weekdays, setWeekdays] = useState<string[]>(parsed.weekdays);
  const [intervalN, setIntervalN] = useState(parsed.intervalN);

  // Sync from external value changes (edit mode)
  useEffect(() => {
    const p = parseScheduleValueToState(value);
    setScheduleMode(p.scheduleMode);
    setFrequency(p.frequency);
    setMinute(p.minute);
    setHour(p.hour);
    setDayOfMonth(p.dayOfMonth);
    setWeekdays(p.weekdays);
    setIntervalN(p.intervalN);
    setOnceDate(p.onceDate);
    setOnceTime(p.onceTime);
    setManualCron(value.cronExpression ?? "");
  }, [value]);

  const emitOnce = useCallback(
    (date: Date | undefined, time: string) => {
      const scheduledAt = buildScheduledAt(date, time);
      if (scheduledAt) {
        onChange({ scheduleType: "once", cronExpression: null, scheduledAt });
      }
    },
    [onChange]
  );

  const emitRecurring = useCallback(
    (f: Frequency, m: string, h: string, dom: string, wd: string[], n: string) => {
      const cronExpr = buildCron(f, m, h, dom, wd, n);
      onChange({ scheduleType: "recurring", cronExpression: cronExpr, scheduledAt: null });
    },
    [onChange]
  );

  // ── Handlers ──
  const handleScheduleMode = (mode: ScheduleMode) => {
    setScheduleMode(mode);
    setManualMode(false);
    if (mode === "once") {
      const d = onceDate || new Date();
      const t = onceTime || "09:00:00";
      setOnceDate(d);
      setOnceTime(t);
      emitOnce(d, t);
    } else {
      emitRecurring(frequency, minute, hour, dayOfMonth, weekdays, intervalN);
    }
  };

  const handleFrequency = (f: Frequency) => {
    setFrequency(f);
    emitRecurring(f, minute, hour, dayOfMonth, weekdays, intervalN);
  };

  const handleMinute = (m: string) => {
    setMinute(m);
    emitRecurring(frequency, m, hour, dayOfMonth, weekdays, intervalN);
  };

  const handleHour = (h: string) => {
    setHour(h);
    emitRecurring(frequency, minute, h, dayOfMonth, weekdays, intervalN);
  };

  const handleDayOfMonth = (d: string) => {
    setDayOfMonth(d);
    emitRecurring(frequency, minute, hour, d, weekdays, intervalN);
  };

  const handleWeekdays = (wd: string[]) => {
    setWeekdays(wd);
    emitRecurring(frequency, minute, hour, dayOfMonth, wd, intervalN);
  };

  const handleIntervalN = (n: string) => {
    setIntervalN(n);
    emitRecurring(frequency, minute, hour, dayOfMonth, weekdays, n);
  };

  const handleOnceDate = (d: Date | undefined) => {
    setOnceDate(d);
    emitOnce(d, onceTime);
  };

  const handleOnceTime = (t: string) => {
    setOnceTime(t);
    emitOnce(onceDate, t);
  };

  const handleManualCron = (c: string) => {
    setManualCron(c);
    if (isValidCron(c)) {
      onChange({ scheduleType: "recurring", cronExpression: c, scheduledAt: null });
    }
  };

  // ── Visibility flags ──
  const showTime = [
    "every-n-hours",
    "daily",
    "every-n-days",
    "weekly",
    "specific-weekdays",
    "monthly",
    "every-n-months"
  ].includes(frequency);
  const showHour = [
    "daily",
    "every-n-days",
    "weekly",
    "specific-weekdays",
    "monthly",
    "every-n-months"
  ].includes(frequency);
  const showIntervalN = [
    "every-n-seconds",
    "every-n-minutes",
    "every-n-hours",
    "every-n-days",
    "every-n-months"
  ].includes(frequency);
  const showWeekdays = frequency === "specific-weekdays";
  const showWeekdaySingle = frequency === "weekly";
  const showDayOfMonth = frequency === "monthly" || frequency === "every-n-months";

  const intervalUnit: Record<string, string> = {
    "every-n-seconds": "seconds",
    "every-n-minutes": "minutes",
    "every-n-hours": "hours",
    "every-n-days": "days",
    "every-n-months": "months"
  };

  const intervalMax: Record<string, number> = {
    "every-n-seconds": 59,
    "every-n-minutes": 59,
    "every-n-hours": 23,
    "every-n-days": 31,
    "every-n-months": 12
  };

  const description =
    value.scheduleType === "once"
      ? value.scheduledAt
        ? `Once on ${format(new Date(value.scheduledAt), "PPP 'at' h:mm:ss a")}`
        : "No date selected"
      : describeCron(value.cronExpression ?? "");

  const manualValid = isValidCron(manualCron);

  const nextRuns = useMemo(() => {
    if (value.scheduleType === "once") {
      if (!value.scheduledAt) return [];
      const date = new Date(value.scheduledAt);
      return date.getTime() > Date.now() ? [date] : [];
    }
    if (!value.cronExpression) return [];
    try {
      const opts = serverTimezone?.timezone ? { timezone: serverTimezone.timezone } : undefined;
      const job = new Cron(value.cronExpression, opts);
      return job.nextRuns(3);
    } catch {
      return [];
    }
  }, [value, serverTimezone?.timezone]);

  const tzLabel = serverTimezone ? `${serverTimezone.timezone} (${serverTimezone.offset})` : null;

  return (
    <div className="space-y-5">
      {/* ── Mode Toggle: Once / Recurring ── */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Schedule type</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={scheduleMode === "once" ? "default" : "outline"}
            size="sm"
            onClick={() => handleScheduleMode("once")}
            className="flex-1"
          >
            <Timer className="size-4" />
            Once
          </Button>
          <Button
            type="button"
            variant={scheduleMode === "recurring" ? "default" : "outline"}
            size="sm"
            onClick={() => handleScheduleMode("recurring")}
            className="flex-1"
          >
            <Repeat className="size-4" />
            Recurring
          </Button>
        </div>
      </div>

      {/* ── Once Mode ── */}
      {scheduleMode === "once" && !manualMode && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Date
            </Label>
            <DatePicker value={onceDate} onChange={handleOnceDate} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Time
            </Label>
            <Input
              type="time"
              step="1"
              value={onceTime}
              onChange={(e) => handleOnceTime(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* ── Recurring Mode ── */}
      {scheduleMode === "recurring" && !manualMode && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              Frequency
            </Label>
            <FrequencySelect value={frequency} onChange={handleFrequency} />
          </div>

          {showIntervalN && (
            <IntervalInput
              value={intervalN}
              onChange={handleIntervalN}
              unit={intervalUnit[frequency] ?? ""}
              min={1}
              max={intervalMax[frequency] ?? 60}
            />
          )}

          {showTime && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {showHour ? "Time" : "At minute"}
              </Label>
              <div className="flex gap-2">
                {showHour && <HourSelect value={hour} onChange={handleHour} />}
                <MinuteSelect value={minute} onChange={handleMinute} />
              </div>
            </div>
          )}

          {showWeekdaySingle && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Day of week
              </Label>
              <Select value={weekdays[0] ?? "1"} onValueChange={(v) => handleWeekdays([v])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {getDayName(day.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showWeekdays && <WeekdaySelector value={weekdays} onChange={handleWeekdays} />}

          {showDayOfMonth && <DayOfMonthSelect value={dayOfMonth} onChange={handleDayOfMonth} />}
        </div>
      )}

      {/* ── Manual Cron Mode (only for recurring) ── */}
      {manualMode && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              Cron expression
            </Label>
            <Input
              type="text"
              value={manualCron}
              onChange={(e) => handleManualCron(e.target.value)}
              placeholder="* * * * *"
              className={cn(
                "font-mono text-sm",
                manualCron && !manualValid && "border-destructive focus-visible:ring-destructive/50"
              )}
              spellCheck={false}
            />
          </div>
          <CronSyntaxReference />
        </div>
      )}

      <Separator />

      {/* ── Manual Toggle (only show for recurring mode) ── */}
      {scheduleMode === "recurring" && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setManualMode(!manualMode);
              if (!manualMode) {
                setManualCron(value.cronExpression ?? "");
              } else {
                const p = parseCronToState(manualCron || value.cronExpression || "");
                setFrequency(p.frequency);
                setMinute(p.minute);
                setHour(p.hour);
                setDayOfMonth(p.dayOfMonth);
                setWeekdays(p.weekdays);
                setIntervalN(p.intervalN);
              }
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="h-3.5 w-3.5" />
            {manualMode ? "Use visual builder" : "Enter cron manually"}
          </button>

          {manualMode && manualCron && (
            <span
              className={cn(
                "text-xs font-medium",
                manualValid ? "text-primary" : "text-destructive"
              )}
            >
              {manualValid ? "Valid" : "Invalid"}
            </span>
          )}
        </div>
      )}

      {/* ── Description with server timezone ── */}
      <div className="flex items-start gap-2.5 rounded-lg bg-muted/50 border border-border/50 px-3.5 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-sm text-foreground/80">{description}</p>
          {tzLabel && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {tzLabel}
            </p>
          )}
          {nextRuns.length > 0 && (
            <div className="mt-1.5 border-t border-border/40 pt-2 space-y-1">
              {value.scheduleType === "once" ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Scheduled run</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {nextRuns.map((date) => (
                      <li key={date.toISOString()} className="flex items-center gap-1.5">
                        <span className="size-1 rounded-full bg-primary/50" />
                        {format(date, "EEE, MMM d, yyyy 'at' h:mm:ss a")}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground/60 italic">
                    Message will be sent once and then auto-disabled
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-muted-foreground">
                    Upcoming runs <span className="font-normal opacity-70">(preview)</span>
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {nextRuns.map((date) => (
                      <li key={date.toISOString()} className="flex items-center gap-1.5">
                        <span className="size-1 rounded-full bg-primary/50" />
                        {format(date, "EEE, MMM d, yyyy 'at' h:mm:ss a")}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground/60 italic">
                    Schedule continues indefinitely while enabled
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
